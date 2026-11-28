import type { VoiceSettings } from "@/lib/audio-voice-settings";
import { VideoStatus, db, mediaAssets, videos, type Video } from "@/db";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  getStorage,
  isStorageConfigured,
  isStorageKey,
  signMediaRef,
} from "@/lib/storage";
import { getModelConfig, calculateModelCredits } from "../config/credits";
import {
  getProvider,
  ProviderRejectedError,
  type ProviderType,
  type VideoTaskResponse,
} from "../ai";
import {
  isModelModeSupported,
  isModelSupported,
  normalizeGenerationMode,
} from "../ai/model-mapping";
import { creditService } from "./credit";
import { generateSignedCallbackUrl } from "@/ai/utils/callback-signature";
import { emitVideoEvent } from "@/lib/video-events";
import { ApiError } from "@/lib/api/error";
import { getConfiguredAIProvider } from "@/ai/provider-config";
import { allowedDuration, createMarketTask, getMarketModel, imageResolution, marketCredits, type MarketRequest } from "@/ai/kie-market";
import { imageOutputCount } from "@/lib/image-output-count";
import { WAN_REFERENCE_MAX_BYTES, WAN_REFERENCE_MAX_FILES, isWanVideoMime } from "@/lib/wan-video-references";
import { assertWithinConcurrencyLimit } from "@/lib/plan-limits";
import { isFreeInternalAccount } from "@/lib/internal-test-account";
import { KLING_KEYFRAME_MODEL, mapKlingFrames, orderedKlingFrames, type KlingKeyframes } from "@/lib/kling-keyframes";
import { invalidKeyframes, resolveKlingKeyframes, validateKlingKeyframes } from "./kling-keyframes";
import { isSafetyApproved, moderateContent, safetyMessage } from "@/lib/content-safety";

import { isMeasuredVideoTool, VIDEO_MOTION_MODEL, type VideoToolOrientation } from "@/lib/video-tool";
import { measuredVideoSource, ownedExtendUpload, validateCharacterImage } from "./video-tool-source";

export interface GenerateVideoParams {
  userId: string;
  prompt: string;
  model: string; // "sora-2"
  duration?: number;
  aspectRatio?: string; // "16:9" | "9:16"
  quality?: string; // "standard" | "high"
  imageUrl?: string; // image-to-video
  imageUrls?: string[]; // image-to-video (multi-image)
  videoKeys?: string[]; // private uploaded Wan reference clips
  keyframes?: KlingKeyframes;
  locale?: string;
  mode?: string;
  preset?: string;
  outputNumber?: number;
  generateAudio?: boolean;
  idempotencyKey?: string;
  /** For tools that work on a video (extend): one of the user's own videos. */
  sourceVideoUuid?: string;
  sourceVideoKey?: string;
  orientation?: VideoToolOrientation;
  expectedCredits?: number;
  characterKey?: string;
}

/** KIE takes at most 50 MB of video for PixVerse extend (kie.ai/pixverse-v6). */
export const MAX_SOURCE_VIDEO_BYTES = 50 * 1024 * 1024;

export interface GenerateMediaParams {
  userId: string;
  model: string;
  prompt: string;
  preset?: string;
  mode?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  count?: number;
  /** Uploaded reference / start images: storage keys or allowed URLs. */
  imageUrls?: string[];
  keyframes?: KlingKeyframes;
  locale?: string;
  audio?: boolean;
  voice?: string;
  style?: string;
  instrumental?: boolean;
  customMode?: boolean;
  speed?: number;
  voiceSettings?: VoiceSettings;
  idempotencyKey?: string;
  /** For tools that work on a video (extend): one of the user's own videos. */
  sourceVideoUuid?: string;
  sourceVideoKey?: string;
  orientation?: VideoToolOrientation;
  expectedCredits?: number;
  characterKey?: string;
}

export interface VideoGenerationResult {
  videoUuid: string;
  taskId: string;
  provider: ProviderType;
  status: string;
  estimatedTime?: number;
  creditsUsed: number;
}

/** A seed in KIE's range (0 to 2^31 - 1). */
function randomSeed(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % 2147483648;
}

/** File extension from a provider URL, falling back when it has none. */
export function mediaExtension(url: string, fallback: string): string {
  const match = /\.([a-z0-9]{2,4})(?:$|[?#])/i.exec(url);
  const ext = match?.[1]?.toLowerCase();
  const known = ["png", "jpg", "jpeg", "webp", "gif", "mp3", "wav", "m4a", "ogg", "aac", "flac"];
  return ext && known.includes(ext) ? ext : fallback;
}

const SUBMIT_SAVE_MAX_ATTEMPTS = 3;
const SUBMIT_SAVE_RETRY_DELAY_MS = 200;
/**
 * A delivery that has held its claim this long without finishing was cut off
 * (the Worker ended or the transfer hung), so another delivery may take over.
 * Longer than a download's own timeout plus the upload of its parts.
 */
export const STALE_UPLOAD_CLAIM_MS = 30 * 60 * 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class VideoService {
  private callbackBaseUrl: string;

  constructor() {
    this.callbackBaseUrl = process.env.AI_CALLBACK_URL || "";
  }

  /**
   * Parse insufficient credits error and convert to structured ApiError
   */
  private toInsufficientCreditsApiError(
    error: unknown,
    fallbackRequiredCredits: number
  ): ApiError | null {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(
      /Insufficient credits\.\s*Required:\s*(\d+)(?:,\s*Available:\s*(\d+))?/i
    );
    if (!match) return null;

    const requiredCredits =
      Number.parseInt(match[1] || "", 10) || fallbackRequiredCredits;
    const availableCredits = match[2]
      ? Number.parseInt(match[2], 10)
      : undefined;

    return new ApiError("Insufficient credits", 402, {
      code: "INSUFFICIENT_CREDITS",
      requiredCredits,
      availableCredits,
    });
  }

  /**
   * Sign a private storage key for a short-lived provider fetch.
   * http(s) URLs pass through unchanged.
   */
  private signImageInput(value: string): string {
    return isStorageKey(value) ? getStorage().getSignedUrl(value, 3600) : value;
  }

  /**
   * Return a copy of a video row with media columns replaced by short-lived
   * signed URLs. Legacy http(s) values pass through; when storage is not
   * configured a stored key resolves to null instead of throwing.
   */
  private signVideoRow<
    T extends { videoUrl: string | null; startImageUrl?: string | null }
  >(row: T): T {
    const sign = (value: string | null | undefined): string | null => {
      if (!value) {
        return null;
      }
      if (isStorageKey(value) && !isStorageConfigured()) {
        return null;
      }
      return signMediaRef(value);
    };

    return {
      ...row,
      videoUrl: sign(row.videoUrl),
      startImageUrl: sign(row.startImageUrl),
    } as T;
  }

  /**
   * Create video generation task
   */
  async generate(params: GenerateVideoParams): Promise<VideoGenerationResult> {
    const videoKeys = params.videoKeys ?? [];
    if (
      isMeasuredVideoTool(params.model) &&
      ((params.outputNumber ?? 1) !== 1 ||
        params.generateAudio ||
        params.aspectRatio ||
        params.mode ||
        params.keyframes ||
        videoKeys.length)
    ) {
      throw new ApiError("Invalid video tool options.", 400, { code: "INVALID_VIDEO_OPTIONS" });
    }
    if (
      !isMeasuredVideoTool(params.model) &&
      ((params.sourceVideoKey && getMarketModel(params.model)?.tool !== "extend") ||
        params.orientation ||
        params.characterKey)
    ) {
      throw new ApiError("This model does not support those inputs.", 400, {
        code: "INVALID_VIDEO_OPTIONS",
      });
    }

    if (params.keyframes && (params.model !== KLING_KEYFRAME_MODEL || videoKeys.length || (params.outputNumber ?? 1) !== 1)) throw invalidKeyframes();
    if (params.mode === "keyframes" && !params.keyframes) throw invalidKeyframes();
    if (videoKeys.length) {
      const invalidSelection =
        params.model !== "wan2.6" ||
        params.mode !== "reference-to-video" ||
        params.imageUrl || params.imageUrls?.length ||
        videoKeys.length > WAN_REFERENCE_MAX_FILES ||
        new Set(videoKeys).size !== videoKeys.length ||
        videoKeys.some((key) => !key.startsWith(`uploads/${params.userId}/`));
      if (invalidSelection) {
        throw new ApiError("Use up to three of your uploaded videos with Wan 2.6.", 400, { code: "INVALID_VIDEO_REFERENCE" });
      }
      if ((params.duration !== undefined && ![5, 10, 15].includes(params.duration)) ||
          (params.quality !== undefined && !["standard", "high", "720p", "1080p"].includes(params.quality)) ||
          (params.outputNumber ?? 1) !== 1) {
        throw new ApiError("Choose one Wan clip at 5, 10 or 15 seconds in 720p or 1080p.", 400, { code: "INVALID_VIDEO_OPTIONS" });
      }
    }
    // Market models (everything beyond the two legacy KIE video models) share
    // one generic path with image and audio generation.
    if (getMarketModel(params.model)) {
      return this.generateMedia({
        userId: params.userId,
        model: params.model,
        prompt: params.prompt,
        preset: params.preset,
        mode: params.mode,
        aspectRatio: params.aspectRatio,
        resolution: params.quality,
        duration: params.duration,
        imageUrls: [...(params.imageUrl ? [params.imageUrl] : []), ...(params.imageUrls ?? [])],
        keyframes: params.keyframes,
        locale: params.locale,
        audio: params.generateAudio,
        idempotencyKey: params.idempotencyKey,
        sourceVideoUuid: params.sourceVideoUuid,
        sourceVideoKey: params.sourceVideoKey,
        orientation: params.orientation,
        expectedCredits: params.expectedCredits,
        characterKey: params.characterKey,
      });
    }

    for (const imageInput of [params.imageUrl, ...(params.imageUrls ?? [])]) {
      if (
        imageInput &&
        isStorageKey(imageInput) &&
        !imageInput.startsWith(`uploads/${params.userId}/`)
      ) {
        throw new ApiError("Invalid image reference", 400, {
          code: "INVALID_IMAGE_REF",
        });
      }
    }

    const modelConfig = getModelConfig(params.model);
    if (!modelConfig) {
      throw new ApiError(`Unsupported model: ${params.model}`, 400, {
        code: "UNSUPPORTED_MODEL",
        model: params.model,
      });
    }

    if (modelConfig.enabled === false) {
      throw new ApiError(`Model ${params.model} is not available`, 400, {
        code: "MODEL_DISABLED",
        model: params.model,
      });
    }

    const effectiveDuration = params.duration || modelConfig.durations[0] || 5;

    const outputNumber = Math.max(1, params.outputNumber ?? 1);
    const creditsRequired = calculateModelCredits(params.model, {
      duration: effectiveDuration,
      quality: params.quality,
    }) * outputNumber;

    // A model with no verified cost prices at 0. Never run it for free.
    if (!(creditsRequired > 0)) {
      throw new ApiError(`Model ${params.model} has no price`, 400, {
        code: "MODEL_NOT_PRICED",
        model: params.model,
      });
    }
    const freeInternal = await isFreeInternalAccount(params.userId);
    const billedCredits = freeInternal ? 0 : creditsRequired;

    const hasImageInput =
      (params.imageUrls && params.imageUrls.length > 0) || Boolean(params.imageUrl);
    const resolvedMode = normalizeGenerationMode(params.mode, hasImageInput);

    if (
      (resolvedMode === "image-to-video" ||
        resolvedMode === "reference-to-video" ||
        resolvedMode === "frames-to-video") &&
      !hasImageInput && !videoKeys.length
    ) {
      throw new ApiError(
        `Mode ${resolvedMode} requires uploaded input media`,
        400,
        {
          code: "MISSING_INPUT_MEDIA",
          mode: resolvedMode,
          model: params.model,
        }
      );
    }

    if (hasImageInput && !modelConfig.supportImageToVideo) {
      throw new ApiError(
        `Model ${params.model} does not support image-to-video`,
        400,
        {
          code: "IMAGE_TO_VIDEO_NOT_SUPPORTED",
          model: params.model,
        }
      );
    }

    const configuredProvider = getConfiguredAIProvider();
    if (configuredProvider && !isModelSupported(params.model, configuredProvider)) {
      throw new ApiError(
        `Model ${params.model} is not available for provider ${configuredProvider}`,
        400,
        {
          code: "MODEL_NOT_AVAILABLE_FOR_PROVIDER",
          model: params.model,
          provider: configuredProvider,
        }
      );
    }

    const actualProvider = configuredProvider || modelConfig.provider;
    if (videoKeys.length && actualProvider !== "kie") {
      throw new ApiError("Video reference inputs require the KIE Wan 2.6 model.", 400, { code: "MODE_NOT_SUPPORTED" });
    }
    if (!isModelModeSupported(params.model, actualProvider, resolvedMode)) {
      throw new ApiError(
        `Mode ${resolvedMode} is not supported for model ${params.model} on provider ${actualProvider}`,
        400,
        {
          code: "MODE_NOT_SUPPORTED",
          model: params.model,
          mode: resolvedMode,
          provider: actualProvider,
        }
      );
    }

    const idempotencyKey = params.idempotencyKey;

    // Idempotency: if a key is provided, look up an existing non-deleted
    // video for the same user with the same key. If found, return its
    // result without calling the provider or freezing credits again.
    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(
        params.userId,
        idempotencyKey
      );
      if (existing) {
        return {
          videoUuid: existing.uuid,
          taskId: existing.externalTaskId ?? "",
          provider: existing.provider as ProviderType,
          status: existing.status,
          creditsUsed: existing.creditsUsed,
        };
      }
    }

    // Replays return their existing job even if an attachment was removed later.
    // Only sign keys issued for this user's validated uploads, never a client URL.
    if (videoKeys.length) {
      const assets = await db.select({ size: mediaAssets.size, mimeType: mediaAssets.mimeType }).from(mediaAssets)
        .where(and(eq(mediaAssets.userId, params.userId), inArray(mediaAssets.key, videoKeys)));
      if (assets.length !== videoKeys.length || assets.some((asset) => !isWanVideoMime(asset.mimeType) ||
          asset.size <= 0 || asset.size > WAN_REFERENCE_MAX_BYTES)) {
        throw new ApiError("Use uploaded MP4 or MOV clips up to 10 MB each.", 400, { code: "INVALID_VIDEO_REFERENCE" });
      }
    }

    // Plan limit on videos in progress. After the idempotency lookup, so a
    // retried submit gets its existing job back; before the row is created
    // and credits are frozen.
    if (!freeInternal) await assertWithinConcurrencyLimit(params.userId);

    const provider = getProvider(actualProvider);
    const videoUuid = `vid_${nanoid(21)}`;

    const aspectRatio = videoKeys.length ? undefined : params.aspectRatio;
    const generateAudio = videoKeys.length ? true : params.generateAudio;
    const parameters: Record<string, unknown> = {
      duration: params.duration,
      aspectRatio,
      quality: params.quality,
      outputNumber,
      mode: resolvedMode,
      ...(params.preset ? { preset: params.preset } : {}),
      imageUrl: params.imageUrl,
      imageUrls: params.imageUrls,
      ...(videoKeys.length ? { videoKeys } : {}),
      generateAudio,
    };
    if (idempotencyKey) {
      parameters.idempotencyKey = idempotencyKey;
    }

    // D1 has no advisory locks. A dedicated, unique idempotency column makes
    // concurrent double-submits collapse to the same video row atomically.
    const insert = db.insert(videos).values({
      uuid: videoUuid,
      userId: params.userId,
      prompt: params.prompt,
      model: params.model,
      parameters,
      idempotencyKey: idempotencyKey ?? null,
      status: VideoStatus.PENDING,
      startImageUrl: params.imageUrls?.[0] || params.imageUrl || null,
      creditsUsed: billedCredits,
      duration: effectiveDuration,
      aspectRatio: aspectRatio || null,
      provider: actualProvider,
      updatedAt: new Date(),
    });

    const [inserted] = idempotencyKey
      ? await insert
          .onConflictDoNothing({
            target: [videos.userId, videos.idempotencyKey],
          })
          .returning({ uuid: videos.uuid, id: videos.id })
      : await insert.returning({ uuid: videos.uuid, id: videos.id });

    let videoResult = inserted;
    if (!videoResult && idempotencyKey) {
      const existing = await this.findByIdempotencyKey(
        params.userId,
        idempotencyKey
      );
      if (existing) {
        videoResult = { uuid: existing.uuid, id: existing.id };
      }
    }

    if (!videoResult) {
      throw new Error("Failed to create video record");
    }

    // If the idempotency lookup inside the transaction found an existing
    // row, return its result without freezing or calling the provider.
    if (videoResult.uuid !== videoUuid) {
      const [existing] = await db
        .select()
        .from(videos)
        .where(eq(videos.uuid, videoResult.uuid))
        .limit(1);
      if (existing) {
        return {
          videoUuid: existing.uuid,
          taskId: existing.externalTaskId ?? "",
          provider: existing.provider as ProviderType,
          status: existing.status,
          creditsUsed: existing.creditsUsed,
        };
      }
    }

    let freezeResult: { success: boolean; holdId: number };
    try {
      freezeResult = freeInternal
        ? { success: true, holdId: 0 }
        : await creditService.freeze({
            userId: params.userId,
            credits: creditsRequired,
            videoUuid: videoResult.uuid,
          });
    } catch (error) {
      await db
        .update(videos)
        .set({
          status: VideoStatus.FAILED,
          errorMessage: String(error),
          updatedAt: new Date(),
        })
        .where(eq(videos.uuid, videoResult.uuid));

      const insufficientCreditsError = this.toInsufficientCreditsApiError(
        error,
        creditsRequired
      );
      if (insufficientCreditsError) {
        throw insufficientCreditsError;
      }
      throw error;
    }

    if (!freezeResult.success) {
      await db
        .update(videos)
        .set({
          status: VideoStatus.FAILED,
          errorMessage: `Insufficient credits. Required: ${creditsRequired}`,
          updatedAt: new Date(),
        })
        .where(eq(videos.uuid, videoResult.uuid));
      throw new ApiError("Insufficient credits", 402, {
        code: "INSUFFICIENT_CREDITS",
        requiredCredits: creditsRequired,
      });
    }



    const callbackUrl = this.callbackBaseUrl
      ? generateSignedCallbackUrl(
        `${this.callbackBaseUrl}/${actualProvider}`,
        videoResult.uuid
      )
      : undefined;

    const signedImageUrl = params.imageUrl
      ? this.signImageInput(params.imageUrl)
      : undefined;
    const signedImageUrls = params.imageUrls?.map((value) =>
      this.signImageInput(value)
    );

    // Call the provider. Split definite rejections from unknown outcomes.
    let providerResult: VideoTaskResponse;
    try {
      providerResult = await provider.createTask({
        model: params.model,
        prompt: params.prompt,
        duration: effectiveDuration,  // ✅ 使用计算后的时长
        aspectRatio,
        quality: params.quality,
        imageUrl: signedImageUrl,
        imageUrls: signedImageUrls,
        ...(videoKeys.length ? { videoUrls: videoKeys.map((key) => getStorage().getSignedUrl(key, 3600)) } : {}),
        mode: resolvedMode,
        outputNumber,
        generateAudio,
        callbackUrl,
      });
    } catch (error) {
      if (error instanceof ProviderRejectedError) {
        // Definite failure: the provider did not create a task.
        if (!freeInternal) await creditService.release(videoResult.uuid);

        await db
          .update(videos)
          .set({
            status: VideoStatus.FAILED,
            errorMessage: String(error),
            updatedAt: new Date(),
          })
          .where(eq(videos.uuid, videoResult.uuid));
        throw error;
      }

      // Unknown outcome: the provider may have accepted (and may charge
      // for) the task. Do NOT release credits, do NOT mark FAILED, do NOT
      // retry createTask. Record the uncertainty for reconciliation.
      const message = error instanceof Error ? error.message : String(error);
      try {
        await db
          .update(videos)
          .set({
            errorMessage: `SUBMIT_UNKNOWN: ${message}`,
            updatedAt: new Date(),
          })
          .where(eq(videos.uuid, videoResult.uuid));
      } catch (updateError) {
        console.error(
          `Failed to record SUBMIT_UNKNOWN for video ${videoResult.uuid}:`,
          updateError
        );
      }

      throw new ApiError(
        "Video submission result unknown; it will be reconciled",
        202,
        { code: "SUBMIT_RESULT_UNKNOWN", videoUuid: videoResult.uuid }
      );
    }

    // Persist externalTaskId/status with retries. If all attempts fail,
    // do NOT release credits or mark FAILED: the task may still complete
    // via callback (callbacks carry videoUuid and handleCallback accepts a
    // row with null externalTaskId).
    let saved = false;
    let lastSaveError: unknown;
    for (let attempt = 1; attempt <= SUBMIT_SAVE_MAX_ATTEMPTS; attempt++) {
      try {
        await db
          .update(videos)
          .set({
            status: VideoStatus.GENERATING,
            externalTaskId: providerResult.taskId,
            provider: actualProvider,
            updatedAt: new Date(),
          })
          .where(eq(videos.uuid, videoResult.uuid));
        saved = true;
        break;
      } catch (error) {
        lastSaveError = error;
        if (attempt < SUBMIT_SAVE_MAX_ATTEMPTS) {
          await delay(SUBMIT_SAVE_RETRY_DELAY_MS * attempt);
        }
      }
    }

    if (!saved) {
      console.error(
        `Video submitted but local save failed; needs reconciliation. videoUuid=${videoResult.uuid} taskId=${providerResult.taskId}`,
        lastSaveError
      );
      throw new ApiError(
        "Video submitted but local save failed; it will be reconciled",
        202,
        {
          code: "SUBMIT_RESULT_UNKNOWN",
          videoUuid: videoResult.uuid,
          taskId: providerResult.taskId,
        }
      );
    }

    return {
      videoUuid: videoResult.uuid,
      taskId: providerResult.taskId,
      provider: actualProvider,
      status: "GENERATING",
      estimatedTime: providerResult.estimatedTime,
      creditsUsed: billedCredits,
    };
  }

  /**
   * Create a generation for a KIE market model (video, image or audio).
   * Same safety rules as generate(): credits are frozen before the provider
   * call, released only when KIE definitely created nothing, and kept on an
   * unknown outcome so the job can be reconciled.
   */
  async generateMedia(params: GenerateMediaParams): Promise<VideoGenerationResult> {
    const model = getMarketModel(params.model);
    if (!model) {
      throw new ApiError(`Unsupported model: ${params.model}`, 400, { code: "UNSUPPORTED_MODEL", model: params.model });
    }
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      throw new ApiError("Generation is not configured", 503, { code: "PROVIDER_NOT_CONFIGURED" });
    }

    const idempotencyKey = params.idempotencyKey;
    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(params.userId, idempotencyKey);
      if (existing) {
        return {
          videoUuid: existing.uuid,
          taskId: existing.externalTaskId ?? "",
          provider: existing.provider as ProviderType,
          status: existing.status,
          creditsUsed: existing.creditsUsed,
        };
      }
    }

    let measured: Awaited<ReturnType<typeof measuredVideoSource>> | null = null;
    let character: Awaited<ReturnType<typeof validateCharacterImage>> | undefined;
    if (isMeasuredVideoTool(model.id)) {
      const motion = model.id === VIDEO_MOTION_MODEL;
      if (
        !model.options.resolutions?.includes(params.resolution ?? "") ||
        (params.imageUrls?.length ?? 0) !== 0 ||
        motion !== Boolean(params.characterKey) ||
        (!motion && params.orientation) ||
        params.keyframes ||
        (params.count ?? 1) !== 1
      ) {
        throw new ApiError("Choose the inputs shown for this video tool.", 400, {
          code: "INVALID_VIDEO_OPTIONS",
        });
      }
      measured = await measuredVideoSource(params.userId, model.id, params);
      if (measured.seconds !== params.duration)
        throw new ApiError("Review the measured duration before submitting.", 409, {
          code: "VIDEO_QUOTE_CHANGED",
        });
      if (motion) {
        character = await validateCharacterImage(params.userId, params.characterKey);
        const safety = await moderateContent({
          text: params.prompt,
          images: [{ url: character.signedUrl, label: "character" }],
          context: "generation",
        });
        if (!isSafetyApproved(safety))
          throw new ApiError(safetyMessage(safety, params.locale), 422, {
            code: "CONTENT_BLOCKED",
            decision: safety.decision,
            categories: safety.categories,
          });
      }
    }

    if (params.keyframes) {
      validateKlingKeyframes({
        ...params, keyframes: params.keyframes,
        hasOtherInputs: Boolean(params.imageUrls?.length || params.sourceVideoUuid),
      });
    }
    for (const imageInput of params.imageUrls ?? []) {
      if (isStorageKey(imageInput) && !imageInput.startsWith(`uploads/${params.userId}/`)) {
        throw new ApiError("Invalid image reference", 400, { code: "INVALID_IMAGE_REF" });
      }
    }
    const maxImages = model.options.maxImages ?? 0;
    if ((params.imageUrls?.length ?? 0) > maxImages) {
      throw new ApiError(`Too many image references for ${model.name}`, 400, {
        code: "TOO_MANY_IMAGE_REFS", max: maxImages,
      });
    }
    const imageInputs = character ? [character.key] : (params.imageUrls ?? []).slice(0, maxImages);
    if (model.options.requiresImage && imageInputs.length === 0) {
      throw new ApiError(`${model.name} needs a start image`, 400, { code: "MISSING_INPUT_MEDIA", model: model.id });
    }
    const minPrompt = model.options.minPromptLength;
    if (minPrompt && params.prompt.trim().length < minPrompt) {
      throw new ApiError(`Prompt is shorter than ${minPrompt} characters`, 400, { code: "PROMPT_TOO_SHORT", min: minPrompt });
    }
    const maxPrompt = model.options.maxPromptLength;
    if (maxPrompt && params.prompt.length > maxPrompt) {
      throw new ApiError(`Prompt is longer than ${maxPrompt} characters`, 400, { code: "PROMPT_TOO_LONG", max: maxPrompt });
    }
    if (model.options.voices?.length && params.voice && !model.options.voices.some((voice) => voice.id === params.voice)) {
      throw new ApiError("Unknown voice", 400, { code: "INVALID_VOICE" });
    }

    // Only offer what the model accepts; anything else falls back to defaults.
    const pick = (value: string | undefined, allowed?: string[]) =>
      value && (!allowed || allowed.length === 0 || allowed.includes(value)) ? value : undefined;
    const request: MarketRequest = {
      prompt: params.prompt,
      mode: params.mode,
      // A ratio the model ignores is not saved, so history shows what was made.
      aspectRatio: params.keyframes || (model.options.aspectFollowsSingleImage && imageInputs.length === 1)
        ? undefined : pick(params.aspectRatio, model.options.aspects),
      resolution: model.kind === "image" ? imageResolution(model, params.resolution) :
        pick(params.resolution, model.options.resolutions) ?? (params.keyframes ? "1080p" : undefined),
      duration: measured?.seconds ?? (params.keyframes ? params.duration ?? 10 : allowedDuration(model, params.duration)),
      ...(model.id === VIDEO_MOTION_MODEL ? { orientation:params.orientation ?? "video" } : {}),
      ...(params.keyframes ? { keyframes: params.keyframes } : {}),
      count: imageOutputCount(params.count, model.options.maxCount),
      audio: model.options.audioToggle ? (params.audio ?? true) : undefined,
      voice: params.voice,
      style: params.style?.slice(0, 1000),
      instrumental: params.instrumental,
      customMode: params.customMode,
      speed: params.speed,
      ...(model.kind === "audio" && params.voiceSettings ? { voiceSettings: params.voiceSettings } : {}),
      // Models that require a seed get a random one.
      ...(model.options.requiresVideo ? { seed: randomSeed() } : {}),
    };

    const creditsRequired = marketCredits(model, { ...request, imageUrls: imageInputs });
    if (measured && creditsRequired !== params.expectedCredits)
      throw new ApiError("The quote changed. Review it before generating.", 409, {
        code: "VIDEO_QUOTE_CHANGED",
      });

    if (!(creditsRequired > 0)) {
      throw new ApiError(`Model ${model.id} has no price`, 400, { code: "MODEL_NOT_PRICED", model: model.id });
    }
    const freeInternal = await isFreeInternalAccount(params.userId);
    const billedCredits = freeInternal ? 0 : creditsRequired;

    const sourceVideo = measured ?? (model.options.requiresVideo
      ? await this.resolveExtendSource(params.userId, params.sourceVideoUuid, params.sourceVideoKey)
      : null);

    let providerFrames: KlingKeyframes | undefined;
    let startFrame: string | undefined;
    if (params.keyframes) {
      const storedFrames = await resolveKlingKeyframes(params.userId, params.keyframes);
      startFrame = orderedKlingFrames(storedFrames)[0];
      providerFrames = mapKlingFrames(storedFrames, (value) => this.signImageInput(value));
      const safety = await moderateContent({
        text: params.prompt,
        images: orderedKlingFrames(providerFrames).map((url, index) => ({ url, label: `keyframe-${index + 1}` })),
        context: "generation",
      });
      if (!isSafetyApproved(safety)) {
        throw new ApiError(safetyMessage(safety, params.locale), 422, { code: "CONTENT_BLOCKED", decision: safety.decision, categories: safety.categories });
      }
    }

    // Only videos count against the plan's concurrency; images and audio are quick.
    if (model.kind === "video") {
      if (!freeInternal) await assertWithinConcurrencyLimit(params.userId);
    }

    const prefix = model.kind === "image" ? "img" : model.kind === "audio" ? "aud" : "vid";
    const uuid = `${prefix}_${nanoid(21)}`;
    // Signing can fail locally before a task exists. Only reserve credits once
    // the complete provider request is ready.
    const callbackUrl = this.callbackBaseUrl ? generateSignedCallbackUrl(`${this.callbackBaseUrl}/kie`, uuid) : undefined;
    const providerRequest = {
      ...request,
      imageUrls: imageInputs.map((value) => this.signImageInput(value)),
      ...(providerFrames ? { keyframes: providerFrames } : {}),
      ...(sourceVideo ? { videoUrl: sourceVideo.signedUrl } : {}),
    };
    const insert = db.insert(videos).values({
      uuid,
      userId: params.userId,
      prompt: params.prompt,
      model: model.id,
      mediaType: model.kind,
      parameters: {
        ...request,
        ...(params.preset ? { preset: params.preset } : {}),
        ...(params.mode ? { mode: params.mode } : {}),
        imageUrls: imageInputs,
        // The source is kept by its id; a signed URL would expire.
        ...(sourceVideo?.uuid ? { sourceVideoUuid: sourceVideo.uuid } : {}),
        ...(params.sourceVideoKey && sourceVideo ? { sourceVideoKey: params.sourceVideoKey } : {}),
        ...(character ? {characterKey:params.characterKey} : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
      idempotencyKey: idempotencyKey ?? null,
      status: VideoStatus.PENDING,
      startImageUrl: startFrame ?? imageInputs[0] ?? null,
      creditsUsed: billedCredits,
      duration: model.kind === "video" ? (request.duration ?? null) : null,
      resolution: request.resolution ?? null,
      aspectRatio: request.aspectRatio ?? null,
      provider: "kie",
      updatedAt: new Date(),
    });
    const [inserted] = idempotencyKey
      ? await insert.onConflictDoNothing({ target: [videos.userId, videos.idempotencyKey] }).returning({ uuid: videos.uuid })
      : await insert.returning({ uuid: videos.uuid });
    if (!inserted) {
      const existing = idempotencyKey ? await this.findByIdempotencyKey(params.userId, idempotencyKey) : null;
      if (existing) {
        return {
          videoUuid: existing.uuid,
          taskId: existing.externalTaskId ?? "",
          provider: existing.provider as ProviderType,
          status: existing.status,
          creditsUsed: existing.creditsUsed,
        };
      }
      throw new Error("Failed to create generation record");
    }

    const failedCharge = model.kind === "image" ? { creditsUsed: 0 } : {};
    let frozen: { success: boolean };
    try {
      frozen = freeInternal
        ? { success: true }
        : await creditService.freeze({ userId: params.userId, credits: creditsRequired, videoUuid: uuid });
    } catch (error) {
      await db.update(videos).set({ status: VideoStatus.FAILED, ...failedCharge, errorMessage: String(error), updatedAt: new Date() }).where(eq(videos.uuid, uuid));
      throw this.toInsufficientCreditsApiError(error, creditsRequired) ?? error;
    }
    if (!frozen.success) {
      await db
        .update(videos)
        .set({ status: VideoStatus.FAILED, ...failedCharge, errorMessage: `Insufficient credits. Required: ${creditsRequired}`, updatedAt: new Date() })
        .where(eq(videos.uuid, uuid));
      throw new ApiError("Insufficient credits", 402, { code: "INSUFFICIENT_CREDITS", requiredCredits: creditsRequired });
    }

    let taskId: string;
    try {
      taskId = await createMarketTask(model, providerRequest, callbackUrl, apiKey);
    } catch (error) {
      if (error instanceof ProviderRejectedError) {
        if (model.kind === "image") {
          await this.tryFailGeneration(uuid, String(error));
        } else {
          if (!freeInternal) await creditService.release(uuid);
          await db.update(videos).set({ status: VideoStatus.FAILED, errorMessage: String(error), updatedAt: new Date() }).where(eq(videos.uuid, uuid));
        }
        if (isMeasuredVideoTool(model.id)) {
          throw new ApiError(
            "The provider declined the source or options. Reserved credits were released.",
            422,
            { code: "TOOL_PROVIDER_REJECTED" },
          );
        }

        if (model.tool === "extend") {
          throw new ApiError("The provider rejected the source or options", 422, { code: "EXTEND_REJECTED" });
        }
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      await db
        .update(videos)
        .set({ errorMessage: `SUBMIT_UNKNOWN: ${message}`, updatedAt: new Date() })
        .where(eq(videos.uuid, uuid))
        .catch((updateError: unknown) => console.error(`Failed to record SUBMIT_UNKNOWN for ${uuid}:`, updateError));
      throw new ApiError("Submission result unknown; it will be reconciled", 202, { code: "SUBMIT_RESULT_UNKNOWN", videoUuid: uuid });
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const [saved] = await db
          .update(videos)
          .set({
            // A fast image callback may have already delivered or released the hold.
            status: model.kind === "image"
              ? sql`case when ${videos.status} = 'PENDING' then 'GENERATING' else ${videos.status} end`
              : VideoStatus.GENERATING,
            externalTaskId: taskId, updatedAt: new Date(),
          })
          .where(eq(videos.uuid, uuid))
          .returning({ status: videos.status, creditsUsed: videos.creditsUsed });
        if (!saved) throw new Error("Generation record was not found");
        return { videoUuid: uuid, taskId, provider: "kie", ...saved };
      } catch (error) {
        if (attempt === SUBMIT_SAVE_MAX_ATTEMPTS) {
          console.error(`Submitted but local save failed; needs reconciliation. uuid=${uuid} taskId=${taskId}`, error);
          throw new ApiError("Submitted but local save failed; it will be reconciled", 202, {
            code: "SUBMIT_RESULT_UNKNOWN",
            videoUuid: uuid,
            taskId,
          });
        }
        await delay(SUBMIT_SAVE_RETRY_DELAY_MS * attempt);
      }
    }
  }

  private async resolveExtendSource(userId: string, sourceVideoUuid?: string, sourceVideoKey?:string) {
    if (sourceVideoKey) {
      if (sourceVideoUuid)
        throw new ApiError("Choose one video to extend.", 400, { code: "SOURCE_VIDEO_UNAVAILABLE" });
      const { signedUrl } = await ownedExtendUpload(userId, sourceVideoKey);
      return { uuid: undefined, signedUrl };
    }
    if (!sourceVideoUuid) {
      throw new ApiError("Choose a video to work on", 400, { code: "MISSING_SOURCE_VIDEO" });
    }
    const [source] = await db
      .select({ uuid: videos.uuid, key: videos.videoUrl, size: videos.fileSize })
      .from(videos)
      .where(and(
        eq(videos.userId, userId),
        eq(videos.uuid, sourceVideoUuid),
        eq(videos.isDeleted, false),
        eq(videos.status, VideoStatus.COMPLETED),
        or(eq(videos.mediaType, "video"), isNull(videos.mediaType)),
      ))
      .limit(1);
    // Only sign an output in this creation's own directory. Legacy external
    // URLs, upload keys and arbitrary paths cannot be verified as our output.
    if (!source?.key || !source.key.startsWith(`videos/${source.uuid}/`) ||
        !/^videos\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(mp4|mov|mkv|avi|webm)$/i.test(source.key)) {
      throw new ApiError("This video cannot be used", 400, { code: "SOURCE_VIDEO_UNAVAILABLE" });
    }

    // New completions record the uploaded byte count. Older rows need an
    // authenticated HEAD on the same immutable key we will sign for KIE.
    try {
      const storage = getStorage();
      const size = source.size ?? await storage.getObjectSize(source.key);
      if (!Number.isSafeInteger(size) || size <= 0) {
        throw new Error("Invalid source object size");
      }
      if (size > MAX_SOURCE_VIDEO_BYTES) {
        throw new ApiError("The video is larger than 50 MB", 400, { code: "SOURCE_VIDEO_TOO_LARGE" });
      }
      return { uuid: source.uuid, signedUrl: storage.getSignedUrl(source.key, 3600) };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Unable to verify the source video", 503, { code: "SOURCE_VIDEO_UNVERIFIED" });
    }
  }

  /**
   * Look up an existing non-deleted video by idempotency key.
   */
  private async findByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ) {
    const [existing] = await db
      .select()
      .from(videos)
      .where(
        and(
          eq(videos.userId, userId),
          eq(videos.isDeleted, false),
              eq(videos.idempotencyKey, idempotencyKey)
        )
      )
      .limit(1);
    return existing ?? null;
  }

  /**
   * Handle AI Callback
   */
  async handleCallback(
    providerType: ProviderType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any,
    videoUuid: string
  ): Promise<void> {
    const provider = getProvider(providerType);
    const result = provider.parseCallback(payload);

    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.uuid, videoUuid))
      .limit(1);

    if (!video) {
      console.error(`Video not found: ${videoUuid}`);
      return;
    }

    if (video.externalTaskId && video.externalTaskId !== result.taskId) {
      console.error(
        `Task ID mismatch: expected ${video.externalTaskId}, got ${result.taskId}`
      );
      return;
    }

    if (result.status === "completed" && (result.videoUrl || video.mediaType === "image")) {
      await this.tryCompleteGeneration(video.uuid, result);
    } else if (result.status === "failed") {
      await this.tryFailGeneration(video.uuid, result.error?.message);
    }
  }

  /**
   * Get task status (for frontend polling)
   */
  async refreshStatus(
    videoUuid: string,
    userId: string
  ): Promise<{
    status: string;
    videoUrl?: string;
    /** Every output (image sets have several); the first equals videoUrl. */
    mediaUrls?: string[];
    mediaType?: string;
    error?: string;
  }> {
    const [video] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.uuid, videoUuid), eq(videos.userId, userId)))
      .limit(1);

    if (!video) {
      throw new ApiError("Video not found", 404);
    }

    if (video.status === VideoStatus.COMPLETED || video.status === VideoStatus.FAILED) {
      await this.refundFailedImage(video);
      return {
        status: video.status,
        videoUrl: signMediaRef(video.videoUrl) || undefined,
        mediaUrls: video.status === VideoStatus.COMPLETED ? this.mediaUrlsOf(video) : undefined,
        mediaType: video.mediaType,
        error: video.errorMessage || undefined,
      };
    }

    if (video.externalTaskId && video.provider) {
      try {
        const provider = getProvider(video.provider as ProviderType);
        const result = await provider.getTaskStatus(video.externalTaskId);

        if (result.status === "completed" && (result.videoUrl || video.mediaType === "image")) {
          const updated = await this.tryCompleteGeneration(video.uuid, result);
          const [fresh] = await db.select().from(videos).where(eq(videos.uuid, video.uuid)).limit(1);
          return {
            status: updated.status,
            videoUrl: updated.videoUrl || undefined,
            mediaUrls: fresh && fresh.status === VideoStatus.COMPLETED ? this.mediaUrlsOf(fresh) : undefined,
            mediaType: video.mediaType,
            ...(fresh?.status === VideoStatus.FAILED ? { error: fresh.errorMessage ?? undefined } : {}),
          };
        }

        if (result.status === "failed") {
          const updated = await this.tryFailGeneration(
            video.uuid,
            result.error?.message
          );
          return {
            status: updated.status,
            error: updated.errorMessage || undefined,
          };
        }
        if (result.status === "processing" && video.status === VideoStatus.PENDING) {
          const [updated] = await db
            .update(videos)
            .set({
              status: VideoStatus.GENERATING,
              updatedAt: new Date(),
            })
            .where(and(eq(videos.uuid, video.uuid), eq(videos.status, VideoStatus.PENDING)))
            .returning({ status: videos.status });
          if (updated) return updated;
          const [current] = await db.select({ status: videos.status }).from(videos).where(eq(videos.uuid, video.uuid));
          if (current) return current;
        }
      } catch (error) {
        console.error("Failed to refresh status from provider:", error);
      }
    }

    return { status: video.status };
  }

  /** Signed URLs for every stored output of a completed row. */
  private mediaUrlsOf(row: { videoUrl: string | null; parameters: Record<string, unknown> | null }): string[] {
    const extra = Array.isArray(row.parameters?.extraKeys) ? (row.parameters?.extraKeys as unknown[]) : [];
    return [row.videoUrl, ...extra]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .map((value) => signMediaRef(value))
      .filter((value): value is string => Boolean(value));
  }

  /**
   * Refresh status by external task id
   */
  async refreshStatusByTaskId(taskId: string, userId: string) {
    const [video] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.externalTaskId, taskId), eq(videos.userId, userId)))
      .limit(1);

    if (!video) {
      throw new ApiError("Video not found", 404);
    }

    return this.refreshStatus(video.uuid, userId);
  }

  /**
   * Try to complete generation (transaction + row lock)
   */
  async tryCompleteGeneration(
    videoUuid: string,
    result: VideoTaskResponse
  ): Promise<{ status: string; videoUrl?: string | null }> {
    const [claimed] = await db
      .update(videos)
      .set({
        status: VideoStatus.UPLOADING,
        originalVideoUrl: result.videoUrl,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(videos.uuid, videoUuid),
          or(
            inArray(videos.status, [VideoStatus.PENDING, VideoStatus.GENERATING]),
            and(
              eq(videos.status, VideoStatus.UPLOADING),
              lt(videos.updatedAt, new Date(Date.now() - STALE_UPLOAD_CLAIM_MS)),
            ),
          ),
        )
      )
      .returning();

    if (!claimed) {
      const [current] = await db
        .select()
        .from(videos)
        .where(eq(videos.uuid, videoUuid))
        .limit(1);
      if (!current) throw new Error("Video not found");
      await this.refundFailedImage(current);
      return {
        status: current.status,
        videoUrl:
          current.status === VideoStatus.COMPLETED
            ? signMediaRef(current.videoUrl)
            : null,
      };
    }

    const stamp = Date.now();
    const sources = result.resultUrls?.length ? result.resultUrls : result.videoUrl ? [result.videoUrl] : [];
    let uploaded: { key: string };
    let videoFileSize: number | undefined;
    let extraKeys: string[] = [];
    if (claimed.mediaType === "image") {
      // Image sets: keep every output. The first is the cover; the rest are
      // stored in parameters.extraKeys. The source decides the content type.
      const outputs = [...new Set(sources)];
      const expected = claimed.parameters?.count;
      if (outputs.length < (typeof expected === "number" ? expected : 1)) {
        return this.tryFailGeneration(videoUuid, "The provider returned an incomplete image batch", true);
      }
      try {
        const storage = getStorage();
        const transfers = await Promise.allSettled(
          outputs.map((sourceUrl, index) =>
            storage.downloadAndUpload({
              sourceUrl,
              key: `images/${videoUuid}/${stamp}-${index}.${mediaExtension(sourceUrl, "png")}`,
              requireNonEmpty: true,
            }),
          ),
        );
        const stored = transfers.flatMap(item => item.status === "fulfilled" ? [item.value] : []);
        if (stored.length !== outputs.length || !stored.every(file => file.fileSize > 0)) {
          // Even a zero-byte receipt can refer to an object we must remove.
          // A cleanup failure must not keep the user's credits frozen.
          await Promise.allSettled(stored.map(file => storage.deleteFile(file.key)));
          throw new Error("Incomplete image transfer");
        }
        uploaded = stored[0];
        extraKeys = stored.slice(1).map(file => file.key);
      } catch {
        return this.tryFailGeneration(videoUuid, "Failed to store the generated images", true);
      }
    } else {
      try {
        if (claimed.mediaType === "audio") {
          uploaded = await getStorage().downloadAndUpload({
            sourceUrl: sources[0],
            key: `audio/${videoUuid}/${stamp}.${mediaExtension(sources[0], "mp3")}`,
          });
        } else {
          const storedVideo = await getStorage().downloadAndUpload({
            sourceUrl: sources[0],
            key: `videos/${videoUuid}/${stamp}.mp4`,
            contentType: "video/mp4",
          });
          uploaded = storedVideo;
          videoFileSize = storedVideo.fileSize;
        }
      } catch (error) {
        // Give the claim back so the next callback or status check retries the
        // transfer; the credits stay reserved until it completes or fails.
        await db
          .update(videos)
          .set({ status: VideoStatus.GENERATING, updatedAt: new Date() })
          .where(and(eq(videos.uuid, videoUuid), eq(videos.status, VideoStatus.UPLOADING)))
          .catch((resetError: unknown) => console.error(`Failed to release the upload claim for ${videoUuid}:`, resetError));
        throw error;
      }
    }

    if (claimed.creditsUsed > 0) await creditService.settle(videoUuid);

    const [completed] = await db
      .update(videos)
      .set({
        status: VideoStatus.COMPLETED,
        videoUrl: uploaded.key,
        fileSize: videoFileSize,
        ...(extraKeys.length > 0
          ? { parameters: { ...(claimed.parameters ?? {}), extraKeys } }
          : {}),
        thumbnailUrl: result.thumbnailUrl || null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(videos.uuid, videoUuid),
          eq(videos.status, VideoStatus.UPLOADING)
        )
      )
      .returning();

    if (!completed) {
      const [current] = await db
        .select()
        .from(videos)
        .where(eq(videos.uuid, videoUuid))
        .limit(1);
      if (!current) throw new Error("Video not found");
      return {
        status: current.status,
        videoUrl: signMediaRef(current.videoUrl),
      };
    }

    const signedUrl = signMediaRef(uploaded.key);
    emitVideoEvent({
      userId: completed.userId,
      videoUuid,
      status: "COMPLETED",
      videoUrl: signedUrl ?? undefined,
      thumbnailUrl: result.thumbnailUrl || null,
    });

    return { status: VideoStatus.COMPLETED, videoUrl: signedUrl };
  }

  private async refundFailedImage(video: Video): Promise<void> {
    if (video.mediaType !== "image" || video.status !== VideoStatus.FAILED) return;
    // Older failed rows can still carry the original quote.
    if (video.creditsUsed !== 0) {
      await db.update(videos).set({ creditsUsed: 0 })
        .where(and(eq(videos.uuid, video.uuid), eq(videos.status, VideoStatus.FAILED)));
    }
    // The hold records what is left to refund even when the displayed charge is zero.
    await creditService.release(video.uuid, { ifHolding: true });
  }

  private async tryFailGeneration(
    videoUuid: string,
    errorMessage?: string,
    imageDeliveryFailed = false,
  ): Promise<{ status: string; errorMessage?: string | null }> {
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.uuid, videoUuid))
      .limit(1);

    if (!video) throw new Error("Video not found");
    if (video.status === VideoStatus.COMPLETED || video.status === VideoStatus.FAILED) {
      await this.refundFailedImage(video);
      return { status: video.status, errorMessage: video.errorMessage };
    }
    const failFrom: VideoStatus[] = [VideoStatus.PENDING, VideoStatus.GENERATING];
    if (video.mediaType !== "image") {
      if (video.creditsUsed > 0) await creditService.release(videoUuid);
      failFrom.push(VideoStatus.UPLOADING);
    }

    const message = errorMessage || "Generation failed";
    const [failed] = await db
      .update(videos)
      .set({
        status: VideoStatus.FAILED,
        ...(video.mediaType === "image" ? { creditsUsed: 0 } : {}),
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(videos.uuid, videoUuid),
          // Only the image uploader can surrender its claim after a delivery failure.
          imageDeliveryFailed ? eq(videos.status, VideoStatus.UPLOADING) : inArray(videos.status, failFrom)
        )
      )
      .returning();

    if (!failed) {
      const [current] = await db
        .select()
        .from(videos)
        .where(eq(videos.uuid, videoUuid))
        .limit(1);
      if (!current) throw new Error("Video not found");
      await this.refundFailedImage(current);
      return { status: current.status, errorMessage: current.errorMessage };
    }

    emitVideoEvent({
      userId: failed.userId,
      videoUuid,
      status: "FAILED",
      error: message,
    });
    await this.refundFailedImage(failed);
    return { status: VideoStatus.FAILED, errorMessage: message };
  }

  /**
   * Get video details
   */
  async getVideo(uuid: string, userId: string) {
    const [video] = await db
      .select()
      .from(videos)
      .where(
        and(
          eq(videos.uuid, uuid),
          eq(videos.userId, userId),
          eq(videos.isDeleted, false)
        )
      )
      .limit(1);
    return video ? this.signVideoRow(video) : null;
  }

  /**
   * Get user video list
   */
  async listVideos(
    userId: string,
    options?: {
      limit?: number;
      cursor?: string;
      status?: string;
      /** Defaults to videos so image and audio rows stay out of video lists. */
      mediaType?: "video" | "image" | "audio";
    }
  ) {
    const limit = options?.limit || 20;

    const conditions = [
      eq(videos.userId, userId),
      eq(videos.isDeleted, false),
      eq(videos.mediaType, options?.mediaType ?? "video"),
    ];

    if (options?.status) {
      conditions.push(eq(videos.status, options.status as typeof VideoStatus[keyof typeof VideoStatus]));
    }

    if (options?.cursor) {
      const [cursorVideo] = await db
        .select({ createdAt: videos.createdAt })
        .from(videos)
        .where(eq(videos.uuid, options.cursor))
        .limit(1);

      if (cursorVideo) {
        conditions.push(lt(videos.createdAt, cursorVideo.createdAt));
      }
    }

    const list = await db
      .select()
      .from(videos)
      .where(and(...conditions))
      .orderBy(desc(videos.createdAt))
      .limit(limit + 1);

    const hasMore = list.length > limit;
    if (hasMore) list.pop();

    return {
      videos: list.map((video) => ({
        ...this.signVideoRow(video),
        mediaUrls: video.status === VideoStatus.COMPLETED ? this.mediaUrlsOf(video) : undefined,
      })),
      nextCursor: hasMore ? list[list.length - 1]?.uuid : undefined,
    };
  }

  /**
   * Delete video (soft delete)
   */
  async deleteVideo(uuid: string, userId: string): Promise<string | null> {
    const [row] = await db.update(videos)
      .set({
        isDeleted: true,
        // A lost DELETE response can be retried without invalidating its undo.
        deletionToken: sql`CASE WHEN ${videos.isDeleted} THEN ${videos.deletionToken} ELSE ${crypto.randomUUID()} END`,
        updatedAt: new Date(),
      })
      .where(and(eq(videos.uuid, uuid), eq(videos.userId, userId)))
      .returning({ token: videos.deletionToken });
    return row?.token ?? null;
  }

  async restoreVideo(uuid: string, userId: string, undoToken: string): Promise<boolean> {
    const [restored] = await db.update(videos)
      .set({ isDeleted: false })
      .where(and(eq(videos.uuid, uuid), eq(videos.userId, userId), eq(videos.deletionToken, undoToken)))
      .returning({ uuid: videos.uuid });
    return Boolean(restored);
  }

}

export const videoService = new VideoService();
