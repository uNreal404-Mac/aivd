import Stripe from "stripe";
import type { CreditPackageConfig } from "@/config/credits";

const STRIPE_SECRET_KEY_VAR = "STRIPE_SECRET_KEY";
const STRIPE_LIVE_MODE_VAR = "STRIPE_LIVE_MODE";

/**
 * Read the Stripe secret key from a (possibly injected) environment object.
 *
 * Uses bracket access with a dynamic object so bundlers do not inline the
 * value at build time — required for Cloudflare Workers.
 */
export function getStripeSecretKey(
  env: Record<string, string | undefined> = process.env
): string | null {
  return env[STRIPE_SECRET_KEY_VAR]?.trim() || null;
}

export type StripeKeyMode = "test" | "live" | "invalid";

/**
 * Classify a Stripe secret/restricted key by its prefix.
 *
 * - `sk_test_` / `rk_test_` → `"test"`
 * - `sk_live_` / `rk_live_` → `"live"`
 * - anything else → `"invalid"` (e.g. publishable `pk_*` keys)
 */
export function getStripeKeyMode(key: string): StripeKeyMode {
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) {
    return "test";
  }
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) {
    return "live";
  }
  return "invalid";
}

/**
 * Whether live mode has been explicitly opted into via `STRIPE_LIVE_MODE`.
 *
 * Uses bracket access with a dynamic key so bundlers do not inline the value
 * at build time — required for Cloudflare Workers.
 */
export function isStripeLiveModeEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env[STRIPE_LIVE_MODE_VAR]?.trim() === "true";
}

export type UsableStripeKey =
  | { ok: true; key: string; mode: "test" | "live" }
  | {
      ok: false;
      error: "stripe_not_configured" | "live_mode_disabled" | "invalid_key";
    };

/**
 * Resolve the configured Stripe key into a usable key, or a reason why it
 * cannot be used. Live keys are refused unless `STRIPE_LIVE_MODE` is `"true"`.
 */
export function getUsableStripeKey(
  env: Record<string, string | undefined> = process.env
): UsableStripeKey {
  const key = getStripeSecretKey(env);
  if (!key) {
    return { ok: false, error: "stripe_not_configured" };
  }

  const mode = getStripeKeyMode(key);
  if (mode === "invalid") {
    return { ok: false, error: "invalid_key" };
  }

  if (mode === "live" && !isStripeLiveModeEnabled(env)) {
    return { ok: false, error: "live_mode_disabled" };
  }

  return { ok: true, key, mode };
}

/** Create a Stripe client using the Workers-compatible fetch HTTP client. */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export interface BuildCheckoutSessionParamsArgs {
  product: CreditPackageConfig;
  userId: string;
  origin: string;
}

/**
 * Build the Stripe Checkout Session params for a credit product.
 *
 * Pure function — no network calls, no database access.
 */
export function buildCheckoutSessionParams({
  product,
  userId,
  origin,
}: BuildCheckoutSessionParamsArgs): Stripe.Checkout.SessionCreateParams {
  const isSubscription = product.type === "subscription";

  const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
    currency: product.price.currency.toLowerCase(),
    unit_amount: product.price.amount,
    product_data: {
      name: product.name,
    },
  };

  if (isSubscription) {
    priceData.recurring = {
      interval: product.billingPeriod ?? "month",
    };
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: isSubscription ? "subscription" : "payment",
    line_items: [
      {
        quantity: 1,
        price_data: priceData,
      },
    ],
    client_reference_id: userId,
    metadata: {
      userId,
      productId: product.id,
    },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel`,
  };

  if (isSubscription) {
    params.subscription_data = {
      metadata: {
        userId,
        productId: product.id,
      },
    };
  } else {
    params.payment_intent_data = {
      metadata: {
        userId,
        productId: product.id,
      },
    };
  }

  return params;
}
