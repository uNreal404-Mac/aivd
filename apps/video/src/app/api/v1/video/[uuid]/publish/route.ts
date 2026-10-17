import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { publishInputSchema } from "@/lib/gallery";
import { galleryService } from "@/services/gallery";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { uuid } = await params;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new ApiError("Request body must be valid JSON", 400);
    }

    const parsed = publishInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ApiError("Invalid request body", 400, parsed.error.issues);
    }

    const video = await galleryService.publish(user.id, uuid, parsed.data);

    return apiSuccess({
      uuid: video.uuid,
      visibility: video.visibility,
      publishedAt: video.publishedAt,
      galleryTitle: video.galleryTitle,
      galleryDescription: video.galleryDescription,
      promptProtected: video.promptProtected,
      assetsReusable: video.assetsReusable,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { uuid } = await params;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new ApiError("Request body must be valid JSON", 400);
    }

    const parsed = publishInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ApiError("Invalid request body", 400, parsed.error.issues);
    }

    const video = await galleryService.updatePublication(
      user.id,
      uuid,
      parsed.data
    );

    return apiSuccess({
      uuid: video.uuid,
      visibility: video.visibility,
      publishedAt: video.publishedAt,
      galleryTitle: video.galleryTitle,
      galleryDescription: video.galleryDescription,
      publicPrompt: video.publicPrompt,
      promptProtected: video.promptProtected,
      assetsReusable: video.assetsReusable,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
