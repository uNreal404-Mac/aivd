import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { GET as llms } from "@/app/llms.txt/route";
import { comparePage, compareSlugs, comparisonsFor } from "@/lib/compare-pages";
import { getLandingModel, landingPriceRows } from "@/lib/model-landing";
import { LIMITS, displayWidth } from "@/lib/site-check";

const read = (path: string) => readFileSync(resolve(__dirname, "..", path), "utf8");
const SUFFIX = " | aivd.ai";

describe("comparison pages", () => {
  const slugs = compareSlugs();

  it("are the three planned pairs, all between live video models", () => {
    expect(slugs).toEqual(["veo-3-1-vs-kling-4", "seedance-2-5-vs-kling-4", "seedance-2-5-vs-veo-3-1"]);
    for (const slug of slugs) {
      const page = comparePage(slug, false);
      expect(page?.a.live && page.b.live).toBe(true);
      expect(page?.a.kind).toBe("video");
    }
    expect(comparePage("veo-3-1-vs-nothing", false)).toBeNull();
  });

  it.each(slugs)("%s fits a search result and names both models", (slug) => {
    for (const zh of [false, true]) {
      const page = comparePage(slug, zh);
      if (!page) throw new Error(slug);
      expect(displayWidth(page.title + SUFFIX)).toBeLessThanOrEqual(LIMITS.title[1]);
      expect(displayWidth(page.description)).toBeLessThanOrEqual(LIMITS.description[1]);
      expect(displayWidth(page.description)).toBeGreaterThanOrEqual(LIMITS.description[0]);
      for (const name of [page.a.name, page.b.name]) {
        expect(page.title).toContain(name);
        expect(page.h1).toContain(name);
        expect(page.answer).toContain(name);
      }
    }
  });

  it.each(slugs)("%s quotes credits and costs from the pricing config", (slug) => {
    const page = comparePage(slug, false);
    if (!page) throw new Error(slug);
    for (const model of [page.a, page.b]) {
      const cheapest = landingPriceRows(model)[0];
      expect(page.answer).toContain(`${cheapest.credits} credits`);
      expect(page.answer).toContain(cheapest.cost);
    }
    const labels = page.rows.map((row) => row.label);
    expect(labels).toEqual(["Length", "Resolution", "Aspect ratio", "Sound", "Input", "Credits a clip, from", "Cost on a plan"]);
    expect(page.faqs.length).toBeGreaterThanOrEqual(4);
    expect(page.faqs.length).toBeLessThanOrEqual(5);
  });

  it.each(slugs)("%s promises nothing the site cannot do", (slug) => {
    for (const zh of [false, true]) {
      const text = JSON.stringify(comparePage(slug, zh));
      expect(text).not.toMatch(/undefined|NaN|unlimited|无限|no sign[- ]?up|免登录|Sora|no watermark on free|免费版无水印/i);
    }
  });

  it("says a model is silent only when its config has no sound", () => {
    const page = comparePage("veo-3-1-vs-kling-4", false);
    const sound = page?.rows.find((row) => row.label === "Sound");
    expect(sound?.a).toBe("Generated with the picture");
    expect(sound?.b).toBe("Silent");
  });

  it("are rendered on the server, in the sitemap, the site check and llms.txt", async () => {
    expect(read("src/components/compare/compare-page.tsx")).not.toContain("use client");
    expect(read("src/components/compare/compare-page.tsx")).toContain("<table");
    expect(read("src/components/compare/compare-page.tsx")).toContain("<details");
    expect(read("src/app/sitemap.ts")).toContain("compareSlugs()");
    expect(read("scripts/site-check.ts")).toContain("compareSlugs()");
    const text = await llms().text();
    for (const slug of slugs) expect(text).toContain(`/compare/${slug}`);
  });

  it("are linked from both models' pages", () => {
    expect(comparisonsFor("veo-3-1").map((item) => item.slug)).toEqual(["veo-3-1-vs-kling-4", "seedance-2-5-vs-veo-3-1"]);
    expect(comparisonsFor("kling-4-0").map((item) => item.other.slug)).toEqual(["veo-3-1", "seedance-2-5"]);
    expect(comparisonsFor("wan-2-6")).toEqual([]);
    expect(read("src/components/model-landing/model-landing.tsx")).toContain("comparisonsFor(model.slug)");
    expect(getLandingModel("kling-4-0")?.live).toBe(true);
  });
});

describe("production config", () => {
  it("needs a real support email before it builds", () => {
    expect(read("wrangler.prod.jsonc")).toMatch(/"NEXT_PUBLIC_SUPPORT_EMAIL":\s*"REPLACE_support_email"|"NEXT_PUBLIC_SUPPORT_EMAIL":\s*"[^"@\s]+@[^"\s]+"/);
  });
});
