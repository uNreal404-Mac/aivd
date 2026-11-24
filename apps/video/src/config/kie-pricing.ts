// Credit prices derived from KIE's public price list.
//
// Source: POST https://api.kie.ai/client/v1/model-pricing/page (the data behind
// https://kie.ai/pricing), read on 2026-11-20. These are list prices, not
// invoiced costs: re-check them against a real KIE bill before relying on the
// margins, and re-run the numbers whenever KIE changes a price.
//
// Video: a clip is priced at its KIE cost times VIDEO_MARKUP plus a flat
// VIDEO_FIXED_USD, then turned into credits at CREDIT_LIST_USD and rounded up
// to 5. The flat part makes cheap clips carry a high multiple (a $0.06 clip
// sells at about 5x) and dear clips a low one (about 2x), which is how the
// market prices them. As the cost grows, the KIE cost behind one credit tends
// to CREDIT_LIST_USD / VIDEO_MARKUP and never exceeds it: that ceiling is
// MAX_VIDEO_COST_PER_CREDIT_USD, and every plan must net more than it per
// credit (tests/kie-pricing.test.ts).
//
// Images and audio keep the earlier rule: cost plus 15% plus a small delivery
// allowance, divided by CREDIT_BUDGET_USD and rounded up.

export const KIE_PRICES_CHECKED_AT = "2026-11-20";

/** What one credit is worth on the price list, in USD. Video prices are quoted in it. */
export const CREDIT_LIST_USD = 0.01;

const VIDEO_MARKUP = 1.95;
const VIDEO_FIXED_USD = 0.15;

/** The most KIE cost one video credit can ever stand for. */
export const MAX_VIDEO_COST_PER_CREDIT_USD = CREDIT_LIST_USD / VIDEO_MARKUP;

/** Fulfilment budget, in USD, that one image or audio credit pays for. */
export const CREDIT_BUDGET_USD = 0.004255892255892256;

const EXTRA_CALL_FACTOR = 1.15;
const IMAGE_DELIVERY_USD = 0.002;
const EPSILON = 1e-9;

/** List price in USD of one video that costs `kieUsd` on KIE. */
export function videoListPriceUsd(kieUsd: number): number {
  return kieUsd * VIDEO_MARKUP + VIDEO_FIXED_USD;
}

/** Credits for one video that costs `kieUsd` on KIE, rounded up to 5. */
export function videoCreditsFromCost(kieUsd: number): number {
  return Math.ceil(videoListPriceUsd(kieUsd) / CREDIT_LIST_USD / 5 - EPSILON) * 5;
}

/** Credits for one audio clip that costs `kieUsd` on KIE (minimum 2). */
export function audioCreditsFromCost(kieUsd: number): number {
  const budget = kieUsd * EXTRA_CALL_FACTOR + IMAGE_DELIVERY_USD;
  return Math.max(2, Math.ceil(budget / CREDIT_BUDGET_USD - EPSILON));
}

/** Credits for one image that costs `kieUsd` on KIE (minimum 2). */
export function imageCreditsFromCost(kieUsd: number): number {
  const budget = kieUsd * EXTRA_CALL_FACTOR + IMAGE_DELIVERY_USD;
  return Math.max(2, Math.ceil(budget / CREDIT_BUDGET_USD - EPSILON));
}

type Resolution = "480p" | "720p" | "1080p";

function normalizedQuality(quality: string | undefined): string {
  return String(quality ?? "").trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Models the app can run on KIE today
// ---------------------------------------------------------------------------

/** Wan 2.6 text/image/video-to-video: USD per clip by length and resolution. */
const WAN_2_6_USD: Record<5 | 10 | 15, { "720p": number; "1080p": number }> = {
  5: { "720p": 0.35, "1080p": 0.525 },
  10: { "720p": 0.7, "1080p": 1.05 },
  15: { "720p": 1.05, "1080p": 1.575 },
};

/** Veo 3.1 on KIE: USD per 8s clip. `veo3` is Quality, `veo3_fast` is Fast. */
const VEO_3_1_USD = {
  fast720p: 0.3,
  quality1080p: 1.275,
};

/**
 * KIE list cost in USD for one generation, or null when the model has no
 * verified KIE price. The branches mirror what src/ai/model-mapping.ts sends
 * to KIE, including its defaults, so the charge never undercuts the request.
 */
export function kieVideoCostUsd(
  modelId: string,
  params: { duration: number; quality?: string },
): number | null {
  const quality = normalizedQuality(params.quality);

  if (modelId === "wan2.6") {
    // The KIE transformer sends 1080p unless the quality maps to 720p, so
    // anything that is not explicitly 720p is charged as 1080p.
    const resolution = quality === "720p" || quality === "standard" ? "720p" : "1080p";
    const length = params.duration <= 5 ? 5 : params.duration <= 10 ? 10 : 15;
    return WAN_2_6_USD[length][resolution];
  }

  if (modelId === "veo-3.1") {
    // The KIE mapping picks `veo3` (Quality) for high / 1080p / 4k and
    // `veo3_fast` otherwise. Quality is charged at its 1080p price, which also
    // covers a 720p Quality render.
    const isQuality = quality === "high" || quality === "1080p" || quality === "4k";
    return isQuality ? VEO_3_1_USD.quality1080p : VEO_3_1_USD.fast720p;
  }

  return null;
}

// ---------------------------------------------------------------------------
// KIE list prices for models that are not connected yet
// ---------------------------------------------------------------------------
// Kept here so a model gets its credit price from the same table the day it is
// wired into src/ai/model-mapping.ts. Nothing below is charged today.

/** USD per second, text/image-to-video with no video input. */
export const KIE_PER_SECOND_USD: Record<string, Partial<Record<Resolution | "768p" | "2k", number>>> = {
  "bytedance/seedance-2-mini": { "480p": 0.019, "720p": 0.041 },
  "bytedance/seedance-2-fast": { "480p": 0.059, "720p": 0.124 },
  "bytedance/seedance-2": { "480p": 0.095, "720p": 0.205, "1080p": 0.51 },
  "bytedance/seedance-2-5-flash": { "480p": 0.0925, "720p": 0.205 },
  "bytedance/seedance-2-5": { "480p": 0.14, "720p": 0.315, "1080p": 0.79 },
  "kling/4-0-flash": { "720p": 0.085 },
  "kling/4-0": { "720p": 0.1425, "1080p": 0.2125 },
  "wan/3-0-video": { "480p": 0.04, "720p": 0.08, "1080p": 0.16 },
  "minimax-h3": { "768p": 0.04, "2k": 0.065 },
  "grok-imagine/image-to-video": { "480p": 0.012, "720p": 0.0225, "1080p": 0.04 },
};

/** USD per image. */
export const KIE_PER_IMAGE_USD: Record<string, number> = {
  "z-image": 0.004,
  "flux3/klein-1k": 0.008,
  "flux3/klein-2k": 0.0125,
  "seedream/5-5-1k": 0.018,
  "seedream/5-5-2k": 0.0315,
  "google/nano-banana": 0.02,
  "gpt-image-2-6-economy-1k": 0.025,
  "gpt-image-2-5-1k": 0.03,
  "gpt-image-2-5-2k": 0.05,
  "google/nano-banana-2-1k": 0.04,
  "google/nano-banana-2-2k": 0.06,
  "google/nano-banana-pro-2k": 0.09,
  "google/nano-banana-pro-4k": 0.12,
};
