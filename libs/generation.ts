import { structuredError } from "./utils";

/** Pages var. Only the exact string "true" opens generation. Unset / anything else is off. */
export const GENERATION_ENABLED_VAR = "GENERATION_ENABLED";
export const GENERATION_DISABLED_CODE = "generation_disabled";
export const GENERATION_DISABLED_MESSAGE = "暂未开放";
export const BUSINESS_PATH = "/business";

export function isGenerationEnabled(env: { GENERATION_ENABLED?: string }): boolean {
  return env.GENERATION_ENABLED === "true";
}

export function generationDisabledResponse(
  extra?: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Response {
  return structuredError(
    GENERATION_DISABLED_CODE,
    GENERATION_DISABLED_MESSAGE,
    503,
    { generationEnabled: false, generateReady: false, mediaRequired: false, ...(extra || {}) },
    extraHeaders
  );
}

export type ClosedCtaKind = "samples" | "quote";

export const CLOSED_CTA = {
  samples: { href: BUSINESS_PATH, label: "查看样片" },
  quote: { href: BUSINESS_PATH, label: "企业定制询价" },
} as const;

/** Marketing CTA when the generation kill switch is off vs on. */
export function generationCta(
  enabled: boolean,
  kind: ClosedCtaKind,
  open: { href: string; label: string }
): { href: string; label: string; closed: boolean } {
  if (enabled) return { href: open.href, label: open.label, closed: false };
  const closed = kind === "quote" ? CLOSED_CTA.quote : CLOSED_CTA.samples;
  return { href: closed.href, label: closed.label, closed: true };
}
