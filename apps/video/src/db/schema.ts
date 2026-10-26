import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const subscriptionPlans = ["FREE", "PRO", "BUSINESS"] as const;
const clusterStatuses = [
  "PENDING",
  "CREATING",
  "INITING",
  "RUNNING",
  "STOPPED",
  "DELETED",
] as const;
const creditTransTypes = [
  "NEW_USER",
  "ORDER_PAY",
  "SUBSCRIPTION",
  "VIDEO_CONSUME",
  "REFUND",
  "EXPIRED",
  "SYSTEM_ADJUST",
] as const;
const creditPackageStatuses = ["ACTIVE", "DEPLETED", "EXPIRED"] as const;
const videoStatuses = [
  "PENDING",
  "GENERATING",
  "UPLOADING",
  "COMPLETED",
  "FAILED",
] as const;

const timestamp = (name: string) => integer(name, { mode: "timestamp" });
const boolean = (name: string) => integer(name, { mode: "boolean" });
const uuid = (name: string) =>
  text(name)
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const customers = sqliteTable(
  "Customer",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authUserId: text("authUserId").notNull(),
    name: text("name"),
    plan: text("plan", { enum: subscriptionPlans }),
    stripeCustomerId: text("stripeCustomerId").unique(),
    stripeSubscriptionId: text("stripeSubscriptionId").unique(),
    stripePriceId: text("stripePriceId"),
    stripeCurrentPeriodEnd: timestamp("stripeCurrentPeriodEnd"),
    createdAt: timestamp("createdAt").default(sql`(unixepoch())`).notNull(),
    updatedAt: timestamp("updatedAt").default(sql`(unixepoch())`).notNull(),
  },
  (table) => [index("Customer_authUserId_idx").on(table.authUserId)]
);

export const users = sqliteTable("user", {
  id: uuid("id"),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt").default(sql`(unixepoch())`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`(unixepoch())`).notNull(),
  isAdmin: boolean("isAdmin").default(false).notNull(),
  isSuperAccount: boolean("isSuperAccount").default(false).notNull(),
  isBanned: boolean("isBanned").default(false).notNull(),
  banReason: text("banReason"),
  bannedAt: timestamp("bannedAt"),
});

export const adminAuditLogs = sqliteTable(
  "admin_audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    targetUserId: text("target_user_id"),
    details: text("details", { mode: "json" }).$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").default(sql`(unixepoch())`).notNull(),
  },
  (table) => [
    index("admin_audit_log_actor_idx").on(table.actor),
    index("admin_audit_log_target_user_id_idx").on(table.targetUserId),
    index("admin_audit_log_created_at_idx").on(table.createdAt),
  ]
);

export const creemSubscriptions = sqliteTable(
  "creem_subscriptions",
  {
    id: uuid("id"),
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    subscriptionId: text("subscription_id").notNull().unique(),
    status: text("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end"),
    createdAt: timestamp("created_at").default(sql`(unixepoch())`).notNull(),
    updatedAt: timestamp("updated_at").default(sql`(unixepoch())`).notNull(),
  },
  (table) => [index("creem_subscriptions_user_id_idx").on(table.userId)]
);

export const sessions = sqliteTable(
  "session",
  {
    id: uuid("id"),
    userId: text("userId").notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").default(sql`(unixepoch())`).notNull(),
    updatedAt: timestamp("updatedAt").default(sql`(unixepoch())`).notNull(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
);

export const accounts = sqliteTable(
  "account",
  {
    id: uuid("id"),
    userId: text("userId").notNull(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
    scope: text("scope"),
    idToken: text("idToken"),
    password: text("password"),
    createdAt: timestamp("createdAt").default(sql`(unixepoch())`).notNull(),
    updatedAt: timestamp("updatedAt").default(sql`(unixepoch())`).notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_id_idx").on(
      table.providerId,
      table.accountId
    ),
  ]
);

export const verifications = sqliteTable("verification", {
  id: uuid("id"),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").default(sql`(unixepoch())`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`(unixepoch())`).notNull(),
});

export const k8sClusterConfigs = sqliteTable(
  "K8sClusterConfig",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    location: text("location").notNull(),
    authUserId: text("authUserId").notNull(),
    plan: text("plan", { enum: subscriptionPlans }).default("FREE"),
    network: text("network"),
    createdAt: timestamp("createdAt").default(sql`(unixepoch())`).notNull(),
    updatedAt: timestamp("updatedAt").default(sql`(unixepoch())`).notNull(),
    status: text("status", { enum: clusterStatuses }).default("PENDING"),
    delete: boolean("delete").default(false),
  },
  (table) => [
    index("K8sClusterConfig_authUserId_idx").on(table.authUserId),
  ]
);

export const creditPackages = sqliteTable(
  "credit_packages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    initialCredits: integer("initial_credits").notNull(),
    remainingCredits: integer("remaining_credits").notNull(),
    frozenCredits: integer("frozen_credits").default(0).notNull(),
    transType: text("trans_type", { enum: creditTransTypes }).notNull(),
    orderNo: text("order_no"),
    status: text("status", { enum: creditPackageStatuses })
      .default("ACTIVE")
      .notNull(),
    expiredAt: timestamp("expired_at"),
    createdAt: timestamp("created_at").default(sql`(unixepoch())`).notNull(),
    updatedAt: timestamp("updated_at").default(sql`(unixepoch())`).notNull(),
  },
  (table) => [
    index("credit_packages_user_id_status_idx").on(
      table.userId,
      table.status
    ),
    index("credit_packages_user_id_expired_at_idx").on(
      table.userId,
      table.expiredAt
    ),
    uniqueIndex("credit_packages_order_no_unique").on(table.orderNo),
    check(
      "credit_packages_remaining_nonnegative",
      sql`${table.remainingCredits} >= 0`
    ),
    check(
      "credit_packages_frozen_nonnegative",
      sql`${table.frozenCredits} >= 0`
    ),
  ]
);

export const creditHolds = sqliteTable(
  "credit_holds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    videoUuid: text("video_uuid").notNull().unique(),
    credits: integer("credits").notNull(),
    status: text("status").default("HOLDING").notNull(),
    packageAllocation: text("package_allocation", { mode: "json" })
      .$type<Array<{ packageId: number; credits: number }>>()
      .notNull(),
    packageId: integer("package_id"),
    createdAt: timestamp("created_at").default(sql`(unixepoch())`).notNull(),
    settledAt: timestamp("settled_at"),
  },
  (table) => [
    index("credit_holds_user_id_idx").on(table.userId),
    index("credit_holds_status_idx").on(table.status),
    index("credit_holds_package_id_idx").on(table.packageId),
  ]
);

export const creditTransactions = sqliteTable(
  "credit_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    transNo: text("trans_no").notNull().unique(),
    userId: text("user_id").notNull(),
    transType: text("trans_type", { enum: creditTransTypes }).notNull(),
    credits: integer("credits").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    packageId: integer("package_id"),
    videoUuid: text("video_uuid"),
    orderNo: text("order_no"),
    holdId: integer("hold_id"),
    remark: text("remark"),
    createdAt: timestamp("created_at").default(sql`(unixepoch())`).notNull(),
  },
  (table) => [
    index("credit_transactions_user_id_idx").on(table.userId),
    index("credit_transactions_trans_type_idx").on(table.transType),
    index("credit_transactions_created_at_idx").on(table.createdAt),
    uniqueIndex("credit_transactions_order_no_unique").on(table.orderNo),
    uniqueIndex("credit_transactions_hold_id_unique").on(table.holdId),
  ]
);

export const stripeWebhookEvents = sqliteTable(
  "stripe_webhook_events",
  {
    eventId: text("event_id").primaryKey(),
    type: text("type").notNull(),
    livemode: boolean("livemode").default(false).notNull(),
    result: text("result"),
    createdAt: timestamp("created_at").default(sql`(unixepoch())`).notNull(),
  },
  (table) => [index("stripe_webhook_events_type_idx").on(table.type)]
);

export const videos = sqliteTable(
  "videos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").notNull().unique(),
    userId: text("user_id").notNull(),
    prompt: text("prompt").notNull(),
    model: text("model").notNull(),
    parameters: text("parameters", { mode: "json" })
      .$type<Record<string, unknown> | null>(),
    idempotencyKey: text("idempotency_key"),
    status: text("status", { enum: videoStatuses })
      .default("PENDING")
      .notNull(),
    provider: text("provider"),
    externalTaskId: text("external_task_id"),
    errorMessage: text("error_message"),
    startImageUrl: text("start_image_url"),
    originalVideoUrl: text("original_video_url"),
    videoUrl: text("video_url"),
    thumbnailUrl: text("thumbnail_url"),
    duration: integer("duration"),
    resolution: text("resolution"),
    aspectRatio: text("aspect_ratio"),
    fileSize: integer("file_size"),
    creditsUsed: integer("credits_used").default(0).notNull(),
    createdAt: timestamp("created_at").default(sql`(unixepoch())`).notNull(),
    updatedAt: timestamp("updated_at").default(sql`(unixepoch())`).notNull(),
    completedAt: timestamp("completed_at"),
    generationTime: integer("generation_time"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    visibility: text("visibility").default("private").notNull(),
    publishedAt: timestamp("published_at"),
    galleryTitle: text("gallery_title"),
    galleryDescription: text("gallery_description"),
    publicPrompt: text("public_prompt"),
    promptProtected: boolean("prompt_protected").default(false).notNull(),
    assetsReusable: boolean("assets_reusable").default(false).notNull(),
  },
  (table) => [
    index("videos_user_id_idx").on(table.userId),
    index("videos_status_idx").on(table.status),
    index("videos_created_at_idx").on(table.createdAt),
    index("videos_visibility_published_idx").on(
      table.visibility,
      table.publishedAt
    ),
    uniqueIndex("videos_user_id_idempotency_key_unique").on(
      table.userId,
      table.idempotencyKey
    ),
  ]
);

export type Customer = typeof customers.$inferSelect;
export type BetterAuthUser = typeof users.$inferSelect;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type CreditPackage = typeof creditPackages.$inferSelect;
export type CreditHold = typeof creditHolds.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type Video = typeof videos.$inferSelect;

export const SubscriptionPlan = {
  FREE: "FREE",
  PRO: "PRO",
  BUSINESS: "BUSINESS",
} as const;
export type SubscriptionPlan =
  (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

export const CreditTransType = {
  NEW_USER: "NEW_USER",
  ORDER_PAY: "ORDER_PAY",
  SUBSCRIPTION: "SUBSCRIPTION",
  VIDEO_CONSUME: "VIDEO_CONSUME",
  REFUND: "REFUND",
  EXPIRED: "EXPIRED",
  SYSTEM_ADJUST: "SYSTEM_ADJUST",
} as const;
export type CreditTransType =
  (typeof CreditTransType)[keyof typeof CreditTransType];

export const CreditPackageStatus = {
  ACTIVE: "ACTIVE",
  DEPLETED: "DEPLETED",
  EXPIRED: "EXPIRED",
} as const;
export type CreditPackageStatus =
  (typeof CreditPackageStatus)[keyof typeof CreditPackageStatus];

export const VideoStatus = {
  PENDING: "PENDING",
  GENERATING: "GENERATING",
  UPLOADING: "UPLOADING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type VideoStatus = (typeof VideoStatus)[keyof typeof VideoStatus];

