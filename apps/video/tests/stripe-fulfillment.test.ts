import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db, creditPackages } from "@/db";
import { CREDIT_PACKAGES } from "@/config/pricing-user";
import { grantCreditsOnce } from "@/payment/stripe-fulfillment";
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
