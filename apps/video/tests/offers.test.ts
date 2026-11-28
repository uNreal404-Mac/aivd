import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { getProductById } from "@/config/credits";
import { MAX_VIDEO_COST_PER_CREDIT_USD } from "@/config/kie-pricing";
import { CREDIT_PACKAGES, FIRST_MONTH_OFFER, LAUNCH_OFFER, SUBSCRIPTION_PRODUCTS, planTierOfName } from "@/config/pricing-user";
import { creditPackages, db } from "@/db";
import { creditPriceUsd, planOffers, usd } from "@/lib/pricing-offers";
import { bonusOrderNo, firstMonthDiscount, hasPaidBefore, isFirstMonthOfferProduct, launchBonusCredits } from "@/payment/offers";
import { buildCheckoutSessionParams } from "@/payment/stripe-checkout";
import { grantCreditsOnce, revokeCreditsForOrder } from "@/payment/stripe-fulfillment";
import { uniqueUserId } from "./helpers";

const product = (period: "month" | "year", tier: string) => {
  const found = SUBSCRIPTION_PRODUCTS.find((item) => item.period === period && planTierOfName(item.name) === tier);
  const config = found ? getProductById(found.id) : undefined;
  if (!config) throw new Error(`no ${tier} ${period} product`);
  return config;
};
const pack = () => {
  const config = getProductById(CREDIT_PACKAGES[0].id);
  if (!config) throw new Error("no pack");
  return config;
};
const creditsOf = async (orderNo: string) => {
  const [row] = await db.select({ credits: creditPackages.initialCredits, left: creditPackages.remainingCredits }).from(creditPackages).where(eq(creditPackages.orderNo, orderNo));
  return row;
};

const originalEndsAt = LAUNCH_OFFER.endsAt;
const startOffer = () => {
  LAUNCH_OFFER.endsAt = new Date(Date.now() + 86_400_000).toISOString();
};
afterEach(() => {
  LAUNCH_OFFER.endsAt = originalEndsAt;
});

describe("what the pricing page says about each plan", () => {
  const offers = planOffers();

  it("works every figure out from the config", () => {
    for (const offer of offers) {
      expect(offer.creditsPerYear).toBe(offer.creditsPerMonth * 12);
      expect(offer.yearlySavingUsd).toBeCloseTo(offer.monthlyPriceUsd * 12 - offer.yearlyPriceUsd, 2);
      expect(offer.yearlySavingPercent).toBe(Math.round((offer.yearlySavingUsd / (offer.monthlyPriceUsd * 12)) * 100));
      // The per-month figure never overstates the saving by more than a cent a month.
      expect(Math.abs(offer.yearlyPerMonthUsd * 12 - offer.yearlyPriceUsd)).toBeLessThan(0.15);
    }
  });

  it("gives every yearly tier 30% off and keeps bigger plans cheaper per credit", () => {
    const [basic, pro, ultimate] = offers;
    expect(basic.yearlySavingPercent).toBe(30);
    expect(pro.yearlySavingPercent).toBe(30);
    expect(ultimate.yearlySavingPercent).toBe(30);
    for (const period of ["month", "year"] as const) {
      expect(creditPriceUsd(pro, period), period).toBeLessThan(creditPriceUsd(basic, period));
      expect(creditPriceUsd(ultimate, period), period).toBeLessThan(creditPriceUsd(pro, period));
    }
  });

  it("gives higher plans more videos at once", () => {
    expect(offers.map((offer) => offer.concurrency)).toEqual([1, 3, 6]);
    // Nothing implements a priority queue yet, so no plan may claim one.
    expect(offers.map((offer) => offer.priorityQueue)).toEqual([false, false, false]);
  });

  it("writes prices with only the decimals they need", () => {
    expect(usd(9.9)).toBe("US$9.9");
    expect(usd(94.9)).toBe("US$94.9");
    expect(usd(24)).toBe("US$24");
    expect(usd(0.6435, 2)).toBe("US$0.64");
    expect(usd(23.9)).toBe("US$23.9");
  });
});

describe("first-month offer", () => {
  it("covers the Pro monthly plan only", () => {
    expect(isFirstMonthOfferProduct(product("month", "pro"))).toBe(true);
    expect(isFirstMonthOfferProduct(product("year", "pro"))).toBe(false);
    expect(isFirstMonthOfferProduct(product("month", "basic"))).toBe(false);
    expect(isFirstMonthOfferProduct(product("month", "ultimate"))).toBe(false);
    expect(isFirstMonthOfferProduct(pack())).toBe(false);
  });

  it("takes off exactly the gap between the list price and the offer price", () => {
    const pro = product("month", "pro");
    const discount = firstMonthDiscount(pro);
    expect(discount).not.toBeNull();
    expect(pro.price.amount - (discount?.amountOffCents ?? 0)).toBe(Math.round(FIRST_MONTH_OFFER.priceUsd * 100));
    expect(discount?.couponId).toContain(String(discount?.amountOffCents));
    expect(firstMonthDiscount(product("month", "basic"))).toBeNull();
  });

  it("puts the coupon on the checkout session and nowhere else", () => {
    const pro = product("month", "pro");
    const withCoupon = buildCheckoutSessionParams({ product: pro, userId: "u1", origin: "https://aivd.ai", couponId: "c1" });
    expect(withCoupon.discounts).toEqual([{ coupon: "c1" }]);
    expect(withCoupon.metadata?.offer).toBe("first_month");
    // The renewal price is still the list price: the discount is a one-time coupon, not a lower price.
    expect(withCoupon.line_items?.[0]?.price_data?.unit_amount).toBe(pro.price.amount);
    const plain = buildCheckoutSessionParams({ product: pro, userId: "u1", origin: "https://aivd.ai" });
    expect(plain.discounts).toBeUndefined();
    expect(plain.metadata?.offer).toBeUndefined();
  });
});

describe("launch bonus", () => {
  it("is off until an end date is set, and off again once it passes", () => {
    LAUNCH_OFFER.endsAt = null;
    expect(launchBonusCredits(pack())).toBe(0);
    LAUNCH_OFFER.endsAt = "2026-12-20T00:00:00Z";
    expect(launchBonusCredits(pack(), new Date("2026-12-19T23:59:59Z"))).toBeGreaterThan(0);
    expect(launchBonusCredits(pack(), new Date("2026-12-20T00:00:00Z"))).toBe(0);
  });

  it("adds a share of packs and of one month's credits on yearly plans", () => {
    startOffer();
    const share = LAUNCH_OFFER.bonusPercent / 100;
    expect(launchBonusCredits(pack())).toBe(Math.round(pack().credits * share));
    for (const tier of ["basic", "pro", "ultimate"] as const) {
      expect(launchBonusCredits(product("year", tier))).toBe(Math.round((product("year", tier).credits / 12) * share));
    }
  });

  it("never sells a credit below the most KIE cost it can stand for, bonus included", () => {
    startOffer();
    // Stripe: 2.9% + $0.30, plus 0.7% Billing on subscriptions and 2.5% for a
    // foreign card with currency conversion, the worst common case.
    const all = [
      ...CREDIT_PACKAGES.map((item) => ({ id: item.id, fee: 0.029 + 0.025 })),
      ...SUBSCRIPTION_PRODUCTS.map((item) => ({ id: item.id, fee: 0.029 + 0.007 + 0.025 })),
    ];
    for (const { id, fee } of all) {
      const config = getProductById(id);
      if (!config) throw new Error(`no product ${id}`);
      const net = (config.price.amount / 100) * (1 - fee) - 0.3;
      const credits = config.credits + launchBonusCredits(config);
      expect(net / credits, config.name).toBeGreaterThan(MAX_VIDEO_COST_PER_CREDIT_USD);
    }
  });

  it("gives monthly plans nothing", () => {
    startOffer();
    for (const tier of ["basic", "pro", "ultimate"] as const) {
      expect(launchBonusCredits(product("month", tier))).toBe(0);
    }
  });

  it("goes to a first payment once, not to later ones", async () => {
    startOffer();
    const userId = uniqueUserId("offer_first");
    const first = `stripe_offer_a_${userId}`;
    const second = `stripe_offer_b_${userId}`;
    expect(await hasPaidBefore(userId)).toBe(false);

    expect(await grantCreditsOnce({ orderNo: first, userId, productId: pack().id })).toBe("granted");
    expect((await creditsOf(bonusOrderNo(first)))?.credits).toBe(launchBonusCredits(pack()));
    expect(await hasPaidBefore(userId)).toBe(true);

    // A redelivered webhook for the same order grants nothing more.
    expect(await grantCreditsOnce({ orderNo: first, userId, productId: pack().id })).toBe("duplicate");

    expect(await grantCreditsOnce({ orderNo: second, userId, productId: pack().id })).toBe("granted");
    expect(await creditsOf(bonusOrderNo(second))).toBeUndefined();
  });

  it("gives nothing when no offer is running", async () => {
    LAUNCH_OFFER.endsAt = null;
    const userId = uniqueUserId("offer_none");
    const orderNo = `stripe_offer_${userId}`;
    await grantCreditsOnce({ orderNo, userId, productId: pack().id });
    expect(await creditsOf(bonusOrderNo(orderNo))).toBeUndefined();
  });

  it("takes the bonus back when the purchase is refunded", async () => {
    startOffer();
    const userId = uniqueUserId("offer_refund");
    const orderNo = `stripe_offer_${userId}`;
    await grantCreditsOnce({ orderNo, userId, productId: pack().id });
    expect((await creditsOf(bonusOrderNo(orderNo)))?.left).toBeGreaterThan(0);

    await revokeCreditsForOrder({ orderNo, revokeOrderNo: `refund_${orderNo}`, ratio: 1, reason: "refund" });
    expect((await creditsOf(orderNo))?.left).toBe(0);
    expect((await creditsOf(bonusOrderNo(orderNo)))?.left).toBe(0);
  });
});
