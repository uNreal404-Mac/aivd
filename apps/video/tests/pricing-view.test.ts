import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ModelCreditTable } from "@/components/pricing/model-credit-table";
import { completeClipCount, plansForPeriod, pricingCopy } from "@/components/pricing/pricing-data";
import { PricingPage } from "@/components/pricing/pricing-page";
import { getPricingReferenceClip } from "@/components/pricing/reference-clip";
import { getAvailableModels, getOnetimeProducts, getSubscriptionProducts } from "@/config/credits";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

function renderPricing(locale: "en" | "zh", paymentsEnabled: boolean, referenceClip = getPricingReferenceClip()) {
  const providerProps = {
    locale,
    messages: locale === "zh" ? zh : en,
    timeZone: "UTC",
    children: createElement(PricingPage, {
      locale,
      paymentsEnabled,
      referenceClip,
      subscriptions: getSubscriptionProducts(),
      packs: getOnetimeProducts(),
      modelCosts: createElement(ModelCreditTable, { lang: locale }),
    }),
  };
  return renderToStaticMarkup(createElement(NextIntlClientProvider, providerProps));
}

describe("pricing cards", () => {
  it.each(["en", "zh"] as const)("renders translated feature labels in %s", (locale) => {
    const html = renderPricing(locale, true);
    const features = (locale === "zh" ? zh : en).Credits.features;

    for (const key of ["hd_videos", "fast_generation", "commercial_use"] as const) {
      expect(html).toContain(features[key]);
      expect(html).not.toContain(key);
    }
    expect(html.match(/\bpr-btn--primary\b/g)).toHaveLength(1);
    expect(html.match(/\bpr-btn--secondary\b/g)).toHaveLength(5);
  });

  it("shows credit-pack expiry and configured costs for one clip", () => {
    const html = renderPricing("en", true);
    expect(html).toContain("Valid for 365 days after purchase");
    expect(html).toContain("Seedance 1.5 Pro");
    expect(html).toContain("1080p");
    expect(html).toMatch(/<th scope="row">12 s<\/th><td>48<\/td><td>48<\/td><td>96<\/td>/);
    expect(html).not.toContain("Never expire");
  });

  it.each(["en", "zh"] as const)("only exposes purchase actions when checkout is open in %s", (locale) => {
    const closed = renderPricing(locale, false);
    const open = renderPricing(locale, true);
    const labels = locale === "zh"
      ? ["选择 Basic 方案", "选择 Pro 方案", "选择 Ultimate 方案", "购买 280 积分", "购买 960 积分", "购买 2,850 积分"]
      : ["Choose Basic", "Choose Pro", "Choose Ultimate", "Buy 280 credits", "Buy 960 credits", "Buy 2,850 credits"];
    for (const label of labels) {
      expect(open).toContain(label);
      expect(closed).not.toContain(label);
    }
    expect(closed).not.toMatch(/class="pr-btn /);
    expect(closed).toContain('href="#credit-costs"');
    const notice = pricingCopy(locale).checkoutClosed;
    expect(closed.split(notice)).toHaveLength(2);
    expect(open).not.toContain(notice);
    const shared = (locale === "zh" ? zh : en).Credits.features;
    expect(closed.split(shared.hd_videos)).toHaveLength(2);
    expect(closed.split(shared.fast_generation)).toHaveLength(2);
  });

  it("calculates whole clips for each actual billing period", () => {
    const ref = getPricingReferenceClip();
    expect(ref).toEqual({ model: "Seedance 1.5 Pro", duration: 4, quality: "720p", credits: 16 });
    if (!ref) throw new Error("Missing expected reference model");
    const products = getSubscriptionProducts();
    expect(plansForPeriod(products, "month").map((p) => completeClipCount(p, ref.credits))).toEqual([17, 60, 178]);
    expect(plansForPeriod(products, "year").map((p) => completeClipCount(p, ref.credits))).toEqual([210, 720, 2137]);
    const html = renderPricing("en", false);
    expect([...html.matchAll(/class="pr-output"><strong>([\d,]+)<\/strong>/g)].map((m) => m[1])).toEqual(["17", "60", "178"]);
    expect(html.split("billed at 16 credits per clip")).toHaveLength(2);
  });

  it("hides estimates without a supported duration and quality", () => {
    const model = getAvailableModels().find((m) => m.id === "seedance-1.5-pro");
    if (!model) throw new Error("Missing expected reference model");
    expect(getPricingReferenceClip([])).toBeNull();
    expect(getPricingReferenceClip([{ ...model, enabled: false }])).toBeNull();
    expect(getPricingReferenceClip([{ ...model, durations: [8] }])).toBeNull();
    expect(getPricingReferenceClip([{ ...model, qualities: ["1080P"] }])).toBeNull();
    expect(renderPricing("en", true, null)).not.toContain('class="pr-output"');
  });
});
