// KIE "market" models: one registry entry per model we sell beyond the two
// legacy video models (Veo 3.1 and Wan 2.6, which keep their own mapping in
// model-mapping.ts). Each entry says which KIE model to call, how to build its
// input, what KIE charges for it (list price, see kie-pricing.ts for the
// source), and which options the studio may offer. Request schemas follow
// KIE's documentation pages for each model.
import { ProviderRejectedError } from "./types";
import { isDefiniteRejection } from "./providers/kie";
import { audioCreditsFromCost, imageCreditsFromCost, videoCreditsFromCost } from "@/config/kie-pricing";
import { secondsBetween } from "@/lib/video-durations";

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
  /** Native audio on/off (video models that support it). */
  audio?: boolean;
  /** Voice id (speech models). */
  voice?: string;
  /** Free-form style / voice description (audio models). */
  style?: string;
}

export interface MarketOptions {
  aspects?: string[];
  resolutions?: string[];
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
    id: "kling/v4-reference-to-video",
    kind: "video",
    name: "Kling 4.0",
    options: { aspects: ["16:9", "9:16", "1:1", "21:9"], resolutions: ["720p", "1080p"], durations: secondsBetween(3, 30), maxImages: 4 },
    costUsd: (req) => perSecond(KLING_4_USD, "720p")(req, 3, 30, 5),
    buildTask: (req) => ({
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
];


// ---------------------------------------------------------------------------
// Image models. USD per image are KIE list prices (kie.ai/pricing, 2026-11-18).
// ---------------------------------------------------------------------------

const refs = (req: MarketRequest, max: number) => (req.imageUrls ?? []).slice(0, max);
const count = (req: MarketRequest, max: number) => Math.min(max, Math.max(1, Math.round(req.count ?? 1)));
const IMAGE_ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];

// GPT Image 2.6 is billed per token. KIE's own per-image estimator (medium
// quality) is used at its most expensive shape, 1:1, plus its allowance per
// reference image, so other shapes only cost less.
const GPT_IMAGE_26_USD = { "1K": 0.04, "2K": 0.0795, "4K": 0.1325 };
const GPT_IMAGE_26_REF_USD = 0.011;

const IMAGE_MODELS: MarketModel[] = [
  {
    id: "seedream-5-5",
    kind: "image",
    name: "Seedream 5.5",
    options: { aspects: [...IMAGE_ASPECTS, "21:9"], resolutions: ["1K", "2K"], maxCount: 1, maxImages: 10 },
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
    options: { aspects: ["auto", ...IMAGE_ASPECTS, "21:9"], resolutions: ["1K", "2K", "4K"], maxCount: 1, maxImages: 16 },
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
      input: { dialogue: [{ text: req.prompt, voice: voiceOr(req, ELEVENLABS_VOICES) }], stability: 0.5 },
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
      input: { text: req.prompt, voice: voiceOr(req, ELEVENLABS_VOICES), stability: 0.5, similarity_boost: 0.75, speed: 1 },
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
      input: { text: req.prompt, voice: voiceOr(req, ELEVENLABS_VOICES), stability: 0.5, similarity_boost: 0.75, speed: 1 },
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
        custom_mode: false,
        instrumental: false,
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

export const MARKET_MODELS: MarketModel[] = [...VIDEO_MODELS, ...IMAGE_MODELS, ...AUDIO_MODELS];

export function getMarketModel(id: string | undefined | null): MarketModel | undefined {
  if (!id) return undefined;
  return MARKET_MODELS.find((item) => item.id === id);
}

/** Credits charged for one request, from the model's KIE list cost. */
export function marketCredits(model: MarketModel, req: MarketRequest): number {
  const cost = model.costUsd(req);
  if (!(cost > 0)) return 0;
  if (model.kind === "video") return videoCreditsFromCost(cost);
  if (model.kind === "image") return imageCreditsFromCost(cost);
  return audioCreditsFromCost(cost);
}

export function marketModelsOf(kind: MarketKind): MarketModel[] {
  return MARKET_MODELS.filter((item) => item.kind === kind);
}
