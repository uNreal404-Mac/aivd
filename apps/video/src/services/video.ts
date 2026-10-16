import { VideoStatus, db, videos } from "@/db";
import { and, desc, eq, lt, sql } from "drizzle-orm";
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

export interface GenerateVideoParams {
  userId: string;
  prompt: string;
  model: string; // "sora-2"
  duration?: number;
  aspectRatio?: string; // "16:9" | "9:16"
  quality?: string; // "standard" | "high"
  imageUrl?: string; // image-to-video
  imageUrls?: string[]; // image-to-video (multi-image)
  mode?: string;
  outputNumber?: number;
  generateAudio?: boolean;
  idempotencyKey?: string;
}

export interface VideoGenerationResult {
  videoUuid: string;
  taskId: string;
  provider: ProviderType;
  status: string;
  estimatedTime?: number;
  creditsUsed: number;
}

const SUBMIT_SAVE_MAX_ATTEMPTS = 3;
const SUBMIT_SAVE_RETRY_DELAY_MS = 200;

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

    const effectiveDuration = params.duration || modelConfig.durations[0] || 5;

    const outputNumber = Math.max(1, params.outputNumber ?? 1);
    const creditsRequired = calculateModelCredits(params.model, {
      duration: effectiveDuration,
      quality: params.quality,
    }) * outputNumber;

    const hasImageInput =
      (params.imageUrls && params.imageUrls.length > 0) || Boolean(params.imageUrl);
    const resolvedMode = normalizeGenerationMode(params.mode, hasImageInput);

    if (
      (resolvedMode === "image-to-video" ||
        resolvedMode === "reference-to-video" ||
        resolvedMode === "frames-to-video") &&
      !hasImageInput
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

    const provider = getProvider(actualProvider);
    const videoUuid = `vid_${nanoid(21)}`;

    const parameters: Record<string, unknown> = {
      duration: params.duration,
      aspectRatio: params.aspectRatio,
      quality: params.quality,
      outputNumber,
      mode: resolvedMode,
      imageUrl: params.imageUrl,
      imageUrls: params.imageUrls,
      generateAudio: params.generateAudio,
    };
    if (idempotencyKey) {
      parameters.idempotencyKey = idempotencyKey;
    }

    // Insert the video row. When an idempotency key is provided, take an
    // advisory lock keyed on (userId, key) so concurrent double submits
    // serialize: the second caller will see the first caller's row.
    let videoResult: { uuid: string; id: number } | undefined;
    if (idempotencyKey) {
      videoResult = await db.transaction(async (trx) => {
        await trx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`${params.userId}:${idempotencyKey}`}))`
        );

        const [existing] = await trx
          .select()
          .from(videos)
          .where(
            and(
              eq(videos.userId, params.userId),
              eq(videos.isDeleted, false),
              sql`${videos.parameters}->>'idempotencyKey' = ${idempotencyKey}`
            )
          )
          .limit(1);

        if (existing) {
          return { uuid: existing.uuid, id: existing.id };
        }

        const [inserted] = await trx
          .insert(videos)
          .values({
            uuid: videoUuid,
            userId: params.userId,
            prompt: params.prompt,
            model: params.model,
            parameters,
            status: VideoStatus.PENDING,
            startImageUrl: params.imageUrls?.[0] || params.imageUrl || null,
            creditsUsed: creditsRequired,
            duration: effectiveDuration,
            aspectRatio: params.aspectRatio || null,
            provider: actualProvider,
            updatedAt: new Date(),
          })
          .returning({ uuid: videos.uuid, id: videos.id });

        return inserted;
      });
    } else {
      const [inserted] = await db
        .insert(videos)
        .values({
          uuid: videoUuid,
          userId: params.userId,
          prompt: params.prompt,
          model: params.model,
          parameters,
          status: VideoStatus.PENDING,
          startImageUrl: params.imageUrls?.[0] || params.imageUrl || null,
          creditsUsed: creditsRequired,
          duration: effectiveDuration,
          aspectRatio: params.aspectRatio || null,
          provider: actualProvider,
          updatedAt: new Date(),
        })
        .returning({ uuid: videos.uuid, id: videos.id });
      videoResult = inserted;
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
      freezeResult = await creditService.freeze({
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
        aspectRatio: params.aspectRatio,
        quality: params.quality,
        imageUrl: signedImageUrl,
        imageUrls: signedImageUrls,
        mode: resolvedMode,
        outputNumber,
        generateAudio: params.generateAudio,
        callbackUrl,
      });
    } catch (error) {
      if (error instanceof ProviderRejectedError) {
        // Definite failure: the provider did not create a task.
        await creditService.release(videoResult.uuid);

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
      creditsUsed: creditsRequired,
    };
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
          sql`${videos.parameters}->>'idempotencyKey' = ${idempotencyKey}`
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

    if (result.status === "completed" && result.videoUrl) {
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
      return {
        status: video.status,
        videoUrl: signMediaRef(video.videoUrl) || undefined,
        error: video.errorMessage || undefined,
      };
    }

    if (video.externalTaskId && video.provider) {
      try {
        const provider = getProvider(video.provider as ProviderType);
        const result = await provider.getTaskStatus(video.externalTaskId);

        if (result.status === "completed" && result.videoUrl) {
          const updated = await this.tryCompleteGeneration(video.uuid, result);
          return {
            status: updated.status,
            videoUrl: updated.videoUrl || undefined,
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
          await db
            .update(videos)
            .set({
              status: VideoStatus.GENERATING,
              updatedAt: new Date(),
            })
            .where(eq(videos.uuid, video.uuid));
          return { status: VideoStatus.GENERATING };
        }
      } catch (error) {
        console.error("Failed to refresh status from provider:", error);
      }
    }

    return { status: video.status };
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
    return db.transaction(async (trx) => {
      const [video] = await trx
        .select()
        .from(videos)
        .where(eq(videos.uuid, videoUuid))
        .limit(1)
        .for("update");

      if (!video) {
        throw new Error("Video not found");
      }

      if (video.status === VideoStatus.COMPLETED) {
        return { status: video.status, videoUrl: signMediaRef(video.videoUrl) };
      }
      if (video.status === VideoStatus.FAILED) {
        return { status: video.status, videoUrl: null };
      }

      if (
        video.status !== VideoStatus.GENERATING &&
        video.status !== VideoStatus.UPLOADING
      ) {
        return { status: video.status, videoUrl: signMediaRef(video.videoUrl) };
      }

      await trx
        .update(videos)
        .set({
          status: VideoStatus.UPLOADING,
          originalVideoUrl: result.videoUrl,
          updatedAt: new Date(),
        })
        .where(eq(videos.uuid, videoUuid));

      const storage = getStorage();
      const key = `videos/${videoUuid}/${Date.now()}.mp4`;
      const uploaded = await storage.downloadAndUpload({
        sourceUrl: result.videoUrl!,
        key,
        contentType: "video/mp4",
      });

      await creditService.settle(videoUuid);

      await trx
        .update(videos)
        .set({
          status: VideoStatus.COMPLETED,
          videoUrl: uploaded.key,
          thumbnailUrl: result.thumbnailUrl || null,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(videos.uuid, videoUuid));

      const signedUrl = signMediaRef(uploaded.key);

      emitVideoEvent({
        userId: video.userId,
        videoUuid,
        status: "COMPLETED",
        videoUrl: signedUrl ?? undefined,
        thumbnailUrl: result.thumbnailUrl || null,
      });

      return { status: VideoStatus.COMPLETED, videoUrl: signedUrl };
    });
  }

  /**
   * Try to mark as failed (transaction + row lock)
   */
  private async tryFailGeneration(
    videoUuid: string,
    errorMessage?: string
  ): Promise<{ status: string; errorMessage?: string | null }> {
    return db.transaction(async (trx) => {
      const [video] = await trx
        .select()
        .from(videos)
        .where(eq(videos.uuid, videoUuid))
        .limit(1)
        .for("update");

      if (!video) {
        throw new Error("Video not found");
      }

      if (video.status === VideoStatus.COMPLETED || video.status === VideoStatus.FAILED) {
        return { status: video.status, errorMessage: video.errorMessage };
      }

      await creditService.release(videoUuid);

      await trx
        .update(videos)
        .set({
          status: VideoStatus.FAILED,
          errorMessage: errorMessage || "Generation failed",
          updatedAt: new Date(),
        })
        .where(eq(videos.uuid, videoUuid));

      emitVideoEvent({
        userId: video.userId,
        videoUuid,
        status: "FAILED",
        error: errorMessage || "Generation failed",
      });

      return {
        status: VideoStatus.FAILED,
        errorMessage: errorMessage || "Generation failed",
      };
    });
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
    }
  ) {
    const limit = options?.limit || 20;

    const conditions = [
      eq(videos.userId, userId),
      eq(videos.isDeleted, false),
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
      videos: list.map((video) => this.signVideoRow(video)),
      nextCursor: hasMore ? list[list.length - 1]?.uuid : undefined,
    };
  }

  /**
   * Delete video (soft delete)
   */
  async deleteVideo(uuid: string, userId: string): Promise<void> {
    await db
      .update(videos)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(videos.uuid, uuid), eq(videos.userId, userId)));
  }
}

export const videoService = new VideoService();
