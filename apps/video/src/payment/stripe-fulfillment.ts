import { eq, sql } from "drizzle-orm";

import { getProductById, getProductExpiryDays } from "@/config/credits";
import { creditPackages, db } from "@/db";
import { CreditTransType, creditService } from "@/services/credit";

import type { GrantCreditsOnce } from "@/payment/stripe-webhook";

/**
 * Grants credits exactly once per `orderNo`.
 *
 * Mirrors the Creem `onGrantAccess` dedupe: a transaction-scoped advisory lock
 * serializes concurrent deliveries for the same order, and the
 * `creditPackages.orderNo` lookup makes the grant idempotent (Stripe retries
 * with the same `event.id`, so the derived `orderNo` is stable).
 */
export const grantCreditsOnce: GrantCreditsOnce = async ({
  orderNo,
  userId,
  productId,
}) => {
  const product = getProductById(productId);
  if (!product) {
    return "unknown_product";
  }

  const result = await db.transaction(async (trx) => {
    await trx.execute(sql`select pg_advisory_xact_lock(hashtext(${orderNo}))`);

    const [existing] = await trx
      .select({ id: creditPackages.id })
      .from(creditPackages)
      .where(eq(creditPackages.orderNo, orderNo))
      .limit(1);

    if (existing) {
      return "duplicate" as const;
    }

    await creditService.recharge({
      userId,
      credits: product.credits,
      orderNo,
      transType:
        product.type === "subscription"
          ? CreditTransType.SUBSCRIPTION
          : CreditTransType.ORDER_PAY,
      expiryDays: getProductExpiryDays(product),
      remark: `Stripe payment: ${product.name}`,
    });

    return "granted" as const;
  });

  return result;
};
