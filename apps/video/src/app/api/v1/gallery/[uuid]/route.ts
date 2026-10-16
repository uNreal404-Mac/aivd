import { NextRequest } from "next/server";

import { apiSuccess, handleApiError } from "@/lib/api/response";
import { galleryService } from "@/services/gallery";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    const item = await galleryService.getPublic(uuid);

    return apiSuccess(item);
  } catch (error) {
    return handleApiError(error);
  }
}
