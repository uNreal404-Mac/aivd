import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { galleryService } from "@/services/gallery";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { uuid } = await params;

    const video = await galleryService.unpublish(user.id, uuid);

    return apiSuccess({
      uuid: video.uuid,
      visibility: video.visibility,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
