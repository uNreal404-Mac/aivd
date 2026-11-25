import { z } from "zod";
import { requireAuth } from "@/lib/api/auth";
import { assertMediaAccount } from "@/lib/api/media-account";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { VIDEO_EDIT_MODEL, VIDEO_MOTION_MODEL } from "@/lib/video-tool";
import {
  measuredVideoSource,
  ownedExtendUpload,
  validateCharacterImage,
} from "@/services/video-tool-source";

const schema = z.object({
  model: z.enum([VIDEO_EDIT_MODEL, VIDEO_MOTION_MODEL]),
  sourceVideoKey: z.string().max(512).optional(),
  sourceVideoUuid: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertMediaAccount(request, user.id);
    const body = await request.json();
    if (body?.model === "pixverse-v6/extend") {
      const key = z.string().min(1).max(512).parse(body.sourceVideoKey);
      const source = await ownedExtendUpload(user.id, key);
      return apiSuccess({ preview: source.signedUrl, name: source.name });
    }
    if (body?.characterKey !== undefined) {
      const key = z.string().min(1).max(512).parse(body.characterKey);
      const image = await validateCharacterImage(user.id, key);
      return apiSuccess({ preview: image.signedUrl });
    }
    const input = schema.parse(body);
    const source = await measuredVideoSource(user.id, input.model, input);
    return apiSuccess({ seconds: source.seconds, preview: source.signedUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
