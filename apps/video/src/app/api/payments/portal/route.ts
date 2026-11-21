import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isPaymentsConfigured } from "@/lib/payments";
import {
  createStripeClient,
  getUsableStripeKey,
} from "@/payment/stripe-checkout";
import {
  findStripeSubscriber,
  recordStripeSubscriber,
} from "@/payment/stripe-customer";

export const dynamic = "force-dynamic";

export const POST = async (req: NextRequest) => {
  if (!isPaymentsConfigured()) {
    return NextResponse.json(
      { error: "payments_not_configured" },
      { status: 503 }
    );
  }

  // Same key rules as checkout: test keys work, live keys only once
  // STRIPE_LIVE_MODE is "true". Anyone who could pay must be able to cancel.
  const keyResult = getUsableStripeKey();
  if (!keyResult.ok) {
    return NextResponse.json({ error: keyResult.error }, { status: 503 });
  }
  const stripe = createStripeClient(keyResult.key);

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({ stripeCustomerId: customers.stripeCustomerId })
    .from(customers)
    .where(eq(customers.authUserId, user.id))
    .limit(1);

  let stripeCustomerId = rows[0]?.stripeCustomerId ?? null;
  if (!stripeCustomerId) {
    // Subscribed before subscribers were recorded, or the webhook was missed:
    // find the subscription by the userId checkout put in its metadata, and
    // save the link so the next visit skips the search.
    const found = await findStripeSubscriber(stripe, user.id);
    if (found) {
      await recordStripeSubscriber(found);
      stripeCustomerId = found.stripeCustomerId;
    }
  }
  if (!stripeCustomerId) {
    return NextResponse.json({ error: "no_customer" }, { status: 404 });
  }

  const origin = new URL(req.url).origin;
  const locale = req.headers.get("referer")?.match(/^https?:\/\/[^/]+\/zh(\/|$)/) ? "/zh" : "";

  let url: string;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}${locale}/account`,
      ...(locale ? { locale: "zh" as const } : {}),
    });
    url = session.url;
  } catch (error) {
    // E.g. the key lacks Customer Portal write permission, or no portal
    // configuration is saved in the Stripe dashboard. Logged for us; the
    // subscriber gets a message pointing to support instead of a bare 500.
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[stripe] billing portal session failed: ${message}`);
    return NextResponse.json({ error: "portal_unavailable" }, { status: 502 });
  }

  return NextResponse.json({ url });
};
