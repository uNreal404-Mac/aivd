import { eq, sql } from "drizzle-orm";

import { getProductById, getProductExpiryDays } from "@/config/credits";
import { creditPackages, db } from "@/db";
import { CreditTransType, creditService } from "@/services/credit";
import { referralService } from "@/services/referral";

import type { GrantCreditsOnce } from "@/payment/stripe-webhook";

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  if ((error as { code?: unknown }).code === "23505") {
    return true;
  }

  const cause = (error as { cause?: unknown }).cause;
  return (
    !!cause &&
    typeof cause === "object" &&
    (cause as { code?: unknown }).code === "23505"
  );
}

/**
 * Grants credits exactly once per `orderNo`.
 *
 * Three layers of protection:
 * 1. Callers derive a stable `orderNo` per Stripe session/event, so retries
 *    reuse the same key.
 * 2. A transaction-scoped advisory lock serializes concurrent deliveries for
 *    the same order, and the `creditPackages.orderNo` lookup is performed in
 *    the same transaction as the grant.
 * 3. A unique index on `credit_packages.order_no` is the final backstop; a
 *    racing insert surfaces Postgres error 23505 which we treat as a
 *    duplicate.
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

  try {
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

      await creditService.recharge(
        {
          userId,
          credits: product.credits,
          orderNo,
          transType:
            product.type === "subscription"
              ? CreditTransType.SUBSCRIPTION
              : CreditTransType.ORDER_PAY,
          expiryDays: getProductExpiryDays(product),
          remark: `Stripe payment: ${product.name}`,
        },
        trx
      );

      return "granted" as const;
    });

    if (result === "granted") {
      try {
        await referralService.rewardOnFirstPayment(userId);
      } catch (error) {
        console.error("[Referral] Failed to reward referral:", error);
      }
    }

    return result;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return "duplicate";
    }
    throw error;
  }
};
