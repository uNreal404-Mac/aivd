import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { safeReturnTo } from "@/lib/credit-return";

import { getProductById } from "@/config/credits";
import { getCurrentUser } from "@/lib/auth";
import { isPaymentsConfigured } from "@/lib/payments";
import { createRateLimiter } from "@/lib/rate-limit";
import { firstMonthDiscount, hasPaidBefore } from "@/payment/offers";
import {
  buildCheckoutSessionParams,
  createStripeClient,
  getUsableStripeKey,
} from "@/payment/stripe-checkout";

export const dynamic = "force-dynamic";

const checkoutLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

export const POST = async (req: NextRequest) => {
  if (!isPaymentsConfigured()) {
    return NextResponse.json(
      { error: "payments_not_configured" },
      { status: 503 }
    );
  }

  const keyResult = getUsableStripeKey();
  if (!keyResult.ok) {
    return NextResponse.json({ error: keyResult.error }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limitResult = checkoutLimiter.check(`user:${user.id}`);
  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(limitResult.retryAfterSeconds),
        },
      }
    );
  }

  let body: { productId?: string; returnTo?: string };
  try {
    body = (await req.json()) as { productId?: string; returnTo?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const product = body.productId ? getProductById(body.productId) : undefined;
  if (!product) {
    return NextResponse.json({ error: "invalid_product" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;

  let session: Stripe.Checkout.Session;
  try {
    const stripe = createStripeClient(keyResult.key);

    // First-month price: only for an account that has never paid. The coupon
    // is created once and reused; it takes a fixed amount off the first
    // invoice, so renewals are charged the list price.
    let couponId: string | undefined;
    const discount = firstMonthDiscount(product);
    if (discount && !(await hasPaidBefore(user.id))) {
      try {
        await stripe.coupons.retrieve(discount.couponId);
      } catch {
        await stripe.coupons.create({
          id: discount.couponId,
          amount_off: discount.amountOffCents,
          currency: discount.currency,
          duration: "once",
          name: "First month offer",
        });
      }
      couponId = discount.couponId;
    }

    session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams({ product, userId: user.id, origin, couponId, returnTo: safeReturnTo(body.returnTo) })
    );
  } catch (error) {
    // Never log the key or full error payload; keep the message short.
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Stripe checkout session creation failed: ${message}`);
    return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
};
