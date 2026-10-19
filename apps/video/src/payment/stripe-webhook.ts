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

/**
 * Revokes credits previously granted for a paid order (refund / dispute).
 *
 * Implementations must be idempotent on `revokeOrderNo` (one key per refund or
 * dispute event) so Stripe retries never revoke twice.
 */
export type RevokeCreditsForOrder = (args: {
  orderNo: string;
  revokeOrderNo: string;
  ratio: number;
  reason: "refund" | "dispute";
}) => Promise<"revoked" | "duplicate" | "not_found" | "nothing_to_revoke">;

/**
 * Resolves the `orderNo` we stored when the checkout session was created
 * (`stripe_<session.id>`) from a Stripe PaymentIntent id. Returns `null` when
 * no matching checkout session exists.
 */
export type FindOrderNoForPaymentIntent = (
  paymentIntentId: string
) => Promise<string | null>;

/**
 * Persists processed webhook event ids so replayed deliveries are no-ops.
 */
export interface WebhookEventStore {
  isProcessed(eventId: string): Promise<boolean>;
  markProcessed(args: {
    eventId: string;
    type: string;
    livemode: boolean;
    result: string;
  }): Promise<void>;
}

export interface HandleStripeWebhookArgs {
  payload: string | Buffer;
  signature: string | null | undefined;
  webhookSecret: string;
  stripe: Stripe;
  grantCreditsOnce: GrantCreditsOnce;
  /**
   * When `true`, live-mode events are processed instead of being ignored.
   * Defaults to `false` (test mode only). Callers should only set this when
   * live mode has been explicitly enabled via `STRIPE_LIVE_MODE`.
   */
  allowLivemode?: boolean;
  /**
   * Optional processed-event store (D1 in production). When provided, events
   * already recorded are acknowledged with `{ duplicate: true }` and never
   * reach a handler.
   */
  eventStore?: WebhookEventStore;
  /** Optional credit revocation for refunds and disputes. */
  revokeCreditsForOrder?: RevokeCreditsForOrder;
  /** Optional PaymentIntent -> orderNo lookup for refunds and disputes. */
  findOrderNoForPaymentIntent?: FindOrderNoForPaymentIntent;
}

export interface StripeWebhookResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Shared handling for `checkout.session.completed` and
 * `checkout.session.async_payment_succeeded`.
 *
 * Idempotency is keyed by the checkout session id (not the event id) so a
 * session that emits both event types only grants once.
 */
async function grantForCheckoutSession(
  session: Stripe.Checkout.Session,
  grantCreditsOnce: GrantCreditsOnce
): Promise<StripeWebhookResult> {
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
    orderNo: `stripe_${session.id}`,
    userId,
    productId,
  });

  return { status: 200, body: { received: true, result } };
}

function paymentIntentIdFrom(
  value: string | Stripe.PaymentIntent | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

interface ProcessEventDeps {
  grantCreditsOnce: GrantCreditsOnce;
  revokeCreditsForOrder?: RevokeCreditsForOrder;
  findOrderNoForPaymentIntent?: FindOrderNoForPaymentIntent;
}

/**
 * Applies the side effects for a single (already verified) Stripe event.
 *
 * Throwing here propagates to the caller so the HTTP route can return 500 and
 * Stripe retries the delivery; the event is then NOT marked as processed.
 */
async function processEvent(
  event: Stripe.Event,
  deps: ProcessEventDeps
): Promise<StripeWebhookResult> {
  const { grantCreditsOnce, revokeCreditsForOrder, findOrderNoForPaymentIntent } =
    deps;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      return grantForCheckoutSession(
        event.data.object as Stripe.Checkout.Session,
        grantCreditsOnce
      );
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

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = paymentIntentIdFrom(charge.payment_intent);

      if (!paymentIntentId) {
        return {
          status: 200,
          body: { received: true, ignored: "no_payment_intent" },
        };
      }

      if (!revokeCreditsForOrder || !findOrderNoForPaymentIntent) {
        return {
          status: 200,
          body: { received: true, ignored: "refunds_not_configured" },
        };
      }

      const orderNo = await findOrderNoForPaymentIntent(paymentIntentId);
      if (!orderNo) {
        return {
          status: 200,
          body: { received: true, ignored: "unmatched_payment" },
        };
      }

      const ratio =
        charge.amount > 0 ? charge.amount_refunded / charge.amount : 1;
      const result = await revokeCreditsForOrder({
        orderNo,
        revokeOrderNo: `stripe_refund_${event.id}`,
        ratio,
        reason: "refund",
      });

      return { status: 200, body: { received: true, result } };
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId = paymentIntentIdFrom(dispute.payment_intent);

      if (!paymentIntentId) {
        return {
          status: 200,
          body: { received: true, ignored: "no_payment_intent" },
        };
      }

      if (!revokeCreditsForOrder || !findOrderNoForPaymentIntent) {
        return {
          status: 200,
          body: { received: true, ignored: "refunds_not_configured" },
        };
      }

      const orderNo = await findOrderNoForPaymentIntent(paymentIntentId);
      if (!orderNo) {
        return {
          status: 200,
          body: { received: true, ignored: "unmatched_payment" },
        };
      }

      const result = await revokeCreditsForOrder({
        orderNo,
        revokeOrderNo: `stripe_dispute_${dispute.id}`,
        ratio: 1,
        reason: "dispute",
      });

      return { status: 200, body: { received: true, result } };
    }

    // Dispute lifecycle acknowledgements. We intentionally do NOT restore
    // credits automatically when a dispute is won (`funds_reinstated` / closed
    // with status "won"): restore them manually after review.
    case "charge.dispute.closed":
    case "charge.dispute.funds_withdrawn":
    case "charge.dispute.funds_reinstated":
    case "charge.dispute.updated": {
      const dispute = event.data.object as Stripe.Dispute;
      console.info(
        `[stripe] dispute ${dispute.id} ${event.type} status=${dispute.status}`
      );

      return {
        status: 200,
        body: {
          received: true,
          ignored: "dispute_logged",
          status: dispute.status,
        },
      };
    }

    default:
      return { status: 200, body: { received: true, ignored: event.type } };
  }
}

/**
 * Pure, dependency-injected core for the Stripe webhook.
 *
 * Live mode is disabled by default: `livemode: true` events are acknowledged
 * but never granted unless the caller passes `allowLivemode: true` (the route
 * only does so when the configured key is a live key and `STRIPE_LIVE_MODE`
 * is `"true"`).
 *
 * Idempotency layers:
 * - When an `eventStore` is provided, replayed `event.id`s short-circuit with
 *   `{ duplicate: true }` before any handler runs.
 * - Checkout-session grants are keyed by session id (`stripe_<session.id>`) so
 *   `checkout.session.completed` and `checkout.session.async_payment_succeeded`
 *   for the same session can never grant twice.
 * - Invoice grants are keyed by event id (`stripe_<event.id>`).
 * - Refunds/disputes revoke with keys `stripe_refund_<event.id>` /
 *   `stripe_dispute_<dispute.id>`.
 *
 * Handler errors propagate so the route returns 500 and Stripe retries; in that
 * case the event is not recorded as processed. A failure to persist the
 * processed marker is only logged (the grants/revocations are themselves
 * idempotent by order number).
 */
export async function handleStripeWebhook({
  payload,
  signature,
  webhookSecret,
  stripe,
  grantCreditsOnce,
  allowLivemode = false,
  eventStore,
  revokeCreditsForOrder,
  findOrderNoForPaymentIntent,
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

  // Live mode is refused unless explicitly allowed by the caller.
  if (event.livemode === true && !allowLivemode) {
    return { status: 200, body: { received: true, ignored: "livemode" } };
  }

  if (eventStore && (await eventStore.isProcessed(event.id))) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  const result = await processEvent(event, {
    grantCreditsOnce,
    revokeCreditsForOrder,
    findOrderNoForPaymentIntent,
  });

  if (eventStore && result.status < 500) {
    try {
      await eventStore.markProcessed({
        eventId: event.id,
        type: event.type,
        livemode: event.livemode === true,
        result: JSON.stringify(result.body).slice(0, 500),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`⚠️ Stripe webhook event store failed: ${message}`);
    }
  }

  return result;
}

