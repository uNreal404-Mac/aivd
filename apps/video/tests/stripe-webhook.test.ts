import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import {
  handleStripeWebhook,
  type GrantCreditsOnce,
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

async function deliver(
  event: unknown,
  signature: string | null,
  grantCreditsOnce: GrantCreditsOnce
) {
  const payload = JSON.stringify(event);
  return handleStripeWebhook({
    payload,
    signature,
    webhookSecret: WEBHOOK_SECRET,
    stripe,
    grantCreditsOnce,
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
  opts: { livemode?: boolean } = {}
) {
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
      object: {
        id: "in_test_123",
        object: "invoice",
        billing_reason: billingReason,
        subscription_details: {
          metadata: { userId: "user_1", productId: "pro-monthly" },
        },
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

  it("ignores livemode events", async () => {
    const { grantCreditsOnce, state } = createIdempotentGranter();
    const event = checkoutSessionEvent("evt_live", { livemode: true });
    const payload = JSON.stringify(event);

    const res = await deliver(event, sign(payload), grantCreditsOnce);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: "livemode" });
    expect(state.calls).toBe(0);
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
