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
  type SeoLandingSlug,
} from "../src/lib/seo-landing";

const LOCALES = ["en", "zh"] as const;

const EXPECTED_MODELS = [
  "Seedance 1.5 Pro",
  "Seedance 1.0 Pro Fast",
  "Seedance 1.0 Pro Quality",
];

const ORIGINAL_SLUGS: readonly SeoLandingSlug[] = [
  "ai-video-generator",
  "text-to-video",
  "image-to-video",
];

const NEW_SLUGS: readonly SeoLandingSlug[] = [
  "reference-to-video",
  "frames-to-video",
  "ai-video-generator-with-audio",
  "ai-short-video-generator",
  "ai-video-generator-for-tiktok",
];

/** Marketing routes only: reference-to-video lives under the tool layout. */
const NEW_MARKETING_SLUGS: readonly SeoLandingSlug[] = NEW_SLUGS.filter(
  (slug) => slug !== "reference-to-video",
);

const ENABLED_MODELS: readonly string[] = [
  "Seedance 1.5 Pro",
  "Seedance 1.0 Pro Fast",
  "Seedance 1.0 Pro Quality",
];

/** Pages that only fit a single model, since each targets one capability. */
const SINGLE_MODEL_SLUGS: readonly SeoLandingSlug[] = [
  "reference-to-video",
  "frames-to-video",
  "ai-video-generator-with-audio",
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

const NEW_CASES = NEW_SLUGS.flatMap((slug) =>
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

/** Same lookup style as routeCandidates, for arbitrary route segments. */
function routeExists(segments: string[]): boolean {
  return [
    path.join(process.cwd(), ...segments),
    path.join(process.cwd(), "apps", "video", ...segments),
  ].some((candidate) => existsSync(candidate));
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
  it("registers exactly the eight expected slugs", () => {
    expect([...SEO_LANDING_SLUGS]).toEqual([
      "ai-video-generator",
      "text-to-video",
      "image-to-video",
      "reference-to-video",
      "frames-to-video",
      "ai-video-generator-with-audio",
      "ai-short-video-generator",
      "ai-video-generator-for-tiktok",
    ]);
    expect(SEO_LANDING_SLUGS).toHaveLength(8);
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
    const cases = CASES.filter(({ slug }) => ORIGINAL_SLUGS.includes(slug));
    for (const { label, content } of cases) {
      expect(content.compareRows, `${label} rows`).toHaveLength(3);
      expect(content.compareRows.map((row) => row.model)).toEqual(
        EXPECTED_MODELS,
      );
      for (const row of content.compareRows) {
        expect(row.bestFor.trim(), `${label} bestFor`).not.toBe("");
        expect(row.input, `${label} input`).toBe("Text, image");
      }
    }
  });

  it("compares only enabled models on the new pages", () => {
    for (const { slug, label, content } of NEW_CASES) {
      expect(content.compareRows.length, `${label} rows`).toBeGreaterThanOrEqual(
        1,
      );
      expect(content.compareRows.length, `${label} rows`).toBeLessThanOrEqual(3);
      for (const row of content.compareRows) {
        expect(ENABLED_MODELS, `${label} model`).toContain(row.model);
        expect(row.bestFor.trim(), `${label} bestFor`).not.toBe("");
        expect(row.input.trim(), `${label} input`).not.toBe("");
      }
      if (SINGLE_MODEL_SLUGS.includes(slug)) {
        expect(content.compareRows, `${label} rows`).toHaveLength(1);
        expect(content.compareRows[0].model, `${label} model`).toBe(
          "Seedance 1.5 Pro",
        );
      }
    }
  });

  it("never names a disabled model on the new pages", () => {
    const disabled = ["Wan", "Veo", "Sora"];
    for (const { label, content } of NEW_CASES) {
      for (const text of copyStrings(content)) {
        for (const model of disabled) {
          expect(text, `${label} ${model}`).not.toContain(model);
        }
      }
    }
  });

  it("never promises free generation or watermark-free output on the new pages", () => {
    const banned = ["free", "免费", "watermark", "水印"];
    for (const { label, content } of NEW_CASES) {
      for (const text of copyStrings(content)) {
        const haystack = text.toLowerCase();
        for (const term of banned) {
          expect(haystack, `${label} ${term}`).not.toContain(
            term.toLowerCase(),
          );
        }
      }
    }
  });

  it("never mentions a disabled model in any copy", () => {
    for (const { label, content } of CASES) {
      for (const text of copyStrings(content)) {
        expect(text, `${label} disabled model`).not.toMatch(
          DISABLED_MODEL_PATTERN,
        );
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

  it("routes the new tool and capability slugs to the right entries", () => {
    expect(generatorHref("en", "reference-to-video")).toBe(
      "/en/reference-to-video",
    );
    expect(generatorHref("zh", "frames-to-video", "a b")).toBe(
      "/zh/ai/video?prompt=a%20b",
    );
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

  it("has route files for the four new marketing pages and the reference tool page", () => {
    for (const slug of NEW_MARKETING_SLUGS) {
      const segments = ["src", "app", "[locale]", "(marketing)", slug, "page.tsx"];
      expect(routeExists(segments), `(marketing)/${slug}/page.tsx`).toBe(true);
    }

    const toolSegments = [
      "src",
      "app",
      "[locale]",
      "(tool)",
      "reference-to-video",
      "page.tsx",
    ];
    expect(routeExists(toolSegments), "(tool)/reference-to-video/page.tsx").toBe(
      true,
    );
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
