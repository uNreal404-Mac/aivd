import { calculateModelCredits } from "@/config/credits";
import { marketModelsOf } from "@/ai/kie-market";

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
    durations: [4, 5, 6, 8, 10, 12],
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
    durations: [5, 8, 10],
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

export const PROMPT_PARAM_MAX = 5000;
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

  const promptParam = firstParam(params.prompt) ?? "";
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
export function estimateCredits(
  settings: Pick<StudioSettings, "modelId" | "duration" | "resolution">,
): number {
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
  aspectRatio: string;
  quality: string;
  generateAudio: boolean;
  idempotencyKey: string;
  imageUrl?: string;
  mode?: "text-to-video" | "image-to-video";
};

export type BuildGenerateRequestResult =
  | { ok: true; body: GenerateRequestBody }
  | { ok: false; reason: "empty-prompt" | "unsupported-model" };

export function buildGenerateRequest(
  settings: StudioSettings,
  idempotencyKey: string,
  imageKey?: string | null,
): BuildGenerateRequestResult {
  const prompt = settings.prompt.trim();

  if (prompt === "") {
    return { ok: false, reason: "empty-prompt" };
  }

  const model = STUDIO_MODELS.find((item) => item.id === settings.modelId);

  if (!model || !model.available) {
    return { ok: false, reason: "unsupported-model" };
  }

  return {
    ok: true,
    body: {
      prompt,
      model: settings.modelId,
      duration: settings.duration,
      aspectRatio: settings.aspect,
      quality: settings.resolution,
      generateAudio: settings.audio,
      idempotencyKey,
      ...(imageKey ? { imageUrl: imageKey, mode: "image-to-video" as const } : {}),
    },
  };
}

type GenerateResponsePayload = {
  success?: boolean;
  data?: {
    videoUuid?: string | null;
    taskId?: string | null;
  } | null;
  error?: {
    message?: string;
    details?: { code?: string } | null;
  } | null;
};

export type SubmitGenerationResult =
  | { ok: true; videoUuid: string | null; taskId: string | null }
  | { ok: false; message: string; code?: string };

export async function submitGeneration(
  settings: StudioSettings,
  idempotencyKey: string,
  fetchImpl: typeof fetch = fetch,
  imageKey?: string | null,
): Promise<SubmitGenerationResult> {
  const request = buildGenerateRequest(settings, idempotencyKey, imageKey);

  if (!request.ok) {
    return {
      ok: false,
      message:
        request.reason === "empty-prompt"
          ? "Please enter a prompt."
          : "This model is not available yet.",
    };
  }

  let response: Response;

  try {
    response = await fetchImpl("/api/v1/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(request.body),
    });
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }

  if (response.status === 401) {
    return { ok: false, message: "Please sign in to generate." };
  }

  let payload: GenerateResponsePayload | null = null;

  try {
    payload = (await response.json()) as GenerateResponsePayload;
  } catch {
    payload = null;
  }

  if (payload?.success) {
    return {
      ok: true,
      videoUuid: payload.data?.videoUuid ?? null,
      taskId: payload.data?.taskId ?? null,
    };
  }

  const message =
    payload?.error?.message ?? "Generation failed. Please try again.";
  const code = payload?.error?.details?.code;

  return code ? { ok: false, message, code } : { ok: false, message };
}

/* -------------------------------------------------------------------------- */
/* Results: status polling and history                                        */
/* -------------------------------------------------------------------------- */

export type StudioResultStatus =
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
  data?: { status?: string; videoUrl?: string; error?: string } | null;
};

export type FetchResultStatus =
  | {
      ok: true;
      status: StudioResultStatus;
      videoUrl: string | null;
      message: string | null;
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
    return {
      ok: true,
      status: toStudioStatus(payload.data.status),
      videoUrl: payload.data.videoUrl ?? null,
      message: payload.data.error ?? null,
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
): Promise<StudioResult[]> {
  try {
    const response = await fetchImpl(`/api/v1/video/list?limit=${limit}`, {
      cache: "no-store",
    });
    if (response.status !== 200) {
      return [];
    }
    const payload = (await response.json()) as ListPayload;
    if (!payload?.success || !Array.isArray(payload.data?.videos)) {
      return [];
    }
    const results: StudioResult[] = [];
    for (const video of payload.data.videos) {
      if (!video?.uuid) continue;
      results.push({
        id: video.uuid,
        videoUuid: video.uuid,
        status: toStudioStatus(video.status),
        videoUrl: video.videoUrl ?? null,
        prompt: video.prompt ?? null,
        message: video.errorMessage ?? null,
      });
    }
    return results;
  } catch {
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
        }
      : item,
  );
}
