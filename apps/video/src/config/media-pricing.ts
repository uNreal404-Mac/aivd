// Prices snapshot 2026-10-20 from https://kie.ai/pricing ; 1 kie credit = $0.005.

/** USD price of a single kie.ai credit. */
export const KIE_USD_PER_CREDIT = 0.005;

/** Site credits charged per kie credit (kie 4 cr -> 3 site credits). */
export const SITE_CREDITS_PER_KIE_CREDIT = 0.75;

/**
 * Effective USD value of one site credit at the most expensive
 * ($14.9 / 280) and cheapest ($799 / 34200) credit pack.
 */
export const SITE_CREDIT_USD = {
  highest: 0.0532,
  lowest: 0.0234,
} as const;

export interface MediaModelPricing {
  id: string;
  name: string;
  mediaType: "image" | "audio";
  kieModel: string;
  kieCredits: number;
  siteCredits: number;
  supportsImageInput: boolean;
  enabled: boolean;
  docsUrl: string;
  pricingUrl: string;
}

/**
 * Convert kie credits into the number of site credits we charge.
 * Always at least 1 credit; the tiny epsilon keeps exact multiples exact.
 */
export function kieCreditsToSiteCredits(kieCredits: number): number {
  return Math.max(1, Math.ceil(kieCredits * SITE_CREDITS_PER_KIE_CREDIT - 1e-9));
}

export const IMAGE_MODELS: Record<string, MediaModelPricing> = {
  "nano-banana": {
    id: "nano-banana",
    name: "Nano Banana",
    mediaType: "image",
    kieModel: "google/nano-banana",
    kieCredits: 4,
    siteCredits: kieCreditsToSiteCredits(4),
    supportsImageInput: false,
    enabled: true,
    docsUrl: "https://docs.kie.ai/market/google/nano-banana",
    pricingUrl: "https://kie.ai/nano-banana",
  },
  "nano-banana-edit": {
    id: "nano-banana-edit",
    name: "Nano Banana Edit",
    mediaType: "image",
    kieModel: "google/nano-banana-edit",
    kieCredits: 4,
    siteCredits: kieCreditsToSiteCredits(4),
    supportsImageInput: true,
    enabled: true,
    docsUrl: "https://docs.kie.ai/market/google/nano-banana-edit",
    pricingUrl: "https://kie.ai/nano-banana?model=google%2Fnano-banana-edit",
  },
  "imagen4-fast": {
    id: "imagen4-fast",
    name: "Imagen 4 Fast",
    mediaType: "image",
    kieModel: "google/imagen4-fast",
    kieCredits: 4,
    siteCredits: kieCreditsToSiteCredits(4),
    supportsImageInput: false,
    // Listed for pricing; request schema differs (no output_format /
    // image_input + resolution). Enable after mapping + a paid test.
    enabled: false,
    docsUrl: "https://docs.kie.ai/market/google/imagen4-fast",
    pricingUrl: "https://kie.ai/google/imagen4?model=google%2Fimagen4-fast",
  },
  "seedream-5-flash": {
    id: "seedream-5-flash",
    name: "Seedream 5 Flash",
    mediaType: "image",
    kieModel: "seedream/5-flash-text-to-image",
    kieCredits: 3.24,
    siteCredits: kieCreditsToSiteCredits(3.24),
    supportsImageInput: false,
    enabled: true,
    docsUrl: "https://docs.kie.ai/market/seedream/5-flash-text-to-image",
    pricingUrl: "https://kie.ai/seedream-5-0-flash",
  },
  "nano-banana-2": {
    id: "nano-banana-2",
    name: "Nano Banana 2 (1K)",
    mediaType: "image",
    kieModel: "nano-banana-2",
    kieCredits: 8,
    siteCredits: kieCreditsToSiteCredits(8),
    supportsImageInput: false,
    // Listed for pricing; request schema differs (no output_format /
    // image_input + resolution). Enable after mapping + a paid test.
    enabled: false,
    docsUrl: "https://kie.ai/nano-banana-2",
    pricingUrl: "https://kie.ai/nano-banana-2",
  },
  "nano-banana-pro": {
    id: "nano-banana-pro",
    name: "Nano Banana Pro (1K/2K)",
    mediaType: "image",
    kieModel: "nano-banana-pro",
    kieCredits: 18,
    siteCredits: kieCreditsToSiteCredits(18),
    supportsImageInput: false,
    // Listed for pricing; request schema differs (no output_format /
    // image_input + resolution). Enable after mapping + a paid test.
    enabled: false,
    docsUrl: "https://docs.kie.ai/market/google/pro-image-to-image",
    pricingUrl: "https://kie.ai/nano-banana-pro",
  },
};

export const DEFAULT_IMAGE_MODEL = "nano-banana";

export const AUDIO_MODELS: Record<string, MediaModelPricing> = {
  "suno-v6": {
    id: "suno-v6",
    name: "Suno V6",
    mediaType: "audio",
    kieModel: "ai-music-api/generate",
    kieCredits: 12,
    siteCredits: kieCreditsToSiteCredits(12),
    supportsImageInput: false,
    enabled: true,
    docsUrl: "https://docs.kie.ai/suno-api/generate-music",
    pricingUrl: "https://kie.ai/suno-api?model=ai-music-api%2Fgenerate",
  },
};

export const DEFAULT_AUDIO_MODEL = "suno-v6";

/** Model version sent to the Suno generate endpoint. */
export const SUNO_MODEL_VERSION = "V6";

export function getMediaModel(
  mediaType: "image" | "audio",
  id: string
): MediaModelPricing | null {
  const table = mediaType === "image" ? IMAGE_MODELS : AUDIO_MODELS;
  return table[id] ?? null;
}

/** Gross margin of a model at a given USD value per site credit. */
export function grossMargin(
  model: MediaModelPricing,
  siteCreditUsd: number
): number {
  return (
    1 - (model.kieCredits * KIE_USD_PER_CREDIT) / (model.siteCredits * siteCreditUsd)
  );
}
