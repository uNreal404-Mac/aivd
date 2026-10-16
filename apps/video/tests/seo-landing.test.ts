import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  SEO_LANDING,
  SEO_LANDING_SLUGS,
  faqJsonLd,
  generatorHref,
  howToJsonLd,
  seoLandingFor,
  type SeoLandingContent,
} from "../src/lib/seo-landing";

const LOCALES = ["en", "zh"] as const;

const EXPECTED_MODELS = [
  "Seedance 1.5 Pro",
  "Seedance 1.0 Pro Fast",
  "Seedance 1.0 Pro Quality",
];

/** Model names that are disabled in the pricing config and must not appear. */
const DISABLED_MODEL_PATTERN = /Wan|Veo|Sora/;

/** Path of the only new route this batch introduces, relative to apps/video. */
const ROUTE_SEGMENTS = [
  "src",
  "app",
  "[locale]",
  "(marketing)",
  "ai-video-generator",
  "page.tsx",
];

const CASES = SEO_LANDING_SLUGS.flatMap((slug) =>
  LOCALES.map((locale) => ({
    slug,
    locale,
    label: `${slug}/${locale}`,
    content: seoLandingFor(slug, locale),
  })),
);

function routeCandidates(): string[] {
  return [
    path.join(process.cwd(), ...ROUTE_SEGMENTS),
    path.join(process.cwd(), "apps", "video", ...ROUTE_SEGMENTS),
  ];
}

/** Every human-readable string on a landing page. */
function copyStrings(content: SeoLandingContent): string[] {
  return [
    content.title,
    content.description,
    content.h1,
    content.heroSub,
    content.promptPlaceholder,
    content.ctaLabel,
    content.whatTitle,
    ...content.whatBody,
    content.stepsTitle,
    ...content.steps.flatMap((step) => [step.title, step.body]),
    content.compareTitle,
    ...content.compareRows.flatMap((row) => [row.model, row.bestFor, row.input]),
    content.faqTitle,
    ...content.faq.flatMap((item) => [item.q, item.a]),
  ];
}

describe("seo landing content", () => {
  it("registers exactly the three expected slugs", () => {
    expect([...SEO_LANDING_SLUGS]).toEqual([
      "ai-video-generator",
      "text-to-video",
      "image-to-video",
    ]);
    expect(new Set(SEO_LANDING_SLUGS).size).toBe(SEO_LANDING_SLUGS.length);
    expect(Object.keys(SEO_LANDING).sort()).toEqual(
      [...SEO_LANDING_SLUGS].sort(),
    );
  });

  it("has an en and zh entry for every slug", () => {
    for (const slug of SEO_LANDING_SLUGS) {
      expect(SEO_LANDING[slug].en, `${slug} en`).toBeDefined();
      expect(SEO_LANDING[slug].zh, `${slug} zh`).toBeDefined();
    }
  });

  it("keeps titles within the 60 character limit", () => {
    for (const { label, content } of CASES) {
      expect(content.title.length, `${label} title`).toBeGreaterThan(0);
      expect(content.title.length, `${label} title`).toBeLessThanOrEqual(60);
    }
  });

  it("keeps descriptions within the 155 character limit", () => {
    for (const { label, content } of CASES) {
      expect(content.description.length, `${label} description`).toBeGreaterThan(
        0,
      );
      expect(
        content.description.length,
        `${label} description`,
      ).toBeLessThanOrEqual(155);
    }
  });

  it("has a non-empty, unique h1 on every page", () => {
    const h1s = CASES.map(({ content }) => content.h1);
    for (const { label, content } of CASES) {
      expect(content.h1.trim(), `${label} h1`).not.toBe("");
    }
    expect(new Set(h1s).size).toBe(h1s.length);
  });

  it("keeps titles and descriptions unique across pages", () => {
    const titles = CASES.map(({ content }) => content.title);
    const descriptions = CASES.map(({ content }) => content.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("ships three steps and five faq entries per page", () => {
    for (const { label, content } of CASES) {
      expect(content.steps, `${label} steps`).toHaveLength(3);
      expect(content.faq, `${label} faq`).toHaveLength(5);
      for (const step of content.steps) {
        expect(step.title.trim(), `${label} step title`).not.toBe("");
        expect(step.body.trim(), `${label} step body`).not.toBe("");
      }
      for (const item of content.faq) {
        expect(item.q.trim(), `${label} faq q`).not.toBe("");
        expect(item.a.trim(), `${label} faq a`).not.toBe("");
      }
    }
  });

  it("compares the three enabled models with the real input modality", () => {
    for (const { slug, locale, label, content } of CASES) {
      if (slug === "ai-video-generator" || slug === "text-to-video" || slug === "image-to-video") {
        expect(content.compareRows, `${label} rows`).toHaveLength(3);
      }
      expect(content.compareRows.map((row) => row.model)).toEqual(
        EXPECTED_MODELS,
      );
      for (const row of content.compareRows) {
        expect(row.bestFor.trim(), `${label} bestFor`).not.toBe("");
        expect(row.input, `${label} input`).toBe("Text, image");
      }
    }
  });

  it("never mentions a disabled model in any copy", () => {
    for (const slug of SEO_LANDING_SLUGS) {
      for (const locale of LOCALES) {
        const content = seoLandingFor(slug, locale);
        const label = `${slug}/${locale}`;
        for (const text of copyStrings(content)) {
          expect(text, `${label} disabled model`).not.toMatch(
            DISABLED_MODEL_PATTERN,
          );
        }
      }
    }
  });

  it("keeps the declared path in sync with the slug", () => {
    for (const { slug, content } of CASES) {
      expect(content.path).toBe(`/${slug}`);
    }
  });

  it("avoids invented metrics in copy", () => {
    for (const { label, content } of CASES) {
      for (const text of copyStrings(content)) {
        expect(text, `${label} percentages`).not.toMatch(/%/);
        expect(text, `${label} digit+plus`).not.toMatch(/\d+\s*(?:[MKB])?\s*\+/);
      }
    }
  });
});

describe("seo landing structured data", () => {
  it("builds a FAQPage with one question per faq entry", () => {
    const content = seoLandingFor("ai-video-generator", "en");
    const ld = faqJsonLd(content);

    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(5);
    expect(ld.mainEntity.map((entry) => entry["@type"])).toEqual(
      new Array(5).fill("Question"),
    );
    expect(ld.mainEntity.map((entry) => entry.name)).toEqual(
      content.faq.map((item) => item.q),
    );
    expect(ld.mainEntity.map((entry) => entry.acceptedAnswer.text)).toEqual(
      content.faq.map((item) => item.a),
    );
    expect(
      ld.mainEntity.every((entry) => entry.acceptedAnswer["@type"] === "Answer"),
    ).toBe(true);
  });

  it("builds a HowTo with the three steps in order", () => {
    const content = seoLandingFor("image-to-video", "zh");
    const ld = howToJsonLd(content);

    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("HowTo");
    expect(ld.name).toBe(content.stepsTitle);
    expect(ld.step).toHaveLength(3);
    expect(ld.step.map((step) => step.position)).toEqual([1, 2, 3]);
    expect(ld.step.map((step) => step.name)).toEqual(
      content.steps.map((step) => step.title),
    );
    expect(ld.step.map((step) => step.text)).toEqual(
      content.steps.map((step) => step.body),
    );
  });
});

describe("generatorHref", () => {
  const prompt = "a cat & a dog / at sunset";

  it("points at the shared text generator for text-driven slugs", () => {
    expect(generatorHref("en", "ai-video-generator")).toBe("/en/ai/video");
    expect(generatorHref("zh", "text-to-video")).toBe("/zh/ai/video");
  });

  it("points at the image entry for image-to-video", () => {
    expect(generatorHref("en", "image-to-video")).toBe("/en/image-to-video");
    expect(generatorHref("zh", "image-to-video")).toBe("/zh/image-to-video");
  });

  it("encodes the prompt into the query string", () => {
    const href = generatorHref("en", "text-to-video", prompt);
    expect(href).toBe(`/en/ai/video?prompt=${encodeURIComponent(prompt)}`);
    expect(href).not.toContain(" ");
    expect(href).toContain("%20");
    expect(href).toContain("%26");
  });

  it("ignores an empty or whitespace-only prompt", () => {
    expect(generatorHref("en", "ai-video-generator", "")).toBe("/en/ai/video");
    expect(generatorHref("en", "ai-video-generator", "   ")).toBe(
      "/en/ai/video",
    );
    expect(generatorHref("en", "image-to-video", "  ")).toBe(
      "/en/image-to-video",
    );
  });
});

describe("sitemap coverage", () => {
  it("includes the new slug in the landing slug list", () => {
    expect([...SEO_LANDING_SLUGS]).toContain("ai-video-generator");
  });

  it("has a route file for the new marketing page", () => {
    const candidates = routeCandidates();
    const found = candidates.filter((candidate) => existsSync(candidate));
    expect(
      found.length,
      `expected one of: ${candidates.join(", ")}`,
    ).toBeGreaterThan(0);
  });
});
