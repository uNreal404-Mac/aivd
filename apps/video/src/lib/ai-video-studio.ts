import { KLING_KEYFRAME_MODEL, type KlingKeyframes } from "./kling-keyframes";
import { validFrameCount } from "./studio-keyframes";
import { WAN_REFERENCE_MAX_FILES } from "./wan-video-references";
import { calculateModelCredits } from "@/config/credits";
import { allowedDuration, getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";
import { promptWithPreset } from "@/lib/video-presets";
import examplePrompts from "@/lib/home-example-prompts.json";
import { secondsBetween } from "@/lib/video-durations";
import type { GenerationParameters } from "@/lib/generation-details";

export type StudioModel = {
  id: string;
  name: string;
  tagline: string;
  badge?: "New" | "Top";
  durations: number[];
  aspects: string[];
  resolutions: string[];
  audio: boolean;
  available: boolean;
};

export const STUDIO_MODELS: StudioModel[] = [
  {
    id: "veo-3.1",
    name: "Veo 3.1",
    tagline: "Rich scenes with synchronized sound and depth.",
    badge: "Top",
    durations: [8],
    aspects: ["16:9", "9:16"],
    // 720p only: asking KIE for "1080p" switches to the Quality tier at about
    // four times the cost without a guaranteed 1080p render.
    resolutions: ["720p"],
    audio: true,
    available: true,
  },
  {
    id: "wan2.6",
    name: "Wan 2.6",
    tagline: "Lightweight generation that stays on budget.",
    durations: [5, 10, 15],
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    resolutions: ["720p", "1080p"],
    audio: false,
    available: true,
  },
  // Off sale: no verified KIE cost to price them from (see kie-pricing.ts).
  {
    id: "seedance-1.5-pro",
    name: "Seedance 1.5 Pro",
    tagline: "Fast, expressive motion for everyday clips.",
    durations: secondsBetween(4, 12),
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    resolutions: ["480p", "720p", "1080p"],
    audio: false,
    available: false,
  },
  {
    id: "sora-2",
    name: "Sora 2",
    tagline: "Bold, imaginative results for standout ideas.",
    durations: [10, 15],
    aspects: ["16:9", "9:16"],
    resolutions: ["720p"],
    audio: true,
    available: false,
  },
  {
    id: "kling-3",
    name: "Kling 3.0",
    tagline: "Cinematic detail with steady, natural movement.",
    badge: "New",
    durations: secondsBetween(3, 15),
    aspects: ["Auto", "16:9", "9:16", "1:1"],
    resolutions: ["720p", "1080p"],
    audio: true,
    available: false,
  },
];

// KIE market video models, with the options each one accepts.
STUDIO_MODELS.push(
  ...marketModelsOf("video").map(
    (model): StudioModel => ({
      id: model.id,
      name: model.name,
      tagline: "",
      durations: model.options.durations ?? [5],
      aspects: model.options.aspects ?? ["16:9"],
      resolutions: model.options.resolutions ?? ["720p"],
      audio: Boolean(model.options.audioToggle),
      available: true,
    }),
  ),
);

export const UNAVAILABLE_LABEL = "暂不可用";

export type StudioSettings = {
  modelId: string;
  duration: number;
  aspect: string;
  resolution: string;
  audio: boolean;
  prompt: string;
  preset?: string;
};

export const PROMPT_PARAM_MAX = 10000;
export const PRESET_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function defaultSettings(model?: StudioModel): StudioSettings {
  const selected =
    model ??
    STUDIO_MODELS.find((item) => item.available) ??
    STUDIO_MODELS[0];

  return {
    modelId: selected.id,
    duration: selected.durations[0],
    aspect: selected.aspects[0],
    resolution: selected.resolutions[0],
    audio: selected.audio,
    prompt: "",
  };
}

export function selectModel(
  settings: StudioSettings,
  modelId: string,
): StudioSettings {
  const next = STUDIO_MODELS.find((model) => model.id === modelId);

  if (!next || !next.available) {
    return settings;
  }

  return {
    ...settings,
    modelId: next.id,
    duration: next.durations.includes(settings.duration)
      ? settings.duration
      : next.durations[0],
    aspect: next.aspects.includes(settings.aspect)
      ? settings.aspect
      : next.aspects[0],
    resolution: next.resolutions.includes(settings.resolution)
      ? settings.resolution
      : next.resolutions[0],
    audio: next.audio ? settings.audio : false,
  };
}

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function settingsFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): StudioSettings {
  let settings = defaultSettings();

  const modelParam = firstParam(params.model);

  if (modelParam) {
    const model = STUDIO_MODELS.find(
      (item) => item.id === modelParam && item.available,
    );

    if (model) {
      settings = selectModel(settings, model.id);
    }
  }

  const sampleId = firstParam(params.sample) ?? "";
  const samplePrompt = Object.prototype.hasOwnProperty.call(examplePrompts, sampleId)
    ? examplePrompts[sampleId as keyof typeof examplePrompts]
    : "";
  const promptParam = firstParam(params.prompt) ?? samplePrompt;
  const prompt = promptParam.trim().slice(0, PROMPT_PARAM_MAX);

  const durationParam = Number(firstParam(params.duration));
  if (settings.modelId && Number.isInteger(durationParam)) {
    const model = STUDIO_MODELS.find((item) => item.id === settings.modelId);
    if (model?.durations.includes(durationParam)) {
      settings = { ...settings, duration: durationParam };
    }
  }

  const aspectParam = firstParam(params.aspect);
  if (aspectParam) {
    const model = STUDIO_MODELS.find((item) => item.id === settings.modelId);
    if (model?.aspects.includes(aspectParam) && aspectParam !== "Auto") {
      settings = { ...settings, aspect: aspectParam };
    }
  }

  const selectedModel = STUDIO_MODELS.find((item) => item.id === settings.modelId);
  const resolutionParam = firstParam(params.resolution);
  if (resolutionParam && selectedModel?.resolutions.includes(resolutionParam)) {
    settings = { ...settings, resolution: resolutionParam };
  }
  const audioParam = firstParam(params.audio);
  if (selectedModel?.audio && (audioParam === "true" || audioParam === "false")) {
    settings = { ...settings, audio: audioParam === "true" };
  }

  const presetParam = firstParam(params.preset);
  const preset = presetParam ? presetParam.toLowerCase().trim() : undefined;

  return {
    ...settings,
    prompt,
    preset: preset && PRESET_PATTERN.test(preset) ? preset : undefined,
  };
}

/**
 * Credits a generation with these settings will cost. Delegates to the same
 * function the server charges with (`videoService.generate`), so the number
 * shown in the UI is the number frozen on submit. Audio does not change the
 * price; resolution is passed as the server's `quality`.
 */
/**
 * Credits a clip will take. Pass `images` (reference images sent with it) and
 * `audio` where they are known: some models charge for an input image or for
 * sound, and the quote shown before Generate must be what the server freezes
 * (services/video.ts prices market models the same way).
 */
export function estimateCredits(
  settings: Pick<StudioSettings, "modelId" | "duration" | "resolution">,
  extras?: { images?: number; audio?: boolean },
): number {
  const market = extras ? getMarketModel(settings.modelId) : undefined;
  if (market) {
    return marketCredits(market, {
      prompt: "",
      // The server bills the nearest length the model makes.
      duration: allowedDuration(market, settings.duration),
      resolution: settings.resolution,
      audio: market.options.audioToggle ? (extras?.audio ?? true) : undefined,
      imageUrls: Array.from({ length: extras?.images ?? 0 }, (_, index) => `reference-${index}`),
    });
  }
  return calculateModelCredits(settings.modelId, {
    duration: settings.duration,
    quality: settings.resolution,
  });
}

export function canGenerate(
  settings: StudioSettings,
  generationEnabled: boolean,
): {
  ok: boolean;
  reason?: "empty-prompt" | "disabled" | "unavailable-model";
} {
  if (settings.prompt.trim() === "") {
    return { ok: false, reason: "empty-prompt" };
  }

  const model = STUDIO_MODELS.find((item) => item.id === settings.modelId);

  if (!model || !model.available) {
    return { ok: false, reason: "unavailable-model" };
  }

  if (!generationEnabled) {
    return { ok: false, reason: "disabled" };
  }

  return { ok: true };
}

export const RESULT_FILTERS = ["All", "Videos", "Favorites"] as const;
export const RIGHT_TABS = ["History", "Library", "How it works"] as const;

export type GenerateRequestBody = {
  prompt: string;
  model: string;
  duration: number;
  aspectRatio?: string;
  quality: string;
  generateAudio?: boolean;
  idempotencyKey: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoKeys?: string[];
  keyframes?: KlingKeyframes;
  mode?: "text-to-video" | "image-to-video" | "reference-to-video";
  preset?: string;
};

export type BuildGenerateRequestResult =
  | { ok: true; body: GenerateRequestBody }
  | { ok: false; reason: "empty-prompt" | "unsupported-model" | "invalid-video-references" | "invalid-keyframes" };

export function buildGenerateRequest(
  settings: StudioSettings,
  idempotencyKey: string,
  imageKey?: string | string[] | null,
  videoKeys: string[] = [],
  keyframes?: KlingKeyframes,
): BuildGenerateRequestResult {
  const prompt = settings.prompt.trim();

  if (prompt === "") {
    return { ok: false, reason: "empty-prompt" };
  }

  const model = STUDIO_MODELS.find((item) => item.id === settings.modelId);

  if (!model || !model.available) {
    return { ok: false, reason: "unsupported-model" };
  }

  const imageKeys = Array.isArray(imageKey) ? imageKey : imageKey ? [imageKey] : [];

  if (keyframes && (model.id !== KLING_KEYFRAME_MODEL || imageKeys.length || videoKeys.length || !validFrameCount(keyframes, settings.duration))) {
    return { ok: false, reason: "invalid-keyframes" };
  }
  if (videoKeys.length && (settings.modelId !== "wan2.6" || imageKeys.length > 0 || videoKeys.length > WAN_REFERENCE_MAX_FILES || videoKeys.some(key => !key.startsWith("uploads/")))) {
    return { ok: false, reason: "invalid-video-references" };
  }

  return {
    ok: true,
    body: {
      prompt: promptWithPreset(prompt, settings.preset),
      model: settings.modelId,
      duration: settings.duration,
      ...(!videoKeys.length && !keyframes ? { aspectRatio: settings.aspect } : {}),
      quality: settings.resolution,
      ...(!videoKeys.length && !keyframes ? { generateAudio: settings.audio } : {}),
      idempotencyKey,
      ...(settings.preset ? { preset: settings.preset } : {}),
      ...(keyframes ? { keyframes, mode: "reference-to-video" as const } : {}),
      ...(videoKeys.length ? { videoKeys, mode: "reference-to-video" as const } : {}),
      ...(imageKeys.length === 1 ? { imageUrl: imageKeys[0], mode: "image-to-video" as const } : {}),
      ...(imageKeys.length > 1 ? { imageUrls: imageKeys, mode: "reference-to-video" as const } : {}),
    },
  };
}

type GenerateResponsePayload = {
  success?: boolean;
  data?: {
    videoUuid?: string | null;
    taskId?: string | null;
    status?: string | null;
    errorMessage?: string | null;
  } | null;
  error?: {
    message?: string;
    details?: { code?: string; requiredCredits?: number; videoUuid?: string } | null;
  } | null;
};

export type SubmitGenerationResult =
  | { ok: true; videoUuid: string | null; taskId: string | null }
  | { ok: false; message: string; code?: string; requiredCredits?: number };

export async function submitGeneration(
  settings: StudioSettings,
  idempotencyKey: string,
  fetchImpl: typeof fetch = fetch,
  imageKey?: string | string[] | null,
  videoKeys: string[] = [],
  expectedAccount?: string,
  keyframes?: KlingKeyframes,
): Promise<SubmitGenerationResult> {
  const request = buildGenerateRequest(settings, idempotencyKey, imageKey, videoKeys, keyframes);

  if (!request.ok) {
    return {
      ok: false,
      message:
        request.reason === "empty-prompt"
          ? "Please enter a prompt."
          : request.reason === "invalid-keyframes" ? "Select keyframes for Kling 4.0 within the limit for this duration."
          : request.reason === "invalid-video-references" ? "Wan 2.6 accepts up to three uploaded video references without any images." : "This model is not available yet.",
    };
  }

  let response: Response;

  try {
    response = await fetchImpl("/api/v1/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        ...(expectedAccount ? { "X-Media-Account": expectedAccount } : {}),
      },
      body: JSON.stringify(request.body),
    });
  } catch {
    return { ok: false, message: "Network error. Please try again.", code: "NETWORK" };
  }

  if (response.status === 401) {
    return { ok: false, message: "Please sign in to generate.", code: "UNAUTHORIZED" };
  }

  let payload: GenerateResponsePayload | null = null;

  try {
    payload = (await response.json()) as GenerateResponsePayload;
  } catch {
    payload = null;
  }

  if (response.status === 202 && payload?.error?.details?.videoUuid) {
    return { ok: true, videoUuid: payload.error.details.videoUuid, taskId: null };
  }
  if (!payload) {
    return { ok: false, message: "No response yet. Retry the same request.", code: "NETWORK" };
  }
  if (payload?.success) {
    if (payload.data?.status === "FAILED") {
      const rawError = typeof payload.data.errorMessage === "string" ? payload.data.errorMessage : "";
      const creditMatch = /\bInsufficient credits\.\s*Required:\s*(\d+)/i.exec(rawError);
      if (creditMatch || /insufficient credits/i.test(rawError)) {
        return {
          ok: false,
          message: rawError || "Insufficient credits.",
          code: "INSUFFICIENT_CREDITS",
          requiredCredits: creditMatch ? Number(creditMatch[1]) : undefined,
        };
      }
      return {
        ok: false,
        message: "The previous submission failed and no credits were kept. Try again.",
        code: "GENERATION_FAILED",
      };
    }
    return {
      ok: true,
      videoUuid: payload.data?.videoUuid ?? null,
      taskId: payload.data?.taskId ?? null,
    };
  }

  const message =
    payload?.error?.message ?? "Generation failed. Please try again.";
  const code = payload?.error?.details?.code;

  const requiredCredits = payload?.error?.details?.requiredCredits;
  if (code === "INSUFFICIENT_CREDITS" && typeof requiredCredits === "number") return { ok: false, message, code, requiredCredits };

  return code ? { ok: false, message, code } : { ok: false, message };
}

/* -------------------------------------------------------------------------- */
/* Results: status polling and history                                        */
/* -------------------------------------------------------------------------- */

export type StudioResultStatus =
  | "submitting"
  | "queued"
  | "generating"
  | "completed"
  | "failed";

export type StudioResult = {
  id: string;
  status: StudioResultStatus;
  videoUuid?: string | null;
  videoUrl?: string | null;
  prompt?: string | null;
  message?: string | null;
  model?: string;
  parameters?: GenerationParameters | null;
  resolution?: string;
  audio?: boolean;
  /** When the clip was submitted (ms), for the elapsed timer. */
  createdAt?: number;
};

export const RESULT_POLL_INTERVAL_MS = 5000;
export const RESULT_HISTORY_LIMIT = 12;

/** Map a server VideoStatus onto the four states the studio renders. */
export function toStudioStatus(status: unknown): StudioResultStatus {
  switch (typeof status === "string" ? status.toUpperCase() : "") {
    case "COMPLETED":
      return "completed";
    case "FAILED":
      return "failed";
    case "GENERATING":
    case "UPLOADING":
      return "generating";
    default:
      return "queued";
  }
}

export function isResultPending(result: StudioResult): boolean {
  return (
    Boolean(result.videoUuid) &&
    (result.status === "queued" || result.status === "generating")
  );
}

type StatusPayload = {
  success?: boolean;
  data?: { status?: string; videoUrl?: string; error?: string; model?: string; parameters?: GenerationParameters | null; duration?: number | null; aspectRatio?: string | null; resolution?: string | null } | null;
};

export type FetchResultStatus =
  | {
      ok: true;
      status: StudioResultStatus;
      videoUrl: string | null;
      message: string | null;
      model?: string;
      parameters?: GenerationParameters | null;
    }
  | { ok: false };

/**
 * Ask the server for the latest state of one generation. The endpoint also
 * refreshes from the provider, so this is what moves a clip to completed when
 * the provider callback has not arrived. Any failure is reported as
 * `{ ok: false }` so the caller keeps the previous state and tries again.
 */
export async function fetchResultStatus(
  videoUuid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchResultStatus> {
  try {
    const response = await fetchImpl(
      `/api/v1/video/${encodeURIComponent(videoUuid)}/status`,
      { cache: "no-store" },
    );
    if (response.status !== 200) {
      return { ok: false };
    }
    const payload = (await response.json()) as StatusPayload;
    if (!payload?.success || !payload.data) {
      return { ok: false };
    }
    const parameters = {
      ...(payload.data.parameters ?? {}),
      ...(!payload.data.parameters?.duration && payload.data.duration ? { duration: payload.data.duration } : {}),
      ...(!payload.data.parameters?.aspectRatio && payload.data.aspectRatio ? { aspectRatio: payload.data.aspectRatio } : {}),
      ...(!payload.data.parameters?.resolution && !payload.data.parameters?.quality && payload.data.resolution ? { resolution: payload.data.resolution } : {}),
    };
    return {
      ok: true,
      status: toStudioStatus(payload.data.status),
      videoUrl: payload.data.videoUrl ?? null,
      message: payload.data.error ?? null,
      ...(payload.data.model ? { model: payload.data.model } : {}),
      ...(Object.keys(parameters).length ? { parameters } : {}),
    };
  } catch {
    return { ok: false };
  }
}

type ListPayload = {
  success?: boolean;
  data?: {
    videos?: Array<{
      uuid?: string;
      status?: string;
      videoUrl?: string | null;
      prompt?: string | null;
      errorMessage?: string | null;
      model?: string;
      resolution?: string | null;
      parameters?: GenerationParameters | null;
      duration?: number | null;
      aspectRatio?: string | null;
      createdAt?: string | number | null;
    }>;
  } | null;
};

/**
 * Load the signed-in user's most recent generations, newest first. Returns an
 * empty list when signed out or on any error: history is a convenience and
 * must never block the studio.
 */
export async function fetchRecentResults(
  fetchImpl: typeof fetch = fetch,
  limit: number = RESULT_HISTORY_LIMIT,
  options?: { completedOnly?: boolean; onError?: () => void },
): Promise<StudioResult[]> {
  try {
    const filter = options?.completedOnly ? "&status=COMPLETED" : "";
    const response = await fetchImpl(`/api/v1/video/list?type=video&limit=${limit}${filter}`, {
      cache: "no-store",
    });
    if (response.status !== 200) {
      options?.onError?.();
      return [];
    }
    const payload = (await response.json()) as ListPayload;
    if (!payload?.success || !Array.isArray(payload.data?.videos)) {
      options?.onError?.();
      return [];
    }
    const results: StudioResult[] = [];
    for (const video of payload.data.videos) {
      if (!video?.uuid) continue;
      const parameters = {
        ...(video.parameters ?? {}),
        ...(!video.parameters?.duration && video.duration ? { duration: video.duration } : {}),
        ...(!video.parameters?.aspectRatio && video.aspectRatio ? { aspectRatio: video.aspectRatio } : {}),
        ...(!video.parameters?.resolution && !video.parameters?.quality && video.resolution ? { resolution: video.resolution } : {}),
      };
      results.push({
        id: video.uuid,
        videoUuid: video.uuid,
        status: toStudioStatus(video.status),
        videoUrl: video.videoUrl ?? null,
        prompt: video.prompt ?? null,
        message: video.errorMessage ?? null,
        model: video.model,
        resolution: (video.parameters?.resolution ?? video.parameters?.quality ?? video.resolution ?? undefined) as string | undefined,
        audio: (video.parameters?.audio ?? video.parameters?.generateAudio) as boolean | undefined,
        ...(Object.keys(parameters).length ? { parameters } : {}),
        createdAt: toMillis(video.createdAt),
      });
    }
    return results;
  } catch {
    options?.onError?.();
    return [];
  }
}

/**
 * Merge server history into the local list. Local entries win (they may be
 * newer than the history snapshot) and keep their position at the top.
 */
export function mergeResults(
  local: StudioResult[],
  history: StudioResult[],
): StudioResult[] {
  const seen = new Set(local.map((item) => item.id));
  return [...local, ...history.filter((item) => !seen.has(item.id))];
}

/** Apply one status poll to the list, leaving other entries untouched. */
export function applyResultStatus(
  results: StudioResult[],
  videoUuid: string,
  update: FetchResultStatus,
): StudioResult[] {
  if (!update.ok) {
    return results;
  }
  return results.map((item) =>
    item.videoUuid === videoUuid
      ? {
          ...item,
          status: update.status,
          videoUrl: update.videoUrl ?? item.videoUrl ?? null,
          message: update.message ?? item.message ?? null,
          model: update.model ?? item.model,
          parameters: update.parameters ?? item.parameters,
        }
      : item,
  );
}

/** A timestamp from the API (ISO string, seconds or milliseconds) in ms. */
export function toMillis(value: string | number | null | undefined): number | undefined {
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  return value ? Date.parse(value) || undefined : undefined;
}

/** A model the account could switch to, with what one clip would cost there. */
export type ModelOption = { id: string; name: string; credits: number };

/**
 * What one clip costs on each of these models, keeping the current length,
 * ratio, quality and sound where the model offers them (the same switch the
 * model picker makes).
 */
export function modelOptions(settings: StudioSettings, modelIds: string[], images = 0): ModelOption[] {
  return modelIds.flatMap((id) => {
    const model = STUDIO_MODELS.find((item) => item.id === id && item.available);
    if (!model) return [];
    // Priced with this clip's reference images and sound, as it would be frozen.
    const switched = selectModel(settings, id);
    const credits = estimateCredits(switched, { images, audio: switched.audio });
    return credits > 0 ? [{ id, name: model.name, credits }] : [];
  });
}

/**
 * When the balance does not cover this clip: the dearest other model whose
 * clip it does cover, the closest thing to what was asked for that the
 * account can pay for. Undefined when nothing fits.
 */
export function bestAffordableModel(options: ModelOption[], currentId: string, available: number): ModelOption | undefined {
  return options
    .filter((option) => option.id !== currentId && option.credits <= available)
    .sort((a, b) => b.credits - a.credits)[0];
}
