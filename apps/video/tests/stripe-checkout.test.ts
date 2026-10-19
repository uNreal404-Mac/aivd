import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import type { CreditPackageConfig } from "@/config/credits";
import {
  CHECKOUT_SITE_ID,
  STATEMENT_DESCRIPTOR_SUFFIX,
  buildCheckoutSessionParams,
  createStripeClient,
  describeProduct,
  getStripeKeyMode,
  getStripeSecretKey,
  getUsableStripeKey,
  isStripeLiveModeEnabled,
} from "@/payment/stripe-checkout";

const subscriptionProduct: CreditPackageConfig = {
  id: "pro-monthly",
  name: "Pro Monthly",
  credits: 1000,
  price: { amount: 1999, currency: "USD" },
  type: "subscription",
  billingPeriod: "month",
};

const yearlyProduct: CreditPackageConfig = {
  id: "pro-yearly",
  name: "Pro Yearly",
  credits: 12000,
  price: { amount: 19999, currency: "USD" },
  type: "subscription",
  billingPeriod: "year",
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

describe("getStripeKeyMode", () => {
  it("returns 'test' for sk_test_ keys", () => {
    expect(getStripeKeyMode("sk_test_123")).toBe("test");
  });

  it("returns 'test' for rk_test_ keys", () => {
    expect(getStripeKeyMode("rk_test_123")).toBe("test");
  });

  it("returns 'live' for sk_live_ keys", () => {
    expect(getStripeKeyMode("sk_live_123")).toBe("live");
  });

  it("returns 'live' for rk_live_ keys", () => {
    expect(getStripeKeyMode("rk_live_123")).toBe("live");
  });

  it("returns 'invalid' for publishable or garbage keys", () => {
    expect(getStripeKeyMode("pk_test_123")).toBe("invalid");
    expect(getStripeKeyMode("garbage")).toBe("invalid");
    expect(getStripeKeyMode("")).toBe("invalid");
  });
});

describe("isStripeLiveModeEnabled", () => {
  it("returns false when the flag is missing", () => {
    expect(isStripeLiveModeEnabled({})).toBe(false);
  });

  it("returns false for non-'true' values", () => {
    expect(isStripeLiveModeEnabled({ STRIPE_LIVE_MODE: "false" })).toBe(false);
    expect(isStripeLiveModeEnabled({ STRIPE_LIVE_MODE: "1" })).toBe(false);
    expect(isStripeLiveModeEnabled({ STRIPE_LIVE_MODE: "" })).toBe(false);
  });

  it("returns true for 'true' (whitespace tolerated)", () => {
    expect(isStripeLiveModeEnabled({ STRIPE_LIVE_MODE: "true" })).toBe(true);
    expect(isStripeLiveModeEnabled({ STRIPE_LIVE_MODE: "  true  " })).toBe(
      true
    );
  });
});

describe("getUsableStripeKey", () => {
  it("returns stripe_not_configured when the key is missing", () => {
    expect(getUsableStripeKey({})).toEqual({
      ok: false,
      error: "stripe_not_configured",
    });
  });

  it("returns stripe_not_configured when the key is blank", () => {
    expect(getUsableStripeKey({ STRIPE_SECRET_KEY: "   " })).toEqual({
      ok: false,
      error: "stripe_not_configured",
    });
  });

  it("returns invalid_key for keys with an invalid prefix", () => {
    expect(getUsableStripeKey({ STRIPE_SECRET_KEY: "pk_test_x" })).toEqual({
      ok: false,
      error: "invalid_key",
    });
    expect(getUsableStripeKey({ STRIPE_SECRET_KEY: "garbage" })).toEqual({
      ok: false,
      error: "invalid_key",
    });
  });

  it("returns live_mode_disabled for a live key without the opt-in flag", () => {
    expect(getUsableStripeKey({ STRIPE_SECRET_KEY: "sk_live_x" })).toEqual({
      ok: false,
      error: "live_mode_disabled",
    });
    expect(
      getUsableStripeKey({
        STRIPE_SECRET_KEY: "rk_live_x",
        STRIPE_LIVE_MODE: "false",
      })
    ).toEqual({ ok: false, error: "live_mode_disabled" });
  });

  it("returns ok with mode 'test' for a sk_test_ key", () => {
    expect(getUsableStripeKey({ STRIPE_SECRET_KEY: "sk_test_x" })).toEqual({
      ok: true,
      key: "sk_test_x",
      mode: "test",
    });
  });

  it("returns ok with mode 'test' for a rk_test_ key", () => {
    expect(getUsableStripeKey({ STRIPE_SECRET_KEY: "rk_test_x" })).toEqual({
      ok: true,
      key: "rk_test_x",
      mode: "test",
    });
  });

  it("returns ok with mode 'live' for a live key when live mode is enabled", () => {
    expect(
      getUsableStripeKey({
        STRIPE_SECRET_KEY: "sk_live_x",
        STRIPE_LIVE_MODE: "true",
      })
    ).toEqual({ ok: true, key: "sk_live_x", mode: "live" });
  });

  it("trims the resolved key", () => {
    expect(
      getUsableStripeKey({ STRIPE_SECRET_KEY: "  sk_test_x  " })
    ).toEqual({ ok: true, key: "sk_test_x", mode: "test" });
  });
});

describe("createStripeClient", () => {
  it("creates a Stripe instance", () => {
    const client = createStripeClient("sk_test_dummy");
    expect(client).toBeInstanceOf(Stripe);
  });
});

describe("describeProduct", () => {
  it("describes an one-time credit pack", () => {
    expect(describeProduct(creditPack)).toBe(
      "100 credits for AI video generation on aidv.ai"
    );
  });

  it("describes a monthly subscription with grouped thousands", () => {
    expect(describeProduct(subscriptionProduct)).toBe(
      "1,000 credits per month for AI video generation on aidv.ai"
    );
  });

  it("describes a yearly subscription", () => {
    expect(describeProduct(yearlyProduct)).toBe(
      "12,000 credits per year for AI video generation on aidv.ai"
    );
  });
});

describe("statement descriptor suffix", () => {
  it("uses the site id as checkout site", () => {
    expect(CHECKOUT_SITE_ID).toBe("aidv.ai");
  });

  it("fits Stripe's 22-character limit", () => {
    expect(STATEMENT_DESCRIPTOR_SUFFIX.length).toBeGreaterThan(0);
    expect(STATEMENT_DESCRIPTOR_SUFFIX.length).toBeLessThanOrEqual(22);
  });

  it("contains only allowed characters", () => {
    expect(STATEMENT_DESCRIPTOR_SUFFIX).toMatch(/^[A-Za-z0-9 .-]+$/);
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
      site: "aidv.ai",
    });

    const lineItems = params.line_items;
    expect(lineItems).toHaveLength(1);
    expect(lineItems?.[0].quantity).toBe(1);

    const priceData = lineItems?.[0].price_data;
    expect(priceData?.currency).toBe("usd");
    expect(priceData?.unit_amount).toBe(1999);
    expect(priceData?.recurring).toEqual({ interval: "month" });
    expect(priceData?.product_data).toEqual({
      name: "Pro Monthly",
      description:
        "1,000 credits per month for AI video generation on aidv.ai",
    });

    expect(params.subscription_data?.metadata).toEqual({
      userId: "user_1",
      productId: "pro-monthly",
      site: "aidv.ai",
    });
    expect(params.payment_intent_data).toBeUndefined();
    expect(params.success_url).toBe(
      "https://example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}"
    );
    expect(params.cancel_url).toBe("https://example.com/checkout/cancel");
  });

  it("sets price_data.product_data.description for one-time products", () => {
    const params = buildCheckoutSessionParams({
      product: creditPack,
      userId: "user_2",
      origin: "https://example.com",
    });

    const priceData = params.line_items?.[0].price_data;
    expect(priceData?.product_data).toEqual({
      name: "Small Pack",
      description: "100 credits for AI video generation on aidv.ai",
    });
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
      site: "aidv.ai",
    });

    const priceData = params.line_items?.[0].price_data;
    expect(priceData?.currency).toBe("usd");
    expect(priceData?.unit_amount).toBe(999);
    expect(priceData?.recurring).toBeUndefined();

    expect(params.subscription_data).toBeUndefined();
    expect(params.payment_intent_data?.metadata).toEqual({
      userId: "user_2",
      productId: "pack-small",
      site: "aidv.ai",
    });
    expect(params.payment_intent_data?.statement_descriptor_suffix).toBe(
      "AIDV"
    );
  });
});
