import { getProductById, getProductExpiryDays } from "@/config/credits";
import { CreditTransType, creditService } from "@/services/credit";

import type { GrantCreditsOnce } from "@/payment/stripe-webhook";

/**
 * Grants credits exactly once per `orderNo`.
 *
 * Three layers of protection on Cloudflare D1:
 * 1. Callers derive a stable `orderNo` per Stripe session/event, so retries
 *    reuse the same key.
 * 2. D1 executes the package and audit inserts as one atomic batch.
 * 3. Unique indexes on `order_no` make concurrent webhook retries no-ops.
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

  const result = await creditService.recharge({
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

  return result.created ? "granted" : "duplicate";
};
