import { describe, it, expect } from "vitest";

import {
  PRICING_COPY,
  approxVideoCount,
  asPricingProducts,
  buildPricingJsonLd,
  costPer100Credits,
  displayPlanName,
  faqItemsFor,
  fill,
  formatPriceString,
  formatUsd,
  monthlyEquivalentCents,
  plansForPeriod,
  pricingCopy,
  yearlySavingsPercent,
  type FaqFacts,
  type PricingProduct,
} from "@/components/pricing/pricing-data";

function plan(
  id: string,
  name: string,
  credits: number,
  amount: number,
  billingPeriod: "month" | "year"
): PricingProduct {
  return {
    id,
    name,
    credits,
    price: { amount, currency: "usd" },
    billingPeriod,
  };
}

/* Real config shape (aivd.ai): Basic/Pro/Ultimate monthly + yearly. */
const BASIC_M = plan("basic-m", "Basic Plan", 280, 990, "month");
const BASIC_Y = plan("basic-y", "Basic Plan (Yearly)", 3360, 9900, "year");
const PRO_M = plan("pro-m", "Pro Plan", 960, 2990, "month");
const PRO_Y = plan("pro-y", "Pro Plan (Yearly)", 11520, 29900, "year");
const ULT_M = plan("ult-m", "Ultimate Plan", 2850, 7990, "month");
const ULT_Y = plan("ult-y", "Ultimate Plan (Yearly)", 34200, 79900, "year");

const ALL_PLANS = [BASIC_M, BASIC_Y, PRO_M, PRO_Y, ULT_M, ULT_Y];

const FACTS: FaqFacts = {
  welcomeCredits: 2,
  welcomeDays: 30,
  giftEnabled: true,
  monthlyValidityDays: 30,
  yearlyValidityDays: 365,
  packValidityDays: 400,
  refundWindowDays: 7,
  cheapestVideoSeconds: 4,
  cheapestVideoCredits: 16,
  videoPerSecond: 4,
  imageCredits: 3,
  musicCredits: 9,
  musicTracks: 2,
};

describe("yearlySavingsPercent", () => {
  it("returns the best yearly saving for the real config shape", () => {
    expect(yearlySavingsPercent(ALL_PLANS)).toBe(17);
  });

  it("returns 0 when there is no monthly counterpart", () => {
    expect(yearlySavingsPercent([BASIC_Y])).toBe(0);
  });

  it("returns 0 when there are no yearly plans", () => {
    expect(yearlySavingsPercent([BASIC_M, PRO_M])).toBe(0);
  });

  it("matches monthly plans regardless of the yearly suffix", () => {
    const saving = yearlySavingsPercent([
      plan("a", "Starter", 100, 1000, "month"),
      plan("b", "Starter (Annual)", 1200, 10000, "year"),
    ]);
    expect(saving).toBe(17);
  });
});

describe("monthlyEquivalentCents", () => {
  it("keeps monthly prices as-is", () => {
    expect(monthlyEquivalentCents(BASIC_M)).toBe(990);
  });

  it("divides yearly prices by 12", () => {
    expect(monthlyEquivalentCents(BASIC_Y)).toBe(825);
    expect(monthlyEquivalentCents(PRO_Y)).toBe(2492);
  });
});

describe("costPer100Credits", () => {
  it("computes the effective price of 100 credits", () => {
    expect(costPer100Credits(BASIC_M)).toBe(354);
    expect(costPer100Credits(ULT_M)).toBe(280);
  });

  it("returns 0 when there are no credits", () => {
    expect(
      costPer100Credits(plan("x", "Empty", 0, 1000, "month"))
    ).toBe(0);
  });
});

describe("displayPlanName", () => {
  it("strips yearly suffixes", () => {
    expect(displayPlanName("Basic Plan (Yearly)")).toBe("Basic Plan");
    expect(displayPlanName("Pro Plan (annual)")).toBe("Pro Plan");
    expect(displayPlanName("Ultimate Plan (Year)")).toBe("Ultimate Plan");
  });

  it("leaves plain names untouched", () => {
    expect(displayPlanName("Pro Plan")).toBe("Pro Plan");
  });
});

describe("approxVideoCount", () => {
  it("floors credits divided by the price of one video", () => {
    expect(approxVideoCount(280, 16)).toBe(17);
    expect(approxVideoCount(3360, 16)).toBe(210);
  });

  it("never divides by zero or negative values", () => {
    expect(approxVideoCount(280, 0)).toBe(0);
    expect(approxVideoCount(280, -4)).toBe(0);
  });
});

describe("formatting helpers", () => {
  it("formats cents as USD", () => {
    expect(formatUsd(990)).toBe("$9.90");
    expect(formatUsd(2990)).toBe("$29.90");
  });

  it("formats 2-decimal price strings", () => {
    expect(formatPriceString(990)).toBe("9.90");
    expect(formatPriceString(9900)).toBe("99.00");
  });

  it("fills templates and leaves unknown placeholders alone", () => {
    expect(fill("{a} and {b}", { a: "one" })).toBe("one and {b}");
  });
});

describe("copy", () => {
  it("has the same keys in en and zh", () => {
    expect(Object.keys(pricingCopy("en")).sort()).toEqual(
      Object.keys(pricingCopy("zh")).sort()
    );
  });

  it("mentions USD in both locales", () => {
    expect(pricingCopy("en").usdNote).toContain("USD");
    expect(pricingCopy("zh").usdNote).toContain("USD");
  });
});

describe("faqItemsFor", () => {
  const en = faqItemsFor("en", FACTS);
  const zh = faqItemsFor("zh", FACTS);

  it("returns the same ids in both locales", () => {
    expect(en.map((item) => item.id)).toEqual(zh.map((item) => item.id));
    expect(en).toHaveLength(8);
  });

  it("contains the numbers that came from the facts (en)", () => {
    const text = en.map((item) => item.answer).join(" ");
    for (const value of [
      FACTS.videoPerSecond,
      FACTS.cheapestVideoSeconds,
      FACTS.cheapestVideoCredits,
      FACTS.monthlyValidityDays,
      FACTS.yearlyValidityDays,
      FACTS.packValidityDays,
      FACTS.refundWindowDays,
      FACTS.imageCredits,
      FACTS.musicCredits,
      FACTS.musicTracks,
      FACTS.welcomeCredits,
      FACTS.welcomeDays,
    ]) {
      expect(text).toContain(String(value));
    }
  });

  it("contains the numbers that came from the facts (zh)", () => {
    const text = zh.map((item) => item.answer).join(" ");
    for (const value of [
      FACTS.videoPerSecond,
      FACTS.cheapestVideoCredits,
      FACTS.monthlyValidityDays,
      FACTS.yearlyValidityDays,
      FACTS.packValidityDays,
      FACTS.refundWindowDays,
      FACTS.imageCredits,
      FACTS.musicCredits,
      FACTS.musicTracks,
    ]) {
      expect(text).toContain(String(value));
    }
  });

  it("does not mention welcome credits when the gift is disabled", () => {
    const off = faqItemsFor("en", { ...FACTS, giftEnabled: false });
    const expiry = off.find((item) => item.id === "expiry");
    expect(expiry?.answer).not.toContain(`free credits`);
  });
});

describe("buildPricingJsonLd", () => {
  const subscriptions = [
    { name: BASIC_M.name, priceCents: BASIC_M.price.amount, billingPeriod: "month" as const },
    { name: BASIC_Y.name, priceCents: BASIC_Y.price.amount, billingPeriod: "year" as const },
  ];
  const packs = [{ name: "Starter Pack", priceCents: 1490 }];
  const faq = faqItemsFor("en", FACTS);

  const nodes = buildPricingJsonLd({
    homeUrl: "https://aivd.ai/",
    pricingUrl: "https://aivd.ai/pricing",
    homeLabel: "Home",
    pricingLabel: "Pricing",
    productName: "aivd.ai credits",
    productDescription: "Prepaid credits for AI video generation.",
    siteName: "aivd.ai",
    subscriptions,
    packs,
    faq,
  });

  const serialized = JSON.stringify(nodes);

  it("emits breadcrumb, FAQ page and product nodes", () => {
    const types = nodes.map((node) => node["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");

    const product = nodes.find((node) => node["@type"] === "Product");
    expect(product).toBeTruthy();
    expect(product?.name).toBe("aivd.ai credits");
    expect(product?.brand).toEqual({ "@type": "Brand", name: "aivd.ai" });
    expect(product?.aggregateRating).toBeUndefined();
    expect(product?.review).toBeUndefined();
  });

  it("never emits aggregateRating, review or availability", () => {
    expect(serialized).not.toContain("aggregateRating");
    expect(serialized).not.toContain('"review"');
    expect(serialized).not.toContain('"availability"');
  });

  it("mirrors the rendered FAQ items", () => {
    const faqPage = nodes.find((node) => node["@type"] === "FAQPage") as {
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
    };
    expect(faqPage.mainEntity).toHaveLength(faq.length);
    expect(faqPage.mainEntity[0].name).toBe(faq[0].question);
    expect(faqPage.mainEntity[0].acceptedAnswer.text).toBe(faq[0].answer);
  });

  it("uses 2-decimal USD price strings on every offer", () => {
    const product = nodes.find((node) => node["@type"] === "Product") as {
      offers: Array<Record<string, unknown>>;
    };
    expect(product.offers).toHaveLength(subscriptions.length + packs.length);

    for (const offer of product.offers) {
      expect(typeof offer.price).toBe("string");
      expect(offer.price).toMatch(/^\d+\.\d{2}$/);
      expect(offer.priceCurrency).toBe("USD");
      expect(offer.url).toBe("https://aivd.ai/pricing");
    }
  });

  it("adds a billing specification for subscriptions only", () => {
    const product = nodes.find((node) => node["@type"] === "Product") as {
      offers: Array<Record<string, unknown>>;
    };
    const monthly = product.offers[0] as {
      priceSpecification?: { unitCode: string; billingDuration: number };
    };
    const yearly = product.offers[1] as {
      priceSpecification?: { unitCode: string; billingDuration: number };
    };
    const pack = product.offers[2] as { priceSpecification?: unknown };

    expect(monthly.priceSpecification?.unitCode).toBe("MON");
    expect(yearly.priceSpecification?.unitCode).toBe("ANN");
    expect(monthly.priceSpecification?.billingDuration).toBe(1);
    expect(pack.priceSpecification).toBeUndefined();
  });
});

/* Kept from the previous suite: helpers whose behaviour did not change. */

describe("plansForPeriod", () => {
  it("keeps only the requested billing period, in order", () => {
    expect(plansForPeriod(ALL_PLANS, "month")).toEqual([BASIC_M, PRO_M, ULT_M]);
    expect(plansForPeriod(ALL_PLANS, "year")).toEqual([BASIC_Y, PRO_Y, ULT_Y]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(plansForPeriod([BASIC_M], "year")).toEqual([]);
    expect(plansForPeriod([], "month")).toEqual([]);
  });
});

describe("asPricingProducts", () => {
  it("narrows config objects to the render props", () => {
    const result = asPricingProducts([
      {
        id: "basic-monthly",
        name: "Basic",
        credits: 1000,
        price: { amount: 1900, currency: "USD" },
        type: "subscription",
        billingPeriod: "month",
      },
    ]);

    expect(result).toEqual([
      {
        id: "basic-monthly",
        name: "Basic",
        credits: 1000,
        price: { amount: 1900, currency: "USD" },
        billingPeriod: "month",
      },
    ]);
  });
});

describe("pricingCopy locale fallback", () => {
  it("returns English for any non-zh locale and Chinese for zh", () => {
    expect(pricingCopy("en")).toBe(PRICING_COPY.en);
    expect(pricingCopy("fr")).toBe(PRICING_COPY.en);
    expect(pricingCopy("zh")).toBe(PRICING_COPY.zh);
  });

  it("translates every key with a non-empty value", () => {
    for (const key of Object.keys(PRICING_COPY.en) as (keyof typeof PRICING_COPY.en)[]) {
      expect(PRICING_COPY.zh[key].length).toBeGreaterThan(0);
    }
  });

  it("falls back to English FAQ for other locales", () => {
    expect(faqItemsFor("fr", FACTS)).toEqual(faqItemsFor("en", FACTS));
  });
});
