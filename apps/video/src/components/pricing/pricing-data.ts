import type { CreditPackageConfig } from "@/config/credits";

/**
 * Pure, dependency-free helpers, copy and FAQ/JSON-LD builders for /pricing.
 * Nothing here touches React, the DOM, the network or runtime config values,
 * so it can be unit-tested in isolation and imported by the client component.
 */

export type BillingPeriod = "month" | "year";

/**
 * Minimal structural shape of a sellable product as it is rendered.
 * `CreditPackageConfig` from "@/config/credits" satisfies it, but tests can
 * build tiny literals instead of full config objects.
 */
export interface PricingProduct {
  id: string;
  name: string;
  /** Credits granted per billing period (or per purchase for packs). */
  credits: number;
  price: {
    /** Price in cents. */
    amount: number;
    currency: string;
  };
  billingPeriod?: BillingPeriod;
  popular?: boolean;
  /** How long the granted credits stay valid, in days. */
  validityDays?: number;
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

/** Safe read of the optional `popular` flag, whatever the config type is. */
export function isPopular(product: { popular?: boolean }): boolean {
  return product.popular === true;
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

/**
 * Largest saving (in percent) a yearly plan offers compared to paying the
 * matching monthly plan for 12 months. 0 when no monthly/yearly pair exists.
 */
export function yearlySavingsPercent(
  products: readonly PricingProduct[]
): number {
  const monthlyByName = new Map<string, PricingProduct>();
  for (const product of products) {
    if (product.billingPeriod === "month") {
      monthlyByName.set(displayPlanName(product.name).toLowerCase(), product);
    }
  }

  let best = 0;
  for (const product of products) {
    if (product.billingPeriod !== "year") continue;
    const monthly = monthlyByName.get(displayPlanName(product.name).toLowerCase());
    if (!monthly || monthly.price.amount <= 0) continue;
    const fullYear = monthly.price.amount * 12;
    const saving = 1 - product.price.amount / fullYear;
    if (saving > best) best = saving;
  }

  return Math.round(best * 100);
}

/** How many videos of `videoCredits` each fit in `credits`. 0 when unsafe. */
export function approxVideoCount(credits: number, videoCredits: number): number {
  if (!Number.isFinite(credits) || !Number.isFinite(videoCredits)) return 0;
  if (videoCredits <= 0) return 0;
  return Math.floor(credits / videoCredits);
}

/** Formats a cent amount for display, e.g. 990 -> "$9.90", 2990 -> "$29.90". */
export function formatUsd(cents: number): string {
  return `$${formatPriceString(cents)}`.replace(/\.00$/, "");
}

/** Cents as a plain 2-decimal price string, e.g. 990 -> "9.90". */
export function formatPriceString(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.max(0, cents) : 0;
  return (Math.round(safe) / 100).toFixed(2);
}

/** Groups a credit amount with thousands separators (locale stable). */
export function formatCreditNumber(credits: number): string {
  return Math.round(credits).toLocaleString("en-US");
}

/** Replaces `{name}` placeholders in a copy template. */
export function fill(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqFacts {
  welcomeCredits: number;
  welcomeDays: number;
  giftEnabled: boolean;
  monthlyValidityDays: number;
  yearlyValidityDays: number;
  packValidityDays: number;
  refundWindowDays: number;
  cheapestVideoSeconds: number;
  cheapestVideoCredits: number;
  videoPerSecond: number;
  imageCredits: number;
  musicCredits: number;
  musicTracks: number;
}

function faqItemsEn(facts: FaqFacts): FaqItem[] {
  const welcome = facts.giftEnabled
    ? ` New accounts also get ${facts.welcomeCredits} free credits, valid for ${facts.welcomeDays} days.`
    : "";

  return [
    {
      id: "credits",
      question: "What are credits?",
      answer:
        `Credits are the single balance used for every generation on aivd.ai. ` +
        `Video at 720p costs ${facts.videoPerSecond} credits per second, so a ` +
        `${facts.cheapestVideoSeconds}-second video costs ${facts.cheapestVideoCredits} credits. ` +
        `Credits are only deducted for the generations you start.`,
    },
    {
      id: "expiry",
      question: "Do credits expire?",
      answer:
        `Yes. Monthly plan credits are valid for ${facts.monthlyValidityDays} days, ` +
        `yearly plan credits for ${facts.yearlyValidityDays} days, and pack credits for ` +
        `${facts.packValidityDays} days.${welcome}`,
    },
    {
      id: "failed",
      question: "What happens if a generation fails?",
      answer:
        "If a generation fails, the credits reserved for it are returned to your balance automatically. You can retry without paying twice.",
    },
    {
      id: "refund",
      question: "Can I get a refund?",
      answer:
        `If you bought a credit pack and none of its credits have been used, you can request a refund ` +
        `by email within ${facts.refundWindowDays} days of purchase. Credits that have been used, ` +
        `and packs that have been partly used, are not refundable, except where the law requires otherwise. ` +
        `There are no partial refunds for the current subscription period, except where the law requires otherwise.`,
    },
    {
      id: "cancel",
      question: "Can I cancel my subscription?",
      answer:
        "Yes. You can cancel any time from your account settings. Your plan stays active until the end of the current billing period and you will not be charged again. We do not give partial refunds for the current period, except where the law requires it.",
    },
    {
      id: "payment",
      question: "Which payment methods do you accept?",
      answer:
        "Payments are processed securely by Stripe, which accepts major credit and debit cards. Stripe sends a receipt to your email after each purchase.",
    },
    {
      id: "media",
      question: "Are image and music generation available?",
      answer:
        `Not yet — both are coming soon. The prices are already listed: ${facts.imageCredits} credits per image, ` +
        `and ${facts.musicCredits} credits per request of ${facts.musicTracks} tracks.`,
    },
    {
      id: "ownership",
      question: "Who owns the videos I make?",
      answer:
        "You own the content you generate, subject to the model providers' terms and applicable law. The full details are in our Terms.",
    },
  ];
}

function faqItemsZh(facts: FaqFacts): FaqItem[] {
  const welcome = facts.giftEnabled
    ? ` 新注册账号还会获赠 ${facts.welcomeCredits} 积分，有效期 ${facts.welcomeDays} 天。`
    : "";

  return [
    {
      id: "credits",
      question: "积分是什么？",
      answer:
        `积分是 aivd.ai 上所有生成的统一余额。720p 视频按秒计费，每秒 ${facts.videoPerSecond} 积分，` +
        `所以 ${facts.cheapestVideoSeconds} 秒的视频需要 ${facts.cheapestVideoCredits} 积分。只有你发起的生成才会扣积分。`,
    },
    {
      id: "expiry",
      question: "积分会过期吗？",
      answer:
        `会。月付方案的积分有效期 ${facts.monthlyValidityDays} 天，年付方案的积分有效期 ` +
        `${facts.yearlyValidityDays} 天，积分包的积分有效期 ${facts.packValidityDays} 天。${welcome}`,
    },
    {
      id: "failed",
      question: "生成失败怎么办？",
      answer:
        "生成失败时，这次消耗的积分会自动退回账户，可以直接重试，不用重复付费。",
    },
    {
      id: "refund",
      question: "可以退款吗？",
      answer:
        `积分包如果一个积分都没用过，可以在购买后 ${facts.refundWindowDays} 天内发邮件申请退款。` +
        `已使用的积分、已经部分使用的积分包不予退款；订阅的当前计费周期也不提供部分退款。法律另有规定的除外。`,
    },
    {
      id: "cancel",
      question: "可以取消订阅吗？",
      answer:
        "可以。你随时能在账户设置中取消订阅。方案会持续到当前计费周期结束，之后不再扣费。当前周期不提供部分退款，法律另有规定的除外。",
    },
    {
      id: "payment",
      question: "支持哪些支付方式？",
      answer:
        "支付由 Stripe 安全处理，支持主流信用卡和借记卡。每次购买后 Stripe 会向你的邮箱发送收据。",
    },
    {
      id: "media",
      question: "图片和音乐生成可以用了吗？",
      answer:
        `图片和音乐生成即将上线，价格已经确定：每张图片 ${facts.imageCredits} 积分，` +
        `每次音乐请求（${facts.musicTracks} 首）${facts.musicCredits} 积分。`,
    },
    {
      id: "ownership",
      question: "我生成的视频归谁所有？",
      answer:
        "你生成的内容归你所有，但需遵守模型服务商的条款和适用法律。完整说明见服务条款。",
    },
  ];
}

/** FAQ for a locale: Chinese when `locale === "zh"`, English otherwise. */
export function faqItemsFor(locale: string, facts: FaqFacts): FaqItem[] {
  return locale === "zh" ? faqItemsZh(facts) : faqItemsEn(facts);
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

/**
 * Every user-visible string on the /pricing page, in one place.
 * Placeholders in braces are filled by the view with numbers that come from
 * config (`fill()` from this module).
 */
export interface PricingCopy {
  heroTitle: string;
  heroSubtitle: string;
  usdNote: string;
  welcomeGift: string;
  billingPeriodLabel: string;
  monthly: string;
  yearly: string;
  saveBadge: string;
  perMonth: string;
  billedMonthly: string;
  billedYearly: string;
  creditsPerMonth: string;
  creditsPerYear: string;
  approxVideos: string;
  per100Credits: string;
  validForDays: string;
  mostPopular: string;
  available: string;
  comingSoon: string;
  redirecting: string;
  getStarted: string;
  usdShort: string;
  creditPacksTitle: string;
  creditPacksSubtitle: string;
  packCredits: string;
  costsTitle: string;
  costsSubtitle: string;
  tableType: string;
  tableUnit: string;
  tableCredits: string;
  tableStatus: string;
  videoRow: string;
  videoUnit: string;
  imageRow: string;
  imageUnit: string;
  musicRow: string;
  musicUnit: string;
  chipTemplate: string;
  failedFootnote: string;
  costsCta: string;
  compareTitle: string;
  compareSubtitle: string;
  tableFeature: string;
  tableMonthlyCredits: string;
  tablePrice: string;
  tablePricePerMonth: string;
  tableCostPer100: string;
  tableApproxVideos: string;
  faqTitle: string;
  faqSubtitle: string;
  refundPolicyLink: string;
  termsLink: string;
  errorFallback: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  breadcrumbHome: string;
  breadcrumbPricing: string;
  productDescription: string;
}

export const PRICING_COPY: { en: PricingCopy; zh: PricingCopy } = {
  en: {
    heroTitle: "Plans & pricing",
    heroSubtitle:
      "Pick a subscription or a one-time credit pack. One credit balance covers every kind of generation on aivd.ai.",
    usdNote: "All prices are in US dollars (USD).",
    welcomeGift:
      "New accounts get {credits} free credits to look around — valid for {days} days.",
    billingPeriodLabel: "Billing period",
    monthly: "Monthly",
    yearly: "Yearly",
    saveBadge: "Save up to {pct}%",
    perMonth: "/ month",
    billedMonthly: "Billed monthly",
    billedYearly: "Billed {amount} yearly",
    creditsPerMonth: "{credits} credits per month",
    creditsPerYear: "{credits} credits per year",
    approxVideos: "≈ {count} × {seconds}s 720p videos",
    per100Credits: "{price} per 100 credits",
    validForDays: "Credits valid for {days} days",
    mostPopular: "Most popular",
    available: "Available",
    comingSoon: "Coming soon",
    redirecting: "Redirecting…",
    getStarted: "Get started",
    usdShort: "USD",
    creditPacksTitle: "Credit packs",
    creditPacksSubtitle: "One-time purchase, no subscription needed.",
    packCredits: "{credits} credits",
    costsTitle: "How many credits does each generation cost?",
    costsSubtitle:
      "Each generation deducts credits at the rates below.",
    tableType: "Type",
    tableUnit: "Unit",
    tableCredits: "Credits",
    tableStatus: "Status",
    videoRow: "Video (720p)",
    videoUnit: "per second",
    imageRow: "Image",
    imageUnit: "per image",
    musicRow: "Music",
    musicUnit: "per request ({tracks} tracks)",
    chipTemplate: "{seconds}s · {credits} credits",
    failedFootnote: "Failed generations are refunded automatically.",
    costsCta: "Try image to video",
    compareTitle: "Compare plans",
    compareSubtitle: "The numbers behind each plan, side by side.",
    tableFeature: "Feature",
    tableMonthlyCredits: "Monthly credits",
    tablePrice: "Price",
    tablePricePerMonth: "{price} / month",
    tableCostPer100: "Cost per 100 credits",
    tableApproxVideos: "{seconds}s 720p videos per month (approx.)",
    faqTitle: "Frequently asked questions",
    faqSubtitle: "Short answers about credits, billing and refunds.",
    refundPolicyLink: "Read the refund policy",
    termsLink: "Read the terms of service",
    errorFallback: "Something went wrong. Please try again.",
    ctaTitle: "Ready to make your first video?",
    ctaBody: "Start from an image and turn it into video with your credits.",
    ctaButton: "Start with image to video",
    breadcrumbHome: "Home",
    breadcrumbPricing: "Pricing",
    productDescription:
      "Prepaid credits for AI video generation on aivd.ai, sold as monthly or yearly plans and one-time packs.",
  },
  zh: {
    heroTitle: "方案与价格",
    heroSubtitle:
      "可以订阅方案，也可以单独买积分包。一份积分余额，平台上各类生成通用。",
    usdNote: "所有价格均以美元（USD）计价。",
    welcomeGift: "新注册账号赠送 {credits} 积分，有效期 {days} 天，可以先体验一下。",
    billingPeriodLabel: "计费周期",
    monthly: "按月",
    yearly: "按年",
    saveBadge: "最高省 {pct}%",
    perMonth: "/ 月",
    billedMonthly: "按月扣费",
    billedYearly: "按年扣费 {amount}",
    creditsPerMonth: "每月 {credits} 积分",
    creditsPerYear: "每年 {credits} 积分",
    approxVideos: "约 {count} 个 {seconds} 秒 720p 视频",
    per100Credits: "每 100 积分 {price}",
    validForDays: "积分有效期 {days} 天",
    mostPopular: "最受欢迎",
    available: "可使用",
    comingSoon: "即将上线",
    redirecting: "正在跳转…",
    getStarted: "立即购买",
    usdShort: "USD",
    creditPacksTitle: "积分包",
    creditPacksSubtitle: "一次购买，不需要订阅。",
    packCredits: "{credits} 积分",
    costsTitle: "每次生成需要多少积分？",
    costsSubtitle: "每次生成按下表扣除积分。",
    tableType: "类型",
    tableUnit: "计费单位",
    tableCredits: "积分",
    tableStatus: "状态",
    videoRow: "视频（720p）",
    videoUnit: "每秒",
    imageRow: "图片",
    imageUnit: "每张",
    musicRow: "音乐",
    musicUnit: "每次请求（{tracks} 首）",
    chipTemplate: "{seconds} 秒 · {credits} 积分",
    failedFootnote: "生成失败会自动退还积分。",
    costsCta: "去试试图生视频",
    compareTitle: "方案对比",
    compareSubtitle: "各方案的积分和价格，一目了然。",
    tableFeature: "项目",
    tableMonthlyCredits: "每月积分",
    tablePrice: "价格",
    tablePricePerMonth: "{price} / 月",
    tableCostPer100: "每 100 积分价格",
    tableApproxVideos: "每月约可生成 {seconds} 秒 720p 视频数",
    faqTitle: "常见问题",
    faqSubtitle: "关于积分、付费和退款，这里是最常见的几个问题。",
    refundPolicyLink: "阅读退款政策",
    termsLink: "阅读服务条款",
    errorFallback: "出错了，请重试。",
    ctaTitle: "开始做你的第一个视频",
    ctaBody: "用方案里的积分，把一张图片变成视频。",
    ctaButton: "去做图生视频",
    breadcrumbHome: "首页",
    breadcrumbPricing: "价格",
    productDescription:
      "aivd.ai 的 AI 视频生成积分，提供按月、按年订阅方案和一次性积分包。",
  },
};

/** Copy for a locale: Chinese when `locale === "zh"`, English otherwise. */
export function pricingCopy(locale: string): PricingCopy {
  return locale === "zh" ? PRICING_COPY.zh : PRICING_COPY.en;
}

/* ------------------------------------------------------------------ */
/* JSON-LD                                                             */
/* ------------------------------------------------------------------ */

export type JsonLdNode = Record<string, unknown>;

export interface JsonLdSubscriptionInput {
  name: string;
  /** Price in cents. */
  priceCents: number;
  billingPeriod: BillingPeriod;
}

export interface JsonLdPackInput {
  name: string;
  /** Price in cents. */
  priceCents: number;
}

export interface PricingJsonLdInput {
  homeUrl: string;
  pricingUrl: string;
  homeLabel: string;
  pricingLabel: string;
  productName: string;
  productDescription: string;
  siteName: string;
  subscriptions: JsonLdSubscriptionInput[];
  packs: JsonLdPackInput[];
  faq: FaqItem[];
}

/**
 * BreadcrumbList + FAQPage + Product for /pricing.
 * Deliberately contains no aggregateRating, review or availability.
 */
export function buildPricingJsonLd(input: PricingJsonLdInput): JsonLdNode[] {
  const breadcrumb: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: input.homeLabel,
        item: input.homeUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: input.pricingLabel,
        item: input.pricingUrl,
      },
    ],
  };

  const faqPage: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: input.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const subscriptionOffers = input.subscriptions.map((product) => {
    const price = formatPriceString(product.priceCents);
    return {
      "@type": "Offer",
      name: product.name,
      price,
      priceCurrency: "USD",
      url: input.pricingUrl,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price,
        priceCurrency: "USD",
        billingDuration: 1,
        unitCode: product.billingPeriod === "year" ? "ANN" : "MON",
      },
    };
  });

  const packOffers = input.packs.map((product) => ({
    "@type": "Offer",
    name: product.name,
    price: formatPriceString(product.priceCents),
    priceCurrency: "USD",
    url: input.pricingUrl,
  }));

  const product: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.productName,
    description: input.productDescription,
    brand: {
      "@type": "Brand",
      name: input.siteName,
    },
    url: input.pricingUrl,
    offers: [...subscriptionOffers, ...packOffers],
  };

  return [breadcrumb, faqPage, product];
}
