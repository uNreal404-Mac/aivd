import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { videoService } from "@/services/video";

export async function POST(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  try {
    const user = await requireAuth(request);
    const { uuid } = await params;
    const restored = await videoService.restoreVideo(uuid, user.id);
    return restored ? apiSuccess({ restored }) : apiError("Creation not found", 404);
  } catch (error) {
    return handleApiError(error);
  }
}
