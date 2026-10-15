import { structuredError } from "./utils";

/** Pages var. Only the exact string "true" opens generation. Unset / anything else is off. */
export const GENERATION_ENABLED_VAR = "GENERATION_ENABLED";
export const GENERATION_DISABLED_CODE = "generation_disabled";
export const GENERATION_DISABLED_MESSAGE = "暂未开放";
export const WORKSPACE_PATH = "/workspace";

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

/** Marketing CTAs always enter the generator. Kind is ignored (quote branch removed). */
export function generationCta(
  enabled: boolean,
  _kind: ClosedCtaKind,
  open: { href: string; label: string }
): { href: string; label: string; closed: boolean } {
  return { href: open.href || WORKSPACE_PATH, label: open.label, closed: !enabled };
}
