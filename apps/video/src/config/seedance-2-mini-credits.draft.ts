/**
 * DRAFT — Seedance 2.0 mini credit mapping.
 *
 * NOT LIVE. This file is the only place the 2.0 mini credit shape exists.
 *
 * Do not:
 * - add `modelId` to VIDEO_MODEL_PRICING in pricing-user.ts
 * - register the id in src/ai/model-mapping.ts or a provider client
 * - import this module from checkout, Stripe, Creem, or /api/v1/video/generate
 * - treat any field here as a retail price
 *
 * Generation stays gated by VIDEO_GENERATION_ENABLED, unchanged.
 *
 * TODO(老板): set retail credits before this mapping is wired into pricing
 * or checkout. Null means "not set". Null is not a price and must not be
 * coerced to 0 for charging.
 */

export const SEEDANCE_2_MINI_CREDIT_DRAFT = {
  draft: true,
  status: "DRAFT",
  modelId: "seedance-2.0-mini",
  displayName: "Seedance 2.0 mini",
  /** Keep false until generation is explicitly approved. */
  enabled: false,
  /** Checkout products are unchanged. */
  wiredToCheckout: false,
  /** Provider calls are unchanged. */
  wiredToGeneration: false,
  /**
   * TODO(老板): retail credits charged per second.
   * Placeholder only — do not invent a live retail number.
   */
  retailCreditsPerSecond: null as number | null,
  /**
   * TODO(老板): optional flat retail base, if the model is not per-second.
   * Placeholder only.
   */
  retailCreditsBase: null as number | null,
  qualityTiers: {
    /** TODO(老板): retail credits for 480p. Placeholder. */
    "480p": null as number | null,
    /** TODO(老板): retail credits for 720p. Placeholder. */
    "720p": null as number | null,
    /** TODO(老板): retail credits for 1080p. Placeholder. */
    "1080p": null as number | null,
  },
  sunsetNote:
    "Seedance 1.5 Pro sunsets around 2026-11-11. This draft does not change live credit charges.",
} as const;
