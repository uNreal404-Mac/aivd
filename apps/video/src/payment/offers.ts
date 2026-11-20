import { and, eq, inArray, ne } from "drizzle-orm";

import type { CreditPackageConfig } from "@/config/credits";
import { FIRST_MONTH_OFFER, LAUNCH_OFFER, isLaunchOfferActive, planTierOfName } from "@/config/pricing-user";
import { CreditTransType, creditPackages, db } from "@/db";

/**
 * The two offers a first-time buyer can get, and the rules that keep them from
 * costing more than they bring in:
 *
 * - First month: the Pro monthly plan at FIRST_MONTH_OFFER.priceUsd for one
 *   month, then the list price.
 * - Launch bonus: extra credits on the first payment while LAUNCH_OFFER runs,
 *   for credit packs and yearly plans only. On a yearly plan the bonus is a
 *   share of ONE month's credits, not of the year's. Monthly plans get none:
 *   at 30% extra, Ultimate monthly would sell a credit for less than the most
 *   KIE cost it can stand for, and Pro monthly would keep about 3%.
 */

/** Whether the account has any paid purchase, other than `exceptOrderNo`. */
export async function hasPaidBefore(userId: string, exceptOrderNo?: string): Promise<boolean> {
  const paid = inArray(creditPackages.transType, [CreditTransType.ORDER_PAY, CreditTransType.SUBSCRIPTION]);
  const [row] = await db
    .select({ id: creditPackages.id })
    .from(creditPackages)
    .where(
      exceptOrderNo
        ? and(eq(creditPackages.userId, userId), paid, ne(creditPackages.orderNo, exceptOrderNo))
        : and(eq(creditPackages.userId, userId), paid),
    )
    .limit(1);
  return Boolean(row);
}

/** True for the one product the first-month price applies to. */
export function isFirstMonthOfferProduct(product: CreditPackageConfig): boolean {
  return (
    FIRST_MONTH_OFFER.enabled &&
    product.type === "subscription" &&
    (product.billingPeriod ?? "month") === "month" &&
    planTierOfName(product.name) === FIRST_MONTH_OFFER.tier
  );
}

/**
 * The one-time discount that brings the first month down to the offer price,
 * or null when the product is not covered. `couponId` carries the amount so a
 * changed offer never reuses a coupon for a different amount.
 */
export function firstMonthDiscount(product: CreditPackageConfig): { couponId: string; amountOffCents: number; currency: string } | null {
  if (!isFirstMonthOfferProduct(product)) return null;
  const amountOffCents = product.price.amount - Math.round(FIRST_MONTH_OFFER.priceUsd * 100);
  if (amountOffCents <= 0) return null;
  return { couponId: `aivd-first-month-${amountOffCents}`, amountOffCents, currency: product.price.currency.toLowerCase() };
}

/** Extra credits the launch offer adds to a first payment for `product`. */
export function launchBonusCredits(product: CreditPackageConfig, now: Date = new Date()): number {
  if (!isLaunchOfferActive(now)) return 0;
  if (product.type === "subscription" && product.billingPeriod !== "year") return 0;
  const base = product.type === "subscription" ? product.credits / 12 : product.credits;
  return Math.round((base * LAUNCH_OFFER.bonusPercent) / 100);
}

/** Order number of the bonus grant that belongs to a paid order. */
export function bonusOrderNo(orderNo: string): string {
  return `${orderNo}_bonus`;
}
