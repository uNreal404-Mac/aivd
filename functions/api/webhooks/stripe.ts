import { json, hasDb, type Env } from "../../../libs/utils";
import { applyPaidPack, isSchemaError, saveStripeCustomerId } from "../../../libs/account";
import { hasStripeWebhook, packFromMetadata, verifyStripeSignature } from "../../../libs/stripe";
import { acceptZcvPaidCheckout } from "../../../libs/zcv";
import { ZCV_PRODUCT } from "../../../libs/zcvCore";
import { startZcvPaidVideo } from "../../../libs/zcvWorkflow";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!hasStripeWebhook(env) || !env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: "webhook_not_configured" }, 503);
  }
  if (!hasDb(env)) return json({ error: "db_missing" }, 503);

  const payload = await request.text();
  const header = request.headers.get("stripe-signature") || "";
  const ok = await verifyStripeSignature(payload, header, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: "invalid_signature" }, 400);

  let event: {
    id?: string;
    livemode?: boolean;
    type?: string;
    data?: {
      object?: {
        id?: string;
        customer?: string;
        client_reference_id?: string;
        mode?: string;
        status?: string;
        payment_status?: string;
        amount_total?: number;
        currency?: string;
        payment_intent?: string;
        metadata?: { userId?: string; pack?: string; orderId?: string; productId?: string };
      };
    };
  };
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (event.type !== "checkout.session.completed") {
    return json({ ok: true, ignored: event.type || "unknown" });
  }

  const session = event.data?.object;
  if (session?.metadata?.productId === ZCV_PRODUCT.id) {
    const testStripeKey = env.STRIPE_SECRET_KEY?.startsWith("sk_test_") || env.STRIPE_SECRET_KEY?.startsWith("rk_test_");
    if (!testStripeKey || event.livemode !== false) return json({ error: "live_zcv_payments_disabled" }, 503);
    if (!event.id || !session.id) return json({ error: "stripe_event_missing_id" }, 400);
    const accepted = await acceptZcvPaidCheckout(env.DB, event.id, session);
    if (!accepted.ok) return json({ error: accepted.reason }, 400);
    const state = await startZcvPaidVideo(env as Env & { DB: D1Database; SESSIONS: KVNamespace; MEDIA: R2Bucket }, accepted.order.id, new URL(request.url).origin);
    return json({ ok: true, product: ZCV_PRODUCT.id, orderId: accepted.order.id, newlyPaid: accepted.newlyPaid, status: state });
  }

  const sessionId = session?.id;
  const userId = Number(session?.metadata?.userId || session?.client_reference_id || 0);
  const pack = packFromMetadata(session?.metadata?.pack);
  const customerId = typeof session?.customer === "string" ? session.customer : "";
  if (!sessionId || !userId || !pack) {
    return json({ ok: true, ignored: "missing_metadata" });
  }

  if (customerId) {
    try {
      await saveStripeCustomerId(env.DB, userId, customerId);
    } catch {
      /* column missing until migration 004 — checkout still works via email */
    }
  }

  try {
    const result = await applyPaidPack(env.DB, {
      userId,
      pack,
      stripeSessionId: sessionId,
    });
    return json({ ok: true, ...result });
  } catch (err) {
    if (isSchemaError(err)) {
      return json(
        {
          error: "schema_migration_required",
          message: "Run migrations/003_referrals_credits.sql on D1.",
        },
        503
      );
    }
    const message = err instanceof Error ? err.message : "credit apply failed";
    if (message === "user not found") return json({ ok: true, ignored: "user_not_found" });
    return json({ error: "credit_apply_failed", message }, 500);
  }
};
