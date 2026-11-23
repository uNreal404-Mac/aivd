import { describe, expect, it } from "vitest";
import { marketModelsOf } from "@/ai/kie-market";
import { STUDIO_MODELS } from "@/lib/ai-video-studio";
import { VIDEO_CATALOG, catalogVideoDurations } from "@/lib/kie-model-catalog";
import { closestDuration, durationLabel, secondsBetween } from "@/lib/video-durations";

describe("video duration choices", () => {
  it("uses every whole second in the continuous KIE ranges", () => {
    const ranges: Record<string, [number, number]> = {
      "bytedance/seedance-2-5": [4, 30],
      "seedance-2-5-flash": [4, 30],
      "kling/v4-reference-to-video": [3, 30],
      "kling/v4-flash-reference-to-video": [3, 20],
      "gemini-omni-flash-1-2": [3, 15],
      "minimax-h3/text-to-video": [4, 15],
      "wan/3-0-video": [2, 30],
      "grok-imagine/text-to-video": [6, 30],
      "grok-imagine-1-5": [1, 15],
      "happyhorse-1-1": [3, 15],
    };
    expect(marketModelsOf("video").map((model) => model.id).sort()).toEqual(Object.keys(ranges).sort());
    for (const model of marketModelsOf("video")) {
      const [min, max] = ranges[model.id];
      const allowed = secondsBetween(min, max);
      expect(model.options.durations, model.id).toEqual(allowed);
      expect(STUDIO_MODELS.find((item) => item.id === model.id)?.durations, model.id).toEqual(allowed);
      for (const duration of [min, min + 1, max - 1, max]) {
        expect(Number(model.buildTask({ prompt: "test", duration }).input.duration), `${model.id} ${duration}s`).toBe(duration);
      }
    }
  });

  it("gives every catalogued model a duration or a source-task duration", () => {
    for (const model of VIDEO_CATALOG) {
      expect(catalogVideoDurations(model.id).length || model.id === "bytedance/seedance-2-5-draft", model.id).toBeTruthy();
    }
    expect(catalogVideoDurations("sora-2")).toEqual([10, 15]);
    expect(catalogVideoDurations("wan2.6")).toEqual([5, 10, 15]);
    expect(STUDIO_MODELS.find((item) => item.id === "seedance-1.5-pro")?.durations).toEqual(secondsBetween(4, 12));
    expect(STUDIO_MODELS.find((item) => item.id === "kling-3")?.durations).toEqual(secondsBetween(3, 15));
    expect(closestDuration([5, 10, 15], 9)).toBe(10);
    expect(durationLabel(secondsBetween(4, 30))).toBe("4–30");
    expect(durationLabel([5, 10, 15])).toBe("5、10、15");
  });
});
