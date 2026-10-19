/**
 * Post-generation actions — RESERVED EXTENSION POINT (not implemented).
 *
 * A post-generation action derives a new generation row from an existing
 * one ("parent"): extend a video, make a variation, upscale, or add music.
 * The derived row lives in the same `videos` table, with:
 *   - `parentUuid` = the parent row's uuid (column added in migration 0002)
 *   - `mediaType`  = the media type the action produces
 *   - `parameters.postAction` = the PostGenerationAction payload below
 *
 * When implemented, a handler must reuse the standard flow:
 * credit hold -> provider task -> signed callback (AI_CALLBACK_URL + /kie)
 * -> copy result to R2 -> settle (or release on ProviderRejectedError),
 * plus the 60s fingerprint dedupe (include parentUuid + action in the key).
 *
 * Nothing here is wired to a route yet; `runPostGenerationAction` always
 * throws NOT_IMPLEMENTED so no credits can be spent through it.
 */
import type { MediaType } from "@/db/schema";
import { ApiError } from "@/lib/api/error";

export const POST_GENERATION_ACTIONS = [
  "extend",
  "variation",
  "upscale",
  "add-music",
] as const;

export type PostGenerationActionType = (typeof POST_GENERATION_ACTIONS)[number];

/** Action-specific options. Kept loose on purpose until each action ships. */
export interface ExtendActionOptions {
  /** Extra seconds to append to the parent video. */
  extraSeconds: number;
  prompt?: string;
}

export interface VariationActionOptions {
  prompt?: string;
  /** 0..1, how far the variation may drift from the parent. */
  strength?: number;
}

export interface UpscaleActionOptions {
  /** Target resolution, e.g. "1080p" | "4k". */
  targetResolution: string;
}

export interface AddMusicActionOptions {
  /** Either an existing audio row uuid or a prompt for a new Suno track. */
  audioUuid?: string;
  musicPrompt?: string;
  instrumental?: boolean;
}

export type PostGenerationAction =
  | { type: "extend"; options: ExtendActionOptions }
  | { type: "variation"; options: VariationActionOptions }
  | { type: "upscale"; options: UpscaleActionOptions }
  | { type: "add-music"; options: AddMusicActionOptions };

export interface PostGenerationRequest {
  userId: string;
  /** uuid of the parent row (must belong to userId, COMPLETED, not deleted). */
  parentUuid: string;
  action: PostGenerationAction;
  idempotencyKey?: string;
}

export interface PostGenerationResult {
  uuid: string;
  parentUuid: string;
  action: PostGenerationActionType;
  mediaType: MediaType;
  taskId: string;
  status: string;
  creditsUsed: number;
}

/** What a future handler for one action type must provide. */
export interface PostGenerationHandler<
  A extends PostGenerationAction = PostGenerationAction,
> {
  type: A["type"];
  /** Media types this action can be applied to. */
  parentMediaTypes: readonly MediaType[];
  /** Media type of the derived row. */
  resultMediaType: MediaType;
  /** Site credits for this action (computed before the hold). */
  quoteCredits(action: A, parent: { model: string; duration: number | null }): number;
  run(request: PostGenerationRequest & { action: A }): Promise<PostGenerationResult>;
}

export function isPostGenerationActionType(
  value: unknown
): value is PostGenerationActionType {
  return (
    typeof value === "string" &&
    (POST_GENERATION_ACTIONS as readonly string[]).includes(value)
  );
}

/** Placeholder entry point. Always throws until a handler is registered. */
export async function runPostGenerationAction(
  request: PostGenerationRequest
): Promise<PostGenerationResult> {
  throw new ApiError(
    `Post-generation action "${request.action.type}" is not available yet`,
    501,
    { code: "NOT_IMPLEMENTED", action: request.action.type }
  );
}
