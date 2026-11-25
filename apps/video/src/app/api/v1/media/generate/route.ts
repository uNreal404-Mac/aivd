import { VOICE_LANGUAGES } from "@/lib/audio-voice-settings";
import { generationRequestKey, readGenerationReplay } from "@/lib/api/generation-replay";
import { assertMediaAccount } from "@/lib/api/media-account";
import { NextRequest } from "next/server";
import { z } from "zod";

import { getMarketModel } from "@/ai/kie-market";
import { requireAuth } from "@/lib/api/auth";
import { canGenerateInPreview } from "@/lib/internal-test-account";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { isSafetyApproved, moderateContent, safetyMessage } from "@/lib/content-safety";
import { imageRefSchema } from "@/lib/image-ref-schema";
import { isAllowedImageInput } from "@/lib/image-url-allowlist";
import { getStorage } from "@/lib/storage";
import { videoService } from "@/services/video";
import "@/lib/proxy-config";

// Image and audio generation through KIE market models. Video market models
// go through /api/v1/video/generate, which delegates to the same service.
const schema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1).max(5000),
  aspectRatio: z.string().max(10).optional(),
  resolution: z.string().max(10).optional(),
  count: z.number().int().min(1).max(9).optional(),
  imageUrls: z.array(imageRefSchema).max(16).optional(),
  voice: z.string().max(64).optional(),
  style: z.string().max(1000).optional(),
  instrumental: z.boolean().optional(),
  customMode: z.boolean().optional(),
  voiceSettings: z.object({
    stability: z.number().min(0).max(1).optional(),
    similarity: z.number().min(0).max(1).optional(),
    expression: z.number().min(0).max(1).optional(),
    language: z.enum(VOICE_LANGUAGES).optional(),
  }).strict().optional(),
  speed: z.number().min(0.7).max(1.2).optional(),
  idempotencyKey: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    assertMediaAccount(request, user.id);

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const tooLong = parsed.error.issues.some((issue) => issue.path[0] === "prompt" && issue.code === "too_big");
      return apiError(tooLong ? "The prompt is too long: 5,000 characters at most." : "The request is not valid.", 400, {
        code: tooLong ? "PROMPT_TOO_LONG" : "INVALID_REQUEST",
      });
    }
    const data = parsed.data;
    const idempotencyKey = generationRequestKey(request, data.idempotencyKey);
    const replay = await readGenerationReplay(user.id, idempotencyKey);
    if (replay) return apiSuccess(replay);
    if (!canGenerateInPreview(user)) {
      return apiError("Generation is coming soon on this preview. No credits were used.", 503, {
        code: "GENERATION_DISABLED",
      });
    }
    const model = getMarketModel(data.model);
    if (!model || model.kind === "video") {
      return apiError("Unsupported model", 400, { code: "UNSUPPORTED_MODEL" });
    }

    const imageUrls = data.imageUrls ?? [];
    if (imageUrls.some((url) => !isAllowedImageInput(url, { userId: user.id }))) {
      return apiError("Image URL host is not allowed.", 400, { code: "IMAGE_URL_NOT_ALLOWED" });
    }

    const safety = await moderateContent({
      text: [data.prompt, data.style].filter(Boolean).join("\n"),
      images: imageUrls.map((url, index) => ({
        url: /^https?:\/\//i.test(url) ? url : getStorage().getSignedUrl(url),
        label: `reference-${index + 1}`,
      })),
      context: "generation",
    });
    if (!isSafetyApproved(safety)) {
      return apiError(safetyMessage(safety, request.headers.get("accept-language") ?? "en"), 422, {
        code: "CONTENT_BLOCKED",
        decision: safety.decision,
        categories: safety.categories,
      });
    }

    const result = await videoService.generateMedia({
      userId: user.id,
      model: model.id,
      prompt: data.prompt,
      aspectRatio: data.aspectRatio,
      resolution: data.resolution,
      count: data.count,
      imageUrls,
      voice: data.voice,
      style: data.style,
      instrumental: data.instrumental,
      customMode: data.customMode,
      speed: data.speed,
      voiceSettings: data.voiceSettings,
      idempotencyKey,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
