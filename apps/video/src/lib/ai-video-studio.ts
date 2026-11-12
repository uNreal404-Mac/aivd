export type StudioModel = {
  id: string;
  name: string;
  tagline: string;
  badge?: "New" | "Top";
  durations: number[];
  aspects: string[];
  resolutions: string[];
  audio: boolean;
  creditsPerSecond: number;
  available: boolean;
};

export const STUDIO_MODELS: StudioModel[] = [
  {
    id: "seedance-1.5-pro",
    name: "Seedance 1.5 Pro",
    tagline: "Fast, expressive motion for everyday clips.",
    badge: "Top",
    durations: [4, 5, 6, 8, 10, 12],
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    resolutions: ["480p", "720p", "1080p"],
    audio: false,
    creditsPerSecond: 4,
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
    creditsPerSecond: 2,
    available: true,
  },
  {
    id: "veo-3.1",
    name: "Veo 3.1",
    tagline: "Rich scenes with synchronized sound and depth.",
    durations: [8],
    aspects: ["16:9", "9:16"],
    resolutions: ["720p"],
    audio: true,
    creditsPerSecond: 6,
    available: true,
  },
  {
    id: "sora-2",
    name: "Sora 2",
    tagline: "Bold, imaginative results for standout ideas.",
    durations: [10, 15],
    aspects: ["16:9", "9:16"],
    resolutions: ["720p"],
    audio: true,
    creditsPerSecond: 5,
    available: true,
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
    creditsPerSecond: 5,
    available: false,
  },
];

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

export function estimateCredits(settings: StudioSettings): number {
  const model = STUDIO_MODELS.find((item) => item.id === settings.modelId);
  const rate = model ? model.creditsPerSecond : 0;

  const resolutionFactor = settings.resolution === "1080p" ? 1.5 : 1;
  const audioFactor = settings.audio ? 1.2 : 1;

  return Math.ceil(
    settings.duration * rate * resolutionFactor * audioFactor,
  );
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
  imageUrls?: string[];
  mode?: "text-to-video" | "image-to-video";
};

export type BuildGenerateRequestResult =
  | { ok: true; body: GenerateRequestBody }
  | { ok: false; reason: "empty-prompt" | "unsupported-model" };

export function buildGenerateRequest(
  settings: StudioSettings,
  idempotencyKey: string,
  imageKey?: string | null,
  referenceKeys: string[] = [],
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
      ...(referenceKeys.length
        ? { imageUrls: [...(imageKey ? [imageKey] : []), ...referenceKeys], mode: "image-to-video" as const }
        : imageKey ? { imageUrl: imageKey, mode: "image-to-video" as const } : {}),
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
  referenceKeys: string[] = [],
): Promise<SubmitGenerationResult> {
  const request = buildGenerateRequest(settings, idempotencyKey, imageKey, referenceKeys);

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
