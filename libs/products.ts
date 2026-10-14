/**
 * One-off products and provider job costs.
 * Home, /pricing, and /zombie-couple-video must consume this catalog
 * (via GET /api/checkout) rather than hard-coding a second price.
 */

export const ZOMBIE_COUPLE_PRESET = "zombie-couple";

/** Server-only prompt. Clients may send the preset id; they cannot override this text. */
export const ZOMBIE_COUPLE_PROMPT =
  "From the very first second, the couple already appear as friendly stylized cartoon zombies: smooth pale mint-green skin, soft glowing eyes, clean intact skin with no wounds, no scars, no exposed tissue, no blood. They keep the same hairstyles and clothes, turn to look at each other, smile and hold hands. Cute Halloween animation style, cinematic lighting, faces stay recognizable.";

/**
 * KIE kling-2.6 silent image-to-video provider cost, in USD cents.
 * Recorded on the order row as cost_cents (not the customer charge).
 */
export const KIE_JOB_COST_CENTS = {
  silent5: 28,
  silent10: 55,
} as const;

export type ProductId = "zombie-couple";

export type OneOffProduct = {
  id: ProductId;
  name: string;
  usdCents: number;
  currency: "usd";
  kind: "one_off_video";
  path: string;
  /** Paid generation: kling-2.6 I2V, silent, 10s. */
  paidModel: "kling-2.6";
  paidDurationSec: 10;
  paidSound: false;
  paidJobCostCents: number;
};

export const PRODUCTS: Record<ProductId, OneOffProduct> = {
  "zombie-couple": {
    id: "zombie-couple",
    name: "Zombie Couple Video",
    usdCents: 699,
    currency: "usd",
    kind: "one_off_video",
    path: "/zombie-couple-video",
    paidModel: "kling-2.6",
    paidDurationSec: 10,
    paidSound: false,
    paidJobCostCents: KIE_JOB_COST_CENTS.silent10,
  },
};

export function parseProductId(value: unknown): ProductId | null {
  if (value === "zombie-couple") return value;
  return null;
}

export function publicProducts() {
  return Object.values(PRODUCTS).map((p) => ({
    id: p.id,
    name: p.name,
    usd: p.usdCents / 100,
    usdCents: p.usdCents,
    currency: p.currency,
    kind: p.kind,
    path: p.path,
    paidDurationSec: p.paidDurationSec,
    paidCopy: "10-second 1080p video, new generation, may differ from preview",
  }));
}

export function isZombieCouplePreset(value: unknown): boolean {
  return value === ZOMBIE_COUPLE_PRESET;
}
