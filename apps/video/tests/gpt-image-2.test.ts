import { describe, expect, it } from "vitest";

import { getMarketModel, marketCredits } from "@/ai/kie-market";

const model = getMarketModel("gpt-image-2");

describe("GPT Image 2", () => {
  it("is registered as an image model with 1K/2K/4K and up to 16 references", () => {
    expect(model?.kind).toBe("image");
    expect(model?.options.resolutions).toEqual(["1K", "2K", "4K"]);
    expect(model?.options.maxImages).toBe(16);
    expect(model?.options.maxCount).toBe(1);
  });

  it("charges KIE's list price per image: 1K $0.03, 2K $0.05, 4K $0.08 (9 / 14 / 23 credits)", () => {
    const at = (resolution: string) => marketCredits(model!, { prompt: "x", resolution });
    expect(model!.costUsd({ prompt: "x", resolution: "1K" })).toBe(0.03);
    expect(model!.costUsd({ prompt: "x", resolution: "2K" })).toBe(0.05);
    expect(model!.costUsd({ prompt: "x", resolution: "4K" })).toBe(0.08);
    expect([at("1K"), at("2K"), at("4K")]).toEqual([9, 14, 23]);
  });

  it("costs the same with reference images (no per-image input charge)", () => {
    const plain = marketCredits(model!, { prompt: "x", resolution: "2K" });
    const withRefs = marketCredits(model!, { prompt: "x", resolution: "2K", imageUrls: ["a", "b", "c"] });
    expect(withRefs).toBe(plain);
  });

  it("calls text-to-image without images and image-to-image with them, resolution always set", () => {
    expect(model!.buildTask({ prompt: "a cat", aspectRatio: "16:9", resolution: "2K" })).toEqual({
      model: "gpt-image-2-text-to-image",
      input: { prompt: "a cat", aspect_ratio: "16:9", resolution: "2K" },
    });
    const urls = Array.from({ length: 20 }, (_, index) => `https://example.com/${index}.png`);
    const task = model!.buildTask({ prompt: "a cat", imageUrls: urls });
    expect(task.model).toBe("gpt-image-2-image-to-image");
    expect(task.input).toMatchObject({ aspect_ratio: "auto", resolution: "1K" });
    expect((task.input.input_urls as string[]).length).toBe(16);
  });

  it("offers only aspect ratios KIE accepts at every resolution", () => {
    const rejectedAtHigherRes = ["5:4", "4:5", "3:1", "1:3", "9:21"];
    for (const aspect of model!.options.aspects ?? []) expect(rejectedAtHigherRes).not.toContain(aspect);
  });
});
