import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getModelConfig } from "@/config/credits";
import {
  MODEL_SEO,
  MODEL_SLUGS,
  buildFaqJsonLd,
  getCapabilities,
  getModelSeo,
  modelHref,
  tryHref,
} from "@/lib/model-seo";

/** The four landing pages and the backend model id each one points at. */
const EXPECTED_MODEL_IDS: Record<string, string> = {
  "seedance-1-5-pro": "seedance-1.5-pro",
  "wan-2-6": "wan2.6",
  "veo-3-1": "veo-3.1",
  "sora-2": "sora-2",
};

describe("model SEO data", () => {
  it("exposes exactly the four documented slugs and backend ids", () => {
    expect(MODEL_SLUGS).toHaveLength(4);
    expect([...MODEL_SLUGS].sort()).toEqual(
      Object.keys(EXPECTED_MODEL_IDS).sort()
    );

    for (const entry of MODEL_SEO) {
      expect(entry.modelId).toBe(EXPECTED_MODEL_IDS[entry.slug]);
    }
  });

  it("resolves entries by slug and returns undefined for unknown slugs", () => {
    for (const entry of MODEL_SEO) {
      expect(getModelSeo(entry.slug)).toBe(entry);
    }
    expect(getModelSeo("not-a-real-model")).toBeUndefined();
  });

  it("points every entry at a model that exists in the credits config", () => {
    for (const entry of MODEL_SEO) {
      expect(getModelConfig(entry.modelId)).not.toBeNull();
      expect(entry.name).toBe(getModelConfig(entry.modelId)?.name);
    }
  });

  it("keeps titles within 60 characters and unique", () => {
    const titles = MODEL_SEO.map((entry) => entry.title);
    for (const title of titles) {
      expect(title.length).toBeLessThanOrEqual(60);
      expect(title.length).toBeGreaterThan(0);
    }
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("keeps descriptions within 155 characters and unique", () => {
    const descriptions = MODEL_SEO.map((entry) => entry.description);
    for (const description of descriptions) {
      expect(description.length).toBeLessThanOrEqual(155);
      expect(description.length).toBeGreaterThan(0);
    }
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("gives every entry three use cases and four to six FAQs", () => {
    for (const entry of MODEL_SEO) {
      expect(entry.useCases).toHaveLength(3);
      expect(entry.intro.length).toBeGreaterThan(0);
      expect(entry.faqs.length).toBeGreaterThanOrEqual(4);
      expect(entry.faqs.length).toBeLessThanOrEqual(6);
      for (const faq of entry.faqs) {
        expect(faq.q.trim().length).toBeGreaterThan(0);
        expect(faq.a.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("does not mention other generation products", () => {
    const serialized = JSON.stringify(MODEL_SEO).toLowerCase();
    expect(serialized).not.toContain("higgsfield");
  });
});

describe("buildFaqJsonLd", () => {
  it("produces a valid FAQPage object for each entry", () => {
    for (const entry of MODEL_SEO) {
      const jsonLd = buildFaqJsonLd(entry);

      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("FAQPage");
      expect(jsonLd.mainEntity).toHaveLength(entry.faqs.length);

      jsonLd.mainEntity.forEach((question, index) => {
        expect(question["@type"]).toBe("Question");
        expect(question.name).toBe(entry.faqs[index].q);
        expect(question.acceptedAnswer["@type"]).toBe("Answer");
        expect(question.acceptedAnswer.text).toBe(entry.faqs[index].a);
      });

      // Must survive a round trip through JSON for the inline <script> tag.
      expect(() => JSON.parse(JSON.stringify(jsonLd))).not.toThrow();
    }
  });
});

describe("getCapabilities", () => {
  it("mirrors the credits config and never exposes an audio flag", () => {
    for (const entry of MODEL_SEO) {
      const config = getModelConfig(entry.modelId);
      const capabilities = getCapabilities(entry.modelId);

      expect(config).not.toBeNull();
      expect(capabilities).not.toBeNull();
      if (!config || !capabilities) throw new Error("missing model config");

      expect(capabilities.durations).toEqual(config.durations);
      expect(capabilities.aspectRatios).toEqual(config.aspectRatios);
      expect(capabilities.resolutions).toEqual(config.qualities ?? []);
      expect(capabilities.imageToVideo).toBe(
        config.supportImageToVideo === true
      );
      expect(Object.keys(capabilities)).not.toContain("audio");
    }
  });

  it("returns null for a model that is not configured", () => {
    expect(getCapabilities("not-a-real-model")).toBeNull();
  });
});

describe("href builders", () => {
  it("encodes the model id in the generator deep link", () => {
    const entry = MODEL_SEO[0];

    expect(tryHref("en", entry)).toBe(
      `/en/ai/video?model=${encodeURIComponent(entry.modelId)}`
    );
    expect(tryHref("en", { ...entry, modelId: "a b&c" })).toBe(
      "/en/ai/video?model=a%20b%26c"
    );
  });

  it("builds locale-prefixed landing page paths", () => {
    for (const entry of MODEL_SEO) {
      expect(modelHref("en", entry.slug)).toBe(`/en/models/${entry.slug}`);
      expect(modelHref("zh", entry.slug)).toBe(`/zh/models/${entry.slug}`);
    }
  });
});

describe("sitemap source", () => {
  const sitemapSource = readFileSync(
    fileURLToPath(new URL("../src/app/sitemap.ts", import.meta.url)),
    "utf8"
  );

  it("adds one route per model landing page using MODEL_SLUGS", () => {
    expect(sitemapSource).toContain("MODEL_SLUGS");
    expect(sitemapSource).toMatch(
      /(from|require\()\s*["']@\/lib\/model-seo["']/
    );
  });

  it("skips dynamic route directories while scanning pages", () => {
    expect(sitemapSource).toMatch(/includes\(\s*["'`]\[["'`]\s*\)/);
  });
});
