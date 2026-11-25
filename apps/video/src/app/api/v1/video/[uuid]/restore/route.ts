import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { videoService } from "@/services/video";

export async function POST(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  try {
    const user = await requireAuth(request);
    const { uuid } = await params;
    const body = await request.json().catch(() => null);
    if (typeof body?.undoToken !== "string" || body.undoToken.length !== 36) {
      return apiError("A valid undo token is required", 400);
    }
    const restored = await videoService.restoreVideo(uuid, user.id, body.undoToken);
    return restored ? apiSuccess({ restored }) : apiError("Creation not found", 404);
  } catch (error) {
    return handleApiError(error);
  }
}
