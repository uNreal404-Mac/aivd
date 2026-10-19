import { NextResponse, type NextRequest } from "next/server";

import {
  createStripeClient,
  getUsableStripeKey,
} from "@/payment/stripe-checkout";
import { grantCreditsOnce } from "@/payment/stripe-fulfillment";
import { handleStripeWebhook } from "@/payment/stripe-webhook";

const STRIPE_WEBHOOK_SECRET_VAR = "STRIPE_WEBHOOK_SECRET";

export const dynamic = "force-dynamic";

export const POST = async (req: NextRequest) => {
  const keyResult = getUsableStripeKey();
  if (!keyResult.ok) {
    return NextResponse.json({ error: keyResult.error }, { status: 503 });
  }

  const webhookSecret = process.env[STRIPE_WEBHOOK_SECRET_VAR]?.trim();

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 503 }
    );
  }

  try {
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature");

    const result = await handleStripeWebhook({
      payload,
      signature,
      webhookSecret,
      stripe: createStripeClient(keyResult.key),
      allowLivemode: keyResult.mode === "live",
      grantCreditsOnce,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    // Never leak verification details; 500 so Stripe retries the delivery.
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Stripe webhook failed: ${message}`);
    return NextResponse.json({ error: "webhook_failed" }, { status: 500 });
  }
};
