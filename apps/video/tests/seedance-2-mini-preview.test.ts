import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isModelSupported } from "@/ai/model-mapping";
import { SEEDANCE_2_MINI_CREDIT_DRAFT } from "@/config/seedance-2-mini-credits.draft";
import {
  calculateModelCredits,
  getAvailableModels,
} from "@/config/credits";
import { VIDEO_MODEL_PRICING } from "@/config/pricing-user";
import {
  imageToVideoConfig,
} from "@/config/tool-pages/image-to-video.config";
import {
  referenceToVideoConfig,
} from "@/config/tool-pages/reference-to-video.config";
import {
  textToVideoConfig,
} from "@/config/tool-pages/text-to-video.config";
import { siteConfig } from "@/config/site";
import { HERO, MODEL_CARDS } from "@/lib/du-home";
import { Seedance2MiniPage } from "@/components/marketing/seedance-2-mini-page";
import {
  getSeedance2MiniCopy,
  SEEDANCE_2_MINI_PATH,
} from "@/lib/seedance-2-mini-page";

const videoRoot = path.resolve(__dirname, "..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(videoRoot, relativePath), "utf8");
}

function collectNumbers(value: unknown, found: number[] = []): number[] {
  if (typeof value === "number") {
    found.push(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, found);
    return found;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectNumbers(child, found);
  }
  return found;
}

describe("Seedance 2.0 mini preview copy", () => {
  it("keeps the homepage hero on Seedance and aivd.ai", () => {
    expect(HERO.eyebrow).toContain("Seedance 2.0 mini");
    expect(HERO.subtitle).toContain("aivd.ai");
    expect(HERO.subtitle.toLowerCase()).not.toContain("aidv");
    expect(HERO.subtitle).toContain("AI video generator");
    expect(HERO.subtitle).toContain("AI image generator");
    expect(HERO.subtitle).toContain("AI music generator");
    expect(HERO.subtitle).toContain("November 11, 2026");
    expect(HERO.ctas.some((cta) => cta.href === SEEDANCE_2_MINI_PATH)).toBe(
      true,
    );
    expect(siteConfig.name).toBe("aivd.ai");
    expect(siteConfig.description).toContain("Seedance 2.0 mini");
    expect(siteConfig.description.toLowerCase()).not.toContain("aidv");
  });

  it("links a model card at the dedicated route", () => {
    const card = MODEL_CARDS.find((item) => item.id === "seedance-2-mini");
    expect(card?.href).toBe(SEEDANCE_2_MINI_PATH);
    expect(card?.title).toBe("Seedance 2.0 mini");
  });

  it("renders the English and Chinese pages without a price or generation switch", () => {
    for (const locale of ["en", "zh"] as const) {
      const copy = getSeedance2MiniCopy(locale);
      const html = renderToStaticMarkup(
        createElement(Seedance2MiniPage, { locale }),
      );

      expect(copy.title.length).toBeLessThanOrEqual(60);
      expect(copy.description.length).toBeLessThanOrEqual(160);
      expect(html).toContain(copy.h1);
      expect(html).toContain("aivd.ai");
      expect(html.toLowerCase()).not.toContain("aidv");
      expect(html).toContain("2026");
      expect(html).toContain(`/${locale}/ai/video`);
      expect(html).toContain(`/${locale}/text-to-video`);
      expect(html).toContain(`/${locale}/image-to-video`);
      expect(html).toContain(`/${locale}/seedance-1-5`);
      expect(html).not.toMatch(/\$\d/);
      expect(copy.keywords).toEqual(
        expect.arrayContaining([
          "AI video generator",
          "AI image generator",
          "AI music generator",
        ]),
      );
    }
  });
});

describe("Seedance 2.0 mini draft credits stay unwired", () => {
  it("is an obvious draft with no retail numbers", () => {
    expect(SEEDANCE_2_MINI_CREDIT_DRAFT.status).toBe("DRAFT");
    expect(SEEDANCE_2_MINI_CREDIT_DRAFT.draft).toBe(true);
    expect(SEEDANCE_2_MINI_CREDIT_DRAFT.enabled).toBe(false);
    expect(SEEDANCE_2_MINI_CREDIT_DRAFT.wiredToCheckout).toBe(false);
    expect(SEEDANCE_2_MINI_CREDIT_DRAFT.wiredToGeneration).toBe(false);
    expect(SEEDANCE_2_MINI_CREDIT_DRAFT.retailCreditsPerSecond).toBeNull();
    expect(SEEDANCE_2_MINI_CREDIT_DRAFT.retailCreditsBase).toBeNull();
    expect(collectNumbers(SEEDANCE_2_MINI_CREDIT_DRAFT)).toEqual([]);
    expect(read("src/config/seedance-2-mini-credits.draft.ts")).toContain(
      "TODO(老板)",
    );
  });

  it("is absent from live pricing, providers, checkout, and the generator", () => {
    expect(VIDEO_MODEL_PRICING["seedance-2.0-mini"]).toBeUndefined();
    expect(
      getAvailableModels({ enabledOnly: false }).map((model) => model.id),
    ).not.toContain("seedance-2.0-mini");
    expect(
      calculateModelCredits("seedance-2.0-mini", { duration: 5, quality: "720p" }),
    ).toBe(0);

    for (const provider of ["evolink", "kie", "apimart"] as const) {
      expect(isModelSupported("seedance-2.0-mini", provider)).toBe(false);
    }

    const generateRoute = read("src/app/api/v1/video/generate/route.ts");
    expect(generateRoute).toContain('VIDEO_GENERATION_ENABLED !== "true"');
    expect(generateRoute).not.toContain("seedance-2.0-mini");
    expect(generateRoute).not.toContain("seedance-2-mini-credits.draft");

    expect(read("src/config/credits.ts")).not.toContain(
      "seedance-2-mini-credits.draft",
    );
    expect(read("src/ai/model-mapping.ts")).not.toContain("seedance-2.0-mini");
    expect(read("src/payment/stripe-checkout.ts")).not.toContain(
      "seedance-2.0-mini",
    );

    for (const config of [
      textToVideoConfig,
      imageToVideoConfig,
      referenceToVideoConfig,
    ]) {
      expect(config.generator.models.available).not.toContain(
        "seedance-2.0-mini",
      );
      expect(config.generator.models.default).not.toBe("seedance-2.0-mini");
    }
  });
});
