import type { ProviderType } from "@/ai/types";
import { calculateModelCredits, getAvailableModels, getModelConfig, type ModelConfig } from "@/config/credits";
import { textToVideoConfig } from "@/config/tool-pages/text-to-video.config";
import { I2V_MODEL_IDS, MAX_PROMPT_LENGTH } from "@/lib/image-to-video";

export type PremiereMode = "text-to-video" | "image-to-video";

export interface PremiereSettings {
  model: string;
  duration: number;
  aspectRatio: string;
  quality?: string;
}

const IMAGE_DRAFT_KEY = "aidv_premiere_image_draft";

export function getPremiereModels(mode: PremiereMode, provider?: ProviderType): ModelConfig[] {
  const models = getAvailableModels({ mode, provider });
  if (mode === "text-to-video") {
    const allowed = textToVideoConfig.generator.models.available;
    return models.filter((model) => allowed.includes(model.id));
  }

  // The image studio's request supports duration and aspect ratio, but no quality override.
  return models
    .filter((model) => I2V_MODEL_IDS.some((id) => id === model.id))
    .map((model) => ({ ...model, qualities: [] }));
}

export function resolvePremiereSettings(
  models: readonly ModelConfig[],
  candidate: Partial<PremiereSettings> = {},
): PremiereSettings | null {
  const model = models.find((item) => item.id === candidate.model) ?? models[0];
  if (!model || !model.durations.length || !model.aspectRatios.length) return null;

  const duration = candidate.duration ?? 4;
  const aspectRatio = candidate.aspectRatio ?? "16:9";
  const quality = model.qualities?.find((option) =>
    option.toLowerCase() === String(candidate.quality ?? "720p").toLowerCase(),
  );
  return {
    model: model.id,
    duration: model.durations.includes(duration) ? duration : model.durations[0],
    aspectRatio: model.aspectRatios.includes(aspectRatio) ? aspectRatio : model.aspectRatios[0],
    quality: quality ?? model.qualities?.[0],
  };
}

export function estimatePremiereCredits(settings: PremiereSettings | null): number | null {
  if (!settings || !getModelConfig(settings.model)?.creditCost) return null;
  const amount = calculateModelCredits(settings.model, settings);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function savePremiereDraft(mode: PremiereMode, prompt: string, settings: PremiereSettings) {
  const draft = JSON.stringify({ ...settings, prompt });
  if (mode === "image-to-video") {
    sessionStorage.setItem(IMAGE_DRAFT_KEY, draft);
  } else {
    // Match the existing tool-page / gallery prefill contract.
    sessionStorage.removeItem("videofly_tool_prefill_notice");
    sessionStorage.setItem("videofly_tool_prefill", draft);
  }
}

export function takePremiereImageDraft(): (PremiereSettings & { prompt: string }) | null {
  try {
    const raw = sessionStorage.getItem(IMAGE_DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(IMAGE_DRAFT_KEY);
    const draft = JSON.parse(raw);
    if (typeof draft?.prompt !== "string" || draft.prompt.length > MAX_PROMPT_LENGTH) return null;
    const settings = resolvePremiereSettings(getPremiereModels("image-to-video"), draft);
    return settings ? { ...settings, prompt: draft.prompt } : null;
  } catch {
    return null;
  }
}
