import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { creem } from "@creem_io/better-auth";
import { magicLink } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import {
  CreditTransType,
  creditService,
} from "@/services/credit";
import {
  getProductById,
  getProductExpiryDays,
} from "@/config/credits";

import { db, users } from "@/db";
import * as schema from "@/db/schema";
import { env } from "./env.mjs";
import { eq } from "drizzle-orm";

const toLogString = (value: unknown) => {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return value;
  const normalized =
    value instanceof Error
      ? {
        name: value.name,
        message: value.message,
        stack: value.stack,
        status: (value as unknown as Record<string, unknown>).status,
        statusText: (value as unknown as Record<string, unknown>).statusText,
        error: (value as unknown as Record<string, unknown>).error,
      }
      : value;
  const seen = new WeakSet();
  try {
    return JSON.stringify(normalized, (_key, val) => {
      if (typeof val === "bigint") return val.toString();
      if (typeof val === "function") return "[Function]";
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      return val;
    });
  } catch {
    return String(normalized);
  }
};

const debugLogger =
  process.env.NODE_ENV === "development"
    ? {
      level: "debug" as const,
      log: (level: "debug" | "info" | "warn" | "error", message: string, ...args: unknown[]) => {
        const suffix = args.length ? ` ${args.map(toLogString).join(" ")}` : "";
        const line = `[Better Auth] ${message}${suffix}`.trimEnd();
        if (level === "error") console.error(line);
        else if (level === "warn") console.warn(line);
        else console.log(line);
      },
    }
    : undefined;

type AuthPlugin =
  | ReturnType<typeof nextCookies>
  | ReturnType<typeof magicLink>
  | ReturnType<typeof creem>;

const plugins: AuthPlugin[] = [
  // Avoid Next.js dev DataCloneError from cookies() in some environments.
  ...(process.env.NODE_ENV === "development" ? [] : [nextCookies()]),
];

if (env.RESEND_API_KEY && env.RESEND_FROM) {
  const resendFrom = env.RESEND_FROM;
  plugins.push(magicLink({
    sendMagicLink: async ({ email, url }) => {
      // Dev/test only: print the magic-link URL to the server console instead
      // of emailing it. Unreachable in production builds (NODE_ENV check).
      if (
        process.env.NODE_ENV !== "production" &&
        process.env.AUTH_DEV_LOG_MAGIC_LINK === "true"
      ) {
        console.info(`[dev-magic-link] ${email} ${url}`);
        return;
      }

      // RESEND_FROM must be a Resend-verified address (set via
      // `wrangler secret put RESEND_FROM --name dreamutopia-video-preview`).
      // Never commit the value. Use plain HTML (no react-email render) so
      // OpenNext Workers cannot fail during JSX email rendering.
      try {
        const { Resend } = await import("resend");
        const { siteConfig } = await import("@/config/site");
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          throw new Error("RESEND_API_KEY is not set on the Worker");
        }
        const resend = new Resend(apiKey);

        const [existingUser] = await db
          .select({ name: users.name, emailVerified: users.emailVerified })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        const userVerified = !!existingUser?.emailVerified;
        const siteName = (siteConfig as { name: string }).name;
        const { buildMagicLinkEmail, isChineseLink } = await import("@/lib/emails/magic-link-html");
        const message = buildMagicLinkEmail({
          url,
          siteName,
          name: existingUser?.name,
          verified: userVerified,
          zh: isChineseLink(url),
        });

        const { error: sendError, data: sendData } = await resend.emails.send({
          from: resendFrom,
          to: email,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: {
            "X-Entity-Ref-ID": String(Date.now()),
          },
        });
        if (sendError) {
          const fromDomain = resendFrom.includes("@")
            ? resendFrom.split("@").pop()
            : "(unknown)";
          const detail = [
            sendError.name,
            (sendError as { message?: string }).message,
            (sendError as { statusCode?: number }).statusCode,
          ]
            .filter(Boolean)
            .join(" | ");
          console.error(
            "Failed to send magic link email:",
            detail,
            "fromDomain=",
            fromDomain,
          );
          throw new Error(
            `Resend send failed (${detail || "error"}). Verify RESEND_FROM domain in Resend (from domain: ${fromDomain}).`,
          );
        }
        console.info("Magic link email sent:", sendData?.id ?? "ok");
      } catch (error) {
        console.error("Failed to send magic link email:", error);
        throw error;
      }
    },
    expiresIn: 300, // 5 minutes
  }));
}

if (env.CREEM_API_KEY) {
  plugins.push(
    creem({
      apiKey: env.CREEM_API_KEY,
      webhookSecret: env.CREEM_WEBHOOK_SECRET,
      testMode: process.env.NODE_ENV !== "production",
      persistSubscriptions: true,
      defaultSuccessUrl: "/dashboard",

      onGrantAccess: async ({ product, customer, metadata }) => {
        console.log(`[Creem] onGrantAccess called`, {
          productId: product?.id,
          productName: product?.name,
          metadata,
        });

        const productConfig = getProductById(product.id);
        if (!productConfig) {
          console.error(`[Creem] Unknown product: ${product.id}`);
          return;
        }

        const credits = productConfig.credits;
        if (credits <= 0) return;

        // 从 metadata 获取用户 ID（Creem 插件在 checkout 时自动设置 referenceId）
        const meta = (metadata ?? {}) as Record<string, unknown>;
        const userId = meta.referenceId as string | undefined;

        if (!userId) {
          console.error(`[Creem] No referenceId in metadata, cannot process subscription`);
          return;
        }

        // 获取订阅 ID 用于防止重复处理
        const subscriptionId =
          typeof meta.subscriptionId === "string"
            ? meta.subscriptionId
            : (customer as { id?: string })?.id;

        const orderNo = subscriptionId
          ? `creem_sub_${subscriptionId}`
          : `creem_${productConfig.type}_${userId}_${Date.now()}`;

        const transType =
          productConfig.type === "subscription"
            ? CreditTransType.SUBSCRIPTION
            : CreditTransType.ORDER_PAY;

        const productName = product?.name ?? productConfig.id;

        console.log(`[Creem] Processing subscription: ${productName}, credits: ${credits}, userId: ${userId}`);

        const recharge = await creditService.recharge({
          userId,
          credits,
          orderNo,
          transType,
          expiryDays: getProductExpiryDays(productConfig),
          remark: `Creem payment: ${productName}`,
        });
        if (!recharge.created) {
          console.log(`[Creem] Duplicate webhook ignored: ${orderNo}`);
          return;
        }

        console.log(`[Creem] Subscription processed: ${orderNo}`);
      },

      onRevokeAccess: async ({ customer, product }) => {
        console.log("Creem access revoked:", { customer, product });
      },

      // 处理一次性购买（checkout.completed 事件不触发 onGrantAccess）
      onCheckoutCompleted: async (checkoutData) => {
        // 只处理一次性购买（onetime）
        // billing_type 可能是 "onetime" 或 "one-time" 取决于 API 版本
        const productType = checkoutData.product?.billing_type as string;
        if (productType !== "onetime" && productType !== "one-time") {
          console.log(`[Creem] Skipping checkout.completed for subscription product`);
          return;
        }

        const product = checkoutData.product;
        const productConfig = getProductById(product.id);
        if (!productConfig) {
          console.error(`[Creem] Unknown product in checkout: ${product.id}`);
          return;
        }

        const credits = productConfig.credits;
        if (credits <= 0) return;

        // 从 metadata 获取用户 ID
        const referenceId = checkoutData.metadata?.referenceId as string | undefined;
        if (!referenceId) {
          console.error(`[Creem] No referenceId in checkout metadata`);
          return;
        }

        // 使用 order ID 作为唯一标识
        const orderId = typeof checkoutData.order === "object"
          ? checkoutData.order?.id
          : checkoutData.order;
        const orderNo = orderId
          ? `creem_${orderId}`
          : `creem_onetime_${referenceId}_${Date.now()}`;

        const productName = product?.name ?? productConfig.id;

        console.log(`[Creem] Processing one-time purchase: ${productName}, credits: ${credits}, userId: ${referenceId}`);

        const recharge = await creditService.recharge({
          userId: referenceId,
          credits,
          orderNo,
          transType: CreditTransType.ORDER_PAY,
          expiryDays: getProductExpiryDays(productConfig),
          remark: `Creem payment: ${productName}`,
        });
        if (!recharge.created) {
          console.log(`[Creem] Duplicate checkout ignored: ${orderNo}`);
          return;
        }

        console.log(`[Creem] One-time purchase completed: ${orderNo}`);
      },
    })
  );
}

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  baseURL: env.BETTER_AUTH_URL ?? env.APP_URL ?? env.NEXT_PUBLIC_APP_URL,
  trustedOrigins: [
    ...new Set(
      [
        env.NEXT_PUBLIC_APP_URL,
        "https://aivd-preview.pages.dev",
        "https://dreamutopia-video.pages.dev",
      ].filter((origin): origin is string => Boolean(origin)),
    ),
  ],
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  logger: debugLogger,
  onAPIError: {
    errorURL: "/login",
  },

  // Drizzle adapter with schema for Better Auth
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  // Plugins
  plugins,

  // Hooks - 自动赠送新用户积分（仅在注册时触发）
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // 只要有新 session 创建（注册或登录），都尝试检查并发放新用户积分
      // grantNewUserCredits 内部有幂等性检查，只会发放一次
      // 这样可以覆盖 Email 注册、OAuth 注册等所有场景
      const newSession = ctx.context?.newSession;
      if (newSession?.user?.id) {
        try {
          // 不等待这个操作，避免阻塞登录/注册响应（虽然它是异步的，但 await 会阻塞中间件链）
          // 但作为 after hook，最好还是 await 确保执行完成，反正数据库查询很快
          await creditService.grantNewUserCredits(newSession.user.id);
        } catch (error) {
          console.error("[Auth] Failed to grant new user credits:", error);
          // 不抛出错误，避免影响用户登录
        }
      }
    }),
  },

  // Google OAuth
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            prompt: "select_account", // Always show account picker
          },
        }
      : {},

  // Custom user fields
  user: {
    additionalFields: {
      isAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false, // Prevent users from setting this
      },
      isSuperAccount: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false, // Granted only through trusted database/admin tooling
      },
    },
  },

  // Session configuration
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
});

// Extend user type with additional fields
export type User = typeof auth.$Infer.Session.user & {
  isAdmin?: boolean | null;
  isSuperAccount?: boolean | null;
};

// Session type with extended user
type BaseSession = typeof auth.$Infer.Session;
export type Session = {
  session: BaseSession["session"];
  user: User;
};
