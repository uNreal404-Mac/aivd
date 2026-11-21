import { describe, expect, it } from "vitest";

import {
  STUDIO_MODELS,
  bestAffordableModel,
  defaultSettings,
  estimateCredits,
  modelOptions,
  selectModel,
} from "@/lib/ai-video-studio";

const option = (id: string, credits: number) => ({ id, name: id.toUpperCase(), credits });

describe("bestAffordableModel", () => {
  const options = [option("veo", 65), option("grok", 40), option("minimax", 55), option("wan", 70)];

  it("offers the dearest other model the balance covers", () => {
    expect(bestAffordableModel(options, "veo", 60)?.id).toBe("minimax");
    expect(bestAffordableModel(options, "wan", 69)?.id).toBe("veo");
  });

  it("never offers the model already chosen", () => {
    expect(bestAffordableModel(options, "grok", 45)).toBeUndefined();
  });

  it("offers nothing when no model fits", () => {
    expect(bestAffordableModel(options, "veo", 30)).toBeUndefined();
  });
});

describe("modelOptions", () => {
  const settings = defaultSettings();
  const available = STUDIO_MODELS.filter((model) => model.available).map((model) => model.id);

  it("prices each model as the studio would after switching to it", () => {
    const options = modelOptions(settings, available);
    expect(options.length).toBeGreaterThan(1);
    for (const item of options) {
      expect(item.credits).toBe(estimateCredits(selectModel(settings, item.id)));
      expect(item.name).toBe(STUDIO_MODELS.find((model) => model.id === item.id)?.name);
    }
  });

  it("leaves out models the studio cannot run", () => {
    const off = STUDIO_MODELS.find((model) => !model.available);
    const ids = ["no-such-model", ...(off ? [off.id] : [])];
    expect(modelOptions(settings, ids)).toEqual([]);
  });

  it("finds a real model a new account's balance covers when the default costs more", () => {
    const options = modelOptions(settings, available);
    const cost = estimateCredits(settings);
    const balance = cost - 1;
    const offer = bestAffordableModel(options, settings.modelId, balance);
    expect(offer).toBeDefined();
    expect(offer?.credits).toBeLessThanOrEqual(balance);
    const fits = options.filter((item) => item.id !== settings.modelId && item.credits <= balance);
    expect(offer?.credits).toBe(Math.max(...fits.map((item) => item.credits)));
  });
});
