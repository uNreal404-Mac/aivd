import { describe, expect, it } from "vitest";
import { MEDIA, MODEL_GALLERIES, SAMPLE_PROMPTS, withPrompt } from "@/lib/home-showcase";

describe("wall prompts", () => {
  it("cover every sample on the walls in both languages", () => {
    const sources = new Set([...Object.values(MEDIA), ...MODEL_GALLERIES.flatMap((gallery) => gallery.media)].map((media) => media.src));
    for (const src of sources) {
      expect(SAMPLE_PROMPTS[src]?.zh, src).toBeTruthy();
      expect(SAMPLE_PROMPTS[src]?.en, src).toBeTruthy();
    }
  });

  it("add the prompt to a studio link", () => {
    expect(withPrompt("/ai/video?model=veo-3.1", "雨夜 & 霓虹")).toBe("/ai/video?model=veo-3.1&prompt=%E9%9B%A8%E5%A4%9C%20%26%20%E9%9C%93%E8%99%B9");
    expect(withPrompt("/ai/image", "a fox")).toBe("/ai/image?prompt=a%20fox");
    expect(withPrompt("/ai/image", undefined)).toBe("/ai/image");
  });
});
