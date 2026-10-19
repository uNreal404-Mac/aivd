import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { mediaGenerationService } from "@/services/media-generation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { uuid } = await params;
    const result = await mediaGenerationService.refreshStatus(uuid, user.id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
