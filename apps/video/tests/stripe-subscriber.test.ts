import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { eq } from "drizzle-orm";

import { customers, db } from "@/db";
import {
  loadOwnSubscription,
  recordStripeSubscriber,
  renewalDateOf,
  subscriberRecordOf,
  type StripeSubscriberRecord,
} from "@/payment/stripe-customer";
import { handleStripeWebhook, type GrantCreditsOnce } from "@/payment/stripe-webhook";
import { uniqueUserId } from "./helpers";

const stripe = new Stripe("sk_test_dummy", {
  httpClient: Stripe.createFetchHttpClient(),
});
const WEBHOOK_SECRET = "whsec_test_secret";
const PERIOD_END = 1_800_000_000; // 2027-01-15

const grantCreditsOnce: GrantCreditsOnce = async () => "granted";

function event(type: string, object: Record<string, unknown>, id = `evt_${type}`) {
  return {
    id,
    object: "event",
    api_version: "2025-03-31.basil",
    created: 1_700_000_000,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: { object },
  };
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    object: "subscription",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    created: 1_700_000_000,
    metadata: { userId: "user_1", productId: "prod_basic" },
    // Current API versions: the period lives on the item.
    items: { data: [{ id: "si_1", current_period_end: PERIOD_END }] },
    ...overrides,
  };
}

async function deliver(payload: unknown) {
  const recorded: StripeSubscriberRecord[] = [];
  const body = JSON.stringify(payload);
  const result = await handleStripeWebhook({
    payload: body,
    signature: stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET }),
    webhookSecret: WEBHOOK_SECRET,
    stripe,
    grantCreditsOnce,
    recordSubscriber: async (record) => {
      recorded.push(record);
    },
  });
  return { result, recorded };
}

async function customerRow(userId: string) {
  const [row] = await db.select().from(customers).where(eq(customers.authUserId, userId));
  return row;
}

describe("subscriberRecordOf / renewalDateOf", () => {
  it("reads the renewal date from the subscription item (current API)", () => {
    const sub = subscription() as unknown as Stripe.Subscription;
    expect(renewalDateOf(sub)).toEqual(new Date(PERIOD_END * 1000));
  });

  it("falls back to the subscription-level period end (older API)", () => {
    const sub = subscription({ items: { data: [{ id: "si_1" }] }, current_period_end: PERIOD_END });
    expect(renewalDateOf(sub as unknown as Stripe.Subscription)).toEqual(new Date(PERIOD_END * 1000));
  });

  it("has no renewal date once set to cancel at period end", () => {
    const sub = subscription({ cancel_at_period_end: true });
    expect(renewalDateOf(sub as unknown as Stripe.Subscription)).toBeNull();
  });

  it("marks canceled subscriptions as ended", () => {
    const record = subscriberRecordOf(subscription({ status: "canceled" }) as unknown as Stripe.Subscription);
    expect(record).toMatchObject({ active: false, renewsAt: null, subscriptionId: "sub_1" });
  });

  it("ignores subscriptions without our userId", () => {
    expect(subscriberRecordOf(subscription({ metadata: {} }) as unknown as Stripe.Subscription)).toBeNull();
  });
});

describe("handleStripeWebhook subscriber events", () => {
  it("links the account when a subscription checkout completes", async () => {
    const { result, recorded } = await deliver(
      event("checkout.session.completed", {
        id: "cs_test_sub",
        object: "checkout.session",
        mode: "subscription",
        payment_status: "paid",
        customer: "cus_1",
        subscription: "sub_1",
        client_reference_id: "user_1",
        metadata: { userId: "user_1", productId: "prod_basic" },
      }),
    );
    expect(result.status).toBe(200);
    expect(recorded).toEqual([
      { userId: "user_1", stripeCustomerId: "cus_1", subscriptionId: "sub_1", active: true },
    ]);
  });

  it("does not link anything for a one-time credit pack", async () => {
    const { recorded } = await deliver(
      event("checkout.session.completed", {
        id: "cs_test_pack",
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        customer: null,
        metadata: { userId: "user_1", productId: "pack" },
      }),
    );
    expect(recorded).toEqual([]);
  });

  it("records renewal changes and the end of a subscription", async () => {
    const updated = await deliver(event("customer.subscription.updated", subscription({ cancel_at_period_end: true })));
    expect(updated.result.body).toMatchObject({ result: "recorded" });
    expect(updated.recorded[0]).toMatchObject({ active: true, renewsAt: null });

    const deleted = await deliver(event("customer.subscription.deleted", subscription({ status: "canceled" })));
    expect(deleted.result.body).toMatchObject({ result: "ended" });
    expect(deleted.recorded[0]).toMatchObject({ active: false });
  });
});

describe("recordStripeSubscriber (D1)", () => {
  it("creates, updates and clears the account's Customer row", async () => {
    const userId = uniqueUserId("sub");
    const customerId = `cus_${userId}`;
    const renewsAt = new Date(PERIOD_END * 1000);

    // Checkout completion: link only, no date.
    await recordStripeSubscriber({ userId, stripeCustomerId: customerId, subscriptionId: `sub_a_${userId}`, active: true });
    expect(await customerRow(userId)).toMatchObject({
      stripeCustomerId: customerId,
      stripeSubscriptionId: `sub_a_${userId}`,
      stripeCurrentPeriodEnd: null,
    });

    // subscription.updated: renewal date arrives.
    await recordStripeSubscriber({ userId, stripeCustomerId: customerId, subscriptionId: `sub_a_${userId}`, active: true, renewsAt });
    // A later checkout event (no date) must not wipe it.
    await recordStripeSubscriber({ userId, stripeCustomerId: customerId, subscriptionId: `sub_a_${userId}`, active: true });
    expect((await customerRow(userId))?.stripeCurrentPeriodEnd).toEqual(renewsAt);

    // Ended: the link to the subscription and the date go; the customer stays
    // so the portal still opens for invoices.
    await recordStripeSubscriber({ userId, stripeCustomerId: customerId, subscriptionId: `sub_a_${userId}`, active: false, renewsAt: null });
    expect(await customerRow(userId)).toMatchObject({
      stripeCustomerId: customerId,
      stripeSubscriptionId: null,
      stripeCurrentPeriodEnd: null,
    });

    const rows = await db.select().from(customers).where(eq(customers.authUserId, userId));
    expect(rows).toHaveLength(1);
  });

  it("the end of an old subscription does not clear a newer one", async () => {
    const userId = uniqueUserId("sub");
    const customerId = `cus_${userId}`;
    await recordStripeSubscriber({ userId, stripeCustomerId: customerId, subscriptionId: `sub_new_${userId}`, active: true });
    await recordStripeSubscriber({ userId, stripeCustomerId: customerId, subscriptionId: `sub_old_${userId}`, active: false, renewsAt: null });
    expect((await customerRow(userId))?.stripeSubscriptionId).toBe(`sub_new_${userId}`);
  });
});

describe("loadOwnSubscription (D1)", () => {
  it("returns the stored subscription only when its metadata names this account", async () => {
    const userId = uniqueUserId("own");
    await recordStripeSubscriber({ userId, stripeCustomerId: `cus_${userId}`, subscriptionId: `sub_${userId}`, active: true });
    const retrieve = async (id: string) => subscription({ id, metadata: { userId } });
    const fake = { subscriptions: { retrieve } } as unknown as Stripe;
    expect((await loadOwnSubscription(fake, userId))?.id).toBe(`sub_${userId}`);

    const someoneElse = {
      subscriptions: { retrieve: async (id: string) => subscription({ id, metadata: { userId: "other" } }) },
    } as unknown as Stripe;
    expect(await loadOwnSubscription(someoneElse, userId)).toBeNull();
  });

  it("finds an unlinked account by metadata search and links it", async () => {
    const userId = uniqueUserId("own");
    const found = subscription({ id: `sub_${userId}`, customer: `cus_${userId}`, metadata: { userId } });
    const fake = {
      subscriptions: { search: async () => ({ data: [found] }), retrieve: async () => found },
    } as unknown as Stripe;
    expect((await loadOwnSubscription(fake, userId))?.id).toBe(`sub_${userId}`);
    expect((await customerRow(userId))?.stripeSubscriptionId).toBe(`sub_${userId}`);
  });
});
