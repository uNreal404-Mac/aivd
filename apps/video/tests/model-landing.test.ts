import { describe, expect, it } from "vitest";
import { INDEXED_LANDING_SLUGS, LANDING_MODELS, LANDING_SLUGS, getLandingModel, landingFaqs, landingPrice, landingSlug, landingSpecs } from "@/lib/model-landing";

describe("model landing pages", () => {
  it("makes readable, unique slugs", () => {
    expect(landingSlug("GPT Image 2.6 Sunburst")).toBe("gpt-image-2-6-sunburst");
    expect(landingSlug("Veo 3.1")).toBe("veo-3-1");
    expect(new Set(LANDING_SLUGS).size).toBe(LANDING_SLUGS.length);
  });

  it("covers every nav model plus the older SEO pages", () => {
    for (const slug of ["veo-3-1", "wan-2-6", "seedance-2-5", "kling-4-0", "nano-banana-pro", "eleven-v3", "suno-v6", "sora-2", "seedance-1-5-pro"]) {
      expect(getLandingModel(slug), slug).toBeDefined();
    }
  });

  it("prices live models and never prices models that are not open", () => {
    for (const model of LANDING_MODELS) {
      const price = landingPrice(model);
      if (!model.live) expect(price, model.slug).toBeNull();
      else expect(price?.credits ?? 1, model.slug).toBeGreaterThan(0);
    }
    expect(getLandingModel("sora-2")?.live).toBe(false);
  });

  it("offers only live models to search engines", () => {
    expect(INDEXED_LANDING_SLUGS).not.toContain("sora-2");
    expect(INDEXED_LANDING_SLUGS).toContain("veo-3-1");
    expect(INDEXED_LANDING_SLUGS.length).toBe(LANDING_MODELS.filter((model) => model.live).length);
  });

  it("lists specs for live video and image models", () => {
    for (const model of LANDING_MODELS.filter((item) => item.live && item.kind !== "audio")) {
      expect(landingSpecs(model).length, model.slug).toBeGreaterThan(0);
    }
  });

  it("answers at least four questions in both languages", () => {
    for (const model of LANDING_MODELS) {
      expect(landingFaqs(model, true).length).toBeGreaterThanOrEqual(4);
      expect(landingFaqs(model, false).length).toBeGreaterThanOrEqual(4);
    }
  });
});
