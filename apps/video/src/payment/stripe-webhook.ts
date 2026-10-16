import Stripe from "stripe";

/**
 * Grants credits exactly once for a given `orderNo`.
 *
 * Implementations are expected to be idempotent on `orderNo` (e.g. a unique
 * constraint in the database). Stripe retries the same `event.id`, so the
 * caller derives a stable `orderNo` from it.
 */
export type GrantCreditsOnce = (args: {
  orderNo: string;
  userId: string;
  productId: string;
}) => Promise<"granted" | "duplicate" | "unknown_product">;

export interface HandleStripeWebhookArgs {
  payload: string | Buffer;
  signature: string | null | undefined;
  webhookSecret: string;
  stripe: Stripe;
  grantCreditsOnce: GrantCreditsOnce;
}

export interface StripeWebhookResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Pure, dependency-injected core for the Stripe webhook.
 *
 * TEST MODE ONLY: live mode events are acknowledged but never granted.
 * Idempotency is keyed by event id (`stripe_<event.id>`) because Stripe
 * retries deliveries with the same event id.
 */
export async function handleStripeWebhook({
  payload,
  signature,
  webhookSecret,
  stripe,
  grantCreditsOnce,
}: HandleStripeWebhookArgs): Promise<StripeWebhookResult> {
  if (!signature) {
    return { status: 400, body: { error: "missing_signature" } };
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch {
    // Never leak verification details to the caller.
    return { status: 400, body: { error: "invalid_signature" } };
  }

  // Test mode only — ignore live mode traffic entirely.
  if (event.livemode === true) {
    return { status: 200, body: { received: true, ignored: "livemode" } };
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== "paid") {
        return { status: 200, body: { received: true, ignored: "unpaid" } };
      }

      const userId =
        session.metadata?.userId ?? session.client_reference_id ?? undefined;
      const productId = session.metadata?.productId;

      if (!userId || !productId) {
        return {
          status: 200,
          body: { received: true, ignored: "missing_metadata" },
        };
      }

      const result = await grantCreditsOnce({
        orderNo: `stripe_${event.id}`,
        userId,
        productId,
      });

      return { status: 200, body: { received: true, result } };
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;

      // The first payment is credited by checkout.session.completed, so only
      // renewal cycles are handled here.
      if (invoice.billing_reason !== "subscription_cycle") {
        return {
          status: 200,
          body: {
            received: true,
            ignored: invoice.billing_reason ?? "not_renewal",
          },
        };
      }

      const metadata = invoice.subscription_details?.metadata;
      const userId = metadata?.userId;
      const productId = metadata?.productId;

      if (!userId || !productId) {
        return {
          status: 200,
          body: { received: true, ignored: "missing_metadata" },
        };
      }

      const result = await grantCreditsOnce({
        orderNo: `stripe_${event.id}`,
        userId,
        productId,
      });

      return { status: 200, body: { received: true, result } };
    }

    default:
      return { status: 200, body: { received: true, ignored: event.type } };
  }
}
