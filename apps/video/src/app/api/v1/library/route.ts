import { desc, eq } from "drizzle-orm";
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
