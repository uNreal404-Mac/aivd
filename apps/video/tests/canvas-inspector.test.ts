import { describe, expect, it } from "vitest";
import { readCanvasEditEntry } from "@/lib/creative-space/canvas-edit-entry";
import { buildRequest, choicesFor, defaultsFor, followsReferenceAspect, quote, withModel } from "@/components/creative-space/canvas/model-options";
import { canvasTextLines } from "@/lib/creative-space/text-editor";

describe("canvas inspector", () => {
  it("initializes supported image and video controls to the observed canvas presets", () => {
    expect(defaultsFor("image", "Image")).toMatchObject({ aspect: "16:9", resolution: "2K", count: 1 });
    expect(defaultsFor("video", "Video")).toMatchObject({ modelId: "bytedance/seedance-2-5", duration: 4, resolution: "480p", aspect: "16:9" });
  });
  it("uses every supported batch size and clamps it when switching models", () => {
    const original = defaultsFor("image", "Image", "Coast");
    const kling = { ...withModel(original, "kling-image-4"), count: 9, resolution: "2K" };
    expect(choicesFor("image", kling.modelId).maxCount).toBe(9);
    expect(buildRequest(kling, kling.prompt, []).body.count).toBe(9);
    expect(quote(kling, kling.prompt, 0)).toBeGreaterThan(quote({ ...kling, count: 1 }, kling.prompt, 0));
    expect(withModel(kling, "seedream-5-5").count).toBe(1);
    expect(withModel(kling, "flux3/klein-text-to-image").count).toBe(4);
  });
  it("identifies first-image aspect behavior using each connected model's actual mapping", () => {
    expect(followsReferenceAspect("bytedance/seedance-2-5")).toBe(true);
    expect(followsReferenceAspect("bytedance/seedance-2-5", 3)).toBe(false);
    expect(followsReferenceAspect("seedance-2-5-flash", 3)).toBe(false);
    expect(followsReferenceAspect("kling/v4-reference-to-video")).toBe(true);
    expect(followsReferenceAspect("minimax-h3/text-to-video")).toBe(true);
    expect(followsReferenceAspect("gemini-omni-flash-1-2")).toBe(false);
  });
});

describe("canvas rich text", () => {
  it("recognizes editor headings, paragraphs, lists, and dividers across stored graph versions", () => {
    expect(canvasTextLines("# Coast\n1. a shot\n- reverse angle\n---\nBody")).toEqual([
      { kind: "h1", value: "Coast" }, { kind: "ol", value: "a shot" }, { kind: "ul", value: "reverse angle" },
      { kind: "hr", value: "" }, { kind: "p", value: "Body" },
    ]);
  });
  it("preserves blank lines, ordinary punctuation and literal HTML as text", () => {
    expect(canvasTextLines("C#\n\n<img src=x>")).toEqual([
      { kind: "p", value: "C#" }, { kind: "p", value: "" }, { kind: "p", value: "<img src=x>" },
    ]);
  });
});

describe("canvas image editing links", () => {
  it("opens the four implemented editing tools and the image tool chooser", () => {
    for (const tool of ["inpaint", "cutout", "upscale", "outpaint", "image"]) {
      expect(readCanvasEditEntry(tool)).toBe(tool);
    }
  });

  it("leaves ordinary and ambiguous canvas URLs alone", () => {
    for (const input of [undefined, "", "video", "toString", ["cutout", "inpaint"]]) {
      expect(readCanvasEditEntry(input)).toBeUndefined();
    }
  });
});
