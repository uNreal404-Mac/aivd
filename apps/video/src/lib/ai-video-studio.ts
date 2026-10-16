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
};

export const STUDIO_MODELS: StudioModel[] = [
  {
    id: "seedance-2",
    name: "Seedance 2.0",
    tagline: "Fast, expressive motion for everyday clips.",
    badge: "Top",
    durations: [5, 8, 10],
    aspects: ["Auto", "16:9", "9:16", "1:1"],
    resolutions: ["720p", "1080p"],
    audio: false,
    creditsPerSecond: 4,
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
  },
  {
    id: "veo-3-1",
    name: "Veo 3.1",
    tagline: "Rich scenes with synchronized sound and depth.",
    durations: [5, 8, 10],
    aspects: ["Auto", "16:9", "9:16", "1:1"],
    resolutions: ["720p", "1080p"],
    audio: true,
    creditsPerSecond: 6,
  },
  {
    id: "wan-2-7",
    name: "Wan 2.7",
    tagline: "Lightweight generation that stays on budget.",
    durations: [5, 8, 10],
    aspects: ["Auto", "16:9", "9:16", "1:1"],
    resolutions: ["720p", "1080p"],
    audio: false,
    creditsPerSecond: 2,
  },
  {
    id: "sora-2",
    name: "Sora 2",
    tagline: "Bold, imaginative results for standout ideas.",
    durations: [5, 8, 10],
    aspects: ["Auto", "16:9", "9:16", "1:1"],
    resolutions: ["720p", "1080p"],
    audio: true,
    creditsPerSecond: 5,
  },
];

export type StudioSettings = {
  modelId: string;
  duration: number;
  aspect: string;
  resolution: string;
  audio: boolean;
  prompt: string;
};

export function defaultSettings(model?: StudioModel): StudioSettings {
  const selected = model ?? STUDIO_MODELS[0];

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

  if (!next) {
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
): { ok: boolean; reason?: "empty-prompt" | "disabled" } {
  if (settings.prompt.trim() === "") {
    return { ok: false, reason: "empty-prompt" };
  }

  if (!generationEnabled) {
    return { ok: false, reason: "disabled" };
  }

  return { ok: true };
}

export const RESULT_FILTERS = ["All", "Videos", "Favorites"] as const;
export const RIGHT_TABS = ["History", "Library", "How it works"] as const;

export const BACKEND_MODEL_IDS: Record<string, string | null> = {
  "seedance-2": "seedance-1.5-pro",
  "kling-3": null,
  "veo-3-1": "veo-3.1",
  "wan-2-7": "wan2.6",
  "sora-2": "sora-2",
};

export type GenerateRequestBody = {
  prompt: string;
  model: string;
  duration: number;
  aspectRatio: string;
  quality: string;
  generateAudio: boolean;
  idempotencyKey: string;
};

export type BuildGenerateRequestResult =
  | { ok: true; body: GenerateRequestBody }
  | { ok: false; reason: "empty-prompt" | "unsupported-model" };

export function buildGenerateRequest(
  settings: StudioSettings,
  idempotencyKey: string,
): BuildGenerateRequestResult {
  const prompt = settings.prompt.trim();

  if (prompt === "") {
    return { ok: false, reason: "empty-prompt" };
  }

  const model = BACKEND_MODEL_IDS[settings.modelId];

  if (!model) {
    return { ok: false, reason: "unsupported-model" };
  }

  return {
    ok: true,
    body: {
      prompt,
      model,
      duration: settings.duration,
      aspectRatio: settings.aspect,
      quality: settings.resolution,
      generateAudio: settings.audio,
      idempotencyKey,
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
): Promise<SubmitGenerationResult> {
  const request = buildGenerateRequest(settings, idempotencyKey);

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
