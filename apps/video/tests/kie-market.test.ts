import { describe, expect, it } from "vitest";

import { MARKET_MODELS, getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";
import { KieProvider } from "@/ai/providers/kie";
import { calculateModelCredits } from "@/config/credits";
import { CREDIT_BUDGET_USD, MAX_VIDEO_COST_PER_CREDIT_USD } from "@/config/kie-pricing";
import { NAV_AUDIO_MODELS, NAV_IMAGE_MODELS, NAV_VIDEO_MODELS } from "@/lib/nav-models";

const req = (overrides = {}) => ({ prompt: "a cat surfing at sunset", ...overrides });

describe("KIE market registry", () => {
  it("keeps ids unique", () => {
    expect(new Set(MARKET_MODELS.map((model) => model.id)).size).toBe(MARKET_MODELS.length);
  });

  it("prices every model above zero and never below its KIE cost", () => {
    for (const model of MARKET_MODELS) {
      const options = model.options;
      const request = req({
        resolution: options.resolutions?.at(-1),
        duration: options.durations?.at(-1),
        count: options.maxCount,
        aspectRatio: options.aspects?.[0],
      });
      const credits = marketCredits(model, request);
      expect(credits, model.id).toBeGreaterThan(0);
      // One credit never stands for more KIE cost than its ceiling, so the credits always cover the cost.
      const ceiling = model.kind === "video" ? MAX_VIDEO_COST_PER_CREDIT_USD : CREDIT_BUDGET_USD;
      expect(credits * ceiling, model.id).toBeGreaterThanOrEqual(model.costUsd(request));
    }
  });

  it("lists every nav model, except the two legacy video models, in the registry", () => {
    const ids = new Set(MARKET_MODELS.map((model) => model.id));
    for (const item of [...NAV_VIDEO_MODELS, ...NAV_IMAGE_MODELS, ...NAV_AUDIO_MODELS]) {
      if (item.id === "veo-3.1" || item.id === "wan2.6") continue;
      expect(ids.has(item.id), item.id).toBe(true);
    }
  });

  it("splits text and image modes into KIE's separate model ids", () => {
    const minimax = getMarketModel("minimax-h3/text-to-video")!;
    expect(minimax.buildTask(req()).model).toBe("minimax-h3/text-to-video");
    const withImage = minimax.buildTask(req({ imageUrls: ["https://x/a.png"] }));
    expect(withImage.model).toBe("minimax-h3/image-to-video");
    expect(withImage.input.first_frame_url).toBe("https://x/a.png");
    // MiniMax expects upper-case resolutions.
    expect(minimax.buildTask(req({ resolution: "2k" })).input.resolution).toBe("2K");

    const seedream = getMarketModel("seedream-5-5")!;
    expect(seedream.buildTask(req()).model).toBe("seedream/5-5-text-to-image");
    expect(seedream.buildTask(req({ imageUrls: ["https://x/a.png"] })).model).toBe("seedream/5-5-image-to-image");
  });

  it("sends the field names and casing each KIE model documents", () => {
    expect(getMarketModel("wan/3-0-video")!.buildTask(req({ resolution: "720p" })).input.resolution).toBe("720P");
    expect(getMarketModel("kling-image-4")!.buildTask(req({ resolution: "4K" })).input.resolution).toBe("4k");
    expect(getMarketModel("grok-imagine/text-to-video")!.buildTask(req({ duration: 10 })).input.duration).toBe("10");
    expect(getMarketModel("nano-banana-pro")!.buildTask(req()).input.output_format).toBe("png");
    expect(getMarketModel("seedance-2-5-flash")!.buildTask(req({ imageUrls: ["https://x/a.png"] })).input.aspect_ratio).toBe("adaptive");
  });

  it("caps GPT Image 2.6 at the quality it is priced for", () => {
    for (const id of ["gpt-image-2-6-sunburst", "gpt-image-2-6-flare"]) {
      expect(getMarketModel(id)!.buildTask(req({ resolution: "4K" })).input.quality).toBe("medium");
    }
  });

  it("clamps durations into each model's documented range", () => {
    expect(getMarketModel("kling/v4-flash-reference-to-video")!.buildTask(req({ duration: 60 })).input.duration).toBe(20);
    expect(getMarketModel("gemini-omni-flash-1-2")!.buildTask(req({ duration: 1 })).input.duration).toBe(3);
  });

  it("charges more for longer and sharper video", () => {
    const seedance = getMarketModel("bytedance/seedance-2-5")!;
    expect(marketCredits(seedance, req({ duration: 10, resolution: "720p" }))).toBeGreaterThan(
      marketCredits(seedance, req({ duration: 5, resolution: "720p" })),
    );
    expect(marketCredits(seedance, req({ duration: 5, resolution: "1080p" }))).toBeGreaterThan(
      marketCredits(seedance, req({ duration: 5, resolution: "720p" })),
    );
  });

  it("charges multi-image requests per image", () => {
    const flux = getMarketModel("flux3/klein-text-to-image")!;
    expect(flux.costUsd(req({ count: 4, resolution: "1K" }))).toBeCloseTo(flux.costUsd(req({ count: 1, resolution: "1K" })) * 4);
  });

  it("prices market video models through calculateModelCredits for the studio", () => {
    expect(calculateModelCredits("bytedance/seedance-2-5", { duration: 5, quality: "720p" })).toBe(
      marketCredits(getMarketModel("bytedance/seedance-2-5")!, req({ duration: 5, resolution: "720p" })),
    );
  });

  it("offers models of every kind", () => {
    expect(marketModelsOf("video").length).toBeGreaterThan(5);
    expect(marketModelsOf("image").length).toBeGreaterThan(5);
    expect(marketModelsOf("audio").length).toBeGreaterThan(3);
  });
});

describe("KIE result parsing", () => {
  const provider = new KieProvider("test-key");

  it("keeps every URL of an image set", () => {
    const result = provider.parseCallback({
      code: 200,
      data: { taskId: "t1", state: "success", resultJson: JSON.stringify({ resultUrls: ["https://a/1.png", "https://a/2.png"] }) },
    });
    expect(result.status).toBe("completed");
    expect(result.resultUrls).toEqual(["https://a/1.png", "https://a/2.png"]);
    expect(result.videoUrl).toBe("https://a/1.png");
  });

  it("reads Suno callbacks and waits for the complete stage", () => {
    const first = provider.parseCallback({ code: 200, data: { callbackType: "first", task_id: "s1", data: [{ audio_url: "" }] } });
    expect(first.status).toBe("processing");
    const complete = provider.parseCallback({
      code: 200,
      data: { callbackType: "complete", task_id: "s1", data: [{ audio_url: "https://a/1.mp3" }, { audio_url: "https://a/2.mp3" }] },
    });
    expect(complete.taskId).toBe("s1");
    expect(complete.status).toBe("completed");
    expect(complete.resultUrls).toEqual(["https://a/1.mp3", "https://a/2.mp3"]);
  });

  it("marks a failed Suno callback as failed", () => {
    const failed = provider.parseCallback({ code: 501, msg: "boom", data: { callbackType: "complete", task_id: "s1", data: [] } });
    expect(failed.status).toBe("failed");
    expect(failed.error?.message).toBe("boom");
  });
});
