import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { GET as llms } from "@/app/llms.txt/route";
import { CONTENT_UPDATED, formatUpdated } from "@/config/content-dates";
import { aboutDoc } from "@/lib/about-content";
import { featureCopy } from "@/lib/feature-pages";
import { LANDING_MODELS, landingPriceAnswer, landingPriceRows } from "@/lib/model-landing";
import { planCostRange, planCreditUsdRange } from "@/lib/pricing-offers";
import { checkPage, pageFacts } from "@/lib/site-check";
import { featurePageGraph, siteGraph } from "@/lib/structured-data";

const read = (path: string) => readFileSync(resolve(__dirname, "..", path), "utf8");

describe("cost on a plan", () => {
  it("runs from the cheapest to the dearest credit price of the plans", () => {
    const { min, max } = planCreditUsdRange();
    expect(min).toBeLessThan(max);
    expect(planCostRange(100)).toBe(`US$${(100 * min).toFixed(2)}–${(100 * max).toFixed(2)}`);
  });

  it("sits next to every model on the feature pages", () => {
    for (const model of featureCopy("text-to-video", false).models) expect(model.cost).toBe(planCostRange(model.credits));
  });
});

describe("model page price answer", () => {
  const live = LANDING_MODELS.filter((model) => model.live);

  it("exists for every live model, from its cheapest option", () => {
    for (const model of live) {
      const rows = landingPriceRows(model);
      expect(rows.length, model.name).toBeGreaterThan(0);
      const credits = rows.map((row) => row.credits);
      expect(credits).toEqual([...credits].sort((a, b) => a - b));
      expect(landingPriceAnswer(model, false, 0)).toContain(`${rows[0].credits} credits`);
      expect(landingPriceAnswer(model, true, 0)).toContain(`${rows[0].credits} 积分`);
    }
  });

  it("mentions the free credits only when they cover the cheapest option", () => {
    for (const model of live) {
      const cheapest = landingPriceRows(model)[0].credits;
      const answer = landingPriceAnswer(model, false, 70) ?? "";
      expect(answer.includes("free credits"), model.name).toBe(70 >= cheapest);
    }
  });
});

describe("dates", () => {
  it("are real calendar days written by hand", () => {
    for (const date of Object.values(CONTENT_UPDATED)) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(formatUpdated("2026-11-21", false)).toBe("21 November 2026");
    expect(formatUpdated("2026-11-21", true)).toBe("2026 年 11 月 21 日");
  });
});

describe("structured data", () => {
  it("gives feature pages a dated WebPage, breadcrumbs and their questions", () => {
    const graph = featurePageGraph({
      path: "/text-to-video",
      name: "Text to Video AI",
      description: "d",
      locale: "en",
      faqs: [{ q: "q", a: "a" }],
      dateModified: "2026-11-21",
    })["@graph"] as { "@type": string }[];
    expect(graph.map((node) => node["@type"])).toEqual(["WebPage", "BreadcrumbList", "FAQPage"]);
    expect(JSON.stringify(graph)).not.toMatch(/undefined/);
  });

  it("names a contact on the organization only when there is an address", () => {
    const org = (siteGraph()["@graph"] as Record<string, unknown>[])[0];
    if (org.email) expect(org.contactPoint).toMatchObject({ "@type": "ContactPoint", email: org.email });
    else expect(org.contactPoint).toBeUndefined();
  });

  it("is checked on every page by the site check", () => {
    const html = (ld: string) => `<html lang="en"><body><script type="application/ld+json">${ld}</script><h1>x</h1></body></html>`;
    expect(pageFacts(html('{"a":1}')).badJsonLd).toBe(0);
    expect(pageFacts(html("{broken")).badJsonLd).toBe(1);
    expect(pageFacts(html('{"url":""}')).badJsonLd).toBe(1);
    const issues = checkPage(pageFacts(html("{broken")), { path: "/", language: "en", home: false, hreflangs: [], preview: true });
    expect(issues.some((issue) => issue.level === "error" && /structured data/.test(issue.message))).toBe(true);
  });
});

describe("about page", () => {
  it("names no operator until one is configured", () => {
    expect(JSON.stringify(aboutDoc("en", { companyName: "" }))).not.toMatch(/operated by/i);
    expect(aboutDoc("en", { companyName: "Example Ltd" }).intro).toContain("operated by Example Ltd");
  });

  it("lists the live models and promises nothing the site cannot do", () => {
    for (const locale of ["en", "zh"] as const) {
      const text = JSON.stringify(aboutDoc(locale, { companyName: "", email: "help@example.com" }));
      expect(text).toContain("Veo 3.1");
      expect(text).toContain("help@example.com");
      expect(text).not.toMatch(/unlimited|无限|no sign[- ]?up|免登录|Sora/i);
    }
  });

  it("is listed for search and linked from the footer", () => {
    expect(read("src/config/indexing-paths.ts")).toContain('path: "/about"');
    expect(read("src/components/landing/footer.tsx")).toContain('href: "/about"');
  });
});

describe("llms.txt", () => {
  it("maps the tools, the live models with prices, pricing and about", async () => {
    const text = await llms().text();
    expect(text.startsWith("# ")).toBe(true);
    for (const path of ["/text-to-video", "/image-to-video", "/reference-to-video", "/audio", "/pricing", "/about"]) expect(text).toContain(path);
    for (const model of LANDING_MODELS.filter((item) => item.live)) expect(text).toContain(`[${model.name}]`);
    expect(text).not.toMatch(/undefined|NaN/);
  });
});

describe("pages kept out of search", () => {
  it("unfinished pages are noindex but followed", () => {
    for (const path of ["(marketing)/image", "(tool)/ai/image", "(marketing)/effects", "(marketing)/gallery"]) {
      expect(read(`src/app/[locale]/${path}/page.tsx`), path).toContain("robots: DRAFT_ROBOTS");
    }
  });

  it("prompt links that fill in the generator are nofollow", () => {
    expect(read("src/components/feature/feature-content.tsx")).toMatch(/className="fc-try" rel="nofollow"/);
    expect(read("src/components/hf/wall-card.tsx")).toContain('href.includes("prompt=") ? "nofollow"');
  });
});

describe("pricing questions", () => {
  it("never print a missing setting", async () => {
    const { faqItemsFor } = await import("@/components/pricing/pricing-data");
    for (const locale of ["en", "zh"]) expect(JSON.stringify(faqItemsFor(locale))).not.toMatch(/undefined|null/);
  });
});
