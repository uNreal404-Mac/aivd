import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import {
  handleStripeWebhook,
  type FindOrderNoForPaymentIntent,
  type GrantCreditsOnce,
  type RevokeCreditsForOrder,
  type WebhookEventStore,
} from "@/payment/stripe-webhook";

const stripe = new Stripe("sk_test_dummy", {
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = "whsec_test_secret";

function sign(payload: string, secret: string = WEBHOOK_SECRET): string {
  return stripe.webhooks.generateTestHeaderString({ payload, secret });
}

/** In-memory granter backed by a Set of orderNo, with a credit counter. */
function createIdempotentGranter(creditsPerGrant = 100) {
  const seen = new Set<string>();
  const state = { credits: 0, calls: 0, granted: 0, duplicates: 0 };

  const grantCreditsOnce: GrantCreditsOnce = async ({ orderNo }) => {
    state.calls += 1;
    if (seen.has(orderNo)) {
      state.duplicates += 1;
      return "duplicate";
    }
    seen.add(orderNo);
    state.credits += creditsPerGrant;
    state.granted += 1;
    return "granted";
  };

  return { grantCreditsOnce, state };
}

/** In-memory processed-event store. */
function createMemoryEventStore() {
  const processed = new Map<
    string,
    { type: string; livemode: boolean; result: string }
  >();

  const store: WebhookEventStore = {
    async isProcessed(eventId) {
      return processed.has(eventId);
    },
    async markProcessed(args) {
      processed.set(args.eventId, {
        type: args.type,
        livemode: args.livemode,
        result: args.result,
      });
    },
  };

  return { store, processed };
}

interface RevokeCall {
  orderNo: string;
  revokeOrderNo: string;
  ratio: number;
  reason: "refund" | "dispute";
}

function createRevokeRecorder(
  result: "revoked" | "duplicate" | "not_found" | "nothing_to_revoke" =
    "revoked"
) {
  const calls: RevokeCall[] = [];
  const revokeCreditsForOrder: RevokeCreditsForOrder = async (args) => {
    calls.push(args);
    return result;
  };
  return { revokeCreditsForOrder, calls };
}

function fixedFinder(orderNo: string | null): FindOrderNoForPaymentIntent {
  return async () => orderNo;
}

interface DeliverOptions {
  allowLivemode?: boolean;
  eventStore?: WebhookEventStore;
  revokeCreditsForOrder?: RevokeCreditsForOrder;
  findOrderNoForPaymentIntent?: FindOrderNoForPaymentIntent;
}

async function deliver(
  event: unknown,
  signature: string | null,
  grantCreditsOnce: GrantCreditsOnce,
  options: DeliverOptions = {}
) {
  const payload = JSON.stringify(event);
  return handleStripeWebhook({
    payload,
    signature,
    webhookSecret: WEBHOOK_SECRET,
    stripe,
    grantCreditsOnce,
    allowLivemode: options.allowLivemode === true,
    eventStore: options.eventStore,
    revokeCreditsForOrder: options.revokeCreditsForOrder,
    findOrderNoForPaymentIntent: options.findOrderNoForPaymentIntent,
  });
}

function checkoutSessionEvent(
  id: string,
  opts: {
    paymentStatus?: string;
    livemode?: boolean;
    type?: string;
    sessionId?: string;
  } = {}
) {
  return {
    id,
    object: "event",
    api_version: "2024-06-20",
    created: 1_700_000_000,
    livemode: opts.livemode ?? false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: opts.type ?? "checkout.session.completed",
    data: {
      object: {
        id: opts.sessionId ?? "cs_test_123",
        object: "checkout.session",
        payment_status: opts.paymentStatus ?? "paid",
        client_reference_id: "user_1",
        metadata: { userId: "user_1", productId: "pack-small" },
      },
    },
  };
}

function invoicePaidEvent(
  id: string,
  billingReason: string,
  opts: {
    livemode?: boolean;
    /**
     * `legacy` (default): metadata on `subscription_details` (SDK-typed field).
     * `parent`: live payload — top-level `subscription_details` is null and
     * metadata is on `parent.subscription_details`.
     * `both`: both paths are set to different values so parent-first order
     * can be asserted.
     */
    metadataAt?: "legacy" | "parent" | "both";
  } = {}
) {
  const legacyMetadata = { userId: "user_1", productId: "pro-monthly" };
  const parentMetadata = { userId: "user_parent", productId: "pro-parent" };
  const metadataAt = opts.metadataAt ?? "legacy";

  const invoice: Record<string, unknown> = {
    id: "in_test_123",
    object: "invoice",
    billing_reason: billingReason,
  };

  if (metadataAt === "parent") {
    invoice.subscription_details = null;
    invoice.parent = {
      type: "subscription_details",
      quote_details: null,
      subscription_details: {
        metadata: legacyMetadata,
        subscription: "sub_test_123",
      },
    };
  } else if (metadataAt === "both") {
    invoice.subscription_details = { metadata: legacyMetadata };
    invoice.parent = {
      type: "subscription_details",
      quote_details: null,
      subscription_details: {
        metadata: parentMetadata,
        subscription: "sub_test_123",
      },
    };
  } else {
    invoice.subscription_details = { metadata: legacyMetadata };
  }

  return {
    id,
    object: "event",
    api_version: "2024-06-20",
    created: 1_700_000_000,
    livemode: opts.livemode ?? false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "invoice.paid",
    data: {
      object: invoice,
    },
  };
}

function chargeRefundedEvent(
  id: string,
  opts: {
    amount?: number;
    amountRefunded?: number;
    paymentIntent?: string | null;
  } = {}
) {
  return {
    id,
    object: "event",
    api_version: "2024-06-20",
    created: 1_700_000_000,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_test_123",
        object: "charge",
        amount: opts.amount ?? 1000,
        amount_refunded: opts.amountRefunded ?? 1000,
        payment_intent:
          opts.paymentIntent === undefined ? "pi_test_123" : opts.paymentIntent,
      },
    },
  };
}

function disputeEvent(
  id: string,
  disputeId: string,
  type: string,
  opts: { paymentIntent?: string | null; status?: string } = {}
) {
  return {
    id,
    object: "event",
    api_version: "2024-06-20",
    created: 1_700_000_000,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: {
      object: {
        id: disputeId,
        object: "dispute",
        status: opts.status ?? "needs_response",
        payment_intent:
          opts.paymentIntent === undefined ? "pi_test_123" : opts.paymentIntent,
      },
    },
  };
}

describe("handleStripeWebhook", () => {
  it("grants credits once for a valid checkout.session.completed", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const event = checkoutSessionEvent("evt_1");
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, result: "granted" });
    expect(state.calls).toBe(1);
    expect(state.credits).toBe(100);
  });

  it("treats a duplicate delivery of the same event id as a no-op", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const event = checkoutSessionEvent("evt_dup");
    const signature = sign(JSON.stringify(event));

    const first = await deliver(event, signature, grantCreditsOnce);
    const second = await deliver(event, signature, grantCreditsOnce);

    expect(first.body).toEqual({ received: true, result: "granted" });
    expect(second.body).toEqual({ received: true, result: "duplicate" });
    expect(state.credits).toBe(100);
    expect(state.granted).toBe(1);
  });

  it("rejects a bad signature without granting", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const event = checkoutSessionEvent("evt_bad");

    const res = await deliver(event, "t=1,v1=deadbeef", grantCreditsOnce);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_signature" });
    expect(state.calls).toBe(0);
    expect(state.credits).toBe(0);
  });

  it("rejects a missing signature", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const event = checkoutSessionEvent("evt_missing");

    const res = await deliver(event, null, grantCreditsOnce);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "missing_signature" });
    expect(state.calls).toBe(0);
  });

  it("ignores livemode events by default", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const event = checkoutSessionEvent("evt_live", { livemode: true });
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: "livemode" });
    expect(state.calls).toBe(0);
  });

  it("processes livemode events when allowLivemode is true", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const event = checkoutSessionEvent("evt_live_allowed", { livemode: true });
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce, {
      allowLivemode: true,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, result: "granted" });
    expect(state.calls).toBe(1);
    expect(state.credits).toBe(100);
  });

  it("ignores unpaid sessions", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const event = checkoutSessionEvent("evt_unpaid", {
      paymentStatus: "unpaid",
    });
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: "unpaid" });
    expect(state.calls).toBe(0);
  });

  it("grants for invoice.paid with billing_reason subscription_cycle", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const event = invoicePaidEvent("evt_renewal", "subscription_cycle");
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, result: "granted" });
    expect(state.credits).toBe(100);
  });

  it("grants renewal credits from invoice.parent.subscription_details.metadata", async () => {
    const calls: Array<{
      orderNo: string;
      userId: string;
      productId: string;
    }> = [];
    const seen = new Set<string>();
    const grantCreditsOnce: GrantCreditsOnce = async (args) => {
      calls.push(args);
      if (seen.has(args.orderNo)) return "duplicate";
      seen.add(args.orderNo);
      return "granted";
    };
    const event = invoicePaidEvent("evt_renewal_parent", "subscription_cycle", {
      metadataAt: "parent",
    });
    const signature = sign(JSON.stringify(event));

    const first = await deliver(event, signature, grantCreditsOnce);
    const second = await deliver(event, signature, grantCreditsOnce);

    expect(first).toEqual({
      status: 200,
      body: { received: true, result: "granted" },
    });
    expect(second).toEqual({
      status: 200,
      body: { received: true, result: "duplicate" },
    });
    expect(calls).toEqual([
      {
        orderNo: "stripe_evt_renewal_parent",
        userId: "user_1",
        productId: "pro-monthly",
      },
      {
        orderNo: "stripe_evt_renewal_parent",
        userId: "user_1",
        productId: "pro-monthly",
      },
    ]);
  });

  it("prefers parent.subscription_details.metadata over subscription_details.metadata", async () => {
    const calls: Array<{
      orderNo: string;
      userId: string;
      productId: string;
    }> = [];
    const grantCreditsOnce: GrantCreditsOnce = async (args) => {
      calls.push(args);
      return "granted";
    };
    const event = invoicePaidEvent("evt_renewal_both", "subscription_cycle", {
      metadataAt: "both",
    });
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce);

    expect(res).toEqual({
      status: 200,
      body: { received: true, result: "granted" },
    });
    expect(calls).toEqual([
      {
        orderNo: "stripe_evt_renewal_both",
        userId: "user_parent",
        productId: "pro-parent",
      },
    ]);
  });

  it("ignores invoice.paid with billing_reason subscription_create", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const event = invoicePaidEvent("evt_create", "subscription_create");
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.ignored).toBe("subscription_create");
    expect(state.calls).toBe(0);
  });

  it("grants credits for checkout.session.async_payment_succeeded", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const event = checkoutSessionEvent("evt_async", {
      type: "checkout.session.async_payment_succeeded",
    });
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, result: "granted" });
    expect(state.credits).toBe(100);
  });

  it("grants once when completed and async_payment_succeeded share a session", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const completed = checkoutSessionEvent("evt_completed");
    const asyncPaid = checkoutSessionEvent("evt_async_same_session", {
      type: "checkout.session.async_payment_succeeded",
    });

    const first = await deliver(
      completed,
      sign(JSON.stringify(completed)),
      grantCreditsOnce
    );
    const second = await deliver(
      asyncPaid,
      sign(JSON.stringify(asyncPaid)),
      grantCreditsOnce
    );

    expect(first.body).toEqual({ received: true, result: "granted" });
    expect(second.body).toEqual({ received: true, result: "duplicate" });
    expect(state.credits).toBe(100);
    expect(state.granted).toBe(1);
  });
});

describe("handleStripeWebhook event store", () => {
  it("short-circuits a replayed event id without calling handlers", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const { store, processed } = createMemoryEventStore();
    const event = checkoutSessionEvent("evt_replay");
    const signature = sign(JSON.stringify(event));

    const first = await deliver(event, signature, grantCreditsOnce, {
      eventStore: store,
    });
    const second = await deliver(event, signature, grantCreditsOnce, {
      eventStore: store,
    });

    expect(first.body).toEqual({ received: true, result: "granted" });
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ received: true, duplicate: true });
    expect(state.calls).toBe(1);
    expect(state.granted).toBe(1);
    expect(state.credits).toBe(100);
    expect(await store.isProcessed("evt_replay")).toBe(true);
    expect(processed.has("evt_replay")).toBe(true);
  });

  it("propagates handler errors and does not mark the event processed", async () => {
    const { store } = createMemoryEventStore();
    const grantCreditsOnce: GrantCreditsOnce = async () => {
      throw new Error("boom");
    };
    const event = checkoutSessionEvent("evt_boom");
    const payload = JSON.stringify(event);

    await expect(
      deliver(event, sign(payload), grantCreditsOnce, { eventStore: store })
    ).rejects.toThrow("boom");

    expect(await store.isProcessed("evt_boom")).toBe(false);
  });
});

describe("handleStripeWebhook refunds and disputes", () => {
  it("revokes all credits for a full charge.refunded", async () => {
    const { grantCreditsOnce } = createIdempotentGranter();
    const { revokeCreditsForOrder, calls } = createRevokeRecorder();
    const event = chargeRefundedEvent("evt_refund_full", {
      amount: 1000,
      amountRefunded: 1000,
    });
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce, {
      revokeCreditsForOrder,
      findOrderNoForPaymentIntent: fixedFinder("stripe_cs_test_123"),
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, result: "revoked" });
    expect(calls).toEqual([
      {
        orderNo: "stripe_cs_test_123",
        revokeOrderNo: "stripe_refund_evt_refund_full",
        ratio: 1,
        reason: "refund",
      },
    ]);
  });

  it("passes a partial refund ratio through to revocation", async () => {
    const { grantCreditsOnce } = createIdempotentGranter();
    const { revokeCreditsForOrder, calls } = createRevokeRecorder();
    const event = chargeRefundedEvent("evt_refund_half", {
      amount: 1000,
      amountRefunded: 500,
    });
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce, {
      revokeCreditsForOrder,
      findOrderNoForPaymentIntent: fixedFinder("stripe_cs_test_456"),
    });

    expect(res.body).toEqual({ received: true, result: "revoked" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      orderNo: "stripe_cs_test_456",
      revokeOrderNo: "stripe_refund_evt_refund_half",
      ratio: 0.5,
      reason: "refund",
    });
  });

  it("ignores a refund when the payment intent cannot be matched", async () => {
    const { grantCreditsOnce } = createIdempotentGranter();
    const { revokeCreditsForOrder, calls } = createRevokeRecorder();
    const event = chargeRefundedEvent("evt_refund_unmatched");
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce, {
      revokeCreditsForOrder,
      findOrderNoForPaymentIntent: fixedFinder(null),
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: "unmatched_payment" });
    expect(calls).toHaveLength(0);
  });

  it("revokes all credits when a dispute is created", async () => {
    const { grantCreditsOnce } = createIdempotentGranter();
    const { revokeCreditsForOrder, calls } = createRevokeRecorder();
    const event = disputeEvent(
      "evt_dispute_created",
      "dp_test_1",
      "charge.dispute.created"
    );
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce, {
      revokeCreditsForOrder,
      findOrderNoForPaymentIntent: fixedFinder("stripe_cs_test_789"),
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, result: "revoked" });
    expect(calls).toEqual([
      {
        orderNo: "stripe_cs_test_789",
        revokeOrderNo: "stripe_dispute_dp_test_1",
        ratio: 1,
        reason: "dispute",
      },
    ]);
  });

  it("logs dispute closures without revoking credits", async () => {
    const { grantCreditsOnce } = createIdempotentGranter();
    const { revokeCreditsForOrder, calls } = createRevokeRecorder();
    const event = disputeEvent(
      "evt_dispute_closed",
      "dp_test_2",
      "charge.dispute.closed",
      { status: "won" }
    );
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce, {
      revokeCreditsForOrder,
      findOrderNoForPaymentIntent: fixedFinder("stripe_cs_test_789"),
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      received: true,
      ignored: "dispute_logged",
      status: "won",
    });
    expect(calls).toHaveLength(0);
  });
});

