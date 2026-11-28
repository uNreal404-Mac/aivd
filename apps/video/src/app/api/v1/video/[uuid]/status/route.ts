import { NextRequest } from "next/server";
import { videoService } from "@/services/video";
import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { uuid } = await params;

    // Refresh and get latest status
    const result = await videoService.refreshStatus(uuid, user.id);

    const row = result.status === "COMPLETED" ? await videoService.getVideo(uuid, user.id) : null;
    return apiSuccess({
      ...result,
      ...(row ? { model: row.model, parameters: row.parameters, duration: row.duration, resolution: row.resolution, aspectRatio: row.aspectRatio } : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
