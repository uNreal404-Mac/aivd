import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ModelCreditTable } from "@/components/pricing/model-credit-table";
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

  it("keeps unavailable checkout actions disabled", () => {
    const html = renderPricing("en", false);
    expect(html.match(/<button[^>]*disabled[^>]*>Coming soon<\/button>/g)).toHaveLength(6);
  });
});
