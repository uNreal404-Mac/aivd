import { describe, expect, it } from "vitest";

import { maxVideoReferences, prepareVideoReferencePrompt, removeVideoReferenceToken } from "@/lib/video-references";

describe("homepage video references", () => {
  it("uses the selected model's reference limit", () => {
    expect(maxVideoReferences("veo-3.1")).toBe(1);
    expect(maxVideoReferences("kling/v4-reference-to-video")).toBe(4);
  });

  it("maps Chinese and English @ references to the uploaded image order", () => {
    expect(prepareVideoReferencePrompt("让 @图片2 跟随 @Image1", 2)).toEqual({
      ok: true,
      prompt: "让 image 2 跟随 image 1",
    });
  });

  it("rejects references without a matching image", () => {
    expect(prepareVideoReferencePrompt("模仿 @图片3", 2)).toEqual({ ok: false, index: 3 });
    expect(prepareVideoReferencePrompt("模仿 @图片0", 2)).toEqual({ ok: false, index: 0 });
  });

  it("removes a deleted reference and renumbers the rest", () => {
    expect(removeVideoReferenceToken("@图片1 转到 @图片3 and @Image2", 2)).toBe("@图片1 转到 @图片2 and ");
  });
});
