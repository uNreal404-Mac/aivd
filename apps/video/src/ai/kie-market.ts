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
    options: { aspects: ["16:9"], resolutions: ["1080p"], durations: [6], maxImages: 1 },
    costUsd: () => 0.285,
    buildTask: (req) => firstImage(req)
      ? { model: "hailuo/02-image-to-video-pro", input: { prompt: req.prompt.slice(0, 1500), image_url: firstImage(req), prompt_optimizer: true } }
      : { model: "hailuo/02-text-to-video-pro", input: { prompt: req.prompt.slice(0, 1500), prompt_optimizer: true } },
  },
  {
    id: "hailuo/02-text-to-video-standard",
    kind: "video",
    name: "MiniMax Hailuo 02 Standard",
    options: { aspects: ["16:9"], resolutions: ["768p"], durations: [6, 10], maxImages: 1 },
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
export function marketModelsOf(kind: MarketKind): MarketModel[] {
  return MARKET_MODELS.filter((item) => item.kind === kind && !item.tool);
}

/** Credits to extend a video: what the server freezes for the same choice. */
export function extendCredits(choice: { resolution: string; duration: number; audio: boolean }): number {
  const model = getMarketModel(EXTEND_MODEL_ID)!;
  return marketCredits(model, { prompt: "", resolution: choice.resolution, duration: choice.duration, audio: choice.audio });
}
