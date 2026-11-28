import { and, desc, eq, like, notLike } from "drizzle-orm";
import { db, mediaAssets } from "@/db";
import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getStorage, SIGNED_URL_DEFAULT_TTL } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const canvasPrefix = `uploads/${user.id}/canvas/%`;
    const canvasScope = new URL(request.url).searchParams.get("scope") === "canvas";
    const assets = await db.select().from(mediaAssets)
      .where(and(eq(mediaAssets.userId, user.id), canvasScope ? like(mediaAssets.key, canvasPrefix) : notLike(mediaAssets.key, canvasPrefix)))
      .orderBy(desc(mediaAssets.createdAt)).limit(200);
    const storage = getStorage();
    return apiSuccess({ assets: assets.map((asset) => ({
      id: `upload:${asset.key}`, key: asset.key, name: asset.name,
      mimeType: asset.mimeType, size: asset.size,
      url: storage.getSignedUrl(asset.key, SIGNED_URL_DEFAULT_TTL),
    })) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json() as { key?: unknown; keys?: unknown; all?: unknown };
    const prefix = `uploads/${user.id}/`;
    const canvasScope = new URL(request.url).searchParams.get("scope") === "canvas";
    const canvasPrefix = `${prefix}canvas/`;
    const keys = body.all === true ? null : typeof body.key === "string" ? [body.key] : body.keys;
    if (keys !== null && (!Array.isArray(keys) || !keys.length || keys.length > 200 || keys.some((key) => typeof key !== "string" || !key.startsWith(prefix) || key.startsWith(canvasPrefix) !== canvasScope))) {
      return Response.json({ error: "invalid_key" }, { status: 400 });
    }
    const assets = await db.select().from(mediaAssets).where(eq(mediaAssets.userId, user.id));
    const requested = keys === null ? assets.filter((asset) => asset.key.startsWith(prefix) && asset.key.startsWith(canvasPrefix) === canvasScope) : assets.filter((asset) => (keys as string[]).includes(asset.key));
    if (keys !== null && requested.length !== new Set(keys as string[]).size) return Response.json({ error: "not_found" }, { status: 404 });
    const deletedKeys: string[] = [];
    const failedKeys: string[] = [];
    const storage = getStorage();
    for (let offset = 0; offset < requested.length; offset += 8) {
      await Promise.all(requested.slice(offset, offset + 8).map(async (asset) => {
        try {
          await storage.deleteFile(asset.key);
          await db.delete(mediaAssets).where(and(eq(mediaAssets.userId, user.id), eq(mediaAssets.key, asset.key)));
          deletedKeys.push(asset.key);
        } catch { failedKeys.push(asset.key); }
      }));
    }
    return apiSuccess({ deleted: failedKeys.length === 0, deletedKeys, failedKeys });
  } catch (error) { return handleApiError(error); }
}
