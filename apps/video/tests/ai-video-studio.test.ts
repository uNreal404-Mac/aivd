import { describe, expect, it } from "vitest";

import {
  canGenerate,
  defaultSettings,
  estimateCredits,
  selectModel,
  STUDIO_MODELS,
} from "@/lib/ai-video-studio";

describe("defaultSettings", () => {
  it("uses the first model when none is provided", () => {
    const settings = defaultSettings();

    expect(settings.modelId).toBe(STUDIO_MODELS[0].id);
    expect(settings.duration).toBe(STUDIO_MODELS[0].durations[0]);
    expect(settings.aspect).toBe(STUDIO_MODELS[0].aspects[0]);
    expect(settings.resolution).toBe(STUDIO_MODELS[0].resolutions[0]);
    expect(settings.audio).toBe(STUDIO_MODELS[0].audio);
    expect(settings.prompt).toBe("");
  });

  it("derives every field from the provided model", () => {
    const model = STUDIO_MODELS[2];
    const settings = defaultSettings(model);

    expect(settings.modelId).toBe(model.id);
    expect(settings.duration).toBe(model.durations[0]);
    expect(settings.audio).toBe(model.audio);
  });
});

describe("selectModel", () => {
  it("keeps supported options when switching models", () => {
    const start = defaultSettings(STUDIO_MODELS[0]);
    const next = selectModel(start, STUDIO_MODELS[4].id);

    expect(next.modelId).toBe(STUDIO_MODELS[4].id);
    expect(next.duration).toBe(start.duration);
    expect(next.aspect).toBe(start.aspect);
    expect(next.resolution).toBe(start.resolution);
  });

  it("falls back to the new model's defaults for unsupported options", () => {
    const start = {
      ...defaultSettings(STUDIO_MODELS[1]),
      duration: 7,
      aspect: "4:3",
      resolution: "4k",
    };
    const next = selectModel(start, STUDIO_MODELS[0].id);

    expect(next.modelId).toBe(STUDIO_MODELS[0].id);
    expect(next.duration).toBe(STUDIO_MODELS[0].durations[0]);
    expect(next.aspect).toBe(STUDIO_MODELS[0].aspects[0]);
    expect(next.resolution).toBe(STUDIO_MODELS[0].resolutions[0]);
  });

  it("disables audio when the new model has no audio", () => {
    const start = { ...defaultSettings(STUDIO_MODELS[2]), audio: true };
    const next = selectModel(start, STUDIO_MODELS[3].id);

    expect(next.audio).toBe(false);
  });

  it("returns the settings unchanged for an unknown id", () => {
    const start = defaultSettings(STUDIO_MODELS[0]);
    const next = selectModel(start, "does-not-exist");

    expect(next).toEqual(start);
  });
});

describe("estimateCredits", () => {
  it("multiplies duration by the model rate", () => {
    const settings = defaultSettings(STUDIO_MODELS[3]);

    expect(estimateCredits(settings)).toBe(
      Math.ceil(settings.duration * STUDIO_MODELS[3].creditsPerSecond),
    );
  });

  it("applies the 1080p resolution factor", () => {
    const settings = {
      ...defaultSettings(STUDIO_MODELS[0]),
      resolution: "1080p",
    };

    expect(estimateCredits(settings)).toBe(
      Math.ceil(
        settings.duration * STUDIO_MODELS[0].creditsPerSecond * 1.5,
      ),
    );
  });

  it("applies the audio factor", () => {
    const settings = { ...defaultSettings(STUDIO_MODELS[2]), audio: true };

    expect(estimateCredits(settings)).toBe(
      Math.ceil(
        settings.duration * STUDIO_MODELS[2].creditsPerSecond * 1.2,
      ),
    );
  });
});

describe("canGenerate", () => {
  it("reports empty-prompt when the prompt is blank", () => {
    const settings = defaultSettings(STUDIO_MODELS[0]);

    expect(canGenerate(settings, true)).toEqual({
      ok: false,
      reason: "empty-prompt",
    });
    expect(canGenerate({ ...settings, prompt: "   " }, true)).toEqual({
      ok: false,
      reason: "empty-prompt",
    });
  });

  it("reports disabled when generation is turned off", () => {
    const settings = { ...defaultSettings(STUDIO_MODELS[0]), prompt: "a cat" };

    expect(canGenerate(settings, false)).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("reports ok when the prompt exists and generation is enabled", () => {
    const settings = { ...defaultSettings(STUDIO_MODELS[0]), prompt: "a cat" };

    expect(canGenerate(settings, true)).toEqual({ ok: true });
  });
});
