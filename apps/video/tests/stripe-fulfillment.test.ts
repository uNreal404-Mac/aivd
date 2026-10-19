import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db, creditPackages } from "@/db";
import { CREDIT_PACKAGES } from "@/config/pricing-user";
import {
  d1WebhookEventStore,
  grantCreditsOnce,
  revokeCreditsForOrder,
} from "@/payment/stripe-fulfillment";
import { creditService } from "@/services/credit";
import { uniqueUserId } from "./helpers";

const foundProduct = CREDIT_PACKAGES.find((p) => p.enabled);
if (!foundProduct) {
  throw new Error("No enabled credit package configured");
}
const product = foundProduct;

async function countPackagesForOrder(orderNo: string): Promise<number> {
  const rows = await db
    .select({ id: creditPackages.id })
    .from(creditPackages)
    .where(eq(creditPackages.orderNo, orderNo));
  return rows.length;
}

describe("grantCreditsOnce", () => {
  it("grants once then reports duplicate for the same orderNo", async () => {
    const userId = uniqueUserId("stripe_seq");
    const orderNo = `stripe_test_${userId}`;

    const first = await grantCreditsOnce({
      orderNo,
      userId,
      productId: product.id,
    });
    const second = await grantCreditsOnce({
      orderNo,
      userId,
      productId: product.id,
    });

    expect(first).toBe("granted");
    expect(second).toBe("duplicate");
    expect(await countPackagesForOrder(orderNo)).toBe(1);
  });

  it("grants exactly once under concurrent calls for the same orderNo", async () => {
    const userId = uniqueUserId("stripe_conc");
    const orderNo = `stripe_test_${userId}`;

    const results = await Promise.all([
      grantCreditsOnce({ orderNo, userId, productId: product.id }),
      grantCreditsOnce({ orderNo, userId, productId: product.id }),
    ]);

    expect(results.filter((r) => r === "granted")).toHaveLength(1);
    expect(await countPackagesForOrder(orderNo)).toBe(1);
  });
});

describe("revokeCreditsForOrder", () => {
  it("revokes all remaining credits for a full refund", async () => {
    const userId = uniqueUserId("stripe_refund_full");
    const orderNo = `stripe_test_${userId}`;

    await grantCreditsOnce({ orderNo, userId, productId: product.id });

    const status = await revokeCreditsForOrder({
      orderNo,
      revokeOrderNo: `stripe_refund_evt_${userId}`,
      ratio: 1,
      reason: "refund",
    });

    expect(status).toBe("revoked");
    const balance = await creditService.getBalance(userId);
    expect(balance.availableCredits).toBe(0);
  });

  it("reports duplicate for the same revokeOrderNo", async () => {
    const userId = uniqueUserId("stripe_refund_dup");
    const orderNo = `stripe_test_${userId}`;
    const revokeOrderNo = `stripe_refund_evt_${userId}`;

    await grantCreditsOnce({ orderNo, userId, productId: product.id });

    const first = await revokeCreditsForOrder({
      orderNo,
      revokeOrderNo,
      ratio: 1,
      reason: "refund",
    });
    const second = await revokeCreditsForOrder({
      orderNo,
      revokeOrderNo,
      ratio: 1,
      reason: "refund",
    });

    expect(first).toBe("revoked");
    expect(second).toBe("duplicate");
    expect((await creditService.getBalance(userId)).availableCredits).toBe(0);
  });

  it("revokes cumulatively up to the initial amount across revokeOrderNos", async () => {
    const userId = uniqueUserId("stripe_refund_partial");
    const orderNo = `stripe_test_${userId}`;

    await grantCreditsOnce({ orderNo, userId, productId: product.id });

    const first = await revokeCreditsForOrder({
      orderNo,
      revokeOrderNo: `stripe_refund_a_${userId}`,
      ratio: 0.5,
      reason: "refund",
    });
    expect(first).toBe("revoked");

    const half = Math.floor(product.credits * 0.5);
    expect((await creditService.getBalance(userId)).availableCredits).toBe(
      product.credits - half
    );

    const second = await revokeCreditsForOrder({
      orderNo,
      revokeOrderNo: `stripe_refund_b_${userId}`,
      ratio: 1,
      reason: "refund",
    });
    expect(second).toBe("revoked");
    expect((await creditService.getBalance(userId)).availableCredits).toBe(0);
  });

  it("reports not_found for an unknown orderNo", async () => {
    const status = await revokeCreditsForOrder({
      orderNo: `stripe_missing_${uniqueUserId("order")}`,
      revokeOrderNo: `stripe_refund_missing_${uniqueUserId("evt")}`,
      ratio: 1,
      reason: "refund",
    });

    expect(status).toBe("not_found");
  });
});

describe("d1WebhookEventStore", () => {
  it("records processed events idempotently", async () => {
    const eventId = uniqueUserId("evt");
    const args = {
      eventId,
      type: "checkout.session.completed",
      livemode: false,
      result: '{"received":true}',
    };

    expect(await d1WebhookEventStore.isProcessed(eventId)).toBe(false);

    await d1WebhookEventStore.markProcessed(args);
    expect(await d1WebhookEventStore.isProcessed(eventId)).toBe(true);

    await expect(
      d1WebhookEventStore.markProcessed(args)
    ).resolves.toBeUndefined();
    expect(await d1WebhookEventStore.isProcessed(eventId)).toBe(true);
  });
});

