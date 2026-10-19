import { describe, expect, it } from "vitest";

import { resolveGenerateImageInputs } from "../src/lib/generate-image-inputs";

describe("resolveGenerateImageInputs", () => {
  it("treats imageKey as an imageUrl alias", () => {
    expect(resolveGenerateImageInputs({ imageKey: "k1" })).toEqual({
      imageUrl: "k1",
      imageUrls: undefined,
      requestedImage: true,
    });
  });

  it("prefers imageUrl over imageKey", () => {
    expect(
      resolveGenerateImageInputs({
        imageUrl: "https://cdn.test/a.png",
        imageKey: "k1",
      }),
    ).toEqual({
      imageUrl: "https://cdn.test/a.png",
      imageUrls: undefined,
      requestedImage: true,
    });
  });

  it("merges imageKeys into imageUrls", () => {
    expect(
      resolveGenerateImageInputs({
        imageUrls: ["https://cdn.test/a.png"],
        imageKeys: ["k1"],
      }),
    ).toEqual({
      imageUrl: undefined,
      imageUrls: ["https://cdn.test/a.png", "k1"],
      requestedImage: true,
    });
  });

  it("marks requestedImage true when an empty array is provided", () => {
    expect(resolveGenerateImageInputs({ imageUrls: [] })).toEqual({
      imageUrl: undefined,
      imageUrls: undefined,
      requestedImage: true,
    });
  });

  it("marks requestedImage false when nothing is provided", () => {
    expect(resolveGenerateImageInputs({})).toEqual({
      imageUrl: undefined,
      imageUrls: undefined,
      requestedImage: false,
    });
  });
});