import { describe, expect, it } from "vitest";

import { CREDIT_EXPIRATION, NEW_USER_GIFT, PLAN_PERKS } from "@/config/pricing-user";
import { LEGAL_CONFIG } from "@/config/legal";
import { HELP_SLUGS, helpArticle, helpArticles, isHelpSlug } from "@/lib/help-articles";
import { packOffers, planOffers, usd } from "@/lib/pricing-offers";
import { helpPageGraph, jsonLd } from "@/lib/structured-data";

const LOCALES = ["en", "zh"] as const;

function allText(slug: (typeof HELP_SLUGS)[number], locale: "en" | "zh"): string {
  const article = helpArticle(slug, locale);
  return [
    article.question,
    article.description,
    article.answer,
    ...article.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.bullets ?? [])]),
  ].join("\n");
}

describe("help articles", () => {
  it("have every question in both languages, with no missing values", () => {
    for (const locale of LOCALES) {
      for (const slug of HELP_SLUGS) {
        const text = allText(slug, locale);
        expect(text, `${locale} ${slug}`).not.toMatch(/undefined|NaN|null|\$\{/);
        const article = helpArticle(slug, locale);
        expect(article.question.length).toBeGreaterThan(5);
        expect(article.answer.length).toBeGreaterThan(20);
        expect(article.sections.length).toBeGreaterThan(0);
      }
    }
  });

  it("keep descriptions short enough for a search result", () => {
    for (const article of helpArticles("en")) {
      expect(article.description.length, article.slug).toBeLessThanOrEqual(160);
    }
    for (const article of helpArticles("zh")) {
      expect(article.description.length, article.slug).toBeLessThanOrEqual(90);
    }
  });

  it("only link to other help questions that exist, never to themselves", () => {
    for (const article of helpArticles("en")) {
      expect(article.related.length).toBeGreaterThan(0);
      for (const slug of article.related) {
        expect(isHelpSlug(slug)).toBe(true);
        expect(slug).not.toBe(article.slug);
      }
      for (const link of article.links) expect(link.path.startsWith("/")).toBe(true);
    }
  });

  it("quote the figures from the pricing config", () => {
    const packs = packOffers();
    const plans = planOffers();
    const free = allText("free-credits", "en");
    expect(free).toContain(`${NEW_USER_GIFT.credits} free credits`);
    expect(free).toContain(`${NEW_USER_GIFT.validDays} days`);

    const payg = allText("pay-as-you-go-credits", "en");
    for (const pack of packs) expect(payg).toContain(usd(pack.priceUsd));
    expect(payg).toContain(`${CREDIT_EXPIRATION.purchaseDays} days`);

    const expiry = allText("credit-expiry", "zh");
    expect(expiry).toContain(`${CREDIT_EXPIRATION.subscriptionDays} 天`);
    expect(expiry).toContain(`${CREDIT_EXPIRATION.purchaseDays} 天`);

    expect(allText("refund-policy", "en")).toContain(`${LEGAL_CONFIG.refundWindowDays} days`);

    const concurrency = allText("concurrent-generations", "en");
    expect(concurrency).toContain(`Free accounts run ${PLAN_PERKS.free.concurrency} video`);
    for (const plan of plans) expect(concurrency).toContain(`runs ${plan.concurrency} video`);
  });

  it("do not promise what is not built", () => {
    for (const locale of LOCALES) {
      for (const slug of HELP_SLUGS) {
        const text = allText(slug, locale).toLowerCase();
        expect(text, slug).not.toMatch(/priority queue|优先排队|no sign[- ]?up|免注册/);
      }
    }
  });

  it("give each page breadcrumb and FAQ data that parses", () => {
    const article = helpArticle("failed-generation-credits", "zh");
    const graph = JSON.parse(
      jsonLd(
        helpPageGraph({
          path: `/help/${article.slug}`,
          name: article.question,
          description: article.description,
          locale: "zh",
          faqs: [{ q: article.question, a: article.answer }],
          dateModified: article.updated,
        }),
      ),
    ) as { "@graph": { "@type": string; itemListElement?: { item: string }[] }[] };
    const types = graph["@graph"].map((node) => node["@type"]);
    expect(types).toEqual(["WebPage", "BreadcrumbList", "FAQPage"]);
    const crumbs = graph["@graph"][1].itemListElement ?? [];
    expect(crumbs.map((crumb) => crumb.item)).toEqual([
      "http://localhost:3000/zh",
      "http://localhost:3000/zh/help",
      "http://localhost:3000/zh/help/failed-generation-credits",
    ]);
  });
});
