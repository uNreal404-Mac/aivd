import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isPaymentsConfigured } from "@/lib/payments";
import {
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

  const rows = await db
    .select({ stripeCustomerId: customers.stripeCustomerId })
    .from(customers)
    .where(eq(customers.authUserId, user.id))
    .limit(1);

  const stripeCustomerId = rows[0]?.stripeCustomerId;
  if (!stripeCustomerId) {
    return NextResponse.json({ error: "no_customer" }, { status: 404 });
  }

  const origin = new URL(req.url).origin;

  const session = await createStripeClient(secretKey).billingPortal.sessions.create(
    {
      customer: stripeCustomerId,
      return_url: `${origin}/account`,
    }
  );

  return NextResponse.json({ url: session.url });
};
