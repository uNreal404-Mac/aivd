import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ModelCreditTable } from "@/components/pricing/model-credit-table";
import { pricingCopy } from "@/components/pricing/pricing-data";
import { PricingPage } from "@/components/pricing/pricing-page";
import { getOnetimeProducts, getSubscriptionProducts } from "@/config/credits";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

function renderPricing(locale: "en" | "zh", paymentsEnabled: boolean) {
  const providerProps = {
    locale,
    messages: locale === "zh" ? zh : en,
    timeZone: "UTC",
    children: createElement(PricingPage, {
      locale,
      paymentsEnabled,
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

  it.each(["en", "zh"] as const)("explains disabled checkout once and names each product in %s", (locale) => {
    const html = renderPricing(locale, false);
    const disabledLabels = Array.from(html.matchAll(/<button\b[^>]*\bdisabled[^>]*>([^<]+)<\/button>/g), match => match[1]);
    const products = locale === "zh"
      ? ["选择 Basic 方案", "选择 Pro 方案", "选择 Ultimate 方案", "购买 280 积分", "购买 960 积分", "购买 2,850 积分"]
      : ["Choose Basic", "Choose Pro", "Choose Ultimate", "Buy 280 credits", "Buy 960 credits", "Buy 2,850 credits"];
    expect(disabledLabels).toHaveLength(6);
    expect(new Set(disabledLabels)).toEqual(new Set(products));
    const notice = pricingCopy(locale).checkoutClosed;
    expect(html.split(notice)).toHaveLength(2);
    expect(renderPricing(locale, true)).not.toContain(notice);
  });
});
