import Stripe from "stripe";
import type { CreditPackageConfig } from "@/config/credits";

const STRIPE_SECRET_KEY_VAR = "STRIPE_SECRET_KEY";
const STRIPE_LIVE_MODE_VAR = "STRIPE_LIVE_MODE";

/** Site identifier attached to all checkout metadata. */
export const CHECKOUT_SITE_ID = "aidv.ai";
/**
 * The name buyers see on the Stripe page. CHECKOUT_SITE_ID above is an
 * internal metadata tag that existing orders and webhooks already carry, so it
 * keeps its historical spelling; the visible name is the real domain.
 */
export const CHECKOUT_DISPLAY_NAME = "aivd.ai";

/** Statement descriptor suffix (card payments only, max 22 chars). */
export const STATEMENT_DESCRIPTOR_SUFFIX = "AIDV";

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

/**
 * Human-readable product description shown on the Stripe Checkout page.
 *
 * Examples:
 * - one-time: "100 credits for AI video generation on aivd.ai"
 * - monthly: "1,000 credits per month for AI video generation on aivd.ai"
 * - yearly: "1,000 credits per year for AI video generation on aivd.ai"
 */
export function describeProduct(product: CreditPackageConfig): string {
  const credits = product.credits.toLocaleString("en-US");

  if (product.type === "subscription") {
    const period = product.billingPeriod === "year" ? "year" : "month";
    return `${credits} credits per ${period} for AI video generation on ${CHECKOUT_DISPLAY_NAME}`;
  }

  return `${credits} credits for AI video generation on ${CHECKOUT_DISPLAY_NAME}`;
}

export interface BuildCheckoutSessionParamsArgs {
  product: CreditPackageConfig;
  userId: string;
  origin: string;
  /** Id of a one-time Stripe coupon to apply (the first-month offer). */
  couponId?: string;
  returnTo?: string | null;
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
  couponId,
  returnTo,
}: BuildCheckoutSessionParamsArgs): Stripe.Checkout.SessionCreateParams {
  const isSubscription = product.type === "subscription";

  const metadata: Record<string, string> = {
    userId,
    productId: product.id,
    site: CHECKOUT_SITE_ID,
  };

  const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
    currency: product.price.currency.toLowerCase(),
    unit_amount: product.price.amount,
    product_data: {
      name: product.name,
      description: describeProduct(product),
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
    metadata: { ...metadata },
    success_url: `${origin}${returnTo?.startsWith("/zh/") ? "/zh" : ""}/checkout/success?session_id={CHECKOUT_SESSION_ID}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`,
    cancel_url: `${origin}${returnTo?.startsWith("/zh/") ? "/zh" : ""}/checkout/cancel${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`,
  };

  if (couponId) {
    params.discounts = [{ coupon: couponId }];
    metadata.offer = "first_month";
    params.metadata = { ...metadata };
  }

  if (isSubscription) {
    // NOTE: Stripe rejects `payment_intent_data` when mode=subscription.
    params.subscription_data = {
      metadata: { ...metadata },
    };
  } else {
    // Statement descriptor suffix applies to card payments only.
    params.payment_intent_data = {
      metadata: { ...metadata },
      statement_descriptor_suffix: STATEMENT_DESCRIPTOR_SUFFIX,
    };
  }

  return params;
}
