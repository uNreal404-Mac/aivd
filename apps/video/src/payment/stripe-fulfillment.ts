import type Stripe from "stripe";
import { eq } from "drizzle-orm";

import { getProductById, getProductExpiryDays } from "@/config/credits";
import { db, stripeWebhookEvents } from "@/db";
import { bonusOrderNo, hasPaidBefore, launchBonusCredits } from "@/payment/offers";
import { CreditTransType, creditService } from "@/services/credit";

import type {
  FindOrderNoForPaymentIntent,
  GrantCreditsOnce,
  RevokeCreditsForOrder,
  WebhookEventStore,
} from "@/payment/stripe-webhook";

/**
 * Grants credits exactly once per `orderNo`.
 *
 * Three layers of protection on Cloudflare D1:
 * 1. Callers derive a stable `orderNo` per Stripe session/event, so retries
 *    reuse the same key.
 * 2. D1 executes the package and audit inserts as one atomic batch.
 * 3. Unique indexes on `order_no` make concurrent webhook retries no-ops.
 */
export const grantCreditsOnce: GrantCreditsOnce = async ({
  orderNo,
  userId,
  productId,
}) => {
  const product = getProductById(productId);
  if (!product) {
    return "unknown_product";
  }

  const result = await creditService.recharge({
    userId,
    credits: product.credits,
    orderNo,
    transType:
      product.type === "subscription"
        ? CreditTransType.SUBSCRIPTION
        : CreditTransType.ORDER_PAY,
    expiryDays: getProductExpiryDays(product),
    remark: `Stripe payment: ${product.name}`,
  });

  // Launch offer: extra credits on an account's first payment. The bonus has
  // its own order number, so a redelivered webhook cannot grant it twice.
  const bonus = launchBonusCredits(product);
  if (bonus > 0 && !(await hasPaidBefore(userId, orderNo))) {
    await creditService.recharge({
      userId,
      credits: bonus,
      orderNo: bonusOrderNo(orderNo),
      transType: CreditTransType.SYSTEM_ADJUST,
      expiryDays: getProductExpiryDays(product),
      remark: `Launch offer bonus: ${product.name}`,
    });
  }

  return result.created ? "granted" : "duplicate";
};

/**
 * Revokes credits for a refunded/disputed order. Idempotent per
 * `revokeOrderNo` (unique index on `credit_transactions.order_no`).
 */
export const revokeCreditsForOrder: RevokeCreditsForOrder = async ({
  orderNo,
  revokeOrderNo,
  ratio,
  reason,
}) => {
  const result = await creditService.revokeForOrder({
    orderNo,
    revokeOrderNo,
    ratio,
    remark: `Stripe ${reason}: ${orderNo}`,
  });
  // A refunded first purchase gives back its launch bonus in the same share.
  // When there was no bonus this finds nothing and does nothing.
  await creditService.revokeForOrder({
    orderNo: bonusOrderNo(orderNo),
    revokeOrderNo: bonusOrderNo(revokeOrderNo),
    ratio,
    remark: `Stripe ${reason}: launch bonus of ${orderNo}`,
  });
  return result.status;
};

/**
 * D1-backed processed-event store. `event_id` is the primary key, so
 * `onConflictDoNothing` makes concurrent deliveries safe.
 */
export const d1WebhookEventStore: WebhookEventStore = {
  async isProcessed(eventId) {
    const [row] = await db
      .select({ eventId: stripeWebhookEvents.eventId })
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, eventId))
      .limit(1);
    return Boolean(row);
  },
  async markProcessed({ eventId, type, livemode, result }) {
    await db
      .insert(stripeWebhookEvents)
      .values({ eventId, type, livemode, result })
      .onConflictDoNothing({ target: stripeWebhookEvents.eventId });
  },
};

/**
 * Maps a Stripe PaymentIntent id back to the `orderNo` we use for grants
 * (`stripe_<checkout session id>`), by listing checkout sessions for the
 * payment intent.
 *
 * @see https://docs.stripe.com/api/checkout/sessions/list (param `payment_intent`)
 */
export function createFindOrderNoForPaymentIntent(
  stripe: Stripe
): FindOrderNoForPaymentIntent {
  return async (paymentIntentId) => {
    const list = await stripe.checkout.sessions.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });
    const session = list.data[0];
    return session ? `stripe_${session.id}` : null;
  };
}

