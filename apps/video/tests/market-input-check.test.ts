import { describe, expect, it } from "vitest";

import { MARKET_MODELS, allowedDuration, getMarketModel } from "@/ai/kie-market";
import { marketImageNotice, marketInputNotice, marketInputProblem } from "@/lib/market-input-check";
import { prepareVideoReferencePrompt } from "@/lib/video-references";

describe("allowedDuration", () => {
  const wan25 = getMarketModel("wan/2-5-text-to-video")!;

  it("moves a length the model cannot make to the nearest one it can", () => {
    expect(allowedDuration(wan25, 6)).toBe(5);
    expect(allowedDuration(wan25, 8)).toBe(10);
    expect(allowedDuration(wan25, 30)).toBe(10);
    expect(allowedDuration(wan25, 10)).toBe(10);
    expect(allowedDuration(wan25, undefined)).toBeUndefined();
  });

  it("returns a length every video model offers, and leaves images alone", () => {
    for (const model of MARKET_MODELS) {
      const choices = model.options.durations;
      if (model.kind !== "video" || !choices?.length) {
        expect(allowedDuration(model, 7)).toBe(7);
        continue;
      }
      for (const seconds of [1, 6, 7, 11, 60]) expect(choices, model.id).toContain(allowedDuration(model, seconds));
    }
  });
});

describe("marketInputProblem", () => {
  it("asks for a start image on image-only models", () => {
    expect(marketInputProblem("vidu-q4/image-to-video", { prompt: "a cat", imageCount: 0 })).toEqual({ code: "needs_image" });
    expect(marketInputProblem("vidu-q4/image-to-video", { prompt: "a cat", imageCount: 1 })).toBeNull();
  });

  it("uses the same prompt limits as the server", () => {
    expect(marketInputProblem("wan/2-5-text-to-video", { prompt: "x".repeat(801), imageCount: 0 })).toMatchObject({ code: "too_long", max: 800 });
    expect(marketInputProblem("wan/2-5-text-to-video", { prompt: "x".repeat(800), imageCount: 0 })).toBeNull();
    expect(marketInputProblem("pixverse/text-to-video", { prompt: " ab ", imageCount: 0 })).toEqual({ code: "too_short", min: 3 });
  });

  it("says what to change in Chinese", () => {
    expect(marketInputNotice("vidu-q4/image-to-video", { prompt: "a cat", imageCount: 0 }, true)).toContain("需要先添加一张图片");
    expect(marketInputNotice("unknown-model", { prompt: "", imageCount: 0 }, true)).toBeNull();
  });
});

describe("marketImageNotice", () => {
  it("rejects image types a model does not take", async () => {
    const webp = [{ url: "https://x/a.webp", name: "a.webp", mimeType: "image/webp" }];
    expect(await marketImageNotice("kling/v3-omni-text-to-video", webp, true)).toContain("只支持 JPG 和 PNG");
    expect(await marketImageNotice("kling/v3-omni-text-to-video", [{ url: "https://x/a.png", name: "a.png" }], true)).toBeNull();
    expect(await marketImageNotice("bytedance/v1-pro-text-to-video", webp, true)).toBeNull();
  });
});

describe("model image tags", () => {
  it("writes each model's own reference tag", () => {
    expect(prepareVideoReferencePrompt("put @图片2 on the left", 2, "image", "kling-4-0/long-image")).toEqual({ ok: true, prompt: "put @image_2 on the left" });
    expect(prepareVideoReferencePrompt("put @图片2 on the left", 2, "image", "grok-imagine/text-to-image")).toEqual({ ok: true, prompt: "put @image2 on the left" });
    expect(prepareVideoReferencePrompt("put @图片2 on the left", 2, "image", "seedream-5-5")).toEqual({ ok: true, prompt: "put image 2 on the left" });
  });

  it("keeps Kling Long Image tags and sends any other @ as a full-width one", () => {
    const task = getMarketModel("kling-4-0/long-image")!.buildTask({ prompt: "logo from @image_1, mail hi@aivd.ai", imageUrls: ["https://x/a.png"] });
    expect(task.input.prompt).toBe("logo from @image_1, mail hi＠aivd.ai");
  });
});
