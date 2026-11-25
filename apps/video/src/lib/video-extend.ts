import { EXTEND_MODEL_ID, extendCredits, getMarketModel } from "@/ai/kie-market";
import { submitMedia } from "@/lib/media-studio";

/**
 * "Extend" (续写) adds seconds to the end of one of the user's own finished
 * videos with PixVerse V6. It is billed only for the added seconds; the price
 * shown is extendCredits(), the same function the server freezes with.
 */
export type ExtendChoice = { prompt: string; duration: number; resolution: string; audio: boolean };

const model = getMarketModel(EXTEND_MODEL_ID)!;

export const EXTEND_RESOLUTIONS = model.options.resolutions ?? ["720p"];
export const EXTEND_MIN_SECONDS = model.options.durations?.[0] ?? 1;
export const EXTEND_MAX_SECONDS = model.options.durations?.at(-1) ?? 15;
export const EXTEND_MIN_PROMPT = model.options.minPromptLength ?? 3;
export const EXTEND_MAX_PROMPT = model.options.maxPromptLength ?? 5000;

/** The quality to start from: the source's own when extend offers it. */
export function defaultExtendResolution(sourceResolution: string | null | undefined): string {
  const value = (sourceResolution ?? "").trim().toLowerCase();
  if (value === "high") return "1080p";
  return EXTEND_RESOLUTIONS.includes(value) ? value : "720p";
}

export function extendPrice(choice: Omit<ExtendChoice, "prompt">): number {
  return extendCredits(choice);
}

export function canSubmitExtend(choice: ExtendChoice): boolean {
  const prompt = choice.prompt.trim();
  return (
    prompt.length >= EXTEND_MIN_PROMPT &&
    prompt.length <= EXTEND_MAX_PROMPT &&
    choice.duration >= EXTEND_MIN_SECONDS &&
    choice.duration <= EXTEND_MAX_SECONDS &&
    EXTEND_RESOLUTIONS.includes(choice.resolution)
  );
}

/** Sends the extend job through the video route (same lost-answer key reuse). */
export function submitExtend(source: string | {sourceVideoKey:string}, choice: ExtendChoice, zh: boolean, expectedAccount?: string) {
  return submitMedia(
    {
      model: EXTEND_MODEL_ID,
      prompt: choice.prompt.trim(),
      ...(typeof source === "string" ? {sourceVideoUuid:source} : source),
      duration: choice.duration,
      quality: choice.resolution,
      generateAudio: choice.audio,
    },
    zh,
    "/api/v1/video/generate",
    expectedAccount,
  );
}
