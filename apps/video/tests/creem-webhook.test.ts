import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db, creditPackages } from "@/db";
import { CREDIT_PACKAGES } from "@/config/pricing-user";
import { uniqueUserId } from "./helpers";

const WEBHOOK_SECRET = "whsec_test_fixture_secret";
const APP_URL = "http://localhost:3000";
const WEBHOOK_PATH = "/api/auth/creem/webhook";

type AuthHandler = (request: Request) => Promise<Response>;

let authHandler: AuthHandler;

const oneTimeProduct = CREDIT_PACKAGES.find((p) => p.enabled);
if (!oneTimeProduct) {
  throw new Error("No enabled credit package found in CREDIT_PACKAGES");
}

function signBody(body: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

function buildCheckoutCompletedBody(params: {
  userId: string;
  orderId: string;
  eventId: string;
}): string {
  const { userId, orderId, eventId } = params;
  const event = {
    eventType: "checkout.completed",
    id: eventId,
    created_at: Date.now(),
    object: {
      object: "checkout",
      id: `chk_${eventId}`,
      request_id: `req_${eventId}`,
      status: "completed",
      metadata: {
        referenceId: userId,
      },
      order: {
        object: "order",
        id: orderId,
        amount: Math.round(oneTimeProduct.priceUsd * 100),
        currency: "USD",
        status: "paid",
      },
      customer: {
        object: "customer",
        id: `cust_${userId}`,
        email: `${userId}@example.com`,
        name: "Test User",
      },
      product: {
        object: "product",
        id: oneTimeProduct.id,
        name: oneTimeProduct.name,
        billing_type: "onetime",
        price: Math.round(oneTimeProduct.priceUsd * 100),
        currency: "USD",
      },
    },
  };
  return JSON.stringify(event);
}

async function postWebhook(body: string, signature: string): Promise<Response> {
  const request = new Request(`${APP_URL}${WEBHOOK_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "creem-signature": signature,
    },
    body,
  });
  return authHandler(request);
}

async function countPackagesForOrder(orderNo: string): Promise<number> {
  const rows = await db
    .select({ id: creditPackages.id })
    .from(creditPackages)
    .where(eq(creditPackages.orderNo, orderNo));
  return rows.length;
}

async function getAvailableCredits(userId: string): Promise<number> {
  const { creditService } = await import("@/services/credit");
  const balance = await creditService.getBalance(userId);
  return balance.availableCredits;
}

/**
 * @creem_io/better-auth's webhook handler invokes options.onCheckoutCompleted(...)
 * WITHOUT awaiting it and immediately returns HTTP 200. The credit-granting work
 * therefore continues after the HTTP response has been sent. Tests must wait for
 * that background processing to finish before asserting on DB state.
 *
 * Strategy: poll the DB until at least one package exists for the orderNo (up to
 * 5s, every 100ms), then wait an extra 500ms so any duplicate in-flight
 * processing (e.g. the select-then-insert race) has time to settle before we
 * assert exact counts.
 */
async function waitForPackageProcessing(orderNo: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const count = await countPackagesForOrder(orderNo);
    if (count >= 1) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // Allow any duplicate in-flight processing to settle before asserting counts.
  await new Promise((resolve) => setTimeout(resolve, 500));
}

beforeAll(async () => {
  process.env.BETTER_AUTH_SECRET = "test-secret-not-real";
  process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  process.env.GOOGLE_CLIENT_ID = "test";
  process.env.GOOGLE_CLIENT_SECRET = "test";
  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_FROM = "test@example.com";
  process.env.CREEM_API_KEY = "creem_test_dummy_not_real";
  process.env.CREEM_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.NEXT_PUBLIC_BILLING_PROVIDER = "creem";

  const { auth } = await import("@/lib/auth/auth");
  authHandler = auth.handler as AuthHandler;
});

describe("creem webhook idempotency", () => {
  it("creem duplicate checkout.completed delivery credits once", async () => {
    const userId = uniqueUserId("creem_seq");
    const orderId = `ord_seq_${userId}`;
    const eventId = `evt_seq_${userId}`;
    const orderNo = `creem_${orderId}`;

    const body = buildCheckoutCompletedBody({ userId, orderId, eventId });
    const signature = signBody(body);

    const before = await getAvailableCredits(userId);

    for (let i = 0; i < 3; i++) {
      const response = await postWebhook(body, signature);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
    }

    await waitForPackageProcessing(orderNo);

    const packageCount = await countPackagesForOrder(orderNo);
    expect(packageCount).toBe(1);

    const after = await getAvailableCredits(userId);
    expect(after - before).toBe(oneTimeProduct.credits);
  });

  it("creem concurrent duplicate deliveries credit once", async () => {
    const userId = uniqueUserId("creem_conc");
    const orderId = `ord_conc_${userId}`;
    const eventId = `evt_conc_${userId}`;
    const orderNo = `creem_${orderId}`;

    const body = buildCheckoutCompletedBody({ userId, orderId, eventId });
    const signature = signBody(body);

    const before = await getAvailableCredits(userId);

    const responses = await Promise.all([
      postWebhook(body, signature),
      postWebhook(body, signature),
      postWebhook(body, signature),
    ]);

    for (const response of responses) {
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
    }

    await waitForPackageProcessing(orderNo);

    const packageCount = await countPackagesForOrder(orderNo);
    expect(packageCount).toBe(1);

    const after = await getAvailableCredits(userId);
    expect(after - before).toBe(oneTimeProduct.credits);
  });

  it("creem webhook with invalid signature is rejected and grants nothing", async () => {
    const userId = uniqueUserId("creem_bad");
    const orderId = `ord_bad_${userId}`;
    const eventId = `evt_bad_${userId}`;
    const orderNo = `creem_${orderId}`;

    const body = buildCheckoutCompletedBody({ userId, orderId, eventId });
    const badSignature = signBody(`${body}tampered`);

    const response = await postWebhook(body, badSignature);

    // The plugin calls ctx.json({ error: "Invalid signature" }, { status: 400 }),
    // but the Better Auth endpoint wrapper actually returns HTTP 200 with that
    // JSON body (observed status 200). Assert on the body instead of the status.
    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toBe("Invalid signature");

    const packageCount = await countPackagesForOrder(orderNo);
    expect(packageCount).toBe(0);

    const credits = await getAvailableCredits(userId);
    expect(credits).toBe(0);
  });
});
