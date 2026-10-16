import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getModelConfig } from "@/config/credits";
import {
  MODEL_PAGE_COPY,
  MODEL_SEO,
  MODEL_SLUGS,
  buildFaqJsonLd,
  getCapabilities,
  getModelSeo,
  localizeModelSeo,
  modelHref,
  resolveLocale,
  tryHref,
} from "@/lib/model-seo";

/** The four landing pages and the backend model id each one points at. */
const EXPECTED_MODEL_IDS: Record<string, string> = {
  "seedance-1-5-pro": "seedance-1.5-pro",
  "wan-2-6": "wan2.6",
  "veo-3-1": "veo-3.1",
  "sora-2": "sora-2",
};

/** Matches a Simplified Chinese character (CJK Unified Ideograph). */
const CJK = /[\u4e00-\u9fff]/;

function hasCjk(value: string): boolean {
  return CJK.test(value);
}

function readModelPageSource(): string {
  return readFileSync(
    path.resolve(
      __dirname,
      "..",
      "src",
      "app",
      "[locale]",
      "(marketing)",
      "models",
      "[slug]",
      "page.tsx"
    ),
    "utf8"
  );
}

function collectCopyStrings(copy: (typeof MODEL_PAGE_COPY)["en"]): string[] {
  return [
    copy.capabilitiesHeading,
    copy.durations,
    copy.resolutions,
    copy.aspectRatios,
    copy.imageToVideo,
    copy.yes,
    copy.no,
    copy.secondsSuffix,
    copy.useCasesHeading,
    copy.howToHeading,
    copy.faqHeading,
    copy.otherModelsHeading,
    copy.h1("Sora 2"),
    copy.tryLabel("Sora 2"),
    ...copy.steps("Sora 2"),
  ];
}

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
      expect(title).not.toContain("DreamUtopia");
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

  it("keeps zh titles within 60 characters and unique", () => {
    const titles = MODEL_SEO.map((entry) => entry.zh.title);

    for (const title of titles) {
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThanOrEqual(60);
      expect(hasCjk(title)).toBe(true);
      expect(title).not.toContain("DreamUtopia");
    }

    expect(new Set(titles).size).toBe(titles.length);
  });

  it("keeps zh descriptions within 155 characters and unique", () => {
    const descriptions = MODEL_SEO.map((entry) => entry.zh.description);

    for (const description of descriptions) {
      expect(description.length).toBeGreaterThan(0);
      expect(description.length).toBeLessThanOrEqual(155);
      expect(hasCjk(description)).toBe(true);
    }

    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("matches the English FAQ count in zh, between four and six", () => {
    for (const entry of MODEL_SEO) {
      expect(entry.zh.faqs).toHaveLength(entry.faqs.length);
      expect(entry.zh.faqs.length).toBeGreaterThanOrEqual(4);
      expect(entry.zh.faqs.length).toBeLessThanOrEqual(6);

      for (const faq of entry.zh.faqs) {
        expect(hasCjk(faq.q)).toBe(true);
        expect(hasCjk(faq.a)).toBe(true);
      }
    }
  });

  it("writes every zh string with Chinese characters", () => {
    for (const entry of MODEL_SEO) {
      expect(hasCjk(entry.zh.intro)).toBe(true);
      expect(entry.zh.useCases).toHaveLength(3);

      for (const useCase of entry.zh.useCases) {
        expect(hasCjk(useCase)).toBe(true);
      }
    }
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

  it("defaults to the English questions and an en language tag", () => {
    for (const entry of MODEL_SEO) {
      const jsonLd = buildFaqJsonLd(entry);

      expect(jsonLd.inLanguage).toBe("en");
      expect(jsonLd.mainEntity.map((question) => question.name)).toEqual(
        entry.faqs.map((faq) => faq.q)
      );
    }
  });

  it("uses the zh questions and a zh-CN language tag for the zh locale", () => {
    for (const entry of MODEL_SEO) {
      const jsonLd = buildFaqJsonLd(entry, "zh");

      expect(jsonLd.inLanguage).toBe("zh-CN");
      expect(jsonLd.mainEntity).toHaveLength(entry.zh.faqs.length);
      expect(jsonLd.mainEntity.map((question) => question.name)).toEqual(
        entry.zh.faqs.map((faq) => faq.q)
      );
      expect(
        jsonLd.mainEntity.map((question) => question.acceptedAnswer.text)
      ).toEqual(entry.zh.faqs.map((faq) => faq.a));
    }
  });
});

describe("resolveLocale", () => {
  it("maps zh to zh and everything else to en", () => {
    expect(resolveLocale("zh")).toBe("zh");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("fr")).toBe("en");
    expect(resolveLocale("zh-CN")).toBe("en");
    expect(resolveLocale("")).toBe("en");
  });
});

describe("localizeModelSeo", () => {
  it("returns the English fields for the en locale", () => {
    for (const entry of MODEL_SEO) {
      expect(localizeModelSeo(entry, "en")).toEqual({
        slug: entry.slug,
        modelId: entry.modelId,
        name: entry.name,
        title: entry.title,
        description: entry.description,
        intro: entry.intro,
        useCases: entry.useCases,
        faqs: entry.faqs,
      });
    }
  });

  it("returns the Chinese fields for the zh locale", () => {
    for (const entry of MODEL_SEO) {
      const localized = localizeModelSeo(entry, "zh");

      expect(localized.slug).toBe(entry.slug);
      expect(localized.modelId).toBe(entry.modelId);
      expect(localized.name).toBe(entry.name);
      expect(localized.title).toBe(entry.zh.title);
      expect(localized.description).toBe(entry.zh.description);
      expect(localized.intro).toBe(entry.zh.intro);
      expect(localized.useCases).toEqual(entry.zh.useCases);
      expect(localized.faqs).toEqual(entry.zh.faqs);
      expect(hasCjk(localized.title)).toBe(true);
    }
  });
});

describe("MODEL_PAGE_COPY", () => {
  it("keeps the English labels free of Chinese characters", () => {
    const en = MODEL_PAGE_COPY.en;

    expect(en.h1("Sora 2")).toBe("Sora 2 AI Video Generator");
    expect(en.tryLabel("Sora 2")).toBe("Try Sora 2");
    expect(en.steps("Sora 2")).toEqual([
      "Write a prompt",
      "Pick Sora 2 and settings",
      "Generate and download",
    ]);
    expect(en.secondsSuffix).toBe("s");
    expect([en.yes, en.no]).toEqual(["Yes", "No"]);

    for (const value of collectCopyStrings(en)) {
      expect(hasCjk(value)).toBe(false);
    }
  });

  it("writes the Chinese labels in Chinese characters", () => {
    const zh = MODEL_PAGE_COPY.zh;

    expect(zh.h1("Sora 2")).toBe("Sora 2 AI 视频生成器");
    expect(zh.tryLabel("Sora 2")).toBe("试用 Sora 2");
    expect(zh.steps("Sora 2")).toEqual([
      "写下提示词",
      "选择 Sora 2 并调整参数",
      "生成并下载",
    ]);
    expect(zh.secondsSuffix).toBe("秒");
    expect([zh.yes, zh.no]).toEqual(["是", "否"]);
    expect(hasCjk(zh.h1("Sora 2"))).toBe(true);
    expect(hasCjk(zh.tryLabel("Sora 2"))).toBe(true);

    for (const step of zh.steps("Sora 2")) {
      expect(hasCjk(step)).toBe(true);
    }

    for (const value of collectCopyStrings(zh)) {
      expect(hasCjk(value)).toBe(true);
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

describe("model page source", () => {
  it("uses the localized copy helpers instead of hard-coded English labels", () => {
    const pageSource = readModelPageSource();

    expect(pageSource).toContain("MODEL_PAGE_COPY");
    expect(pageSource).toContain("localizeModelSeo");
    expect(pageSource).not.toContain("AI Video Generator");
    expect(pageSource).not.toContain("Try ");
    expect(pageSource).not.toContain("How to use");
    expect(pageSource).not.toContain("Other models");
  });
});
