import type { CreditPackageConfig } from "@/config/credits";

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

/** Number of full clips one billing period can fund at the quoted reference cost. */
export function completeClipCount(product: PricingProduct, creditsPerClip: number): number {
  return Math.floor(product.credits / creditsPerClip);
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

/** The smallest annual discount available across the listed tiers. */
export function yearlySavingsPercent(products: readonly PricingProduct[]): number | undefined {
  const monthlyPrices = new Map(products
    .filter((product) => product.billingPeriod === "month")
    .map((product) => [displayPlanName(product.name), product.price.amount]));
  const savings = products.filter((p) => p.billingPeriod === "year").map((year) => {
    const monthly = monthlyPrices.get(displayPlanName(year.name));
    return monthly && monthly > 0 ? Math.round(100 * (1 - year.price.amount / (monthly * 12))) : 0;
  });
  const percent = savings.length ? Math.min(...savings) : 0;
  return percent > 0 ? percent : undefined;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "credits",
    question: "What are credits and how are they used?",
    answer:
      "The table above shows the credits needed for one clip at each supported duration and resolution. For example, a longer clip can cost more even when you use the same model.",
  },
  {
    id: "expiry",
    question: "Do my credits expire?",
    answer:
      "Subscription credits are valid for the plan period; one-time pack credits expire after the number of days listed on the pack.",
  },
  {
    id: "switching",
    question: "Can I switch between monthly and yearly billing?",
    answer: "You can choose monthly or yearly billing when you subscribe.",
  },
  {
    id: "refunds",
    question: "What happens if a generation fails?",
    answer:
      "If a generation fails, the credits reserved for it are released back to your balance automatically.",
  },
  {
    id: "payment",
    question: "Which payment methods do you accept?",
    answer:
      "Payments are processed securely by Stripe, which accepts major credit and debit cards. Stripe sends a receipt to your email after each purchase.",
  },
  {
    id: "cancel",
    question: "Can I cancel my subscription anytime?",
    answer:
      "You can cancel a subscription at any time. Your plan stays active until the end of the period you already paid for, and it will not renew after that.",
  },
];

/** Same six questions and ids as FAQ_ITEMS, translated faithfully. */
export const FAQ_ITEMS_ZH: FaqItem[] = [
  {
    id: "credits",
    question: "什么是积分，如何使用？",
    answer:
      "上表列出了每个可选模型生成一段视频所需的积分。选择时长和分辨率即可查到对应的用量。",
  },
  {
    id: "expiry",
    question: "我的积分会过期吗？",
    answer: "订阅积分在方案周期内有效；一次性积分的有效天数见对应积分包。",
  },
  {
    id: "switching",
    question: "我可以在按月与按年计费之间切换吗？",
    answer: "订阅时可以选择按月或按年计费。",
  },
  {
    id: "refunds",
    question: "如果生成失败会怎样？",
    answer: "如果生成失败，为其预留的积分会自动返还到你的余额。",
  },
  {
    id: "payment",
    question: "你们接受哪些支付方式？",
    answer:
      "支付由 Stripe 安全处理，支持主流信用卡和借记卡。每次购买后 Stripe 会向你的邮箱发送收据。",
  },
  {
    id: "cancel",
    question: "我可以随时取消订阅吗？",
    answer:
      "你可以随时取消订阅。方案会持续有效至你已付费的周期结束，之后不再续订。",
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
  checkoutClosed: string;
  redirecting: string;
  choosePlan: string;
  buyCredits: string;
  creditPacksTitle: string;
  creditPacksSubtitle: string;
  /** Template, e.g. "{credits} credits". */
  packCredits: string;
  packValidity: string;
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
    saveBadge: "Save ~{percent}%",
    perMonth: "/ month",
    billedMonthly: "Billed monthly",
    billedYearly: "Billed {amount} yearly",
    creditsPerMonth: "{credits} credits per month",
    creditsPerYear: "{credits} credits per year",
    mostPopular: "Most popular",
    checkoutClosed: "Checkout is turned off on this site. You can compare plans and credit packs below.",
    redirecting: "Redirecting…",
    choosePlan: "Choose {plan}",
    buyCredits: "Buy {credits} credits",
    creditPacksTitle: "Credit packs",
    creditPacksSubtitle:
      "One-time credit purchases. Each pack shows its price and validity.",
    packCredits: "{credits} credits",
    packValidity: "Valid for {days} days after purchase",
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
    saveBadge: "省约 {percent}%",
    perMonth: "/ 月",
    billedMonthly: "按月计费",
    billedYearly: "按年计费 {amount}",
    creditsPerMonth: "每月 {credits} 积分",
    creditsPerYear: "每年 {credits} 积分",
    mostPopular: "最受欢迎",
    checkoutClosed: "此站点当前未启用支付。你可以在下方比较订阅方案和积分包。",
    redirecting: "跳转中…",
    choosePlan: "选择 {plan} 方案",
    buyCredits: "购买 {credits} 积分",
    creditPacksTitle: "积分包",
    creditPacksSubtitle: "积分包按次购买，价格和有效期见下方。",
    packCredits: "{credits} 积分",
    packValidity: "购买后 {days} 天内有效",
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
