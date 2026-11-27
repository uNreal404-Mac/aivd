import { elevenDialogueInput, elevenSpeechInput, type VoiceSettings } from "@/lib/audio-voice-settings";
// KIE "market" models: one registry entry per model we sell beyond the two
// legacy video models (Veo 3.1 and Wan 2.6, which keep their own mapping in
// model-mapping.ts). Each entry says which KIE model to call, how to build its
// input, what KIE charges for it (list price, see kie-pricing.ts for the
// source), and which options the studio may offer. Request schemas follow
// KIE's documentation pages for each model.
import { ProviderRejectedError } from "./types";
import { isDefiniteRejection } from "./providers/kie";
import { audioCreditsFromCost, imageCreditsFromCost, videoCreditsFromCost } from "@/config/kie-pricing";
import { VIDEO_EDIT_MODEL, VIDEO_MOTION_MODEL, type VideoToolOrientation } from "@/lib/video-tool";
import { secondsBetween } from "@/lib/video-durations";
import { imageOutputCount } from "@/lib/image-output-count";
import { KLING_KEYFRAME_MODEL, type KlingKeyframes } from "@/lib/kling-keyframes";

export type MarketKind = "video" | "image" | "audio";

/** What the studio sends for one generation. Each model reads what it needs. */
export interface MarketRequest {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  /** Images per request (image models). */
  count?: number;
  /** Signed URLs of reference / start images. */
  imageUrls?: string[];
  keyframes?: KlingKeyframes;
  /** Native audio on/off (video models that support it). */
  audio?: boolean;
  /** Voice id (speech models). */
  voice?: string;
  /** Free-form style / voice description (audio models). */
  style?: string;
  /** Instrumental-only toggle for music models (Suno V6). */
  instrumental?: boolean;
  /** Custom lyrics mode toggle for music models (Suno V6). */
  customMode?: boolean;
  /** Speaking speed multiplier for TTS models that support it (0.7–1.2). */
  speed?: number;
  voiceSettings?: VoiceSettings;
  /** Signed URL of a video to work on (video tools such as extend). */
  videoUrl?: string;
  orientation?: VideoToolOrientation;
  /** Random seed, for models that require one. */
  seed?: number;
}

export interface MarketOptions {
  aspects?: string[];
  resolutions?: string[];
  /** Image models whose default is not their first (smallest) size. */
  defaultResolution?: string;
  durations?: number[];
  /** Highest `count` the model accepts. */
  maxCount?: number;
  /** Most reference images the model accepts; 0 or undefined means none. */
  maxImages?: number;
  /** Whether the model can render native audio and it can be toggled. */
  audioToggle?: boolean;
  voices?: { id: string; name: string }[];
  /** Longest prompt / script the model accepts. */
  maxPromptLength?: number;
  /** The model cannot run without a start image. */
  requiresImage?: boolean;
  /** The model works on an existing video (`videoUrl`). */
  requiresVideo?: boolean;
  /** Shortest prompt the model accepts. */
  minPromptLength?: number;
  /** Image types the model accepts when narrower than JPEG, PNG and WebP. */
  imageTypes?: string[];
  /** Smallest width and height, in pixels, the model accepts for an input image. */
  minImageSide?: number;
  /** With exactly one image the output keeps that image's ratio; `aspects` applies to the other modes. */
  aspectFollowsSingleImage?: boolean;
}

export interface MarketModel {
  /** Our id; matches the nav and studio model ids. */
  id: string;
  kind: MarketKind;
  name: string;
  options: MarketOptions;
  /** KIE list cost in USD for this request. */
  costUsd: (req: MarketRequest) => number;
  /** Builds the KIE createTask body (without callBackUrl). */
  buildTask: (req: MarketRequest) => { model: string; input: Record<string, unknown> };
  /**
   * A tool that works on an existing creation (extend a video) rather than a
   * model to pick in the studio: never listed by marketModelsOf().
   */
  tool?: "extend" | "edit" | "motion";
}

const KIE_BASE = "https://api.kie.ai";

/** POST to KIE and return the parsed body, mapping errors like KieProvider. */
export async function kiePost(path: string, apiKey: string, body: unknown): Promise<any> {
  const response = await fetch(`${KIE_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let result: any = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }
  // Even a structured error on an upstream timeout or 5xx is ambiguous.
  if (response.status === 408 || response.status >= 500) {
    throw new Error(`KIE API error: ${response.status}`);
  }
  const code = typeof result?.code === "number" ? result.code : response.status;
  if (code !== 200) {
    const message = result?.msg || `KIE API error: ${code}`;
    // A definite 4xx means KIE created nothing; callers release credits.
    if (isDefiniteRejection(code)) throw new ProviderRejectedError(message, code);
    throw new Error(message);
  }
  return result;
}

/** Submit a createTask market job and return KIE's task id. */
export async function createMarketTask(
  model: MarketModel,
  req: MarketRequest,
  callbackUrl: string | undefined,
  apiKey: string,
): Promise<string> {
  const task = model.buildTask(req);
  const result = await kiePost("/api/v1/jobs/createTask", apiKey, {
    ...task,
    ...(callbackUrl ? { callBackUrl: callbackUrl } : {}),
  });
  const taskId = result?.data?.taskId;
  if (!taskId) throw new Error("KIE returned no taskId");
  return taskId;
}


// ---------------------------------------------------------------------------
// Video models. USD per second are KIE list prices for text/image-to-video
// with no video input (kie.ai/pricing, read 2026-11-18).
// ---------------------------------------------------------------------------

const firstImage = (req: MarketRequest) => req.imageUrls?.[0];
const clampDuration = (req: MarketRequest, min: number, max: number, fallback: number) =>
  Math.min(max, Math.max(min, Math.round(req.duration ?? fallback)));
const perSecond = (table: Record<string, number>, fallbackRes: string) => (req: MarketRequest, min: number, max: number, fallback: number) =>
  (table[req.resolution ?? fallbackRes] ?? table[fallbackRes]) * clampDuration(req, min, max, fallback);

const COMMON_ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4"];

const SEEDANCE_25_USD = { "480p": 0.14, "720p": 0.315, "1080p": 0.79 };
const SEEDANCE_25_FLASH_USD = { "480p": 0.0925, "720p": 0.205 };
const KLING_4_USD = { "720p": 0.1425, "1080p": 0.2125 };
const KLING_4_FLASH_USD = { "720p": 0.085 };
const GEMINI_OMNI_12_USD = { "360p": 0.02, "720p": 0.045, "1080p": 0.05, "4k": 0.11 };
const MINIMAX_H3_USD = { "768p": 0.04, "2k": 0.065 };
const MINIMAX_H3_IMAGE_INPUT_USD = 0.02;
const WAN_3_USD = { "480p": 0.04, "720p": 0.08, "1080p": 0.16 };
const GROK_USD = { "480p": 0.012, "720p": 0.0225, "1080p": 0.04 };
const HAPPYHORSE_11_USD = { "720p": 0.1125, "1080p": 0.145 };
// KIE public price list, read 2026-11-25 (no video input).
const SEEDANCE_2_USD = { "480p": 0.095, "720p": 0.205, "1080p": 0.51 };
const SEEDANCE_2_FAST_USD = { "480p": 0.059, "720p": 0.124 };
const SEEDANCE_2_MINI_USD = { "480p": 0.019, "720p": 0.041 };
const KLING_3_USD = { "720p": 0.0755, "1080p": 0.101 };
const KLING_3_AUDIO_USD = { "720p": 0.1135, "1080p": 0.151 };
const WAN_3_PRIME_USD = { "480p": 0.0612, "720p": 0.126, "1080p": 0.252 };
const HAPPYHORSE_10_USD = { "720p": 0.14, "1080p": 0.24 };
const GEMINI_OMNI_11_USD: Record<number, number> = { 4: 0.315, 6: 0.42, 8: 0.525, 10: 0.63 };
const GEMINI_OMNI_11_4K_USD: Record<number, number> = { 4: 0.735, 6: 0.84, 8: 0.945, 10: 1.05 };
// MAGI-2 (Sand AI), read 2026-11-26: one 1080p rate for text, image and
// reference input; sound on or off costs the same.
const MAGI_2_USD = { "1080p": 0.088 };
const MAGI_2_ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
/** Gemini Omni 1.1 only renders 4/6/8/10 s: the shortest length that covers the request. */
const omniDuration = (req: MarketRequest) => [4, 6, 8, 10].find((value) => value >= (req.duration ?? 4)) ?? 10;

// Fixed-length endpoints bill the clip we submit, including requests between two lengths.
const fiveOrTen = (req: MarketRequest) => (req.duration ?? 5) > 5 ? 10 : 5;
const wanFlashDuration = (req: MarketRequest) => (req.duration ?? 5) > 10 ? 15 : fiveOrTen(req);
const hd = (req: MarketRequest) => req.resolution === "1080p" ? "1080p" : "720p";
const option = (value: string | undefined, allowed: string[], fallback: string) =>
  value && allowed.includes(value) ? value : fallback;

// Studios turn "@图片2" into "image 2"; the canvas sends "@图片2" as typed.
// Models that bind a reference by their own tag get that tag instead, for
// pictures that were actually sent. A tag directly followed by a letter or
// digit gets a space so that word is not read as part of it.
const IMAGE_REFERENCE = /@(?:图片|image)_?(\d+)(?!\d)|\bimage (\d+)(?!\d)/gi;
export function bindImageTags(prompt: string, count: number, tag: (index: number) => string): string {
  return prompt.replace(IMAGE_REFERENCE, (token, tagged: string | undefined, plain: string | undefined, offset: number, whole: string) => {
    const index = Number(tagged ?? plain);
    if (index < 1 || index > count) return token;
    const next = whole[offset + token.length];
    return next !== undefined && /[\p{L}\p{N}_]/u.test(next) ? `${tag(index)} ` : tag(index);
  });
}

// KIE reads every "@" in a Kling Long Image prompt as an image tag and rejects
// ones it was not sent, so an e-mail address or a stray "@" goes out full-width.
export function klingLongImagePrompt(prompt: string, count: number): string {
  const bound = bindImageTags(prompt, count, (index) => `@image_${index}`);
  return bound.replace(/@(?!image_(\d+)(?!\d))|@image_(\d+)(?!\d)/g, (token, _a, index: string | undefined) =>
    index && Number(index) >= 1 && Number(index) <= count ? token : `＠${token.slice(1)}`);
}

const JPEG_PNG = ["image/jpeg", "image/png"];
const VIDEO_ASPECTS = ["16:9", "9:16", "1:1"];
const SEEDANCE_1_USD = { "480p": .014, "720p": .03, "1080p": .07 };
const VIDU_Q4_USD = { "540p": .036, "720p": .076, "1080p": .096, "2k": .152, "4k": .312 };
const KLING_OMNI_USD = { "720p": .0755, "1080p": .101, "4k": .3775 };
const KLING_OMNI_AUDIO_USD = { "720p": .101, "1080p": .126, "4k": .3775 };
const PIXVERSE_V6_USD = { "360p": .02, "540p": .028, "720p": .036, "1080p": .072 };
const PIXVERSE_V6_AUDIO_USD = { "360p": .028, "540p": .036, "720p": .048, "1080p": .092 };

const VIDEO_MODELS: MarketModel[] = [
  {
    id: "bytedance/seedance-2-5",
    kind: "video",
    name: "Seedance 2.5",
    options: { aspects: [...COMMON_ASPECTS, "21:9"], resolutions: ["480p", "720p", "1080p"], durations: secondsBetween(4, 30), maxImages: 1, audioToggle: true },
    costUsd: (req) => perSecond(SEEDANCE_25_USD, "720p")(req, 4, 30, 5),
    buildTask: (req) => ({
      model: "bytedance/seedance-2-5",
      input: {
        prompt: req.prompt,
        resolution: req.resolution ?? "720p",
        // With a first frame the model keeps the image's own shape.
        aspect_ratio: firstImage(req) ? "adaptive" : (req.aspectRatio ?? "16:9"),
        duration: clampDuration(req, 4, 30, 5),
        generate_audio: req.audio ?? true,
        ...(firstImage(req) ? { first_frame_url: firstImage(req) } : {}),
      },
    }),
  },
  {
    id: "seedance-2-5-flash",
    kind: "video",
    name: "Seedance 2.5 Flash",
    options: { aspects: [...COMMON_ASPECTS, "21:9"], resolutions: ["480p", "720p"], durations: secondsBetween(4, 30), maxImages: 1, audioToggle: true },
    costUsd: (req) => perSecond(SEEDANCE_25_FLASH_USD, "720p")(req, 4, 30, 5),
    buildTask: (req) => ({
      model: "bytedance/seedance-2-5-flash",
      input: {
        prompt: req.prompt,
        resolution: req.resolution ?? "720p",
        // Flash requires "adaptive" with a first frame.
        aspect_ratio: firstImage(req) ? "adaptive" : (req.aspectRatio ?? "16:9"),
        // Always send a length: without one Flash picks it and bills the actual length.
        duration: clampDuration(req, 4, 30, 5),
        generate_audio: req.audio ?? true,
        ...(firstImage(req) ? { first_frame_url: firstImage(req) } : {}),
      },
    }),
  },
  {
    id: KLING_KEYFRAME_MODEL,
    kind: "video",
    name: "Kling 4.0",
    options: { aspects: ["16:9", "9:16", "1:1", "21:9"], resolutions: ["720p", "1080p"], durations: secondsBetween(3, 30), maxImages: 4 },
    costUsd: (req) => perSecond(KLING_4_USD, "720p")(req, 3, 30, 5),
    buildTask: (req) => req.keyframes ? {
      model: "kling-4.0/keyframe-to-video",
      input: {
        prompt: req.prompt,
        resolution: req.resolution ?? "1080p",
        duration: clampDuration(req, 3, 30, 10),
        ...(req.keyframes.first ? { first_frame_url: req.keyframes.first } : {}),
        ...(req.keyframes.middle?.length ? { keyframe_urls: req.keyframes.middle } : {}),
        ...(req.keyframes.last ? { last_frame_url: req.keyframes.last } : {}),
      },
    } : ({
      model: "kling-4.0/reference-to-video",
      input: {
        prompt: req.prompt,
        resolution: req.resolution ?? "720p",
        aspect_ratio: req.imageUrls?.length ? "auto" : (req.aspectRatio ?? "16:9"),
        duration: clampDuration(req, 3, 30, 5),
        ...(req.imageUrls?.length ? { image_urls: req.imageUrls.slice(0, 4) } : {}),
      },
    }),
  },
  {
    id: "kling/v4-flash-reference-to-video",
    kind: "video",
    name: "Kling 4.0 Flash",
    options: { aspects: ["16:9", "9:16", "1:1", "21:9"], resolutions: ["720p"], durations: secondsBetween(3, 20), maxImages: 4 },
    costUsd: (req) => perSecond(KLING_4_FLASH_USD, "720p")(req, 3, 20, 5),
    buildTask: (req) => ({
      model: "kling-4.0/flash-reference-to-video",
      input: {
        prompt: req.prompt,
        resolution: "720p",
        aspect_ratio: req.imageUrls?.length ? "auto" : (req.aspectRatio ?? "16:9"),
        duration: clampDuration(req, 3, 20, 5),
        ...(req.imageUrls?.length ? { image_urls: req.imageUrls.slice(0, 4) } : {}),
      },
    }),
  },
  {
    id: "gemini-omni-flash-1-2",
    kind: "video",
    name: "Gemini Omni Flash 1.2",
    options: { aspects: ["16:9", "9:16"], resolutions: ["360p", "720p", "1080p", "4k"], durations: secondsBetween(3, 15), maxImages: 1 },
    costUsd: (req) => perSecond(GEMINI_OMNI_12_USD, "720p")(req, 3, 15, 5),
    buildTask: (req) => ({
      model: "google/gemini-omni-flash-1-2",
      input: {
        prompt: req.prompt,
        resolution: req.resolution ?? "720p",
        aspect_ratio: req.aspectRatio ?? "16:9",
        duration: clampDuration(req, 3, 15, 5),
        ...(firstImage(req) ? { first_frame_url: firstImage(req) } : {}),
      },
    }),
  },
  {
    id: "minimax-h3/text-to-video",
    kind: "video",
    name: "MiniMax H3",
    options: { aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], resolutions: ["768p", "2k"], durations: secondsBetween(4, 15), maxImages: 1 },
    costUsd: (req) =>
      perSecond(MINIMAX_H3_USD, "768p")(req, 4, 15, 6) + (firstImage(req) ? MINIMAX_H3_IMAGE_INPUT_USD : 0),
    buildTask: (req) => {
      const resolution = req.resolution === "2k" ? "2K" : "768P";
      const duration = clampDuration(req, 4, 15, 6);
      return firstImage(req)
        ? { model: "minimax-h3/image-to-video", input: { prompt: req.prompt, first_frame_url: firstImage(req), duration, resolution } }
        : { model: "minimax-h3/text-to-video", input: { prompt: req.prompt, aspect_ratio: req.aspectRatio ?? "16:9", duration, resolution } };
    },
  },
  {
    id: "wan/3-0-video",
    kind: "video",
    name: "Wan 3.0",
    options: { aspects: COMMON_ASPECTS, resolutions: ["480p", "720p", "1080p"], durations: secondsBetween(2, 30), maxImages: 1, audioToggle: true },
    costUsd: (req) => perSecond(WAN_3_USD, "720p")(req, 2, 30, 5),
    buildTask: (req) => ({
      model: "wan/3-0-video",
      input: {
        prompt: req.prompt,
        resolution: (req.resolution ?? "720p").toUpperCase(),
        aspect_ratio: firstImage(req) ? "adaptive" : (req.aspectRatio ?? "16:9"),
        duration: clampDuration(req, 2, 30, 5),
        audio: req.audio ?? true,
        ...(firstImage(req) ? { first_frame_url: firstImage(req) } : {}),
      },
    }),
  },
  {
    id: "grok-imagine/text-to-video",
    kind: "video",
    name: "Grok Imagine",
    options: { aspects: ["16:9", "9:16", "1:1", "2:3", "3:2"], resolutions: ["480p", "720p", "1080p"], durations: secondsBetween(6, 30), maxImages: 1 },
    costUsd: (req) => perSecond(GROK_USD, "720p")(req, 6, 30, 6),
    buildTask: (req) => {
      // KIE's examples send the length as a string for both modes.
      const duration = String(clampDuration(req, 6, 30, 6));
      const resolution = req.resolution ?? "720p";
      return firstImage(req)
        ? { model: "grok-imagine/image-to-video", input: { prompt: req.prompt, image_urls: [firstImage(req)], duration, resolution, mode: "normal" } }
        : { model: "grok-imagine/text-to-video", input: { prompt: req.prompt, aspect_ratio: req.aspectRatio ?? "16:9", duration, resolution, mode: "normal" } };
    },
  },
  {
    id: "grok-imagine-1-5",
    kind: "video",
    name: "Grok Imagine 1.5",
    // KIE only offers 1.5 as an image-to-video preview: a start image is required.
    options: { aspects: ["16:9", "9:16", "1:1", "4:3", "3:4"], resolutions: ["480p", "720p", "1080p"], durations: secondsBetween(1, 15), maxImages: 1, audioToggle: true, requiresImage: true },
    costUsd: (req) => perSecond(GROK_USD, "720p")(req, 1, 15, 8),
    buildTask: (req) => ({
      model: "grok-imagine-video-1-5-preview",
      input: {
        prompt: req.prompt,
        image_urls: req.imageUrls?.slice(0, 1) ?? [],
        aspect_ratio: "auto",
        resolution: req.resolution ?? "720p",
        duration: clampDuration(req, 1, 15, 8),
        enable_audio: req.audio ?? true,
      },
    }),
  },
  {
    id: "happyhorse-1-1",
    kind: "video",
    name: "HappyHorse 1.1",
    options: { aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], resolutions: ["720p", "1080p"], durations: secondsBetween(3, 15), maxImages: 1 },
    costUsd: (req) => perSecond(HAPPYHORSE_11_USD, "1080p")(req, 3, 15, 5),
    buildTask: (req) => {
      const resolution = req.resolution ?? "1080p";
      const duration = clampDuration(req, 3, 15, 5);
      return firstImage(req)
        ? { model: "happyhorse-1-1/image-to-video", input: { prompt: req.prompt, image_urls: [firstImage(req)], resolution, duration } }
        : { model: "happyhorse-1-1/text-to-video", input: { prompt: req.prompt, aspect_ratio: req.aspectRatio ?? "16:9", resolution, duration } };
    },
  },
  // Seedance 2.0 family (docs.kie.ai/market/bytedance/seedance-2*, prices 2026-11-25).
  ...([
    ["bytedance/seedance-2", "Seedance 2.0", SEEDANCE_2_USD, ["480p", "720p", "1080p"]],
    ["bytedance/seedance-2-fast", "Seedance 2.0 Fast", SEEDANCE_2_FAST_USD, ["480p", "720p"]],
    ["bytedance/seedance-2-mini", "Seedance 2.0 Mini", SEEDANCE_2_MINI_USD, ["480p", "720p"]],
  ] as const).map(([id, name, table, resolutions]): MarketModel => ({
    id,
    kind: "video",
    name,
    options: { aspects: [...COMMON_ASPECTS, "21:9"], resolutions: [...resolutions], durations: secondsBetween(4, 15), maxImages: 1, audioToggle: true },
    costUsd: (req) => perSecond(table, "720p")(req, 4, 15, 5),
    buildTask: (req) => ({
      model: id,
      input: {
        prompt: req.prompt,
        resolution: req.resolution && (resolutions as readonly string[]).includes(req.resolution) ? req.resolution : "720p",
        aspect_ratio: firstImage(req) ? "adaptive" : (req.aspectRatio ?? "16:9"),
        duration: clampDuration(req, 4, 15, 5),
        generate_audio: req.audio ?? true,
        ...(firstImage(req) ? { first_frame_url: firstImage(req) } : {}),
      },
    }),
  })),
  {
    id: "kling/kling-3-0",
    kind: "video",
    name: "Kling 3.0",
    // std renders 720p, pro 1080p; sound changes the price.
    options: { aspects: ["16:9", "9:16", "1:1"], resolutions: ["720p", "1080p"], durations: secondsBetween(3, 15), maxImages: 1, audioToggle: true },
    costUsd: (req) => {
      const table = req.audio === false ? KLING_3_USD : KLING_3_AUDIO_USD;
      return perSecond(table, "720p")(req, 3, 15, 5);
    },
    buildTask: (req) => ({
      model: "kling-3.0/video",
      input: {
        prompt: req.prompt,
        sound: req.audio ?? true,
        duration: String(clampDuration(req, 3, 15, 5)),
        aspect_ratio: req.aspectRatio && ["16:9", "9:16", "1:1"].includes(req.aspectRatio) ? req.aspectRatio : "16:9",
        mode: req.resolution === "1080p" ? "pro" : "std",
        multi_shots: false,
        ...(firstImage(req) ? { image_urls: [firstImage(req)] } : {}),
      },
    }),
  },
  {
    id: "wan/3-0-video-prime",
    kind: "video",
    name: "Wan 3.0 Prime",
    options: { aspects: COMMON_ASPECTS, resolutions: ["480p", "720p", "1080p"], durations: secondsBetween(2, 30), maxImages: 1, audioToggle: true },
    costUsd: (req) => perSecond(WAN_3_PRIME_USD, "720p")(req, 2, 30, 5),
    buildTask: (req) => ({
      model: "wan/3-0-video-prime",
      input: {
        prompt: req.prompt,
        resolution: (req.resolution ?? "720p").toUpperCase(),
        aspect_ratio: firstImage(req) ? "adaptive" : (req.aspectRatio ?? "16:9"),
        duration: clampDuration(req, 2, 30, 5),
        audio: req.audio ?? true,
        ...(firstImage(req) ? { first_frame_url: firstImage(req) } : {}),
      },
    }),
  },
  {
    id: "google/gemini-omni-flash-1-1",
    kind: "video",
    name: "Gemini Omni Flash 1.1",
    // Billed per clip by length: 4/6/8/10 s, one price up to 1080p and one for 4K.
    options: { aspects: ["16:9", "9:16"], resolutions: ["360p", "720p", "1080p", "4k"], durations: [4, 6, 8, 10], maxImages: 1 },
    costUsd: (req) => (req.resolution === "4k" ? GEMINI_OMNI_11_4K_USD : GEMINI_OMNI_11_USD)[omniDuration(req)],
    buildTask: (req) => ({
      model: "google/gemini-omni-flash-1-1",
      input: {
        prompt: req.prompt,
        duration: String(omniDuration(req)),
        aspect_ratio: req.aspectRatio === "9:16" ? "9:16" : "16:9",
        resolution: req.resolution ?? "720p",
        ...(firstImage(req) ? { first_frame_url: firstImage(req) } : {}),
      },
    }),
  },
  {
    id: "happyhorse/text-to-video",
    kind: "video",
    name: "HappyHorse 1.0",
    options: { aspects: ["16:9", "9:16", "1:1", "4:3", "3:4"], resolutions: ["720p", "1080p"], durations: secondsBetween(3, 15), maxImages: 1 },
    costUsd: (req) => perSecond(HAPPYHORSE_10_USD, "1080p")(req, 3, 15, 5),
    buildTask: (req) => {
      const resolution = req.resolution ?? "1080p";
      const duration = clampDuration(req, 3, 15, 5);
      return firstImage(req)
        ? { model: "happyhorse/image-to-video", input: { prompt: req.prompt, image_urls: [firstImage(req)], resolution, duration } }
        : { model: "happyhorse/text-to-video", input: { prompt: req.prompt, aspect_ratio: req.aspectRatio ?? "16:9", resolution, duration } };
    },
  },
  {
    id: "hailuo/02-text-to-video-pro",
    kind: "video",
    name: "MiniMax Hailuo 02 Pro",
    // A fixed 6 s 1080p clip, priced per clip.
    options: { aspects: ["16:9"], resolutions: ["1080p"], durations: [6], maxImages: 1, maxPromptLength: 1500 },
    costUsd: () => 0.285,
    buildTask: (req) => firstImage(req)
      ? { model: "hailuo/02-image-to-video-pro", input: { prompt: req.prompt.slice(0, 1500), image_url: firstImage(req), prompt_optimizer: true } }
      : { model: "hailuo/02-text-to-video-pro", input: { prompt: req.prompt.slice(0, 1500), prompt_optimizer: true } },
  },
  {
    id: "hailuo/02-text-to-video-standard",
    kind: "video",
    name: "MiniMax Hailuo 02 Standard",
    options: { aspects: ["16:9"], resolutions: ["768p"], durations: [6, 10], maxImages: 1, maxPromptLength: 1500 },
    costUsd: (req) => ((req.duration ?? 6) > 6 ? 0.25 : 0.15),
    buildTask: (req) => {
      const duration = (req.duration ?? 6) > 6 ? "10" : "6";
      return firstImage(req)
        ? { model: "hailuo/02-image-to-video-standard", input: { prompt: req.prompt.slice(0, 1500), image_url: firstImage(req), duration, resolution: "768P", prompt_optimizer: true } }
        : { model: "hailuo/02-text-to-video-standard", input: { prompt: req.prompt.slice(0, 1500), duration, prompt_optimizer: true } };
    },
  },
  {
    id: "magi-2",
    kind: "video",
    name: "MAGI-2",
    // docs.kie.ai/market/magi-2/*: one image is the first frame; two or more
    // become reference images (up to 10) for reference-to-video.
    options: { aspects: MAGI_2_ASPECTS, resolutions: ["1080p"], durations: secondsBetween(4, 30), maxImages: 10, audioToggle: true, maxPromptLength: 15000 },
    costUsd: (req) => perSecond(MAGI_2_USD, "1080p")(req, 4, 30, 5),
    buildTask: (req) => {
      const images = req.imageUrls?.slice(0, 10) ?? [];
      const common = {
        prompt: req.prompt.slice(0, 15000),
        duration: clampDuration(req, 4, 30, 5),
        resolution: "1080p",
        generate_audio: req.audio ?? true,
      };
      const aspect_ratio = req.aspectRatio && MAGI_2_ASPECTS.includes(req.aspectRatio) ? req.aspectRatio : "16:9";
      if (images.length > 1) return { model: "magi-2/reference-to-video", input: { ...common, aspect_ratio, reference_image_urls: images } };
      // Image-to-video follows the first frame's shape and takes no aspect ratio.
      if (images.length === 1) return { model: "magi-2/image-to-video", input: { ...common, first_frame_url: images[0] } };
      return { model: "magi-2/text-to-video", input: { ...common, aspect_ratio } };
    },
  },
  {
    id: "bytedance/seedance-2-5-draft", kind: "video", name: "Seedance 2.5 Draft",
    options: { aspects: MAGI_2_ASPECTS, resolutions: ["480p"], durations: secondsBetween(4, 30), maxImages: 1, audioToggle: true, maxPromptLength: 20480 },
    // Assumption: no separate draft tariff is published. Use Seedance 2.5's no-video-input 480p rate.
    costUsd: (req) => SEEDANCE_25_USD["480p"] * clampDuration(req, 4, 30, 5),
    buildTask: (req) => ({
      model: "bytedance/seedance-2-5",
      input: {
        prompt: req.prompt, draft: true, resolution: "480p", duration: clampDuration(req, 4, 30, 5),
        aspect_ratio: firstImage(req) ? "adaptive" : option(req.aspectRatio, MAGI_2_ASPECTS, "16:9"),
        generate_audio: req.audio ?? true, ...(firstImage(req) ? { first_frame_url: firstImage(req) } : {}),
      },
    }),
  },
  {
    id: "bytedance/v1-pro-text-to-video", kind: "video", name: "Seedance 1.0 Pro",
    options: { aspects: MAGI_2_ASPECTS, resolutions: Object.keys(SEEDANCE_1_USD), durations: [5, 10], maxImages: 1, maxPromptLength: 10000 },
    costUsd: (req) => (SEEDANCE_1_USD[req.resolution as keyof typeof SEEDANCE_1_USD] ?? .03) * fiveOrTen(req),
    buildTask: (req) => {
      const common = { prompt: req.prompt, duration: String(fiveOrTen(req)), resolution: option(req.resolution, Object.keys(SEEDANCE_1_USD), "720p") };
      return firstImage(req)
        ? { model: "bytedance/v1-pro-image-to-video", input: { ...common, image_url: firstImage(req) } }
        : { model: "bytedance/v1-pro-text-to-video", input: { ...common, aspect_ratio: option(req.aspectRatio, MAGI_2_ASPECTS, "16:9") } };
    },
  },
  {
    id: "bytedance/v1-pro-fast-image-to-video", kind: "video", name: "Seedance 1.0 Pro Fast",
    options: { aspects: ["auto"], resolutions: ["720p", "1080p"], durations: [5, 10], maxImages: 1, requiresImage: true, maxPromptLength: 10000 },
    costUsd: (req) => (hd(req) === "1080p" ? { 5: .18, 10: .36 } : { 5: .08, 10: .18 })[fiveOrTen(req)],
    buildTask: (req) => ({
      model: "bytedance/v1-pro-fast-image-to-video",
      input: { prompt: req.prompt, image_url: firstImage(req), resolution: hd(req), duration: String(fiveOrTen(req)) },
    }),
  },
  {
    id: "wan/2-7-text-to-video", kind: "video", name: "Wan 2.7",
    options: { aspects: COMMON_ASPECTS, resolutions: ["720p", "1080p"], durations: secondsBetween(2, 15), maxImages: 2, maxPromptLength: 5000 },
    costUsd: (req) => perSecond({ "720p": .08, "1080p": .12 }, "720p")(req, 2, 15, 5),
    buildTask: (req) => {
      const common = { prompt: req.prompt, resolution: hd(req), duration: clampDuration(req, 2, 15, 5) };
      return firstImage(req)
        ? { model: "wan/2-7-image-to-video", input: { ...common, first_frame_url: firstImage(req), ...(req.imageUrls?.[1] ? { last_frame_url: req.imageUrls[1] } : {}) } }
        : { model: "wan/2-7-text-to-video", input: { ...common, ratio: option(req.aspectRatio, COMMON_ASPECTS, "16:9") } };
    },
  },
  {
    id: "wan/2-5-text-to-video", kind: "video", name: "Wan 2.5",
    options: { aspects: VIDEO_ASPECTS, resolutions: ["720p", "1080p"], durations: [5, 10], maxImages: 1, maxPromptLength: 800 },
    costUsd: (req) => (hd(req) === "1080p" ? { 5: .5, 10: 1 } : { 5: .3, 10: .6 })[fiveOrTen(req)],
    buildTask: (req) => {
      const common = { prompt: req.prompt, resolution: hd(req), duration: String(fiveOrTen(req)) };
      return firstImage(req)
        ? { model: "wan/2-5-image-to-video", input: { ...common, image_url: firstImage(req) } }
        : { model: "wan/2-5-text-to-video", input: { ...common, aspect_ratio: option(req.aspectRatio, VIDEO_ASPECTS, "16:9") } };
    },
  },
  {
    id: "wan/2-6-flash-image-to-video", kind: "video", name: "Wan 2.6 Flash",
    options: { aspects: ["auto"], resolutions: ["720p", "1080p"], durations: [5, 10, 15], maxImages: 1, requiresImage: true, audioToggle: true, maxPromptLength: 1500, minImageSide: 256 },
    costUsd: (req) => {
      const clips = hd(req) === "1080p"
        ? (req.audio === false ? { 5: .15, 10: .30, 15: .45 } : { 5: .30, 10: .60, 15: .90 })
        : (req.audio === false ? { 5: .10, 10: .20, 15: .30 } : { 5: .20, 10: .40, 15: .60 });
      return clips[wanFlashDuration(req)];
    },
    buildTask: (req) => ({
      model: "wan/2-6-flash-image-to-video",
      input: { prompt: req.prompt, image_urls: refs(req, 1), resolution: hd(req), duration: String(wanFlashDuration(req)), audio: req.audio ?? true },
    }),
  },
  {
    id: "kling/v3-turbo-text-to-video", kind: "video", name: "Kling 3.0 Turbo",
    options: { aspects: VIDEO_ASPECTS, resolutions: ["720p", "1080p"], durations: secondsBetween(3, 15), maxImages: 1, maxPromptLength: 2500, imageTypes: JPEG_PNG },
    costUsd: (req) => perSecond({ "720p": .101, "1080p": .126 }, "720p")(req, 3, 15, 5),
    buildTask: (req) => {
      const common = { prompt: req.prompt, resolution: hd(req), duration: String(clampDuration(req, 3, 15, 5)) };
      return firstImage(req)
        ? { model: "kling/v3-turbo-image-to-video", input: { ...common, image_urls: refs(req, 1) } }
        : { model: "kling/v3-turbo-text-to-video", input: { ...common, aspect_ratio: option(req.aspectRatio, VIDEO_ASPECTS, "16:9") } };
    },
  },
  {
    id: "kling/v3-omni-text-to-video", kind: "video", name: "Kling 3.0 Omni",
    options: { aspects: VIDEO_ASPECTS, resolutions: Object.keys(KLING_OMNI_USD), durations: secondsBetween(3, 15), maxImages: 7, audioToggle: true, maxPromptLength: 3072, imageTypes: JPEG_PNG, minImageSide: 300 },
    costUsd: (req) => perSecond(req.audio === false ? KLING_OMNI_USD : KLING_OMNI_AUDIO_USD, "720p")(req, 3, 15, 5),
    buildTask: (req) => {
      const images = refs(req, 7);
      const common = {
        prompt: req.prompt, duration: clampDuration(req, 3, 15, 5),
        resolution: option(req.resolution, Object.keys(KLING_OMNI_USD), "720p"), audio: req.audio ?? true,
      };
      const aspect_ratio = option(req.aspectRatio, VIDEO_ASPECTS, "16:9");
      if (images.length > 1) return { model: "kling-3.0-omni/reference-to-video", input: { ...common, image_urls: images, aspect_ratio } };
      if (images.length) return { model: "kling-3.0-omni/image-to-video", input: { ...common, image_urls: images, aspect_ratio: "auto" } };
      return { model: "kling-3.0-omni/text-to-video", input: { ...common, aspect_ratio } };
    },
  },
  {
    id: "kling/text-to-video", kind: "video", name: "Kling 2.6",
    options: { aspects: VIDEO_ASPECTS, resolutions: ["1080p"], durations: [5, 10], maxImages: 1, audioToggle: true, maxPromptLength: 2500, imageTypes: JPEG_PNG },
    costUsd: (req) => (req.audio === false ? { 5: .315, 10: .63 } : { 5: .63, 10: 1.26 })[fiveOrTen(req)],
    buildTask: (req) => {
      const common = { prompt: req.prompt, duration: String(fiveOrTen(req)), sound: req.audio ?? true };
      return firstImage(req)
        ? { model: "kling-2.6/image-to-video", input: { ...common, image_urls: refs(req, 1) } }
        : { model: "kling-2.6/text-to-video", input: { ...common, aspect_ratio: option(req.aspectRatio, VIDEO_ASPECTS, "16:9") } };
    },
  },
  {
    id: "kling/v25-turbo-text-to-video-pro", kind: "video", name: "Kling 2.5 Turbo",
    options: { aspects: VIDEO_ASPECTS, resolutions: ["1080p"], durations: [5, 10], maxImages: 2, maxPromptLength: 2500, imageTypes: JPEG_PNG },
    costUsd: (req) => ({ 5: .315, 10: .63 })[fiveOrTen(req)],
    buildTask: (req) => {
      const common = { prompt: req.prompt, duration: String(fiveOrTen(req)) };
      return firstImage(req)
        ? { model: "kling/v2-5-turbo-image-to-video-pro", input: { ...common, image_url: firstImage(req), ...(req.imageUrls?.[1] ? { tail_image_url: req.imageUrls[1] } : {}) } }
        : { model: "kling/v2-5-turbo-text-to-video-pro", input: { ...common, aspect_ratio: option(req.aspectRatio, VIDEO_ASPECTS, "16:9") } };
    },
  },
  ...(["pro", "standard"] as const).map((tier): MarketModel => ({
    id: `hailuo/2-3-image-to-video-${tier}`, kind: "video", name: `Hailuo 2.3 ${tier === "pro" ? "Pro" : "Standard"}`,
    // 1080P cannot render 10s. Keep all combinations exposed by the picker valid.
    options: { aspects: ["auto"], resolutions: ["768p", "1080p"], durations: [6], maxImages: 1, requiresImage: true, maxPromptLength: 5000 },
    costUsd: (req) => (tier === "pro" ? { "768p": .225, "1080p": .4 } : { "768p": .15, "1080p": .25 })[req.resolution === "1080p" ? "1080p" : "768p"],
    buildTask: (req) => ({
      model: `hailuo/2-3-image-to-video-${tier}`,
      input: { prompt: req.prompt, image_url: firstImage(req), duration: "6", resolution: req.resolution === "1080p" ? "1080P" : "768P" },
    }),
  })),
  {
    id: "vidu-q4/image-to-video", kind: "video", name: "Vidu Q4",
    options: { aspects: COMMON_ASPECTS, resolutions: Object.keys(VIDU_Q4_USD), durations: secondsBetween(3, 16), maxImages: 15, requiresImage: true, audioToggle: true, maxPromptLength: 20000, aspectFollowsSingleImage: true },
    costUsd: (req) => perSecond(VIDU_Q4_USD, "720p")(req, 3, 16, 5),
    buildTask: (req) => {
      const images = refs(req, 15);
      const common = { prompt: req.prompt, duration: clampDuration(req, 3, 16, 5), resolution: option(req.resolution, Object.keys(VIDU_Q4_USD), "720p"), audio: req.audio ?? true };
      return images.length > 1
        ? { model: "vidu-q4/reference-to-video", input: { ...common, reference_image_urls: images, aspect_ratio: option(req.aspectRatio, COMMON_ASPECTS, "16:9") } }
        : { model: "vidu-q4/image-to-video", input: { ...common, image_url: images[0] } };
    },
  },
  {
    id: "pixverse/text-to-video", kind: "video", name: "PixVerse V6",
    options: { aspects: [...MAGI_2_ASPECTS, "2:3", "3:2"], resolutions: Object.keys(PIXVERSE_V6_USD), durations: secondsBetween(1, 15), maxImages: 1, audioToggle: true, minPromptLength: 3, maxPromptLength: 5000 },
    costUsd: (req) => perSecond(req.audio === false ? PIXVERSE_V6_USD : PIXVERSE_V6_AUDIO_USD, "720p")(req, 1, 15, 5),
    buildTask: (req) => {
      const common = { prompt: req.prompt, duration: clampDuration(req, 1, 15, 5), quality: option(req.resolution, Object.keys(PIXVERSE_V6_USD), "720p"), generate_audio_switch: req.audio ?? true };
      return firstImage(req)
        ? { model: "pixverse-v6/image-to-video", input: { ...common, image_urls: refs(req, 1) } }
        : { model: "pixverse-v6/text-to-video", input: { ...common, aspect_ratio: option(req.aspectRatio, [...MAGI_2_ASPECTS, "2:3", "3:2"], "16:9") } };
    },
  },
  {
    id: "wan/2-2-a14b-text-to-video-turbo", kind: "video", name: "Wan 2.2 Turbo",
    // KIE documents no length field and bills per second; the A14B turbo
    // renders about 5 s (81 frames at 16 fps). Assumption: bill 6 s so a
    // clip that rounds up is still covered.
    options: { aspects: ["16:9", "9:16"], resolutions: ["480p", "720p"], durations: [5], maxImages: 1, maxPromptLength: 5000 },
    costUsd: (req) => (req.resolution === "480p" ? .04 : .08) * 6,
    buildTask: (req) => {
      const common = { prompt: req.prompt, resolution: req.resolution === "480p" ? "480p" : "720p" };
      return firstImage(req)
        ? { model: "wan/2-2-a14b-image-to-video-turbo", input: { ...common, image_url: firstImage(req) } }
        : { model: "wan/2-2-a14b-text-to-video-turbo", input: { ...common, aspect_ratio: req.aspectRatio === "9:16" ? "9:16" : "16:9" } };
    },
  },
  {
    id: "gemini-omni-video", kind: "video", name: "Gemini Omni Video",
    options: { aspects: ["16:9", "9:16"], resolutions: ["720p", "1080p", "4k"], durations: [4, 6, 8, 10], maxImages: 7, maxPromptLength: 20000 },
    // The no-video tariff matches Flash 1.1 at each of these clip lengths.
    costUsd: (req) => (req.resolution === "4k" ? GEMINI_OMNI_11_4K_USD : GEMINI_OMNI_11_USD)[omniDuration(req)],
    buildTask: (req) => ({
      model: "gemini-omni-video",
      input: {
        prompt: req.prompt, duration: String(omniDuration(req)), resolution: option(req.resolution, ["720p", "1080p", "4k"], "720p"),
        aspect_ratio: req.aspectRatio === "9:16" ? "9:16" : "16:9", ...(firstImage(req) ? { image_urls: refs(req, 7) } : {}),
      },
    }),
  },
];


// ---------------------------------------------------------------------------
// Image models. USD per image are KIE list prices (kie.ai/pricing, 2026-11-18).
// ---------------------------------------------------------------------------

const refs = (req: MarketRequest, max: number) => (req.imageUrls ?? []).slice(0, max);
const count = (req: MarketRequest, max: number) => imageOutputCount(req.count, max);
const IMAGE_ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];

// GPT Image 2.6 is billed per token. KIE's own per-image estimator (medium
// quality) is used at its most expensive shape, 1:1, plus its allowance per
// reference image, so other shapes only cost less.
const GPT_IMAGE_26_USD = { "1K": 0.04, "2K": 0.0795, "4K": 0.1325 };
const GPT_IMAGE_26_REF_USD = 0.011;

// GPT Image 2: one price per image by resolution, the same for text-to-image
// and image-to-image, nothing extra per reference image (kie.ai/gpt-image-2,
// read 2026-11-24). KIE rejects 5:4, 4:5, 3:1, 1:3 and 9:21 at 2K or 4K, so
// only shapes valid at every resolution are offered.
const GPT_IMAGE_2_USD = { "1K": 0.03, "2K": 0.05, "4K": 0.08 };

// Shapes each model's KIE schema accepts (docs.kie.ai, read 2026-11-25).
const FLUX2_ASPECTS = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"];
const SEEDREAM_5_ASPECTS = ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"];
const IMAGEN_ASPECTS = ["1:1", "16:9", "9:16", "3:4", "4:3"];
const QWEN3_ASPECTS = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"];
const IDEOGRAM_SIZES: Record<string, string> = {
  "1:1": "square_hd", "4:3": "landscape_4_3", "3:4": "portrait_4_3", "16:9": "landscape_16_9", "9:16": "portrait_16_9",
};

const IMAGE_SIZES = ["1K", "2K", "4K"];
const GPT_25_ASPECTS = ["auto", ...IMAGE_ASPECTS, "21:9"];
const BANANA_2_ASPECTS = [...GPT_25_ASPECTS, "1:4", "4:1", "1:8", "8:1", "4:5", "5:4"];
const WAN_IMAGE_ASPECTS = ["1:1", "16:9", "4:3", "21:9", "3:4", "9:16", "8:1", "1:8"];
const SEEDREAM_4_SIZES: Record<string, string> = {
  ...IDEOGRAM_SIZES, "3:2": "landscape_3_2", "2:3": "portrait_3_2", "21:9": "landscape_21_9",
};
const imageSize = (req: MarketRequest) =>
  req.resolution === "4K" || req.resolution === "2K" ? req.resolution : "1K";

const IMAGE_MODELS: MarketModel[] = [
  {
    id: "seedream-5-5",
    kind: "image",
    name: "Seedream 5.5",
    options: { aspects: [...IMAGE_ASPECTS, "21:9"], resolutions: ["1K", "2K"], defaultResolution: "2K", maxCount: 1, maxImages: 10 },
    costUsd: (req) => ((req.resolution ?? "2K") === "2K" ? 0.0315 : 0.018) + refs(req, 10).length * 0.0072,
    buildTask: (req) => ({
      model: refs(req, 10).length ? "seedream/5-5-image-to-image" : "seedream/5-5-text-to-image",
      input: {
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio ?? (refs(req, 10).length ? "auto" : "1:1"),
        size: req.resolution ?? "2K",
        output_format: "png",
        ...(refs(req, 10).length ? { image_urls: refs(req, 10) } : {}),
      },
    }),
  },
  ...(["sunburst", "flare"] as const).map(
    (variant): MarketModel => ({
      id: `gpt-image-2-6-${variant}`,
      kind: "image",
      name: `GPT Image 2.6 ${variant === "sunburst" ? "Sunburst" : "Flare"}`,
      options: { aspects: ["auto", ...IMAGE_ASPECTS], resolutions: ["1K", "2K", "4K"], maxCount: 1, maxImages: 16 },
      costUsd: (req) =>
        GPT_IMAGE_26_USD[(req.resolution ?? "1K") as keyof typeof GPT_IMAGE_26_USD] + refs(req, 16).length * GPT_IMAGE_26_REF_USD,
      buildTask: (req) => ({
        model: `gpt-image-2-6/${variant}-${refs(req, 16).length ? "image-to-image" : "text-to-image"}`,
        input: {
          prompt: req.prompt,
          aspect_ratio: req.aspectRatio ?? "auto",
          resolution: req.resolution ?? "1K",
          // Priced at medium; never let a request ask for a costlier tier.
          quality: "medium",
          output_format: "png",
          ...(refs(req, 16).length ? { input_urls: refs(req, 16) } : {}),
        },
      }),
    }),
  ),
  {
    id: "gpt-image-2",
    kind: "image",
    name: "GPT Image 2",
    options: { aspects: ["auto", ...IMAGE_ASPECTS, "2:1", "1:2", "21:9"], resolutions: ["1K", "2K", "4K"], maxCount: 1, maxImages: 16 },
    costUsd: (req) => GPT_IMAGE_2_USD[(req.resolution ?? "1K") as keyof typeof GPT_IMAGE_2_USD] ?? GPT_IMAGE_2_USD["4K"],
    buildTask: (req) => ({
      model: refs(req, 16).length ? "gpt-image-2-image-to-image" : "gpt-image-2-text-to-image",
      input: {
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio ?? "auto",
        // KIE asks for the resolution to be set explicitly.
        resolution: req.resolution ?? "1K",
        ...(refs(req, 16).length ? { input_urls: refs(req, 16) } : {}),
      },
    }),
  },
  {
    id: "nano-banana-2-1",
    kind: "image",
    name: "Nano Banana 2.1",
    options: { aspects: ["auto", ...IMAGE_ASPECTS, "21:9"], resolutions: ["1K", "2K", "4K"], maxCount: 1, maxImages: 10 },
    costUsd: (req) => ({ "1K": 0.02, "2K": 0.03, "4K": 0.045 })[(req.resolution ?? "1K") as "1K" | "2K" | "4K"] ?? 0.045,
    buildTask: (req) => ({
      model: "nano-banana-2-1",
      input: {
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio ?? "auto",
        resolution: req.resolution ?? "1K",
        output_format: "png",
        ...(refs(req, 10).length ? { image_input: refs(req, 10) } : {}),
      },
    }),
  },
  {
    id: "nano-banana-pro",
    kind: "image",
    name: "Nano Banana Pro",
    options: { aspects: ["auto", ...IMAGE_ASPECTS, "21:9"], resolutions: ["1K", "2K", "4K"], maxCount: 1, maxImages: 8 },
    costUsd: (req) => ((req.resolution ?? "1K") === "4K" ? 0.12 : 0.09),
    buildTask: (req) => ({
      model: "nano-banana-pro",
      input: {
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio ?? "1:1",
        resolution: req.resolution ?? "1K",
        // KIE says to always set this; it has no default.
        output_format: "png",
        ...(refs(req, 8).length ? { image_input: refs(req, 8) } : {}),
      },
    }),
  },
  {
    id: "kling-image-4",
    kind: "image",
    name: "Kling Image 4.0",
    options: { aspects: ["auto", ...IMAGE_ASPECTS, "21:9"], resolutions: ["2K", "4K", "8K"], maxCount: 9, maxImages: 10 },
    costUsd: (req) =>
      (({ "2K": 0.0565, "4K": 0.085, "8K": 0.1415 })[(req.resolution ?? "2K") as "2K" | "4K" | "8K"] ?? 0.1415) * count(req, 9) +
      refs(req, 10).length * 0.0025,
    buildTask: (req) => ({
      model: "kling-4-0/image",
      input: {
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio ?? "auto",
        resolution: (req.resolution ?? "2K").toLowerCase(),
        mode: "default",
        count: count(req, 9),
        ...(refs(req, 10).length ? { image_urls: refs(req, 10) } : {}),
      },
    }),
  },
  {
    id: "minimax-h3-image",
    kind: "image",
    name: "MiniMax H3 Image",
    options: { aspects: ["auto", ...IMAGE_ASPECTS, "21:9"], resolutions: ["1K", "2K", "4K"], defaultResolution: "2K", maxCount: 1, maxImages: 16 },
    costUsd: (req) => ((req.resolution ?? "2K") === "4K" ? 0.0275 : 0.009) + refs(req, 16).length * 0.0025,
    buildTask: (req) => ({
      model: refs(req, 16).length ? "minimax-h3/image-edit" : "minimax-h3/text-to-image",
      input: {
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio ?? "auto",
        resolution: req.resolution ?? "2K",
        output_format: "png",
        ...(refs(req, 16).length ? { image_urls: refs(req, 16) } : {}),
      },
    }),
  },
  {
    id: "flux3/klein-text-to-image",
    kind: "image",
    name: "FLUX 3 Image",
    options: { aspects: [...IMAGE_ASPECTS, "21:9"], resolutions: ["1K", "2K", "4K"], maxCount: 4, maxImages: 10 },
    costUsd: (req) =>
      (({ "1K": 0.008, "2K": 0.0125, "4K": 0.0325 })[(req.resolution ?? "1K") as "1K" | "2K" | "4K"] ?? 0.0325) * count(req, 4),
    buildTask: (req) => ({
      model: refs(req, 10).length ? "flux-3/klein-edit-image" : "flux-3/klein-text-to-image",
      input: {
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio ?? (refs(req, 10).length ? "auto" : "1:1"),
        resolution: req.resolution ?? "1K",
        num_images: count(req, 4),
        output_format: "png",
        ...(refs(req, 10).length ? { image_urls: refs(req, 10) } : {}),
      },
    }),
  },
  {
    id: "grok-imagine-image-2-0/text-to-image",
    kind: "image",
    name: "Grok Imagine 2.0",
    options: { aspects: ["1:1", "16:9", "9:16", "3:2", "2:3"], resolutions: [], maxCount: 1, maxImages: 5 },
    costUsd: () => 0.02,
    buildTask: (req) =>
      refs(req, 5).length
        ? { model: "grok-imagine-image-2-0/image-edit", input: { prompt: req.prompt, aspect_ratio: req.aspectRatio ?? "auto", image_urls: refs(req, 5) } }
        : { model: "grok-imagine-image-2-0/text-to-image", input: { prompt: req.prompt, aspect_ratio: req.aspectRatio ?? "1:1" } },
  },
  // FLUX.2 Pro / Flex (docs.kie.ai/market/flux2/*): 1K or 2K, up to 8 references.
  ...([
    ["flux2/pro-text-to-image", "FLUX.2 Pro", "pro", { "1K": 0.025, "2K": 0.035 }],
    ["flux2/flex-text-to-image", "FLUX.2 Flex", "flex", { "1K": 0.07, "2K": 0.12 }],
  ] as const).map(([id, name, tier, prices]): MarketModel => ({
    id,
    kind: "image",
    name,
    options: { aspects: FLUX2_ASPECTS, resolutions: ["1K", "2K"], maxCount: 1, maxImages: 8 },
    costUsd: (req) => prices[req.resolution === "2K" ? "2K" : "1K"],
    buildTask: (req) => {
      const images = refs(req, 8);
      const aspect = req.aspectRatio && FLUX2_ASPECTS.includes(req.aspectRatio) ? req.aspectRatio : images.length ? "auto" : "1:1";
      return {
        model: `flux-2/${tier}-${images.length ? "image-to-image" : "text-to-image"}`,
        input: {
          prompt: req.prompt,
          aspect_ratio: !images.length && aspect === "auto" ? "1:1" : aspect,
          resolution: req.resolution === "2K" ? "2K" : "1K",
          ...(images.length ? { input_urls: images } : {}),
        },
      };
    },
  })),
  {
    id: "seedream/5-pro-text-to-image",
    kind: "image",
    name: "Seedream 5 Pro",
    // basic renders 1K and high 2K; the first reference image is free.
    options: { aspects: SEEDREAM_5_ASPECTS, resolutions: ["1K", "2K"], maxCount: 1, maxImages: 10 },
    costUsd: (req) => (req.resolution === "2K" ? 0.07 : 0.035) + Math.max(0, refs(req, 10).length - 1) * 0.0025,
    buildTask: (req) => ({
      model: refs(req, 10).length ? "seedream/5-pro-image-to-image" : "seedream/5-pro-text-to-image",
      input: {
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio && SEEDREAM_5_ASPECTS.includes(req.aspectRatio) ? req.aspectRatio : "1:1",
        quality: req.resolution === "2K" ? "high" : "basic",
        output_format: "png",
        ...(refs(req, 10).length ? { image_urls: refs(req, 10) } : {}),
      },
    }),
  },
  {
    id: "seedream/5-flash-text-to-image",
    kind: "image",
    name: "Seedream 5 Flash",
    options: { aspects: SEEDREAM_5_ASPECTS, resolutions: ["1K", "2K"], maxCount: 1, maxImages: 10 },
    costUsd: () => 0.0162,
    buildTask: (req) => ({
      model: refs(req, 10).length ? "seedream/5-flash-image-to-image" : "seedream/5-flash-text-to-image",
      input: {
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio && SEEDREAM_5_ASPECTS.includes(req.aspectRatio) ? req.aspectRatio : "1:1",
        size: req.resolution === "2K" ? "2K" : "1K",
        output_format: "png",
        ...(refs(req, 10).length ? { image_urls: refs(req, 10) } : {}),
      },
    }),
  },
  ...([
    ["google/imagen4", "Imagen 4", 0.04],
    ["google/imagen4-fast", "Imagen 4 Fast", 0.02],
  ] as const).map(([id, name, usd]): MarketModel => ({
    id,
    kind: "image",
    name,
    // Text to image only.
    options: { aspects: IMAGEN_ASPECTS, resolutions: [], maxCount: 1, maxImages: 0 },
    costUsd: () => usd,
    buildTask: (req) => ({
      model: id,
      input: { prompt: req.prompt, aspect_ratio: req.aspectRatio && IMAGEN_ASPECTS.includes(req.aspectRatio) ? req.aspectRatio : "1:1" },
    }),
  })),
  {
    id: "ideogram/v3-text-to-image",
    kind: "image",
    name: "Ideogram V3",
    // Always BALANCED, the speed it is priced at; one reference turns it into a remix.
    options: { aspects: Object.keys(IDEOGRAM_SIZES), resolutions: [], maxCount: 1, maxImages: 1 },
    costUsd: () => 0.035,
    buildTask: (req) => {
      const image_size = IDEOGRAM_SIZES[req.aspectRatio ?? "1:1"] ?? "square_hd";
      const image = refs(req, 1)[0];
      return image
        ? { model: "ideogram/v3-remix", input: { prompt: req.prompt, image_url: image, rendering_speed: "BALANCED", image_size, num_images: "1" } }
        : { model: "ideogram/v3-text-to-image", input: { prompt: req.prompt, rendering_speed: "BALANCED", image_size } };
    },
  },
  {
    id: "qwen3/text-to-image",
    kind: "image",
    name: "Qwen Image 3",
    options: { aspects: QWEN3_ASPECTS, resolutions: ["1K", "2K"], maxCount: 1, maxImages: 3 },
    costUsd: (req) => 0.024 + refs(req, 3).length * 0.0025,
    buildTask: (req) => ({
      model: refs(req, 3).length ? "qwen3/image-to-image" : "qwen3/text-to-image",
      input: {
        prompt: req.prompt,
        resolution: req.resolution === "2K" ? "2K" : "1K",
        image_size: req.aspectRatio && QWEN3_ASPECTS.includes(req.aspectRatio) ? req.aspectRatio : "1:1",
        output_format: "png",
        ...(refs(req, 3).length ? { image_urls: refs(req, 3) } : {}),
      },
    }),
  },
  {
    id: "z-image/z-image",
    kind: "image",
    name: "Z-Image",
    options: { aspects: ["1:1", "4:3", "3:4", "16:9", "9:16"], resolutions: [], maxCount: 1, maxImages: 0, maxPromptLength: 1000 },
    costUsd: () => 0.004,
    buildTask: (req) => ({
      model: "z-image",
      input: {
        prompt: req.prompt.slice(0, 1000),
        aspect_ratio: req.aspectRatio && ["1:1", "4:3", "3:4", "16:9", "9:16"].includes(req.aspectRatio) ? req.aspectRatio : "1:1",
      },
    }),
  },
  {
    id: "kling-4-0/long-image", kind: "image", name: "Kling Long Image 4.0",
    options: { aspects: [], resolutions: ["1K", "2K"], defaultResolution: "2K", maxCount: 1, maxImages: 3, maxPromptLength: 20000, imageTypes: JPEG_PNG },
    costUsd: (req) => {
      const images = refs(req, 3);
      const oneK = req.resolution === "1K";
      if (!images.length) return oneK ? .495 : .5375;
      return (oneK ? .4225 : .495) + images.length * .0025;
    },
    buildTask: (req) => {
      const images = refs(req, 3);
      return {
        model: "kling-4-0/long-image",
        input: {
          prompt: klingLongImagePrompt(req.prompt, images.length), resolution: req.resolution === "1K" ? "1k" : "2k",
          ...(images.length ? { skill: "ecommerce", length: "medium", image_urls: images } : { skill: "webpage" }),
        },
      };
    },
  },
  ...(["sunburst", "flare"] as const).map((variant): MarketModel => ({
    id: `gpt/gpt-image-2-5-${variant}-text-to-image`, kind: "image",
    name: `GPT Image 2.5 ${variant === "sunburst" ? "Sunburst" : "Flare"}`,
    // 2.5 has no quality field. Only send priced resolutions and ratios valid at all sizes.
    options: { aspects: GPT_25_ASPECTS, resolutions: IMAGE_SIZES, maxCount: 1, maxImages: 16, maxPromptLength: 20000 },
    costUsd: (req) => GPT_IMAGE_2_USD[imageSize(req)],
    buildTask: (req) => {
      const images = refs(req, 16);
      return {
        model: `gpt-image-2-5-${variant}-${images.length ? "image-to-image" : "text-to-image"}`,
        input: {
          prompt: req.prompt, resolution: imageSize(req), aspect_ratio: option(req.aspectRatio, GPT_25_ASPECTS, "auto"),
          ...(images.length ? { input_urls: images } : {}),
        },
      };
    },
  })),
  {
    id: "gpt-image/1-5-text-to-image", kind: "image", name: "GPT Image 1.5",
    options: { aspects: ["1:1", "2:3", "3:2"], resolutions: [], maxCount: 1, maxImages: 16 },
    costUsd: () => .02,
    buildTask: (req) => {
      const images = refs(req, 16);
      return {
        model: images.length ? "gpt-image/1.5-image-to-image" : "gpt-image/1.5-text-to-image",
        input: { prompt: req.prompt, quality: "medium", aspect_ratio: option(req.aspectRatio, ["1:1", "2:3", "3:2"], "1:1"), ...(images.length ? { input_urls: images } : {}) },
      };
    },
  },
  {
    id: "seedream/5-lite-text-to-image", kind: "image", name: "Seedream 5 Lite",
    options: { aspects: SEEDREAM_5_ASPECTS, resolutions: ["2K", "3K", "4K"], maxCount: 1, maxImages: 14, minPromptLength: 4, maxPromptLength: 2995 },
    costUsd: () => .0275,
    buildTask: (req) => {
      const images = refs(req, 14);
      return {
        model: images.length ? "seedream/5-lite-image-to-image" : "seedream/5-lite-text-to-image",
        input: {
          prompt: req.prompt, aspect_ratio: option(req.aspectRatio, SEEDREAM_5_ASPECTS, "1:1"),
          quality: req.resolution === "4K" ? "ultra" : req.resolution === "3K" ? "high" : "basic",
          output_format: "png",
          ...(images.length ? { image_urls: images } : {}),
        },
      };
    },
  },
  {
    id: "seedream/4-5-text-to-image", kind: "image", name: "Seedream 4.5",
    options: { aspects: SEEDREAM_5_ASPECTS, resolutions: ["2K", "4K"], maxCount: 1, maxImages: 14, maxPromptLength: 3000 },
    costUsd: () => .0325,
    buildTask: (req) => {
      const images = refs(req, 14);
      return {
        model: images.length ? "seedream/4.5-edit" : "seedream/4.5-text-to-image",
        input: {
          prompt: req.prompt, aspect_ratio: option(req.aspectRatio, SEEDREAM_5_ASPECTS, "1:1"),
          quality: req.resolution === "4K" ? "high" : "basic", ...(images.length ? { image_urls: images } : {}),
        },
      };
    },
  },
  {
    id: "seedream/seedream-v4-text-to-image", kind: "image", name: "Seedream 4.0",
    options: { aspects: Object.keys(SEEDREAM_4_SIZES), resolutions: IMAGE_SIZES, maxCount: 1, maxImages: 10, maxPromptLength: 5000 },
    costUsd: () => .025,
    buildTask: (req) => {
      const images = refs(req, 10);
      return {
        model: images.length ? "bytedance/seedream-v4-edit" : "bytedance/seedream-v4-text-to-image",
        input: {
          prompt: req.prompt, image_size: SEEDREAM_4_SIZES[option(req.aspectRatio, Object.keys(SEEDREAM_4_SIZES), "1:1")],
          image_resolution: imageSize(req), max_images: 1, ...(images.length ? { image_urls: images } : {}),
        },
      };
    },
  },
  {
    id: "google/nanobanana2", kind: "image", name: "Nano Banana 2",
    options: { aspects: BANANA_2_ASPECTS, resolutions: IMAGE_SIZES, maxCount: 1, maxImages: 10, maxPromptLength: 20000 },
    costUsd: (req) => ({ "1K": .04, "2K": .06, "4K": .09 })[imageSize(req)],
    buildTask: (req) => ({
      model: "nano-banana-2",
      input: { prompt: req.prompt, aspect_ratio: option(req.aspectRatio, BANANA_2_ASPECTS, "auto"), resolution: imageSize(req), ...(firstImage(req) ? { image_input: refs(req, 10) } : {}) },
    }),
  },
  {
    id: "google/nano-banana-2-lite", kind: "image", name: "Nano Banana 2 Lite",
    options: { aspects: BANANA_2_ASPECTS, resolutions: [], maxCount: 1, maxImages: 10, maxPromptLength: 20000 },
    costUsd: () => .02,
    buildTask: (req) => ({
      model: "nano-banana-2-lite",
      input: { prompt: req.prompt, aspect_ratio: option(req.aspectRatio, BANANA_2_ASPECTS, "auto"), ...(firstImage(req) ? { image_urls: refs(req, 10) } : {}) },
    }),
  },
  {
    id: "qwen3-pro/text-to-image", kind: "image", name: "Qwen Image 3.0 Pro",
    options: { aspects: QWEN3_ASPECTS, resolutions: ["1K", "2K"], maxCount: 1, maxImages: 3, maxPromptLength: 5000 },
    costUsd: (req) => (req.resolution === "2K" ? .06 : .032) + refs(req, 3).length * .0025,
    buildTask: (req) => {
      const images = refs(req, 3);
      return {
        model: images.length ? "qwen3/pro-image-to-image" : "qwen3/pro-text-to-image",
        input: {
          prompt: req.prompt, resolution: req.resolution === "2K" ? "2K" : "1K",
          image_size: option(req.aspectRatio, QWEN3_ASPECTS, "1:1"), output_format: "png", ...(images.length ? { image_urls: images } : {}),
        },
      };
    },
  },
  ...([["wan/2-7-image", "Wan 2.7 Image", .024], ["wan/2-7-image-pro", "Wan 2.7 Image Pro", .06]] as const).map(([id, name, usd]): MarketModel => ({
    id, kind: "image", name,
    // 4K Pro is text-only. Offer sizes valid both with and without references.
    options: { aspects: WAN_IMAGE_ASPECTS, resolutions: ["1K", "2K"], defaultResolution: "2K", maxCount: 1, maxImages: 9, maxPromptLength: 5000 },
    costUsd: () => usd,
    buildTask: (req) => {
      const images = refs(req, 9);
      return {
        model: id,
        input: {
          prompt: req.prompt, resolution: req.resolution === "1K" ? "1K" : "2K", n: 1, enable_sequential: false,
          ...(images.length ? { input_urls: images } : { aspect_ratio: option(req.aspectRatio, WAN_IMAGE_ASPECTS, "1:1") }),
        },
      };
    },
  })),
  {
    id: "grok-imagine/text-to-image", kind: "image", name: "Grok Imagine",
    options: { aspects: ["1:1", "2:3", "3:2", "16:9", "9:16"], resolutions: [], maxCount: 1, maxImages: 5 },
    // One speed-mode request returns a pair for $0.02. An edit is $0.02 per generation.
    costUsd: () => .02,
    buildTask: (req) => {
      const images = refs(req, 5);
      return images.length
        ? { model: "grok-imagine/image-to-image", input: { prompt: bindImageTags(req.prompt, images.length, (index) => `@image${index}`), image_urls: images } }
        : { model: "grok-imagine/text-to-image", input: { prompt: req.prompt, aspect_ratio: option(req.aspectRatio, ["1:1", "2:3", "3:2", "16:9", "9:16"], "1:1"), enable_pro: false } };
    },
  },
];

// ---------------------------------------------------------------------------
// Audio models
// ---------------------------------------------------------------------------

/** ElevenLabs voices on KIE (ids from KIE's docs). */
export const ELEVENLABS_VOICES = [
  { id: "EkK5I93UQWFDigLMpZcX", name: "James" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian" },
  { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum" },
  { id: "BZgkqPqms7Kj9ulSkVzn", name: "Eve" },
  { id: "lcMyyd2HUfFzxdCaC4Ta", name: "Lucy" },
  { id: "aD6riP1btT197c6dACmy", name: "Rachel" },
  { id: "LruHrtVF6PSyGItzMNHS", name: "Benjamin" },
];
const GEMINI_VOICES = ["Fola", "Kore", "Puck", "Charon", "Zephyr", "Aoede", "Enceladus", "Leda", "Orus", "Achird"].map((name) => ({ id: name, name }));
const voiceOr = (req: MarketRequest, list: { id: string }[]) => (list.some((v) => v.id === req.voice) ? req.voice! : list[0].id);
const perThousandChars = (usd: number) => (req: MarketRequest) => Math.max(1, req.prompt.length) / 1000 * usd;

const AUDIO_MODELS: MarketModel[] = [
  {
    id: "elevenlabs-v3",
    kind: "audio",
    name: "Eleven v3",
    options: { voices: ELEVENLABS_VOICES, maxPromptLength: 5000 },
    costUsd: perThousandChars(0.07),
    buildTask: (req) => ({
      model: "elevenlabs/text-to-dialogue-v3",
      input: { dialogue: [{ text: req.prompt, voice: voiceOr(req, ELEVENLABS_VOICES) }], ...elevenDialogueInput(req.voiceSettings) },
    }),
  },
  {
    id: "elevenlabs-multilingual-v2",
    kind: "audio",
    name: "Eleven Multilingual v2",
    options: { voices: ELEVENLABS_VOICES, maxPromptLength: 5000 },
    costUsd: perThousandChars(0.06),
    buildTask: (req) => ({
      model: "elevenlabs/text-to-speech-multilingual-v2",
      input: {
        text: req.prompt,
        voice: voiceOr(req, ELEVENLABS_VOICES),
        ...elevenSpeechInput(req.voiceSettings),
        speed: Math.min(1.2, Math.max(0.7, req.speed ?? 1)),
      },
    }),
  },
  {
    id: "elevenlabs-turbo-2-5",
    kind: "audio",
    name: "Eleven Turbo 2.5",
    options: { voices: ELEVENLABS_VOICES, maxPromptLength: 5000 },
    costUsd: perThousandChars(0.03),
    buildTask: (req) => ({
      model: "elevenlabs/text-to-speech-turbo-2-5",
      input: {
        text: req.prompt,
        voice: voiceOr(req, ELEVENLABS_VOICES),
        ...elevenSpeechInput(req.voiceSettings),
        speed: Math.min(1.2, Math.max(0.7, req.speed ?? 1)),
      },
    }),
  },
  {
    id: "gemini-3-8-flash-tts",
    kind: "audio",
    name: "Gemini 3.8 Flash TTS",
    options: { voices: GEMINI_VOICES, maxPromptLength: 5000 },
    // Token-billed and KIE gives no tokens per second; priced above ElevenLabs
    // v3 per 1,000 characters as a safe ceiling until real bills confirm it.
    costUsd: perThousandChars(0.08),
    buildTask: (req) => ({
      model: "google/gemini-3-8-flash-tts",
      input: {
        speakers: [{ speaker_id: "Speaker 1", voice_name: voiceOr(req, GEMINI_VOICES) }],
        dialogue_turns: [{ speaker_id: "Speaker 1", text: req.prompt, ...(req.style ? { style: req.style.slice(0, 500) } : {}) }],
      },
    }),
  },
  {
    id: "suno-music",
    kind: "audio",
    name: "Suno V6",
    options: { maxPromptLength: 3000 },
    costUsd: () => 0.06,
    buildTask: (req) => ({
      model: "ai-music-api/generate",
      input: {
        custom_mode: Boolean(req.customMode),
        instrumental: Boolean(req.instrumental),
        model: "V6",
        prompt: req.prompt.slice(0, 3000),
        // Non-custom mode needs a style (or another attachment) besides the idea.
        style: (req.style || "pop, cinematic").slice(0, 1000),
      },
    }),
  },
  {
    id: "suno-sounds",
    kind: "audio",
    name: "Suno Sounds",
    options: { maxPromptLength: 500 },
    costUsd: () => 0.0125,
    buildTask: (req) => ({ model: "ai-music-api/sounds", input: { prompt: req.prompt.slice(0, 500), model: "V6" } }),
  },
  {
    id: "suno-speech",
    kind: "audio",
    name: "Suno Speech",
    options: { maxPromptLength: 3000 },
    costUsd: () => 0.06,
    buildTask: (req) => ({ model: "ai-music-api/speech", input: { customMode: false, prompt: req.prompt.slice(0, 3000) } }),
  },
];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tools that work on an existing creation
// ---------------------------------------------------------------------------

// PixVerse V6 extend, billed only for the newly added seconds (kie.ai pricing
// data "pixverse-v6, Extend, <quality>(no audio|with audio)", read 2026-11-25).
const PIXVERSE_V6_EXTEND_USD = { "360p": 0.02, "540p": 0.028, "720p": 0.036, "1080p": 0.072 };
const PIXVERSE_V6_EXTEND_AUDIO_USD = { "360p": 0.028, "540p": 0.036, "720p": 0.048, "1080p": 0.092 };

/** Our id for "extend a video"; the source is any of the user's own videos. */
export const EXTEND_MODEL_ID = "pixverse-v6/extend";

// KIE public model-pricing/page (2026-11-25), transformation and motion control.
const klingToolPrice = (req: MarketRequest) =>
  (req.resolution === "1080p" ? 0.151 : 0.1135) * (req.duration ?? 0);
const TOOL_MODELS: MarketModel[] = [
  {
    id: VIDEO_EDIT_MODEL, name: "Kling 3.0 Omni Edit", kind: "video", tool: "edit",
    options: { requiresVideo: true, resolutions: ["720p", "1080p"], durations: secondsBetween(3, 16), minPromptLength: 1, maxPromptLength: 3072 },
    costUsd: klingToolPrice,
    buildTask: req => ({ model: VIDEO_EDIT_MODEL, input: {
      prompt: req.prompt, video_urls: [req.videoUrl], resolution: req.resolution, aspect_ratio: "auto", audio: false,
    } }),
  },
  {
    id: VIDEO_MOTION_MODEL, name: "Kling 3.0 Motion Control", kind: "video", tool: "motion",
    options: { requiresVideo: true, requiresImage: true, maxImages: 1, resolutions: ["720p", "1080p"], durations: secondsBetween(3, 30), maxPromptLength: 2500 },
    costUsd: klingToolPrice,
    buildTask: req => ({ model: VIDEO_MOTION_MODEL, input: {
      ...(req.prompt ? { prompt: req.prompt } : {}), video_urls: [req.videoUrl], input_urls: req.imageUrls,
      mode: req.resolution, character_orientation: req.orientation ?? "video",
    } }),
  },
  {
    id: EXTEND_MODEL_ID,
    kind: "video",
    name: "PixVerse V6 Extend",
    tool: "extend",
    options: {
      resolutions: ["360p", "540p", "720p", "1080p"],
      durations: secondsBetween(1, 15),
      audioToggle: true,
      requiresVideo: true,
      minPromptLength: 3,
      maxPromptLength: 5000,
    },
    costUsd: (req) => perSecond(req.audio ? PIXVERSE_V6_EXTEND_AUDIO_USD : PIXVERSE_V6_EXTEND_USD, "720p")(req, 1, 15, 5),
    buildTask: (req) => ({
      model: "pixverse-v6/extend",
      input: {
        // By URL, so any of the user's videos can be extended, whichever
        // model made it (KIE: MP4/MOV/MKV/AVI/WebM, 50 MB at most).
        video_url: req.videoUrl,
        prompt: req.prompt,
        duration: clampDuration(req, 1, 15, 5),
        quality: req.resolution && req.resolution in PIXVERSE_V6_EXTEND_USD ? req.resolution : "720p",
        seed: req.seed ?? 0,
        generate_audio_switch: Boolean(req.audio),
      },
    }),
  },
];

export const MARKET_MODELS: MarketModel[] = [...VIDEO_MODELS, ...IMAGE_MODELS, ...AUDIO_MODELS, ...TOOL_MODELS];

export function getMarketModel(id: string | undefined | null): MarketModel | undefined {
  if (!id) return undefined;
  return MARKET_MODELS.find((item) => item.id === id);
}

/** Used by the studio, quote and service, including old drafts with a retired size. */
export function imageResolution(model: MarketModel, selected?: string): string | undefined {
  const { resolutions, defaultResolution } = model.options;
  return selected && resolutions?.includes(selected) ? selected : defaultResolution ?? resolutions?.[0];
}

/** Credits charged for one request, from the model's KIE list cost. */
export function marketCredits(model: MarketModel, req: MarketRequest): number {
  const cost = model.costUsd(model.kind === "image" ? { ...req, resolution: imageResolution(model, req.resolution) } : req);
  if (!(cost > 0)) return 0;
  if (model.kind === "video") return videoCreditsFromCost(cost);
  if (model.kind === "image") return imageCreditsFromCost(cost);
  return audioCreditsFromCost(cost);
}

/** Models to pick from in a studio (tools such as extend are left out). */
// A video model with a fixed list of lengths only produces those lengths. Any
// other request is moved to the nearest one (the longer on a tie) so the
// price, the provider request and the saved record all use the same value.
export function allowedDuration(model: MarketModel, duration: number | undefined): number | undefined {
  const choices = model.kind === "video" ? model.options.durations : undefined;
  if (duration === undefined || !choices?.length || choices.includes(duration)) return duration;
  return choices.reduce((best, value) => {
    const gap = Math.abs(value - duration), bestGap = Math.abs(best - duration);
    return gap < bestGap || (gap === bestGap && value > best) ? value : best;
  });
}

export function marketModelsOf(kind: MarketKind): MarketModel[] {
  return MARKET_MODELS.filter((item) => item.kind === kind && !item.tool);
}

/** Credits to extend a video: what the server freezes for the same choice. */
export function extendCredits(choice: { resolution: string; duration: number; audio: boolean }): number {
  const model = getMarketModel(EXTEND_MODEL_ID)!;
  return marketCredits(model, { prompt: "", resolution: choice.resolution, duration: choice.duration, audio: choice.audio });
}
