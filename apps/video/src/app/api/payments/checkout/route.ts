import { NextResponse, type NextRequest } from "next/server";

import { getProductById } from "@/config/credits";
import { getCurrentUser } from "@/lib/auth";
import { isPaymentsConfigured } from "@/lib/payments";
import {
  buildCheckoutSessionParams,
  createStripeClient,
  getStripeSecretKey,
} from "@/payment/stripe-checkout";

export const dynamic = "force-dynamic";

export const POST = async (req: NextRequest) => {
  if (!isPaymentsConfigured()) {
    return NextResponse.json(
      { error: "payments_not_configured" },
      { status: 503 }
    );
  }

  const secretKey = getStripeSecretKey();
  if (!secretKey || !secretKey.startsWith("sk_test_")) {
    return NextResponse.json({ error: "test_mode_only" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const session = await createStripeClient(secretKey).checkout.sessions.create(
    buildCheckoutSessionParams({ product, userId: user.id, origin })
  );

  return NextResponse.json({ url: session.url });
};
