import { CREDIT_EXPIRATION, PLAN_PERKS } from "@/config/pricing-user";
import {
  CARD_VIDEO_UNIT_IDS,
  generationsFor,
  packOffers,
  planOffers,
  pricingUnit,
  type PaidTier,
} from "@/lib/pricing-offers";

// What the credits upgrade dialog shows, worked out from the pricing config.
// No React here, so the numbers on screen can be tested on their own.

export type UpgradeTab = "year" | "month" | "pack";
export const UPGRADE_TABS: UpgradeTab[] = ["year", "month", "pack"];

/** How many clips of one model a number of credits pays for. */
export type UpgradeEstimate = {
  unitId: string;
  name: string;
  spec: { zh: string; en: string };
  creditsEach: number;
  count: number;
};

export type UpgradeOption = {
  /** The product id checkout is started with. */
  id: string;
  tab: UpgradeTab;
  /** null for a credit pack. */
  tier: PaidTier | null;
  popular: boolean;
  /** What the card is charged today, at the listed price. */
  chargedTodayUsd: number;
  /** Credits granted by this purchase: a month's, a year's, or the pack's. */
  credits: number;
  /** null for a credit pack. */
  creditsPerMonth: number | null;
  /** Headline price per month: the monthly price, or the yearly price over 12. */
  perMonthUsd: number | null;
  /** Yearly rows: the monthly plan's price, shown struck through. */
  wasPerMonthUsd: number | null;
  /** Yearly rows: percent saved against twelve monthly payments. */
  savingPercent: number;
  /** Monthly rows the first-month offer covers: the first month's price. */
  firstMonthUsd: number | null;
  /** Clips per month for a plan, clips in total for a pack. */
  estimates: UpgradeEstimate[];
  /** Plans only. A pack leaves the account's own limits as they are. */
  concurrency: number | null;
  priorityQueue: boolean | null;
  /** Packs only: days until the credits expire. */
  validDays: number | null;
};

export function estimatesFor(credits: number): UpgradeEstimate[] {
  return CARD_VIDEO_UNIT_IDS.map((id) => {
    const unit = pricingUnit(id);
    return { unitId: unit.id, name: unit.name, spec: unit.spec, creditsEach: unit.credits, count: generationsFor(credits, unit.credits) };
  });
}

/** The rows of one tab, in the order shown. */
/** `firstPurchase` false hides the first-month price, for accounts that have paid before. */
export function upgradeOptions(tab: UpgradeTab, firstPurchase = true): UpgradeOption[] {
  if (tab === "pack") {
    return packOffers().map((pack) => ({
      id: pack.id,
      tab,
      tier: null,
      popular: pack.popular,
      chargedTodayUsd: pack.priceUsd,
      credits: pack.credits,
      creditsPerMonth: null,
      perMonthUsd: null,
      wasPerMonthUsd: null,
      savingPercent: 0,
      firstMonthUsd: null,
      estimates: estimatesFor(pack.credits),
      concurrency: null,
      priorityQueue: null,
      validDays: CREDIT_EXPIRATION.purchaseDays,
    }));
  }
  return planOffers().map((plan) => {
    const yearly = tab === "year";
    const firstMonth = !yearly && firstPurchase && plan.firstMonthPriceUsd !== null && plan.firstMonthPriceUsd < plan.monthlyPriceUsd ? plan.firstMonthPriceUsd : null;
    return {
      id: yearly ? plan.yearlyId : plan.monthlyId,
      tab,
      tier: plan.tier,
      popular: plan.popular,
      chargedTodayUsd: yearly ? plan.yearlyPriceUsd : plan.monthlyPriceUsd,
      credits: yearly ? plan.creditsPerYear : plan.creditsPerMonth,
      creditsPerMonth: plan.creditsPerMonth,
      perMonthUsd: yearly ? plan.yearlyPerMonthUsd : plan.monthlyPriceUsd,
      wasPerMonthUsd: yearly && plan.yearlySavingPercent > 0 ? plan.monthlyPriceUsd : null,
      savingPercent: yearly ? Math.max(0, plan.yearlySavingPercent) : 0,
      firstMonthUsd: firstMonth,
      estimates: estimatesFor(plan.creditsPerMonth),
      concurrency: PLAN_PERKS[plan.tier].concurrency,
      priorityQueue: PLAN_PERKS[plan.tier].priorityQueue,
      validDays: null,
    };
  });
}

/** The biggest yearly saving across the plans, for the badge on the yearly tab. */
export function maxYearlySavingPercent(): number {
  return Math.max(0, ...planOffers().map((plan) => plan.yearlySavingPercent));
}

/**
 * The row a tab opens on: the popular plan, or for packs the smallest one that
 * covers what the account is short of (the popular pack when that is unknown).
 */
export function defaultOptionId(tab: UpgradeTab, shortfall?: number | null): string {
  const options = upgradeOptions(tab);
  if (tab === "pack" && shortfall && shortfall > 0) {
    const covering = options.find((option) => option.credits >= shortfall);
    if (covering) return covering.id;
    return options[options.length - 1].id;
  }
  return (options.find((option) => option.popular) ?? options[0]).id;
}

/** Credits still missing for a generation, when both numbers are known. */
export function creditsShortfall(required?: number | null, available?: number | null): number | null {
  if (!required || required <= 0) return null;
  if (available === null || available === undefined) return required;
  return Math.max(0, required - Math.max(0, available));
}

/** The line under the title: what this generation needs and what the account has. */
export function creditsNeededLine(required: number | null | undefined, available: number | null | undefined, zh: boolean): string | null {
  if (!required || required <= 0) return null;
  const need = required.toLocaleString("en-US");
  // A balance that already covers the cost is out of date; leave it out.
  if (available === null || available === undefined || available >= required) {
    return zh ? `这次生成需要 ${need} 积分。` : `This generation needs ${need} credits.`;
  }
  const have = Math.max(0, available).toLocaleString("en-US");
  return zh ? `这次生成需要 ${need} 积分，你现在有 ${have}。` : `This generation needs ${need} credits. You have ${have}.`;
}

/** A sentence for a checkout error code. The codes themselves are never shown. */
export function checkoutErrorMessage(code: string | undefined, zh: boolean): string {
  switch (code) {
    case "payments_not_configured":
      return zh ? "支付功能暂未开放，请稍后再来。" : "Payments are not open yet. Please check back soon.";
    case "rate_limited":
      return zh ? "操作太频繁了，请稍等一会儿再试。" : "Too many attempts. Please wait a moment and try again.";
    case "invalid_product":
    case "invalid_body":
      return zh ? "这个商品暂时无法购买，请换一个选项或稍后再试。" : "This option cannot be bought right now. Pick another or try again later.";
    case "network":
      return zh ? "网络不稳定，没有连上支付页面，请再试一次。" : "The connection dropped before checkout opened. Please try again.";
    default:
      return zh ? "暂时无法打开支付页面，请稍后再试。没有产生任何扣款。" : "We could not open checkout. Please try again. You have not been charged.";
  }
}
