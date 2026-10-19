import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { getProductById } from "@/config/credits";
import { getCurrentUser } from "@/lib/auth";
import { isPaymentsConfigured } from "@/lib/payments";
import { createRateLimiter } from "@/lib/rate-limit";
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

  let body: { productId?: string };
  try {
    body = (await req.json()) as { productId?: string };
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
    session = await createStripeClient(keyResult.key).checkout.sessions.create(
      buildCheckoutSessionParams({ product, userId: user.id, origin })
    );
  } catch (error) {
    // Never log the key or full error payload; keep the message short.
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Stripe checkout session creation failed: ${message}`);
    return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
};
