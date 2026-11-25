import { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api/response";
import { galleryService } from "@/services/gallery";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const limit =
      parsedLimit !== undefined && Number.isFinite(parsedLimit)
        ? parsedLimit
        : undefined;

    const result = searchParams.get("sort") === "rating"
      ? await galleryService.listPopular(limit)
      : await galleryService.listPublic({
          limit,
          cursor: searchParams.get("cursor") ?? undefined,
        });

    const response = apiSuccess(result);
    response.headers.set("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=300");
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
