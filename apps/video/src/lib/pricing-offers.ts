import {
  CREDIT_PACKAGES,
  FIRST_MONTH_OFFER,
  PLAN_PERKS,
  SUBSCRIPTION_PRODUCTS,
  planTierOfName,
} from "@/config/pricing-user";
import { PRICING_UNITS } from "@/lib/pricing-units";

export type PaidTier = "basic" | "pro" | "ultimate";
export const PAID_TIERS: PaidTier[] = ["basic", "pro", "ultimate"];

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Everything the pricing surfaces say about one plan, worked out from the config. */
export type PlanOffer = {
  tier: PaidTier;
  monthlyId: string;
  yearlyId: string;
  popular: boolean;
  /** Credits granted each month on the monthly plan. */
  creditsPerMonth: number;
  /** Credits granted at once on the yearly plan. */
  creditsPerYear: number;
  monthlyPriceUsd: number;
  /** What is charged today on the yearly plan. */
  yearlyPriceUsd: number;
  /** Yearly price spread over 12 months, to one decimal. */
  yearlyPerMonthUsd: number;
  /** Twelve monthly payments minus the yearly price. */
  yearlySavingUsd: number;
  yearlySavingPercent: number;
  /** The saving expressed as months of the monthly plan. */
  yearlyMonthsFree: number;
  /** First month's price for an account that has never paid, when the offer covers this plan. */
  firstMonthPriceUsd: number | null;
  concurrency: number;
  priorityQueue: boolean;
};

export function planOffers(): PlanOffer[] {
  return PAID_TIERS.map((tier) => {
    const monthly = SUBSCRIPTION_PRODUCTS.find((item) => item.enabled && item.period === "month" && planTierOfName(item.name) === tier);
    const yearly = SUBSCRIPTION_PRODUCTS.find((item) => item.enabled && item.period === "year" && planTierOfName(item.name) === tier);
    if (!monthly || !yearly) throw new Error(`pricing config is missing the ${tier} plan`);
    const fullYear = monthly.priceUsd * 12;
    const saving = round2(fullYear - yearly.priceUsd);
    return {
      tier,
      monthlyId: monthly.id,
      yearlyId: yearly.id,
      popular: Boolean(monthly.popular),
      creditsPerMonth: monthly.credits,
      creditsPerYear: yearly.credits,
      monthlyPriceUsd: monthly.priceUsd,
      yearlyPriceUsd: yearly.priceUsd,
      yearlyPerMonthUsd: round1(yearly.priceUsd / 12),
      yearlySavingUsd: saving,
      yearlySavingPercent: Math.round((saving / fullYear) * 100),
      yearlyMonthsFree: round1(saving / monthly.priceUsd),
      firstMonthPriceUsd: FIRST_MONTH_OFFER.enabled && FIRST_MONTH_OFFER.tier === tier ? FIRST_MONTH_OFFER.priceUsd : null,
      concurrency: PLAN_PERKS[tier].concurrency,
      priorityQueue: PLAN_PERKS[tier].priorityQueue,
    };
  });
}

/** USD one credit costs on a plan, for the period shown. */
export function creditPriceUsd(offer: PlanOffer, period: "month" | "year"): number {
  return period === "year" ? offer.yearlyPriceUsd / offer.creditsPerYear : offer.monthlyPriceUsd / offer.creditsPerMonth;
}

/** Whole generations a credit balance pays for. */
export function generationsFor(credits: number, creditsEach: number): number {
  return creditsEach > 0 ? Math.floor(credits / creditsEach) : 0;
}

/**
 * What every plan card quotes: the two most searched video models and the most
 * searched image model, at their real prices. A cheaper variant would give a
 * bigger count, but it is not what people come looking for.
 */
export const CARD_VIDEO_UNIT_IDS = ["bytedance/seedance-2-5", "kling/v4-reference-to-video"] as const;
export const CARD_IMAGE_UNIT_ID = "nano-banana-2-1";
/** The default model in the studio: the one the welcome credits are sized for. */
export const FREE_VIDEO_UNIT_ID = "veo-3.1";

export function pricingUnit(id: string) {
  const unit = PRICING_UNITS.find((item) => item.id === id);
  if (!unit) throw new Error(`no pricing unit for ${id}`);
  return unit;
}

/** "US$9.9", "US$0.65", "US$24": as many decimals as the amount needs, at most two. */
export function usd(value: number, decimals?: number): string {
  const cents = Math.round(value * 100);
  const places = decimals ?? (cents % 100 === 0 ? 0 : cents % 10 === 0 ? 1 : 2);
  return `US$${(cents / 100).toFixed(places)}`;
}

/** Packs in the order sold, with what 100 credits cost in each. */
export function packOffers() {
  return CREDIT_PACKAGES.filter((pack) => pack.enabled !== false).map((pack) => ({
    id: pack.id,
    name: pack.name,
    priceUsd: pack.priceUsd,
    credits: pack.credits,
    popular: Boolean(pack.popular),
    per100Usd: round2((pack.priceUsd / pack.credits) * 100),
  }));
}

/**
 * What one credit costs on the subscription plans, cheapest (the biggest
 * yearly plan) to dearest (the smallest monthly plan), for "about $x-$y a
 * clip" next to a credit price.
 */
export function planCreditUsdRange(): { min: number; max: number } {
  const perCredit = SUBSCRIPTION_PRODUCTS.filter((plan) => plan.enabled && plan.credits > 0).map((plan) => plan.priceUsd / plan.credits);
  return { min: Math.min(...perCredit), max: Math.max(...perCredit) };
}

/** "US$0.51–0.64": what a number of credits costs on the plans. */
export function planCostRange(credits: number): string {
  const { min, max } = planCreditUsdRange();
  const low = usd(credits * min, 2);
  const high = usd(credits * max, 2).replace(/^US\$/, "");
  return low === `US$${high}` ? low : `${low}–${high}`;
}
