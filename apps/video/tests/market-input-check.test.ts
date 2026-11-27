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
  const long = getMarketModel("kling-4-0/long-image")!;
  const grok = getMarketModel("grok-imagine/text-to-image")!;
  const prompt = (model: typeof long, text: string, images: number) =>
    model.buildTask({ prompt: text, imageUrls: Array.from({ length: images }, (_, i) => `https://x/${i}.png`) }).input.prompt;

  it("keeps the studio's plain wording for other models", () => {
    expect(prepareVideoReferencePrompt("put @图片2 on the left", 2)).toEqual({ ok: true, prompt: "put image 2 on the left" });
  });

  it("writes each model's own tag for pictures that were sent", () => {
    expect(prompt(long, "put image 2 on the left", 2)).toBe("put @image_2 on the left");
    expect(prompt(long, "左边用@图片2，右边用@图片1", 2)).toBe("左边用@image_2，右边用@image_1");
    expect(prompt(grok, "用@图片1做海报", 1)).toBe("用@image1 做海报");
    expect(prompt(grok, "a poster from image 1", 1)).toBe("a poster from @image1");
    expect(prompt(grok, "image 3 is missing", 1)).toBe("image 3 is missing");
  });

  it("sends any other @ to Kling Long Image as a full-width one", () => {
    expect(prompt(long, "logo from image 1, mail hi@aivd.ai", 1)).toBe("logo from @image_1, mail hi＠aivd.ai");
    expect(prompt(long, "contact me@image_1.com", 0)).toBe("contact me＠image_1.com");
    expect(prompt(long, "use @image_3", 1)).toBe("use ＠image_3");
  });

  it("does not trust a placeholder file type", async () => {
    const work = [{ url: "https://x/work.png", name: "a cat", mimeType: "image/generated" }];
    expect(await marketImageNotice("kling/v3-turbo-text-to-video", work, true)).toBeNull();
  });
});

describe("quotes use the length the server bills", () => {
  it("prices a saved 6 s Wan 2.5 node at 5 s", async () => {
    const { estimateCredits } = await import("@/lib/ai-video-studio");
    const { calculateModelCredits } = await import("@/config/credits");
    const five = estimateCredits({ modelId: "wan/2-5-text-to-video", duration: 5, resolution: "720p" }, { images: 0 });
    expect(estimateCredits({ modelId: "wan/2-5-text-to-video", duration: 6, resolution: "720p" }, { images: 0 })).toBe(five);
    expect(calculateModelCredits("wan/2-5-text-to-video", { duration: 6, quality: "720p" })).toBe(five);
  });
});
