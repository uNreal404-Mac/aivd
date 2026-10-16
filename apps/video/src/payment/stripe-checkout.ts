import Stripe from "stripe";
import type { CreditPackageConfig } from "@/config/credits";

const STRIPE_SECRET_KEY_VAR = "STRIPE_SECRET_KEY";

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
