import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import type { CreditPackageConfig } from "@/config/credits";
import {
  buildCheckoutSessionParams,
  createStripeClient,
  getStripeSecretKey,
} from "@/payment/stripe-checkout";

const subscriptionProduct: CreditPackageConfig = {
  id: "pro-monthly",
  name: "Pro Monthly",
  credits: 1000,
  price: { amount: 1999, currency: "USD" },
  type: "subscription",
  billingPeriod: "month",
};

const creditPack: CreditPackageConfig = {
  id: "pack-small",
  name: "Small Pack",
  credits: 100,
  price: { amount: 999, currency: "USD" },
  type: "one-time",
};

describe("getStripeSecretKey", () => {
  it("returns null when the key is missing", () => {
    expect(getStripeSecretKey({})).toBeNull();
  });

  it("returns null when the key is blank", () => {
    expect(getStripeSecretKey({ STRIPE_SECRET_KEY: "   " })).toBeNull();
  });

  it("returns the trimmed key", () => {
    expect(getStripeSecretKey({ STRIPE_SECRET_KEY: "  sk_test_123  " })).toBe(
      "sk_test_123"
    );
  });
});

describe("createStripeClient", () => {
  it("creates a Stripe instance", () => {
    const client = createStripeClient("sk_test_dummy");
    expect(client).toBeInstanceOf(Stripe);
  });
});

describe("buildCheckoutSessionParams", () => {
  it("builds subscription mode params", () => {
    const params = buildCheckoutSessionParams({
      product: subscriptionProduct,
      userId: "user_1",
      origin: "https://example.com",
    });

    expect(params.mode).toBe("subscription");
    expect(params.client_reference_id).toBe("user_1");
    expect(params.metadata).toEqual({
      userId: "user_1",
      productId: "pro-monthly",
    });

    const lineItems = params.line_items;
    expect(lineItems).toHaveLength(1);
    expect(lineItems?.[0].quantity).toBe(1);

    const priceData = lineItems?.[0].price_data;
    expect(priceData?.currency).toBe("usd");
    expect(priceData?.unit_amount).toBe(1999);
    expect(priceData?.recurring).toEqual({ interval: "month" });
    expect(priceData?.product_data).toEqual({ name: "Pro Monthly" });

    expect(params.subscription_data?.metadata).toEqual({
      userId: "user_1",
      productId: "pro-monthly",
    });
    expect(params.success_url).toBe(
      "https://example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}"
    );
    expect(params.cancel_url).toBe("https://example.com/checkout/cancel");
  });

  it("builds one-time payment mode params without recurring", () => {
    const params = buildCheckoutSessionParams({
      product: creditPack,
      userId: "user_2",
      origin: "https://example.com",
    });

    expect(params.mode).toBe("payment");
    expect(params.client_reference_id).toBe("user_2");
    expect(params.metadata).toEqual({
      userId: "user_2",
      productId: "pack-small",
    });

    const priceData = params.line_items?.[0].price_data;
    expect(priceData?.currency).toBe("usd");
    expect(priceData?.unit_amount).toBe(999);
    expect(priceData?.recurring).toBeUndefined();

    expect(params.payment_intent_data?.metadata).toEqual({
      userId: "user_2",
      productId: "pack-small",
    });
  });
});
