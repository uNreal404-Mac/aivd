import { and, desc, eq, lt } from "drizzle-orm";

import { db } from "@/db";
import { users, videos } from "@/db/schema";
import { ApiError } from "@/lib/api/error";
import {
  buildTemplate,
  canPublish,
  isMissingGallerySchemaError,
  resolvePublishFields,
  toGalleryItem,
} from "@/lib/gallery";
import { getAvailableModels } from "@/config/credits";
import { signMediaRef } from "@/lib/storage";

/** Publish payload, derived from the pure schema helper so the two stay in sync. */
type PublishInput = Parameters<typeof resolvePublishFields>[0]["input"];
type GalleryItem = ReturnType<typeof toGalleryItem>;
type GalleryTemplate = ReturnType<typeof buildTemplate>;
type PublishDenialCode = Extract<
  ReturnType<typeof canPublish>,
  { ok: false }
>["code"];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 24;

const MISSING_SCHEMA_WARNING =
  "[gallery] schema not migrated (0003_gallery.sql); returning empty list";

/** Row shape returned by the public gallery join before signing. */
type GalleryPageRow = {
  video: typeof videos.$inferSelect;
  authorName: string | null;
};

let warnedMissingSchema = false;

/** Emit the missing-migration warning at most once per process. */
function warnMissingGallerySchema(): void {
  if (warnedMissingSchema) return;
  warnedMissingSchema = true;
  console.warn(MISSING_SCHEMA_WARNING);
}

/** Map a `canPublish` denial code onto the matching API error. */
function publishError(code: PublishDenialCode): ApiError {
  switch (code) {
    case "NOT_FOUND":
      return new ApiError("Video not found", 404);
    case "FORBIDDEN":
      return new ApiError("You do not own this video", 403);
    case "NOT_COMPLETED":
      return new ApiError("Only completed videos can be published", 409);
    case "ALREADY_PUBLISHED":
      return new ApiError("Video is already in the gallery", 409);
  }
}

/** Accept either raw model ids or model objects when reading the catalog. */
function toModelId(model: { id: string } | string): string {
  return typeof model === "string" ? model : model.id;
}

export interface GalleryListResult {
  items: GalleryItem[];
  nextCursor: string | null;
}

export class GalleryService {
  /**
   * Publish a completed, owned, private video to the public gallery.
   * The write is a single conditional UPDATE so concurrent publishes are
   * duplicate-safe; when it matches nothing we re-read to classify the failure.
   */
  async publish(userId: string, uuid: string, input: PublishInput) {
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.uuid, uuid))
      .limit(1);

    const check = canPublish(video ?? null, userId);
    if (!check.ok || !video) {
      throw publishError(check.ok ? "NOT_FOUND" : check.code);
    }

    const [author] = await db
      .select({ isSuperAccount: users.isSuperAccount })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const fields = resolvePublishFields({
      isSuperAccount: Boolean(author?.isSuperAccount),
      originalPrompt: video.prompt,
      input,
    });

    const [updated] = await db
      .update(videos)
      .set({
        visibility: "public",
        publishedAt: new Date(),
        galleryTitle: fields.galleryTitle,
        galleryDescription: fields.galleryDescription,
        publicPrompt: fields.publicPrompt,
        promptProtected: fields.promptProtected,
        assetsReusable: fields.assetsReusable,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(videos.uuid, uuid),
          eq(videos.userId, userId),
          eq(videos.visibility, "private"),
          eq(videos.status, "COMPLETED"),
          eq(videos.isDeleted, false)
        )
      )
      .returning();

    if (!updated) {
      // Lost a race against a concurrent publish; re-read to map the outcome.
      const [current] = await db
        .select()
        .from(videos)
        .where(eq(videos.uuid, uuid))
        .limit(1);
      const recheck = canPublish(current ?? null, userId);
      throw publishError(recheck.ok ? "ALREADY_PUBLISHED" : recheck.code);
    }

    return updated;
  }

  /** Remove a video from the gallery. Owner only. */
  async unpublish(userId: string, uuid: string) {
    const [updated] = await db
      .update(videos)
      .set({ visibility: "private", updatedAt: new Date() })
      .where(
        and(
          eq(videos.uuid, uuid),
          eq(videos.userId, userId),
          eq(videos.isDeleted, false)
        )
      )
      .returning();

    if (!updated) {
      throw new ApiError("Video not found", 404);
    }

    return updated;
  }

  /** Cursor-paginated list of public, completed, non-deleted works. */
  async listPublic(params: {
    limit?: number;
    cursor?: string | null;
  }): Promise<GalleryListResult> {
    const requested = params.limit;
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(1, Math.floor(requested as number)), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const conditions = [
      eq(videos.visibility, "public"),
      eq(videos.isDeleted, false),
      eq(videos.status, "COMPLETED"),
    ];

    if (params.cursor) {
      const cursorDate = new Date(params.cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        conditions.push(lt(videos.publishedAt, cursorDate));
      }
    }

    let rows: GalleryPageRow[];
    try {
      rows = await db
        .select({ video: videos, authorName: users.name })
        .from(videos)
        .innerJoin(users, eq(users.id, videos.userId))
        .where(and(...conditions))
        .orderBy(desc(videos.publishedAt))
        .limit(limit + 1);
    } catch (error) {
      if (isMissingGallerySchemaError(error)) {
        warnMissingGallerySchema();
        return { items: [], nextCursor: null };
      }
      throw error;
    }

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const items = page.map((row) =>
      this.signItem(
        toGalleryItem({ ...row.video, authorName: row.authorName })
      )
    );

    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last?.video.publishedAt
        ? last.video.publishedAt.toISOString()
        : null;

    return { items, nextCursor };
  }

  /** Fetch a single public work, or throw 404 when it is not public. */
  async getPublic(uuid: string): Promise<GalleryItem> {
    try {
      const [row] = await db
        .select({ video: videos, authorName: users.name })
        .from(videos)
        .innerJoin(users, eq(users.id, videos.userId))
        .where(
          and(
            eq(videos.uuid, uuid),
            eq(videos.visibility, "public"),
            eq(videos.isDeleted, false),
            eq(videos.status, "COMPLETED")
          )
        )
        .limit(1);

      if (!row) {
        throw new ApiError("Gallery item not found", 404);
      }

      return this.signItem(
        toGalleryItem({ ...row.video, authorName: row.authorName })
      );
    } catch (error) {
      if (isMissingGallerySchemaError(error)) {
        throw new ApiError("Gallery item not found", 404);
      }
      throw error;
    }
  }

  /** Build the "Use Template" prefill payload for a public work. */
  async getTemplate(uuid: string): Promise<GalleryTemplate> {
    try {
      const item = await this.getPublic(uuid);
      const models = await getAvailableModels();

      return buildTemplate(item, models.map(toModelId));
    } catch (error) {
      if (isMissingGallerySchemaError(error)) {
        throw new ApiError("Gallery item not found", 404);
      }
      throw error;
    }
  }

  /**
   * Replace stored media keys with short-lived presigned URLs.
   * `?? original` keeps the field's declared type unchanged.
   */
  private signItem(item: GalleryItem): GalleryItem {
    return {
      ...item,
      videoUrl: signMediaRef(item.videoUrl) ?? item.videoUrl,
      thumbnailUrl: signMediaRef(item.thumbnailUrl) ?? item.thumbnailUrl,
      startImageUrl: signMediaRef(item.startImageUrl) ?? item.startImageUrl,
    };
  }
}

export const galleryService = new GalleryService();
