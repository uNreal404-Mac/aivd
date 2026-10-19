import { describe, expect, it } from "vitest";

import { transformParamsForProvider } from "../src/ai/model-mapping";

describe("kieParamsTransformer", () => {
  it("passes seedance ratio strings through and uses a numeric duration", () => {
    const result = transformParamsForProvider("seedance-1.5-pro", "kie", {
      prompt: "p",
      aspectRatio: "16:9",
      duration: 4,
      imageUrl: "https://r2.example/x.png",
    });

    expect(result.input.aspect_ratio).toBe("16:9");
    expect(result.input.duration).toBe(4);
    expect(typeof result.input.duration).toBe("number");
    expect(result.input.input_urls).toEqual(["https://r2.example/x.png"]);
    expect(result.input.resolution).toBe("720p");
  });

  it("limits seedance input_urls to the first two images", () => {
    const result = transformParamsForProvider("seedance-1.5-pro", "kie", {
      prompt: "p",
      aspectRatio: "16:9",
      duration: 4,
      imageUrls: [
        "https://r2.example/a.png",
        "https://r2.example/b.png",
        "https://r2.example/c.png",
      ],
    });

    expect(result.input.input_urls).toEqual([
      "https://r2.example/a.png",
      "https://r2.example/b.png",
    ]);
  });

  it("maps sora-2 aspect ratios to landscape/portrait", () => {
    const landscape = transformParamsForProvider("sora-2", "kie", {
      prompt: "p",
      aspectRatio: "16:9",
    });
    expect(landscape.input.aspect_ratio).toBe("landscape");

    const portrait = transformParamsForProvider("sora-2", "kie", {
      prompt: "p",
      aspectRatio: "9:16",
    });
    expect(portrait.input.aspect_ratio).toBe("portrait");
  });

  it("does not send aspect_ratio for wan2.6 and keeps a string duration", () => {
    const result = transformParamsForProvider("wan2.6", "kie", {
      prompt: "p",
      aspectRatio: "16:9",
      duration: 5,
    });

    expect(result.input).not.toHaveProperty("aspect_ratio");
    expect(result.input.duration).toBe("5");
  });
});
