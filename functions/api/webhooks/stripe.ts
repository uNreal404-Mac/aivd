import { json, hasDb, type Env } from "../../../libs/utils";
import { applyPaidPack, isSchemaError, saveStripeCustomerId } from "../../../libs/account";
import {
  checkoutGrantDecision,
  hasStripeWebhook,
  verifyStripeSignature,
  type StripeEvent,
} from "../../../libs/stripe";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!hasStripeWebhook(env) || !env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: "webhook_not_configured" }, 503);
  }
  if (!hasDb(env)) return json({ error: "db_missing" }, 503);

  const payload = await request.text();
  const header = request.headers.get("stripe-signature") || "";
  const ok = await verifyStripeSignature(payload, header, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: "invalid_signature" }, 400);

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const decision = checkoutGrantDecision(event);
  if (decision.action === "ignore") {
    return json({ ok: true, ignored: decision.reason });
  }

  if (decision.customerId) {
    try {
      await saveStripeCustomerId(env.DB, decision.userId, decision.customerId);
    } catch {
      /* column missing until migration 004 — checkout still works via email */
    }
  }

  try {
    const result = await applyPaidPack(env.DB, {
      userId: decision.userId,
      pack: decision.pack,
      stripeSessionId: decision.sessionId,
    });
    return json({ ok: true, ...result });
  } catch (err) {
    if (isSchemaError(err)) {
      return json(
        {
          error: "schema_migration_required",
          message: "Run migrations/003_referrals_credits.sql and migrations/005_stripe_sessions.sql on D1.",
        },
        503
      );
    }
    const message = err instanceof Error ? err.message : "credit apply failed";
    if (message === "user not found") return json({ ok: true, ignored: "user_not_found" });
    return json({ error: "credit_apply_failed", message }, 500);
  }
};
