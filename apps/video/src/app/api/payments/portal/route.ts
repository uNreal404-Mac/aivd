import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isPaymentsConfigured } from "@/lib/payments";
import { portalPreflight } from "@/lib/portal-guard";
import {
  createStripeClient,
  getStripeSecretKey,
} from "@/payment/stripe-checkout";

export const dynamic = "force-dynamic";

export const POST = async (req: NextRequest) => {
  const user = await getCurrentUser();
  const secretKey = getStripeSecretKey();

  const preflight = portalPreflight({
    authenticated: user !== null,
    paymentsConfigured: isPaymentsConfigured(),
    secretKey,
  });

  if (preflight) {
    return NextResponse.json(
      { error: preflight.error },
      { status: preflight.status }
    );
  }

  // `portalPreflight` already returned 401/503 when these were missing.
  const authUserId = user!.id;
  const stripeKey = secretKey!;

  const rows = await db
    .select({ stripeCustomerId: customers.stripeCustomerId })
    .from(customers)
    .where(eq(customers.authUserId, authUserId))
    .limit(1);

  const stripeCustomerId = rows[0]?.stripeCustomerId;
  if (!stripeCustomerId) {
    return NextResponse.json({ error: "no_customer" }, { status: 404 });
  }

  const origin = new URL(req.url).origin;

  const session = await createStripeClient(stripeKey).billingPortal.sessions.create(
    {
      customer: stripeCustomerId,
      return_url: `${origin}/account`,
    }
  );

  return NextResponse.json({ url: session.url });
};
