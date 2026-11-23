import { and, desc, eq } from "drizzle-orm";
import { db, mediaAssets } from "@/db";
import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getStorage, SIGNED_URL_DEFAULT_TTL } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const assets = await db.select().from(mediaAssets)
      .where(eq(mediaAssets.userId, user.id))
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
    const body = await request.json() as { key?: unknown };
    if (typeof body.key !== "string" || !body.key.startsWith(`uploads/${user.id}/`)) return Response.json({ error: "invalid_key" }, { status: 400 });
    const [asset] = await db.select().from(mediaAssets).where(and(eq(mediaAssets.userId, user.id), eq(mediaAssets.key, body.key))).limit(1);
    if (!asset) return Response.json({ error: "not_found" }, { status: 404 });
    await getStorage().deleteFile(asset.key);
    await db.delete(mediaAssets).where(and(eq(mediaAssets.userId, user.id), eq(mediaAssets.key, asset.key)));
    return apiSuccess({ deleted: true });
  } catch (error) { return handleApiError(error); }
}
