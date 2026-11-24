import type { CreditPackageConfig } from "@/config/credits";
import { FIRST_MONTH_OFFER, LAUNCH_OFFER, REFUND_POLICY } from "@/config/pricing-user";
import { SUPPORT_EMAIL } from "@/config/site";
import { CARD_VIDEO_UNIT_IDS, FREE_VIDEO_UNIT_ID, type PlanOffer, creditPriceUsd, packOffers, planOffers, pricingUnit, usd } from "@/lib/pricing-offers";

/**
 * Pure, dependency-free helpers for the /pricing page.
 * Nothing in here touches React, the DOM or the network so it can be
 * unit-tested in isolation and reused on the server.
 */

export type BillingPeriod = "month" | "year";

/**
 * Minimal structural shape of a sellable product.
 * `CreditPackageConfig` from "@/config/credits" satisfies it, but tests can
 * build tiny literals instead of full config objects.
 */
export interface PricingProduct {
  id: string;
  name: string;
  /** Credits granted per billing period. */
  credits: number;
  price: {
    /** Price in cents. */
    amount: number;
    currency: string;
  };
  billingPeriod?: "month" | "year";
}

/** Normalize a value coming from config into the props we render. */
export function asPricingProducts(
  products: readonly CreditPackageConfig[]
): PricingProduct[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    credits: product.credits,
    price: {
      amount: product.price.amount,
      currency: product.price.currency,
    },
    billingPeriod: product.billingPeriod,
  }));
}

/** Products belonging to a single billing period, original order preserved. */
export function plansForPeriod<T extends PricingProduct>(
  products: readonly T[],
  period: BillingPeriod
): T[] {
  return products.filter((product) => product.billingPeriod === period);
}

/**
 * Price expressed as "per month", in cents.
 * Monthly plans return their own price; yearly plans are divided by 12.
 */
export function monthlyEquivalentCents(product: PricingProduct): number {
  if (product.billingPeriod !== "year") {
    return Math.round(product.price.amount);
  }
  return Math.round(product.price.amount / 12);
}

/** Effective cost of 100 credits, in cents. Returns 0 when credits is 0. */
export function costPer100Credits(product: PricingProduct): number {
  if (!product.credits || product.credits <= 0) return 0;
  return Math.round((product.price.amount / product.credits) * 100);
}

/** Display name with the billing-period suffix removed, e.g. "Pro (Yearly)". */
export function displayPlanName(name: string): string {
  return name.replace(/\s*\((?:yearly|annual|year)\)\s*$/i, "").trim();
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

// The answers quote plan prices, credit counts and offer terms, so they are
// built from the pricing config: a changed price cannot leave a stale answer.
const offers = planOffers();
const [basicOffer, proOffer, ultimateOffer] = offers;
const veoUnit = pricingUnit(FREE_VIDEO_UNIT_ID);
const seedanceUnit = pricingUnit(CARD_VIDEO_UNIT_IDS[0]);
const klingUnit = pricingUnit(CARD_VIDEO_UNIT_IDS[1]);
const clipPrice = (credits: number, offer: PlanOffer) => usd(credits * creditPriceUsd(offer, "month"), 2);
const n = (value: number) => value.toLocaleString("en-US");
const packs = packOffers();
const smallestPack = packs[0];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "per-video",
    question: "How much does one video cost?",
    answer: `It depends on the model. On the Basic plan one ${veoUnit.name} clip (${veoUnit.spec.en}) is ${veoUnit.credits} credits, about ${clipPrice(veoUnit.credits, basicOffer)}. One ${klingUnit.name} clip (${klingUnit.spec.en}) is ${klingUnit.credits} credits, about ${clipPrice(klingUnit.credits, basicOffer)}, and one ${seedanceUnit.name} clip (${seedanceUnit.spec.en}) is ${seedanceUnit.credits} credits, about ${clipPrice(seedanceUnit.credits, basicOffer)}. Bigger plans pay less per credit: the same ${seedanceUnit.name} clip is about ${clipPrice(seedanceUnit.credits, ultimateOffer)} on Ultimate. The table above lists every model.`,
  },
  {
    id: "plans-differ",
    question: "What is the difference between the plans?",
    answer: `All three plans use every model, export without a watermark and include commercial use. They differ in how many credits you get and how many videos run at once: Basic has ${n(basicOffer.creditsPerMonth)} credits a month and runs ${basicOffer.concurrency} video at a time; Pro has ${n(proOffer.creditsPerMonth)} credits and runs ${proOffer.concurrency} at once; Ultimate has ${n(ultimateOffer.creditsPerMonth)} credits and runs ${ultimateOffer.concurrency} at once. Bigger plans also pay less per credit.`,
  },
  {
    id: "offers",
    question: LAUNCH_OFFER.endsAt ? "What are the first-month and launch offers?" : "Is there a first-month offer?",
    answer: `If your account has never paid before, your first month of Pro on monthly billing is ${usd(FIRST_MONTH_OFFER.priceUsd)}; it then renews at ${usd(proOffer.monthlyPriceUsd)} a month.${LAUNCH_OFFER.endsAt ? ` During the launch offer, a first purchase of a credit pack or a yearly plan also gets ${LAUNCH_OFFER.bonusPercent}% extra credits; on a yearly plan the extra is ${LAUNCH_OFFER.bonusPercent}% of one month's credits. Monthly plans are not part of it, and the launch offer ends on the date shown at the top of this page.` : ""}`,
  },
  {
    id: "expiry",
    question: "Do my credits expire?",
    answer:
      "Yes. Monthly plan credits last 30 days from each grant and do not roll over; yearly plans grant the whole year up front, valid for 365 days; one-time packs last a year; welcome credits last 7 days. Credits closest to expiry are used first, and anything that expires unused shows up as an expiry entry under Credits & billing.",
  },
  {
    id: "packs",
    question: "Can I buy credits without subscribing?",
    answer: `Yes. Credit packs are one-time purchases that anyone can buy, starting at ${usd(smallestPack.priceUsd)} for ${n(smallestPack.credits)} credits. Pack credits cost more each than plan credits and last a year. They are also the way to top up when a plan runs low.`,
  },
  {
    id: "refunds",
    question: "What happens if a generation fails?",
    answer:
      "If a generation fails, the credits reserved for it are released back to your balance automatically.",
  },
  {
    id: "refund-policy",
    question: "Can I get a refund?",
    answer: `Yes, on your first purchase, whether a credit pack or the first payment of a subscription: ask within ${REFUND_POLICY.days} days and, if none of the credits from that purchase have been used, you get the full amount back. Any launch-offer bonus credits are removed with the refund. Purchases whose credits have been used are not refunded.`,
  },
  {
    id: "cancel",
    question: "Can I cancel my subscription anytime?",
    answer: `Yes. Open your Account page and click Manage subscription to cancel renewal in one click, or ${SUPPORT_EMAIL ? `email ${SUPPORT_EMAIL}` : "write to us through the contact page"}. Your plan stays active until the end of the period you already paid for and does not renew after that; credits you already have stay usable until they expire.`,
  },
];

/** Same questions and ids as FAQ_ITEMS, translated faithfully. */
export const FAQ_ITEMS_ZH: FaqItem[] = [
  {
    id: "per-video",
    question: "一条视频多少钱？",
    answer: `看用哪个模型。Basic 套餐下，一条 ${veoUnit.name}（${veoUnit.spec.zh}）扣 ${veoUnit.credits} 积分，约 ${clipPrice(veoUnit.credits, basicOffer)}；一条 ${klingUnit.name}（${klingUnit.spec.zh}）扣 ${klingUnit.credits} 积分，约 ${clipPrice(klingUnit.credits, basicOffer)}；一条 ${seedanceUnit.name}（${seedanceUnit.spec.zh}）扣 ${seedanceUnit.credits} 积分，约 ${clipPrice(seedanceUnit.credits, basicOffer)}。套餐越大每积分越便宜：同样一条 ${seedanceUnit.name} 在 Ultimate 约 ${clipPrice(seedanceUnit.credits, ultimateOffer)}。上面的表格列出了全部模型。`,
  },
  {
    id: "plans-differ",
    question: "三个套餐有什么区别？",
    answer: `三档都能用全部模型，成片无水印、可商用。区别在积分数量和能同时生成几个视频：Basic 每月 ${n(basicOffer.creditsPerMonth)} 积分，同时生成 ${basicOffer.concurrency} 个视频；Pro 每月 ${n(proOffer.creditsPerMonth)} 积分，同时 ${proOffer.concurrency} 个；Ultimate 每月 ${n(ultimateOffer.creditsPerMonth)} 积分，同时 ${ultimateOffer.concurrency} 个。套餐越大，每积分也越便宜。`,
  },
  {
    id: "offers",
    question: LAUNCH_OFFER.endsAt ? "首月优惠和开业优惠是什么？" : "有首月优惠吗？",
    answer: `从未付过款的账号第一次按月订阅 Pro，首月 ${usd(FIRST_MONTH_OFFER.priceUsd)}，之后按 ${usd(proOffer.monthlyPriceUsd)}/月续费。${LAUNCH_OFFER.endsAt ? `开业优惠期间，首次购买积分包或年付套餐还会多送 ${LAUNCH_OFFER.bonusPercent}% 积分；年付按一个月积分的 ${LAUNCH_OFFER.bonusPercent}% 赠送。月付套餐不参加，开业优惠的截止日期写在本页顶部。` : ""}`,
  },
  {
    id: "expiry",
    question: "我的积分会过期吗？",
    answer:
      "会。月付订阅每期发放的积分 30 天内有效，不滚存；年付一次发放全年积分、365 天内有效；单独购买的积分包 1 年内有效；新用户赠送积分 7 天内有效。使用时先扣即将到期的积分，到期未用的积分会在「积分与账单」里记一条过期记录。",
  },
  {
    id: "packs",
    question: "不订阅能买积分吗？",
    answer: `能。积分包是一次性购买，所有人都可以买，最小的一档是 ${usd(smallestPack.priceUsd)} 买 ${n(smallestPack.credits)} 积分。积分包的单价比订阅贵，1 年内有效。订阅积分不够用时也可以用它加购。`,
  },
  {
    id: "refunds",
    question: "如果生成失败会怎样？",
    answer: "如果生成失败，为其预留的积分会自动返还到你的余额。",
  },
  {
    id: "refund-policy",
    question: "可以退款吗？",
    answer: `第一笔购买可以（积分包或订阅的首次付款都算）：${REFUND_POLICY.days} 天内提出，并且这笔购买的积分一点都没用过，就全额退款。开业优惠赠送的积分会随退款一并收回。积分已经使用的购买不退款。`,
  },
  {
    id: "cancel",
    question: "我可以随时取消订阅吗？",
    answer: `可以。进入「账户」页面点击「管理订阅」即可一键取消自动续费，也可以用注册邮箱${SUPPORT_EMAIL ? `发邮件到 ${SUPPORT_EMAIL}` : "通过联系页联系我们"}。套餐会持续到你已付费的周期结束，之后不再续订；已有的积分在过期前仍可使用。`,
  },
];

/**
 * Every user-visible string on the /pricing page, in one place.
 * Placeholders in braces (`{amount}`, `{credits}`, `{price}`, `{per100}`)
 * are filled by the view; currency formatting stays in the component.
 */
export interface PricingCopy {
  heroTitle: string;
  heroSubtitle: string;
  billingPeriodLabel: string;
  monthly: string;
  yearly: string;
  saveBadge: string;
  perMonth: string;
  billedMonthly: string;
  /** Template, e.g. "Billed {amount} yearly". */
  billedYearly: string;
  /** Template, e.g. "{credits} credits per month". */
  creditsPerMonth: string;
  /** Template, e.g. "{credits} credits per year". */
  creditsPerYear: string;
  mostPopular: string;
  comingSoon: string;
  redirecting: string;
  getStarted: string;
  creditPacksTitle: string;
  creditPacksSubtitle: string;
  /** Template, e.g. "{credits} credits". */
  packCredits: string;
  /** Template, e.g. "{price} · {per100} per 100 credits". */
  packMeta: string;
  compareTitle: string;
  compareSubtitle: string;
  tableFeature: string;
  tableMonthlyCredits: string;
  tablePrice: string;
  /** Template, e.g. "{price} / month". */
  tablePricePerMonth: string;
  tableCostPer100: string;
  tableCommercialUse: string;
  faqTitle: string;
  faqSubtitle: string;
  errorFallback: string;
}

export const PRICING_COPY: { en: PricingCopy; zh: PricingCopy } = {
  en: {
    heroTitle: "Plans & pricing",
    heroSubtitle:
      "Choose how much you want to create. Every plan includes credits that work across text-to-video and image-to-video.",
    billingPeriodLabel: "Billing period",
    monthly: "Monthly",
    yearly: "Yearly",
    saveBadge: "Save ~8%",
    perMonth: "/ month",
    billedMonthly: "Billed monthly",
    billedYearly: "Billed {amount} yearly",
    creditsPerMonth: "{credits} credits per month",
    creditsPerYear: "{credits} credits per year",
    mostPopular: "Most popular",
    comingSoon: "Coming soon",
    redirecting: "Redirecting…",
    getStarted: "Get started",
    creditPacksTitle: "Credit packs",
    creditPacksSubtitle:
      "Prefer to top up without a subscription? Buy credits once and spend them whenever inspiration strikes.",
    packCredits: "{credits} credits",
    packMeta: "{price} · {per100} per 100 credits",
    compareTitle: "Compare plans",
    compareSubtitle: "Everything each tier includes, side by side.",
    tableFeature: "Feature",
    tableMonthlyCredits: "Monthly credits",
    tablePrice: "Price",
    tablePricePerMonth: "{price} / month",
    tableCostPer100: "Cost per 100 credits",
    tableCommercialUse: "Commercial use",
    faqTitle: "Frequently asked questions",
    faqSubtitle: "Still deciding? These are the questions we hear most.",
    errorFallback: "Something went wrong. Please try again.",
  },
  zh: {
    heroTitle: "方案与价格",
    heroSubtitle:
      "选择你想创作的数量。每个方案都包含可用于文生视频和图生视频的积分。",
    billingPeriodLabel: "计费周期",
    monthly: "按月",
    yearly: "按年",
    saveBadge: "省约 8%",
    perMonth: "/ 月",
    billedMonthly: "按月计费",
    billedYearly: "按年计费 {amount}",
    creditsPerMonth: "每月 {credits} 积分",
    creditsPerYear: "每年 {credits} 积分",
    mostPopular: "最受欢迎",
    comingSoon: "即将推出",
    redirecting: "跳转中…",
    getStarted: "立即开始",
    creditPacksTitle: "积分包",
    creditPacksSubtitle: "不想订阅？一次性购买积分，灵感来时随时使用。",
    packCredits: "{credits} 积分",
    packMeta: "{price} · 每 100 积分 {per100}",
    compareTitle: "方案对比",
    compareSubtitle: "各档位包含的全部内容，一目了然。",
    tableFeature: "功能",
    tableMonthlyCredits: "每月积分",
    tablePrice: "价格",
    tablePricePerMonth: "{price} / 月",
    tableCostPer100: "每 100 积分价格",
    tableCommercialUse: "商业用途",
    faqTitle: "常见问题",
    faqSubtitle: "还在犹豫？这些是我们最常被问到的问题。",
    errorFallback: "出错了，请重试。",
  },
};

/** Copy for a locale: Chinese when `locale === "zh"`, English otherwise. */
export function pricingCopy(locale: string): PricingCopy {
  return locale === "zh" ? PRICING_COPY.zh : PRICING_COPY.en;
}

/** FAQ for a locale: Chinese when `locale === "zh"`, English otherwise. */
export function faqItemsFor(locale: string): FaqItem[] {
  return locale === "zh" ? FAQ_ITEMS_ZH : FAQ_ITEMS;
}
