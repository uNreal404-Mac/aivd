import { describe, expect, it } from "vitest";

import {
  AUDIO_MODELS,
  DEFAULT_AUDIO_MODEL,
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODELS,
  SITE_CREDIT_USD,
  getMediaModel,
  grossMargin,
  kieCreditsToSiteCredits,
} from "@/config/media-pricing";

const allModels = [
  ...Object.values(IMAGE_MODELS),
  ...Object.values(AUDIO_MODELS),
];

describe("media pricing", () => {
  it("converts kie credits to site credits", () => {
    expect(kieCreditsToSiteCredits(4)).toBe(3);
    expect(kieCreditsToSiteCredits(12)).toBe(9);
    expect(IMAGE_MODELS["nano-banana"].siteCredits).toBe(3);
    expect(IMAGE_MODELS["nano-banana-edit"].siteCredits).toBe(3);
    expect(IMAGE_MODELS["imagen4-fast"].siteCredits).toBe(3);
    expect(IMAGE_MODELS["seedream-5-flash"].siteCredits).toBe(3);
    expect(IMAGE_MODELS["nano-banana-2"].siteCredits).toBe(6);
    expect(IMAGE_MODELS["nano-banana-pro"].siteCredits).toBe(14);
    expect(AUDIO_MODELS["suno-v6"].siteCredits).toBe(9);
  });

  it("never charges less than one site credit", () => {
    for (const model of allModels) {
      expect(model.siteCredits).toBeGreaterThanOrEqual(1);
    }
    expect(kieCreditsToSiteCredits(0)).toBe(1);
    expect(kieCreditsToSiteCredits(0.1)).toBe(1);
  });

  it("keeps a healthy margin at the cheapest pack", () => {
    for (const model of allModels) {
      expect(grossMargin(model, SITE_CREDIT_USD.lowest)).toBeGreaterThanOrEqual(
        0.65,
      );
    }
  });

  it("computes nano-banana margins", () => {
    const model = IMAGE_MODELS["nano-banana"];
    expect(grossMargin(model, SITE_CREDIT_USD.lowest)).toBeCloseTo(0.7151, 3);
    expect(grossMargin(model, SITE_CREDIT_USD.highest)).toBeCloseTo(0.8747, 3);
  });

  it("looks up models by media type", () => {
    expect(getMediaModel("image", "nope")).toBeNull();
    expect(getMediaModel("audio", "nope")).toBeNull();
    expect(getMediaModel("image", DEFAULT_IMAGE_MODEL)).not.toBeNull();
    expect(getMediaModel("audio", DEFAULT_AUDIO_MODEL)).not.toBeNull();
    expect(getMediaModel("image", DEFAULT_IMAGE_MODEL)?.mediaType).toBe("image");
    expect(getMediaModel("audio", DEFAULT_AUDIO_MODEL)?.mediaType).toBe("audio");
  });

  it("ships sane defaults and provider model ids", () => {
    expect(DEFAULT_IMAGE_MODEL).toBe("nano-banana");
    expect(DEFAULT_AUDIO_MODEL).toBe("suno-v6");
    expect(IMAGE_MODELS["nano-banana"].kieModel).toBe("google/nano-banana");
    expect(IMAGE_MODELS["nano-banana-edit"].supportsImageInput).toBe(true);
    expect(IMAGE_MODELS["nano-banana"].supportsImageInput).toBe(false);
    expect(AUDIO_MODELS["suno-v6"].kieModel).toBe("ai-music-api/generate");
    // Only models whose request schema is mapped are enabled for now.
    const enabled = allModels.filter((m) => m.enabled).map((m) => m.id).sort();
    expect(enabled).toEqual(
      ["nano-banana", "nano-banana-edit", "seedream-5-flash", "suno-v6"].sort()
    );
    for (const model of allModels) {
      expect(model.docsUrl.startsWith("https://")).toBe(true);
      expect(model.pricingUrl.startsWith("https://kie.ai/")).toBe(true);
    }
  });
});

describe("post-generation extension point", () => {
  it("is reserved but not implemented", async () => {
    const { runPostGenerationAction, isPostGenerationActionType } =
      await import("@/services/post-generation");
    expect(isPostGenerationActionType("extend")).toBe(true);
    expect(isPostGenerationActionType("add-music")).toBe(true);
    expect(isPostGenerationActionType("delete")).toBe(false);
    await expect(
      runPostGenerationAction({
        userId: "u",
        parentUuid: "vid_x",
        action: { type: "upscale", options: { targetResolution: "1080p" } },
      })
    ).rejects.toMatchObject({ status: 501 });
  });
});
