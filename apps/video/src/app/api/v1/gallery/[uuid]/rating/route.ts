import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { galleryService } from "@/services/gallery";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    await galleryService.getPublic(uuid);
    return apiSuccess(await galleryService.getRating(uuid));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { uuid } = await params;
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError("Request body must be valid JSON", 400); }
    const score = typeof body === "object" && body !== null && "score" in body ? (body as { score: unknown }).score : undefined;
    if (typeof score !== "number") throw new ApiError("Rating must be an integer from 1 to 5", 400);
    return apiSuccess(await galleryService.ratePublic(user.id, uuid, score));
  } catch (error) {
    return handleApiError(error);
  }
}
