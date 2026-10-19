import { VideoStatus, db, videos } from "@/db";
import type { MediaType } from "@/db/schema";
import { and, asc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  getStorage,
  isStorageConfigured,
  isStorageKey,
  signMediaRef,
} from "@/lib/storage";
import { ApiError } from "@/lib/api/error";
import { ProviderRejectedError } from "@/ai/types";
import {
  getKieMediaClient,
  type KieMediaResult,
} from "@/ai/providers/kie-media";
import { generateSignedCallbackUrl } from "@/ai/utils/callback-signature";
import { creditService } from "./credit";
import { buildDedupeKey, DEDUPE_WINDOW_SECONDS } from "./video-dedupe";
import {
  DEFAULT_AUDIO_MODEL,
  DEFAULT_IMAGE_MODEL,
  getMediaModel,
} from "@/config/media-pricing";

export interface GenerateMediaParams {
  userId: string;
  mediaType: "image" | "audio";
  prompt: string;
  model?: string;
  imageUrls?: string[];
  aspectRatio?: string;
  instrumental?: boolean;
  style?: string;
  title?: string;
  idempotencyKey?: string;
}

export interface MediaGenerationResult {
  uuid: string;
  mediaType: "image" | "audio";
  taskId: string;
  status: string;
  creditsUsed: number;
}

export interface MediaStatusResult {
  uuid: string;
  mediaType: "image" | "audio";
  status: string;
  urls: string[];
  error?: string;
}

type VideoRow = typeof videos.$inferSelect;
type ResolvedMediaType = "image" | "audio";

const SUBMIT_SAVE_MAX_ATTEMPTS = 3;
const SUBMIT_SAVE_RETRY_DELAY_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generation service for image + audio ("media") rows.
 *
 * Re-uses the `videos` table (with `mediaType` set), the credit hold flow and
 * the signed callback route. Only the final provider callback (or a completed
 * poll) settles credits.
 */
export class MediaGenerationService {
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

  private toResult(row: VideoRow): MediaGenerationResult {
    return {
      uuid: row.uuid,
      mediaType: row.mediaType === "audio" ? "audio" : "image",
      taskId: row.externalTaskId ?? "",
      status: row.status,
      creditsUsed: row.creditsUsed,
    };
  }

  private signImageInput(value: string): string {
    return isStorageKey(value) ? getStorage().getSignedUrl(value, 3600) : value;
  }

  private readResultKeys(
    parameters: Record<string, unknown> | null
  ): string[] {
    const keys = parameters?.resultKeys;
    if (!Array.isArray(keys)) return [];
    return keys.filter(
      (value): value is string => typeof value === "string" && value.length > 0
    );
  }

  private signResultKeys(keys: string[]): string[] {
    const urls: string[] = [];
    for (const key of keys) {
      if (isStorageKey(key) && !isStorageConfigured()) {
        continue;
      }
      const signed = signMediaRef(key);
      if (signed) {
        urls.push(signed);
      }
    }
    return urls;
  }

  async generate(params: GenerateMediaParams): Promise<MediaGenerationResult> {
    const mediaType = params.mediaType;
    const defaultModelId =
      mediaType === "image" ? DEFAULT_IMAGE_MODEL : DEFAULT_AUDIO_MODEL;
    const modelId = params.model ?? defaultModelId;

    const model = getMediaModel(mediaType, modelId);
    if (!model || !model.enabled) {
      throw new ApiError(`Unsupported model: ${modelId}`, 400, {
        code: "UNSUPPORTED_MODEL",
        model: modelId,
        mediaType,
      });
    }

    const imageUrls = params.imageUrls ?? [];

    for (const value of imageUrls) {
      if (
        isStorageKey(value) &&
        !value.startsWith(`uploads/${params.userId}/`)
      ) {
        throw new ApiError("Invalid image reference", 400, {
          code: "INVALID_IMAGE_REF",
        });
      }
    }

    if (mediaType === "audio" && imageUrls.length > 0) {
      throw new ApiError("Image input is not supported for this model", 400, {
        code: "IMAGE_INPUT_NOT_SUPPORTED",
        model: modelId,
      });
    }

    if (mediaType === "image" && imageUrls.length > 0 && !model.supportsImageInput) {
      throw new ApiError(
        `Model ${modelId} does not support image input`,
        400,
        {
          code: "IMAGE_INPUT_NOT_SUPPORTED",
          model: modelId,
        }
      );
    }

    const creditsRequired = model.siteCredits;
    const idempotencyKey = params.idempotencyKey;

    // Idempotency: a client-supplied key collapses retries onto one row.
    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(
        params.userId,
        idempotencyKey
      );
      if (existing) {
        return this.toResult(existing);
      }
    }

    const dedupeKey = buildDedupeKey({
      userId: params.userId,
      model: modelId,
      mode: mediaType,
      prompt: params.prompt,
      duration: 0,
      aspectRatio: params.aspectRatio,
      quality: JSON.stringify({
        style: params.style ?? null,
        title: params.title ?? null,
        instrumental: params.instrumental ?? null,
      }),
      imageUrls,
      outputNumber: 1,
      generateAudio: undefined,
    });

    const recentDuplicate = await this.findRecentDuplicate(
      params.userId,
      dedupeKey
    );
    if (recentDuplicate) {
      return this.toResult(recentDuplicate);
    }

    const rowUuid = `${mediaType === "image" ? "img" : "aud"}_${nanoid(21)}`;

    const parameters: Record<string, unknown> = {
      mediaType,
      aspectRatio: params.aspectRatio,
      imageUrls,
      instrumental: params.instrumental,
      style: params.style,
      title: params.title,
      dedupeKey,
      kieModel: model.kieModel,
    };
    if (idempotencyKey) {
      parameters.idempotencyKey = idempotencyKey;
    }

    const insert = db.insert(videos).values({
      uuid: rowUuid,
      userId: params.userId,
      mediaType,
      prompt: params.prompt,
      model: modelId,
      parameters,
      idempotencyKey: idempotencyKey ?? null,
      status: VideoStatus.PENDING,
      startImageUrl: imageUrls[0] ?? null,
      creditsUsed: creditsRequired,
      duration: null,
      aspectRatio: params.aspectRatio ?? null,
      provider: "kie",
      updatedAt: new Date(),
    });

    const [inserted] = idempotencyKey
      ? await insert
          .onConflictDoNothing({
            target: [videos.userId, videos.idempotencyKey],
          })
          .returning({ uuid: videos.uuid, id: videos.id })
      : await insert.returning({ uuid: videos.uuid, id: videos.id });

    let rowRef = inserted;
    if (!rowRef && idempotencyKey) {
      const existing = await this.findByIdempotencyKey(
        params.userId,
        idempotencyKey
      );
      if (existing) {
        rowRef = { uuid: existing.uuid, id: existing.id };
      }
    }

    if (!rowRef) {
      throw new Error("Failed to create media record");
    }

    if (rowRef.uuid !== rowUuid) {
      const [existing] = await db
        .select()
        .from(videos)
        .where(eq(videos.uuid, rowRef.uuid))
        .limit(1);
      if (existing) {
        return this.toResult(existing);
      }
    }

    // Race: the earliest inserted matching row wins. Drop ours if we lost.
    const winner = await this.findRecentDuplicate(params.userId, dedupeKey);
    if (winner && winner.uuid !== rowUuid) {
      await db.delete(videos).where(eq(videos.uuid, rowUuid));
      return this.toResult(winner);
    }

    let freezeResult: { success: boolean; holdId: number };
    try {
      freezeResult = await creditService.freeze({
        userId: params.userId,
        credits: creditsRequired,
        videoUuid: rowUuid,
      });
    } catch (error) {
      await db
        .update(videos)
        .set({
          status: VideoStatus.FAILED,
          errorMessage: String(error),
          updatedAt: new Date(),
        })
        .where(eq(videos.uuid, rowUuid));

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
        .where(eq(videos.uuid, rowUuid));
      throw new ApiError("Insufficient credits", 402, {
        code: "INSUFFICIENT_CREDITS",
        requiredCredits: creditsRequired,
      });
    }

    // Read the callback base URL at call time so env changes are picked up.
    const callbackBaseUrl = process.env.AI_CALLBACK_URL;
    const callbackUrl = callbackBaseUrl
      ? generateSignedCallbackUrl(`${callbackBaseUrl}/kie`, rowUuid)
      : undefined;

    const client = getKieMediaClient();

    let taskId: string;
    try {
      if (mediaType === "image") {
        const signedImageUrls = imageUrls.map((value) =>
          this.signImageInput(value)
        );
        const created = await client.createImageTask({
          kieModel: model.kieModel,
          prompt: params.prompt,
          imageUrls: signedImageUrls.length > 0 ? signedImageUrls : undefined,
          aspectRatio: params.aspectRatio,
          callbackUrl,
        });
        taskId = created.taskId;
      } else {
        const created = await client.createMusicTask({
          prompt: params.prompt,
          instrumental: params.instrumental,
          style: params.style,
          title: params.title,
          callbackUrl,
        });
        taskId = created.taskId;
      }
    } catch (error) {
      if (error instanceof ProviderRejectedError) {
        // Definite failure: no task was created. Release and mark FAILED.
        await creditService.release(rowUuid);

        await db
          .update(videos)
          .set({
            status: VideoStatus.FAILED,
            errorMessage: String(error),
            updatedAt: new Date(),
          })
          .where(eq(videos.uuid, rowUuid));
        throw error;
      }

      // Unknown outcome: keep the hold, keep the row, record for reconciliation.
      const message = error instanceof Error ? error.message : String(error);
      try {
        await db
          .update(videos)
          .set({
            errorMessage: `SUBMIT_UNKNOWN: ${message}`,
            updatedAt: new Date(),
          })
          .where(eq(videos.uuid, rowUuid));
      } catch (updateError) {
        console.error(
          `Failed to record SUBMIT_UNKNOWN for media ${rowUuid}:`,
          updateError
        );
      }

      throw new ApiError(
        "Submission result unknown; it will be reconciled",
        202,
        { code: "SUBMIT_RESULT_UNKNOWN", uuid: rowUuid }
      );
    }

    let saved = false;
    let lastSaveError: unknown;
    for (let attempt = 1; attempt <= SUBMIT_SAVE_MAX_ATTEMPTS; attempt++) {
      try {
        await db
          .update(videos)
          .set({
            status: VideoStatus.GENERATING,
            externalTaskId: taskId,
            provider: "kie",
            updatedAt: new Date(),
          })
          .where(eq(videos.uuid, rowUuid));
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
        `Media submitted but local save failed; needs reconciliation. uuid=${rowUuid} taskId=${taskId}`,
        lastSaveError
      );
      throw new ApiError(
        "Submission result unknown; it will be reconciled",
        202,
        { code: "SUBMIT_RESULT_UNKNOWN", uuid: rowUuid, taskId }
      );
    }

    return {
      uuid: rowUuid,
      mediaType,
      taskId,
      status: VideoStatus.GENERATING,
      creditsUsed: creditsRequired,
    };
  }

  async handleCallback(payload: unknown, uuid: string): Promise<void> {
    const [row] = await db
      .select()
      .from(videos)
      .where(eq(videos.uuid, uuid))
      .limit(1);

    if (!row) {
      console.error(`Media not found: ${uuid}`);
      return;
    }

    if (row.mediaType !== "image" && row.mediaType !== "audio") {
      console.error(`handleCallback: not a media row: ${uuid}`);
      return;
    }

    const client = getKieMediaClient();
    const result: KieMediaResult =
      row.mediaType === "image"
        ? client.parseImageCallback(payload)
        : client.parseMusicCallback(payload);

    if (
      row.externalTaskId &&
      result.taskId &&
      row.externalTaskId !== result.taskId
    ) {
      console.error(
        `Task ID mismatch: expected ${row.externalTaskId}, got ${result.taskId}`
      );
      return;
    }

    if (result.status === "completed") {
      await this.tryComplete(row.uuid, result);
      return;
    }

    if (result.status === "failed") {
      await this.tryFail(row.uuid, result.error?.message);
      return;
    }

    // Progress notification only: never settle credits here.
    if (row.status === VideoStatus.PENDING) {
      await db
        .update(videos)
        .set({
          status: VideoStatus.GENERATING,
          updatedAt: new Date(),
        })
        .where(eq(videos.uuid, row.uuid));
    }
  }

  async refreshStatus(
    uuid: string,
    userId: string
  ): Promise<MediaStatusResult> {
    const [row] = await db
      .select()
      .from(videos)
      .where(eq(videos.uuid, uuid))
      .limit(1);

    if (
      !row ||
      row.userId !== userId ||
      row.isDeleted ||
      (row.mediaType !== "image" && row.mediaType !== "audio")
    ) {
      throw new ApiError("Media not found", 404);
    }

    const resolvedMediaType: ResolvedMediaType =
      row.mediaType === "audio" ? "audio" : "image";

    if (
      row.status === VideoStatus.COMPLETED ||
      row.status === VideoStatus.FAILED
    ) {
      return {
        uuid: row.uuid,
        mediaType: resolvedMediaType,
        status: row.status,
        urls: this.signResultKeys(this.readResultKeys(row.parameters)),
        error: row.errorMessage || undefined,
      };
    }

    if (row.externalTaskId) {
      try {
        const client = getKieMediaClient();
        const result = await client.getTaskStatus(
          row.externalTaskId,
          resolvedMediaType
        );

        if (result.status === "completed") {
          await this.tryComplete(row.uuid, result);
        } else if (result.status === "failed") {
          await this.tryFail(row.uuid, result.error?.message);
        } else if (row.status === VideoStatus.PENDING) {
          await db
            .update(videos)
            .set({ status: VideoStatus.GENERATING, updatedAt: new Date() })
            .where(eq(videos.uuid, row.uuid));
        }
      } catch (error) {
        console.error(`Failed to refresh media status for ${uuid}:`, error);
      }
    }

    const [current] = await db
      .select()
      .from(videos)
      .where(eq(videos.uuid, uuid))
      .limit(1);
    const finalRow = current ?? row;

    return {
      uuid: finalRow.uuid,
      mediaType: resolvedMediaType,
      status: finalRow.status,
      urls: this.signResultKeys(this.readResultKeys(finalRow.parameters)),
      error: finalRow.errorMessage || undefined,
    };
  }

  /**
   * Download every produced asset into R2, settle credits, mark COMPLETED.
   * kie.ai keeps files for ~14 days, so we always copy them.
   */
  private async tryComplete(
    uuid: string,
    result: KieMediaResult
  ): Promise<string> {
    if (result.urls.length === 0) {
      // Never settle a "completed" result that has nothing to deliver.
      console.error(`Media ${uuid}: completed result without URLs; ignored`);
      const [current] = await db
        .select({ status: videos.status })
        .from(videos)
        .where(eq(videos.uuid, uuid))
        .limit(1);
      return current?.status ?? VideoStatus.GENERATING;
    }

    const [claimed] = await db
      .update(videos)
      .set({
        status: VideoStatus.UPLOADING,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(videos.uuid, uuid),
          inArray(videos.status, [
            VideoStatus.PENDING,
            VideoStatus.GENERATING,
          ])
        )
      )
      .returning();

    if (!claimed) {
      const [current] = await db
        .select()
        .from(videos)
        .where(eq(videos.uuid, uuid))
        .limit(1);
      if (!current) throw new Error("Media not found");
      return current.status;
    }

    const isImage = claimed.mediaType === "image";
    const keys: string[] = [];

    try {
      const storage = getStorage();
      for (let index = 0; index < result.urls.length; index++) {
        const key = isImage
          ? `images/${uuid}/${index}.png`
          : `audio/${uuid}/${index}.mp3`;
        const contentType = isImage ? "image/png" : "audio/mpeg";
        await storage.downloadAndUpload({
          sourceUrl: result.urls[index],
          key,
          contentType,
        });
        keys.push(key);
      }
    } catch (error) {
      // Revert so a later callback/poll can retry. Do not settle or release.
      await db
        .update(videos)
        .set({ status: VideoStatus.GENERATING, updatedAt: new Date() })
        .where(
          and(
            eq(videos.uuid, uuid),
            eq(videos.status, VideoStatus.UPLOADING)
          )
        );
      throw error;
    }

    await creditService.settle(uuid);

    const parameters = {
      ...(claimed.parameters ?? {}),
      resultKeys: keys,
      sourceUrls: result.urls,
    };

    await db
      .update(videos)
      .set({
        status: VideoStatus.COMPLETED,
        videoUrl: keys[0] ?? null,
        originalVideoUrl: result.urls[0] ?? null,
        thumbnailUrl: result.thumbnailUrl ?? null,
        parameters,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(videos.uuid, uuid),
          eq(videos.status, VideoStatus.UPLOADING)
        )
      );

    return VideoStatus.COMPLETED;
  }

  private async tryFail(uuid: string, message?: string): Promise<string> {
    const [row] = await db
      .select()
      .from(videos)
      .where(eq(videos.uuid, uuid))
      .limit(1);

    if (!row) throw new Error("Media not found");
    if (
      row.status === VideoStatus.COMPLETED ||
      row.status === VideoStatus.FAILED
    ) {
      return row.status;
    }

    await creditService.release(uuid);

    const failureMessage = message || "Generation failed";
    const [failed] = await db
      .update(videos)
      .set({
        status: VideoStatus.FAILED,
        errorMessage: failureMessage,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(videos.uuid, uuid),
          inArray(videos.status, [
            VideoStatus.PENDING,
            VideoStatus.GENERATING,
            VideoStatus.UPLOADING,
          ])
        )
      )
      .returning();

    if (!failed) {
      const [current] = await db
        .select()
        .from(videos)
        .where(eq(videos.uuid, uuid))
        .limit(1);
      if (!current) throw new Error("Media not found");
      return current.status;
    }

    return VideoStatus.FAILED;
  }

  private async findByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<VideoRow | null> {
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

  private async findRecentDuplicate(
    userId: string,
    dedupeKey: string,
    excludeUuid?: string
  ): Promise<VideoRow | null> {
    const since = new Date(Date.now() - DEDUPE_WINDOW_SECONDS * 1000);
    const conditions = [
      eq(videos.userId, userId),
      eq(videos.isDeleted, false),
      ne(videos.status, VideoStatus.FAILED),
      gte(videos.createdAt, since),
      sql`json_extract(${videos.parameters}, '$.dedupeKey') = ${dedupeKey}`,
    ];

    if (excludeUuid) {
      conditions.push(ne(videos.uuid, excludeUuid));
    }

    const [row] = await db
      .select()
      .from(videos)
      .where(and(...conditions))
      .orderBy(asc(videos.id))
      .limit(1);

    return row ?? null;
  }
}

export const mediaGenerationService = new MediaGenerationService();

/** Media type of a generation row, or null when the row does not exist. */
export async function getRowMediaType(uuid: string): Promise<MediaType | null> {
  const [row] = await db
    .select({ mediaType: videos.mediaType })
    .from(videos)
    .where(eq(videos.uuid, uuid))
    .limit(1);
  return row?.mediaType ?? null;
}
