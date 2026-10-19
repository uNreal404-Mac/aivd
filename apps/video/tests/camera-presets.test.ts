import { describe, expect, it } from "vitest";
import {
  CAMERA_PRESET_IDS,
  CAMERA_PRESET_MAX_PROMPT_EXTRA,
  CAMERA_PRESETS,
  FIXED_LENS_MODELS,
  applyCameraPreset,
  containsCjk,
  getCameraPreset,
  isCameraPresetId,
} from "../src/lib/camera-presets";

describe("camera presets", () => {
  it("defines a complete, unique, well-labelled preset catalog", () => {
    expect(CAMERA_PRESETS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(CAMERA_PRESET_IDS).size).toBe(CAMERA_PRESET_IDS.length);
    expect(CAMERA_PRESETS.map((preset) => preset.id)).toEqual([
      ...CAMERA_PRESET_IDS,
    ]);

    for (const preset of CAMERA_PRESETS) {
      expect(preset.labelEn.trim().length).toBeGreaterThan(0);
      expect(preset.labelZh.trim().length).toBeGreaterThan(0);
      expect(preset.descriptionEn.trim().length).toBeGreaterThan(0);
      expect(preset.descriptionZh.trim().length).toBeGreaterThan(0);
      expect(preset.promptEn.trim().length).toBeGreaterThan(0);
      expect(preset.promptZh.trim().length).toBeGreaterThan(0);
      expect(containsCjk(preset.labelZh)).toBe(true);
      expect(isCameraPresetId(preset.id)).toBe(true);
    }

    const fixedLensIds = CAMERA_PRESETS.filter((preset) => preset.fixedLens).map(
      (preset) => preset.id,
    );
    expect(fixedLensIds).toEqual(["static"]);

    const requiredIds = [
      "push-in",
      "pull-out",
      "pan-left",
      "truck-left",
      "orbit",
      "dive",
      "crane-up",
      "tracking",
      "handheld",
      "dolly-zoom",
      "tornado",
      "drone-aerial",
      "static",
    ] as const;

    for (const id of requiredIds) {
      expect(CAMERA_PRESET_IDS).toContain(id);
      expect(getCameraPreset(id)?.id).toBe(id);
    }

    expect(getCameraPreset("not-a-preset")).toBeNull();
    expect(getCameraPreset(null)).toBeNull();
    expect(getCameraPreset(undefined)).toBeNull();
    expect(isCameraPresetId("orbit")).toBe(true);
    expect(isCameraPresetId("not-a-preset")).toBe(false);
    expect(isCameraPresetId(null)).toBe(false);
    expect(FIXED_LENS_MODELS).toContain("seedance-1.5-pro");
  });

  it("computes the maximum extra prompt length", () => {
    const expectedMax = CAMERA_PRESETS.reduce(
      (max, preset) => Math.max(max, preset.promptEn.length, preset.promptZh.length),
      0,
    );
    expect(CAMERA_PRESET_MAX_PROMPT_EXTRA).toBe(expectedMax);
    expect(CAMERA_PRESET_MAX_PROMPT_EXTRA).toBeGreaterThan(0);
  });

  it("appends the English push-in fragment with sentence punctuation", () => {
    const result = applyCameraPreset({
      prompt: "A red fox in snow",
      presetId: "push-in",
      modelId: "veo-3.1",
    });

    expect(result).toEqual({
      prompt:
        "A red fox in snow. Slow, smooth dolly push-in toward the subject.",
      presetId: "push-in",
    });
  });

  it("joins prompts that already end with punctuation using one space", () => {
    const result = applyCameraPreset({
      prompt: "A red fox in snow.",
      presetId: "push-in",
      modelId: "veo-3.1",
    });

    expect(result.prompt).toBe(
      "A red fox in snow. Slow, smooth dolly push-in toward the subject.",
    );
  });

  it("appends the Chinese push-in fragment with Chinese punctuation", () => {
    const result = applyCameraPreset({
      prompt: "雪地里的红狐狸",
      presetId: "push-in",
      modelId: "veo-3.1",
    });

    expect(result).toEqual({
      prompt: "雪地里的红狐狸。镜头缓慢平稳地向主体推进。",
      presetId: "push-in",
    });
  });

  it("is idempotent when the fragment is already present", () => {
    const first = applyCameraPreset({
      prompt: "A red fox in snow",
      presetId: "orbit",
      modelId: "seedance-1.5-pro",
    });
    const second = applyCameraPreset({
      prompt: first.prompt,
      presetId: "orbit",
      modelId: "seedance-1.5-pro",
    });

    expect(second).toEqual(first);
  });

  it("leaves unknown or empty presets untouched without fixedLens", () => {
    const result = applyCameraPreset({
      prompt: "keep me",
      presetId: "not-a-preset",
      modelId: "seedance-1.5-pro",
    });

    expect(result).toEqual({ prompt: "keep me", presetId: null });
    expect("fixedLens" in result).toBe(false);

    const empty = applyCameraPreset({
      prompt: "keep me",
      presetId: null,
      modelId: "seedance-1.5-pro",
    });
    expect(empty).toEqual({ prompt: "keep me", presetId: null });
    expect("fixedLens" in empty).toBe(false);
  });

  it("includes fixedLens only for supported models", () => {
    const staticResult = applyCameraPreset({
      prompt: "A red fox in snow",
      presetId: "static",
      modelId: "seedance-1.5-pro",
    });
    expect(staticResult.fixedLens).toBe(true);

    const orbitResult = applyCameraPreset({
      prompt: "A red fox in snow",
      presetId: "orbit",
      modelId: "seedance-1.5-pro",
    });
    expect(orbitResult.fixedLens).toBe(false);

    const unsupportedModelResult = applyCameraPreset({
      prompt: "A red fox in snow",
      presetId: "orbit",
      modelId: "veo-3.1",
    });
    expect(unsupportedModelResult.fixedLens).toBeUndefined();
    expect("fixedLens" in unsupportedModelResult).toBe(false);
  });
});
