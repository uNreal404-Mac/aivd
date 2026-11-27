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

  it.each([
    ["bytedance/seedance-2-5", 12, true],
    ["seedance-2-5-flash", 10, true],
    ["bytedance/seedance-2-5-draft", 12, true],
    ["bytedance/seedance-2", 9, false],
    ["bytedance/seedance-2-fast", 9, false],
    ["bytedance/seedance-2-mini", 9, false],
  ] as const)("%s sends every selected reference in KIE's multimodal mode", (id, limit, omni) => {
    const model = getMarketModel(id)!;
    const images = Array.from({ length: limit }, (_, index) => `https://x/reference-${index + 1}.png`);
    expect(model.options.maxImages).toBe(limit);

    const single = model.buildTask(req({ imageUrls: images.slice(0, 1), aspectRatio: "9:16" })).input;
    expect(single.first_frame_url).toBe(images[0]);
    expect(single.reference_image_urls).toBeUndefined();
    expect(single.aspect_ratio).toBe("adaptive");

    const multiple = model.buildTask(req({ imageUrls: images, aspectRatio: "9:16" })).input;
    expect(multiple.first_frame_url).toBeUndefined();
    expect(multiple.reference_image_urls).toEqual(images);
    expect(multiple.aspect_ratio).toBe("9:16");
    expect(multiple.omni_reference_task_type).toBe(omni ? "reference" : undefined);
  });

  it("routes MAGI-2 to text, first-frame or reference input and prices it per second", () => {
    const magi = getMarketModel("magi-2")!;
    const text = magi.buildTask(req({ duration: 12, aspectRatio: "21:9", audio: false }));
    expect(text).toEqual({ model: "magi-2/text-to-video", input: { prompt: req().prompt, duration: 12, resolution: "1080p", generate_audio: false, aspect_ratio: "21:9" } });
    const image = magi.buildTask(req({ imageUrls: ["https://x/a.png"], aspectRatio: "9:16" }));
    expect(image.model).toBe("magi-2/image-to-video");
    expect(image.input.first_frame_url).toBe("https://x/a.png");
    expect(image.input.aspect_ratio).toBeUndefined();
    const refs = magi.buildTask(req({ imageUrls: Array.from({ length: 12 }, (_, i) => `https://x/${i}.png`) }));
    expect(refs.model).toBe("magi-2/reference-to-video");
    expect(refs.input.reference_image_urls).toHaveLength(10);
    expect(magi.costUsd(req({ duration: 10 }))).toBeCloseTo(0.88);
    expect(magi.costUsd(req({ duration: 10, audio: false }))).toBeCloseTo(0.88);
  });

  it("bills Wan 2.2 Turbo for a rounded-up 6 s clip and splits text and image input", () => {
    const wan = getMarketModel("wan/2-2-a14b-text-to-video-turbo")!;
    expect(wan.buildTask(req({ aspectRatio: "9:16", resolution: "480p" }))).toEqual({ model: "wan/2-2-a14b-text-to-video-turbo", input: { prompt: req().prompt, resolution: "480p", aspect_ratio: "9:16" } });
    expect(wan.buildTask(req({ imageUrls: ["https://x/a.png"] }))).toEqual({ model: "wan/2-2-a14b-image-to-video-turbo", input: { prompt: req().prompt, resolution: "720p", image_url: "https://x/a.png" } });
    expect(wan.costUsd(req())).toBeCloseTo(0.48);
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

describe("video model requests from the November 26 KIE catalogue", () => {
  const images = ["https://x/first.png", "https://x/last.png"];
  const aspect = "9:16";
  const input = { prompt: "a cat", duration: 10, resolution: "1080p", aspectRatio: aspect, audio: false };

  // Text inputs and first-frame inputs use different field names even within a family.
  it.each([
    {
      id: "bytedance/seedance-2-5-draft", text: "bytedance/seedance-2-5", edit: "bytedance/seedance-2-5",
      common: { duration: 10, resolution: "480p", draft: true, generate_audio: false },
      noImages: { aspect_ratio: aspect }, withImages: { reference_image_urls: images, omni_reference_task_type: "reference", aspect_ratio: aspect }, usd: 1.4,
    },
    {
      id: "bytedance/v1-pro-text-to-video", text: "bytedance/v1-pro-text-to-video", edit: "bytedance/v1-pro-image-to-video",
      common: { duration: "10", resolution: "1080p" }, noImages: { aspect_ratio: aspect }, withImages: { image_url: images[0] }, usd: .7,
    },
    {
      id: "wan/2-7-text-to-video", text: "wan/2-7-text-to-video", edit: "wan/2-7-image-to-video",
      common: { duration: 10, resolution: "1080p" }, noImages: { ratio: aspect }, withImages: { first_frame_url: images[0], last_frame_url: images[1] }, usd: 1.2,
    },
    {
      id: "wan/2-5-text-to-video", text: "wan/2-5-text-to-video", edit: "wan/2-5-image-to-video",
      common: { duration: "10", resolution: "1080p" }, noImages: { aspect_ratio: aspect }, withImages: { image_url: images[0] }, usd: 1,
    },
    {
      id: "kling/v3-turbo-text-to-video", text: "kling/v3-turbo-text-to-video", edit: "kling/v3-turbo-image-to-video",
      common: { duration: "10", resolution: "1080p" }, noImages: { aspect_ratio: aspect }, withImages: { image_urls: [images[0]] }, usd: 1.26,
    },
    {
      id: "kling/text-to-video", text: "kling-2.6/text-to-video", edit: "kling-2.6/image-to-video",
      common: { duration: "10", sound: false }, noImages: { aspect_ratio: aspect }, withImages: { image_urls: [images[0]] }, usd: .63,
    },
    {
      id: "kling/v25-turbo-text-to-video-pro", text: "kling/v2-5-turbo-text-to-video-pro", edit: "kling/v2-5-turbo-image-to-video-pro",
      common: { duration: "10" }, noImages: { aspect_ratio: aspect }, withImages: { image_url: images[0], tail_image_url: images[1] }, usd: .63,
    },
    {
      id: "gemini-omni-video", text: "gemini-omni-video", edit: "gemini-omni-video",
      common: { duration: "10", resolution: "1080p", aspect_ratio: aspect }, noImages: {}, withImages: { image_urls: images }, usd: .63,
    },
  ])("$id sends the documented text and image payloads", ({ id, text, edit, common, noImages, withImages, usd }) => {
    const model = getMarketModel(id)!;
    expect(model.buildTask(input)).toEqual({ model: text, input: { prompt: input.prompt, ...common, ...noImages } });
    expect(model.buildTask({ ...input, imageUrls: images })).toEqual({ model: edit, input: { prompt: input.prompt, ...common, ...withImages } });
    for (const imageUrls of [[], images]) expect(model.costUsd({ ...input, imageUrls })).toBeCloseTo(usd);
  });

  it.each([
    ["kling/v4-reference-to-video", 10, "kling-4.0/reference-to-video", "image_urls"],
    ["kling/v4-flash-reference-to-video", 10, "kling-4.0/flash-reference-to-video", "image_urls"],
    ["gemini-omni-flash-1-2", 6, "google/gemini-omni-flash-1-2", "image_urls"],
    ["google/gemini-omni-flash-1-1", 7, "google/gemini-omni-flash-1-1", "image_urls"],
    ["minimax-h3/text-to-video", 9, "minimax-h3/reference-to-video", "reference_image_urls"],
    ["happyhorse-1-1", 9, "happyhorse-1-1/reference-to-video", "reference_image"],
    ["happyhorse/text-to-video", 9, "happyhorse/reference-to-video", "reference_image"],
    ["wan/3-0-video", 10, "wan/3-0-video", "reference_image_urls"],
    ["wan/3-0-video-prime", 10, "wan/3-0-video-prime", "reference_image_urls"],
    ["wan/2-7-text-to-video", 5, "wan/2-7-r2v", "reference_image"],
    ["pixverse/text-to-video", 7, "pixverse-v6/reference-to-video", "image_references"],
  ] as const)("%s passes the provider's multi-image reference limit", (id, limit, taskId, field) => {
    const model = getMarketModel(id)!;
    const imageUrls = Array.from({ length: limit }, (_, i) => `https://x/${i + 1}.png`);
    expect(model.options.maxImages).toBe(limit);
    const task = model.buildTask(req({ imageUrls, aspectRatio: "9:16" }));
    expect(task.model).toBe(taskId);
    expect(task.input[field]).toHaveLength(limit);
    if (field === "image_references") {
      expect((task.input.image_references as Array<Record<string, string>>)[0]).toMatchObject({ image_url: imageUrls[0], ref_name: "ref_1" });
    } else {
      expect(task.input[field]).toEqual(imageUrls);
    }
  });

  it("keeps PixVerse's single image as a first frame", () => {
    const model = getMarketModel("pixverse/text-to-video")!;
    expect(model.buildTask(req({ imageUrls: [images[0]] })).model).toBe("pixverse-v6/image-to-video");
    expect(model.buildTask(req({ imageUrls: [images[0]] })).input.image_urls).toEqual([images[0]]);
  });

  it("uses Kling 3.0's two image slots as first and last frames", () => {
    const model = getMarketModel("kling/kling-3-0")!;
    expect(model.options.maxImages).toBe(2);
    expect(model.buildTask(req({ imageUrls: images })).input.image_urls).toEqual(images);
  });

  it("uses Wan 2.7 reference mode for two images selected as references", () => {
    const task = getMarketModel("wan/2-7-text-to-video")!.buildTask(req({ imageUrls: images, mode: "reference-to-video" }));
    expect(task.model).toBe("wan/2-7-r2v");
    expect(task.input.reference_image).toEqual(images);
    expect(task.input.first_frame_url).toBeUndefined();
  });

  it("translates numbered image mentions into each reference model's KIE syntax", () => {
    const imageUrls = images;
    const prompt = "让 image 2 跟随 image 1";
    expect(getMarketModel("kling/v4-reference-to-video")!.buildTask(req({ imageUrls, prompt })).input.prompt).toBe("让 @image_2 跟随 @image_1");
    expect(getMarketModel("wan/3-0-video")!.buildTask(req({ imageUrls, prompt })).input.prompt).toBe("让 Image2 跟随 Image1");
    expect(getMarketModel("happyhorse-1-1")!.buildTask(req({ imageUrls, prompt })).input.prompt).toBe("让 [Image 2] 跟随 [Image 1]");
    expect(getMarketModel("pixverse/text-to-video")!.buildTask(req({ imageUrls, prompt })).input.prompt).toBe("让 @ref_2 跟随 @ref_1");
  });

  it.each([
    ["bytedance/v1-pro-fast-image-to-video", { duration: "10", resolution: "1080p", image_url: images[0] }, .36],
    ["wan/2-6-flash-image-to-video", { duration: "10", resolution: "1080p", image_urls: [images[0]], audio: false }, .30],
    ["hailuo/2-3-image-to-video-pro", { duration: "6", resolution: "1080P", image_url: images[0] }, .4],
    ["hailuo/2-3-image-to-video-standard", { duration: "6", resolution: "1080P", image_url: images[0] }, .25],
  ] as const)("%s requires a first frame and quotes the clip actually rendered", (id, fields, usd) => {
    const model = getMarketModel(id)!;
    const request = { ...input, imageUrls: images };
    expect(model.options.requiresImage).toBe(true);
    expect(model.buildTask(request)).toEqual({ model: id, input: { prompt: input.prompt, ...fields } });
    expect(model.costUsd(request)).toBeCloseTo(usd);
  });

  it("routes Kling Omni and Vidu references at the no-video-input rate", () => {
    const omni = getMarketModel("kling/v3-omni-text-to-video")!;
    const vidu = getMarketModel("vidu-q4/image-to-video")!;
    const many = Array.from({ length: 20 }, (_, i) => `https://x/${i}.png`);
    const common = { prompt: input.prompt, resolution: "1080p", duration: 10, audio: false };
    expect(omni.buildTask(input)).toEqual({ model: "kling-3.0-omni/text-to-video", input: { ...common, aspect_ratio: aspect } });
    expect(omni.buildTask({ ...input, imageUrls: [images[0]] })).toEqual({ model: "kling-3.0-omni/image-to-video", input: { ...common, aspect_ratio: "auto", image_urls: [images[0]] } });
    expect(omni.buildTask({ ...input, imageUrls: many })).toEqual({ model: "kling-3.0-omni/reference-to-video", input: { ...common, aspect_ratio: aspect, image_urls: many.slice(0, 7) } });
    expect(vidu.options.requiresImage).toBe(true);
    expect(vidu.buildTask({ ...input, imageUrls: [images[0]] })).toEqual({ model: "vidu-q4/image-to-video", input: { ...common, image_url: images[0] } });
    expect(vidu.buildTask({ ...input, imageUrls: many })).toEqual({ model: "vidu-q4/reference-to-video", input: { ...common, aspect_ratio: aspect, reference_image_urls: many.slice(0, 15) } });
    expect(vidu.costUsd({ ...input, imageUrls: many })).toBeCloseTo(.96);
  });

  it.each([
    ["kling/v3-omni-text-to-video", "720p", .755, 1.01],
    ["kling/v3-omni-text-to-video", "1080p", 1.01, 1.26],
    ["kling/v3-omni-text-to-video", "4k", 3.775, 3.775],
    ["kling/text-to-video", "", .63, 1.26],
    ["wan/2-6-flash-image-to-video", "720p", .20, .40],
    ["wan/2-6-flash-image-to-video", "1080p", .30, .60],
    ["pixverse/text-to-video", "360p", .20, .28],
    ["pixverse/text-to-video", "540p", .28, .36],
    ["pixverse/text-to-video", "720p", .36, .48],
    ["pixverse/text-to-video", "1080p", .72, .92],
  ] as const)("%s bills native audio separately at %s", (id, resolution, silent, sound) => {
    const model = getMarketModel(id)!;
    for (const imageUrls of [[], images]) {
      const request = { ...input, resolution, imageUrls };
      expect(model.costUsd({ ...request, audio: false })).toBeCloseTo(silent);
      expect(model.costUsd({ ...request, audio: true })).toBeCloseTo(sound);
    }
  });

  it("uses the same duration tier on the wire and in per-clip prices", () => {
    const fast = getMarketModel("bytedance/v1-pro-fast-image-to-video")!;
    const flash = getMarketModel("wan/2-6-flash-image-to-video")!;
    const gemini = getMarketModel("gemini-omni-video")!;
    for (const [duration, seconds, usd] of [[-3, 5, .08], [6, 10, .18], [70, 10, .18]]) {
      const request = { ...input, duration, resolution: "720p", imageUrls: images };
      expect(fast.buildTask(request).input.duration).toBe(String(seconds));
      expect(fast.costUsd(request)).toBeCloseTo(usd);
    }
    for (const [duration, seconds, usd] of [[1, 5, .3], [6, 10, .6], [12, 15, .9]]) {
      const request = { ...input, duration, audio: true, imageUrls: images };
      expect(flash.buildTask(request).input.duration).toBe(String(seconds));
      expect(flash.costUsd(request)).toBeCloseTo(usd);
    }
    for (const [duration, seconds, usd] of [[1, 4, .735], [5, 6, .84], [7, 8, .945], [11, 10, 1.05]]) {
      const request = { ...input, duration, resolution: "4k" };
      expect(gemini.buildTask(request).input.duration).toBe(String(seconds));
      expect(gemini.costUsd(request)).toBeCloseTo(usd);
    }
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
