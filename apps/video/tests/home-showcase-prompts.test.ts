import { describe, expect, it } from "vitest";
import { MODEL_GALLERIES, SAMPLE_PROMPTS, withPrompt } from "@/lib/home-showcase";
import EXAMPLE_PROMPTS from "@/lib/home-example-prompts.json";
import { HOME_TEMPLATES } from "@/lib/home-templates";

describe("wall prompts", () => {
  it("cover every sample on the walls in both languages", () => {
    // The walls, where every sample opens the generator with its prompt. Cover
    // clips of feature cards (like the Creative Space Agent card) link elsewhere.
    const media = MODEL_GALLERIES.flatMap((gallery) => gallery.media);
    for (const item of media) {
      // A sample with a promptId opens the generator with that example prompt
      // (home-example-prompts.json); every other one has its own pair here.
      if (item.promptId) {
        expect((EXAMPLE_PROMPTS as Record<string, string>)[item.promptId], item.src).toBeTruthy();
        continue;
      }
      expect(SAMPLE_PROMPTS[item.src]?.zh, item.src).toBeTruthy();
      expect(SAMPLE_PROMPTS[item.src]?.en, item.src).toBeTruthy();
    }
  });

  it("add the prompt to a studio link", () => {
    expect(withPrompt("/ai/video?model=veo-3.1", "雨夜 & 霓虹")).toBe("/ai/video?model=veo-3.1&prompt=%E9%9B%A8%E5%A4%9C%20%26%20%E9%9C%93%E8%99%B9");
    expect(withPrompt("/ai/image", "a fox")).toBe("/ai/image?prompt=a%20fox");
    expect(withPrompt("/ai/image", undefined)).toBe("/ai/image");
  });

  it("do not repeat the template covers in the model wall right below them", () => {
    // The homepage shows the first five templates, then the first model wall.
    const templateCovers = new Set(HOME_TEMPLATES.slice(0, 5).map((template) => template.image));
    const repeated = MODEL_GALLERIES[0].media.map((media) => media.src).filter((src) => templateCovers.has(src));
    expect(repeated).toEqual([]);
  });
});
