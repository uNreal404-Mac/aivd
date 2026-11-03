import { calculateModelCredits, getAvailableModels, type ModelConfig } from "@/config/credits";

export function getPricingReferenceClip(models: readonly ModelConfig[] = getAvailableModels({ mode: "text-to-video" })) {
  const duration = 4;
  const model = models.find((entry) => entry.id === "seedance-1.5-pro" && entry.enabled !== false);
  const quality = model?.qualities?.find((entry) => entry.toLowerCase() === "720p");
  if (!model?.durations.includes(duration) || !quality) return null;

  const credits = calculateModelCredits(model.id, { duration, quality });
  return Number.isFinite(credits) && credits > 0 ? {
    model: model.name, duration, quality: quality.toLowerCase(), credits,
  } : null;
}

export type PricingReferenceClip = NonNullable<ReturnType<typeof getPricingReferenceClip>>;
