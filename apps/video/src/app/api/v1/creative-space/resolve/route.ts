import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db, mediaAssets, videos } from "@/db";
import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { signMediaRef } from "@/lib/storage";

const schema = z.object({
  uuids: z.array(z.string().min(1).max(80)).max(200).default([]),
  keys: z.array(z.string().min(1).max(1024)).max(200).default([]),
});

function chunks<T>(list: T[], size = 90): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size));
  return out;
}

/**
 * Fresh signed URLs for the media a saved canvas refers to, in one request
 * instead of one status call per node. Only the caller's own rows; running
 * jobs are reported as such (the canvas keeps polling their status route,
 * which also advances them).
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError("The request is not valid.", 400, { code: "INVALID_REQUEST" });
    const { uuids, keys } = parsed.data;
    const results: Record<string, { status: string; urls: string[]; mediaType?: string; error?: string }> = {};
    // D1 allows 100 bound parameters per query: ask in chunks.
    for (const chunk of chunks(uuids)) {
      const rows = await db
        .select({
          uuid: videos.uuid,
          status: videos.status,
          mediaType: videos.mediaType,
          videoUrl: videos.videoUrl,
          parameters: videos.parameters,
          errorMessage: videos.errorMessage,
        })
        .from(videos)
        .where(and(eq(videos.userId, user.id), eq(videos.isDeleted, false), inArray(videos.uuid, chunk)));
      for (const row of rows) {
        const extra = Array.isArray(row.parameters?.extraKeys) ? (row.parameters.extraKeys as unknown[]) : [];
        const urls = row.status === "COMPLETED"
          ? [row.videoUrl, ...extra]
              .filter((value): value is string => typeof value === "string" && value.length > 0)
              .map((value) => signMediaRef(value))
              .filter((value): value is string => Boolean(value))
          : [];
        results[row.uuid] = {
          status: row.status,
          urls,
          ...(row.mediaType ? { mediaType: row.mediaType } : {}),
          ...(row.errorMessage ? { error: row.errorMessage } : {}),
        };
      }
    }
    const assets: Record<string, string> = {};
    for (const chunk of chunks(keys)) {
      const rows = await db
        .select({ key: mediaAssets.key })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.userId, user.id), inArray(mediaAssets.key, chunk)));
      for (const row of rows) {
        const url = signMediaRef(row.key);
        if (url) assets[row.key] = url;
      }
    }
    return apiSuccess({ results, assets });
  } catch (error) {
    return handleApiError(error);
  }
}
