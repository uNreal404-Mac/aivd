import { NextRequest } from "next/server";
import { videoService } from "@/services/video";
import { requireAuth } from "@/lib/api/auth";
import { canGenerateInPreview } from "@/lib/internal-test-account";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { z } from "zod";
import { isAllowedImageInput } from "@/lib/image-url-allowlist";
import { WAN_REFERENCE_MAX_FILES } from "@/lib/wan-video-references";
import { imageRefSchema } from "@/lib/image-ref-schema";
import { getStorage } from "@/lib/storage";
import {
  isSafetyApproved,
  moderateContent,
  safetyMessage,
} from "@/lib/content-safety";
// Import proxy configuration for fetch requests
import "@/lib/proxy-config";

const generateSchema = z.object({
  prompt: z.string().min(1).max(10000),
  model: z.string().min(1),
  duration: z.number().optional(),
  aspectRatio: z.string().optional(),
  quality: z.string().optional(),
  imageUrl: imageRefSchema.optional(),
  imageUrls: z.array(imageRefSchema).optional(),
  videoKeys: z.array(z.string().min(1).max(512)).min(1).max(WAN_REFERENCE_MAX_FILES).optional(),
  mode: z.string().optional(),
  outputNumber: z.number().int().min(1).optional().default(1),
  generateAudio: z.boolean().optional(),
  idempotencyKey: z.string().max(200).optional(),
  /** Extend a video: one of the caller's own finished videos. */
  sourceVideoUuid: z.string().max(64).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!canGenerateInPreview(user)) {
      return apiError(
        "Video generation is coming soon — this preview does not run real video generation. No credits were used.",
        503,
        { code: "GENERATION_DISABLED" },
      );
    }

    const body = await request.json();
    const data = generateSchema.parse(body);
    // The session cookie can change between reserving a retry key and POST.
    const retryAccount = request.headers.get("X-Extend-Account");
    if (retryAccount !== null && retryAccount !== user.id) {
      return apiError("Your account changed. Please try again.", 409, { code: "ACCOUNT_CHANGED" });
    }

    const imageUrls = [
      ...(data.imageUrl ? [data.imageUrl] : []),
      ...(data.imageUrls ?? []),
    ];
    if (
      imageUrls.some(
        (imageUrl) => !isAllowedImageInput(imageUrl, { userId: user.id }),
      )
    ) {
      return apiError("Image URL host is not allowed.", 400, {
        code: "IMAGE_URL_NOT_ALLOWED",
      });
    }

    const safetyImages = imageUrls.map((imageUrl, index) => ({
      url: /^https?:\/\//i.test(imageUrl)
        ? imageUrl
        : getStorage().getSignedUrl(imageUrl),
      label: `reference-${index + 1}`,
    }));
    const locale = request.headers.get("accept-language") ?? "en";
    const safety = await moderateContent({
      text: data.prompt,
      images: safetyImages,
      context: "generation",
    });
    if (!isSafetyApproved(safety)) {
      return apiError(safetyMessage(safety, locale), 422, {
        code: "CONTENT_BLOCKED",
        decision: safety.decision,
        categories: safety.categories,
      });
    }

    const headerKey = request.headers.get("Idempotency-Key");
    const idempotencyKey = headerKey
      ? headerKey.slice(0, 200)
      : data.idempotencyKey;

    const result = await videoService.generate({
      userId: user.id,
      prompt: data.prompt,
      model: data.model,
      duration: data.duration,
      aspectRatio: data.aspectRatio,
      quality: data.quality,
      imageUrl: data.imageUrl,
      imageUrls: data.imageUrls,
      mode: data.mode,
      videoKeys: data.videoKeys,
      outputNumber: data.outputNumber,
      generateAudio: data.generateAudio,
      idempotencyKey,
      sourceVideoUuid: data.sourceVideoUuid,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
