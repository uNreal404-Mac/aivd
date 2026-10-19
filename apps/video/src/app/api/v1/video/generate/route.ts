import { NextRequest } from "next/server";
import { videoService } from "@/services/video";
import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { z } from "zod";
import { isAllowedImageInput } from "@/lib/image-url-allowlist";
import { imageRefSchema } from "@/lib/image-ref-schema";
import { resolveGenerateImageInputs } from "@/lib/generate-image-inputs";
import { ProviderRejectedError } from "@/ai/types";
import { CAMERA_PRESET_IDS } from "@/lib/camera-presets";
// Import proxy configuration for fetch requests
import "@/lib/proxy-config";

const generateSchema = z.object({
  prompt: z.string().min(1).max(5000),
  model: z.string().min(1),
  duration: z.number().optional(),
  aspectRatio: z.string().optional(),
  quality: z.string().optional(),
  imageUrl: imageRefSchema.optional(),
  imageUrls: z.array(imageRefSchema).optional(),
  imageKey: imageRefSchema.optional(),
  imageKeys: z.array(imageRefSchema).optional(),
  mode: z.string().optional(),
  outputNumber: z.number().int().min(1).optional().default(1),
  generateAudio: z.boolean().optional(),
  cameraPreset: z.enum(CAMERA_PRESET_IDS).optional(),
  idempotencyKey: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (process.env.VIDEO_GENERATION_ENABLED !== "true") {
      return apiError(
        "Video generation is coming soon — this preview does not run real video generation. No credits were used.",
        503,
        { code: "GENERATION_DISABLED" },
      );
    }

    const user = await requireAuth(request);
    const body = await request.json();
    const data = generateSchema.parse(body);

    const imageInputs = resolveGenerateImageInputs(data);
    const imageUrls = [
      ...(imageInputs.imageUrl ? [imageInputs.imageUrl] : []),
      ...(imageInputs.imageUrls ?? []),
    ];

    if (
      imageUrls.length === 0 &&
      (imageInputs.requestedImage ||
        data.mode === "image-to-video" ||
        data.mode === "reference-to-video" ||
        data.mode === "frames-to-video")
    ) {
      return apiError("Image input is required for this mode.", 400, {
        code: "MISSING_INPUT_MEDIA",
      });
    }

    if (
      imageUrls.some(
        (imageUrl) => !isAllowedImageInput(imageUrl, { userId: user.id }),
      )
    ) {
      return apiError("Image URL host is not allowed.", 400, {
        code: "IMAGE_URL_NOT_ALLOWED",
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
      imageUrl: imageInputs.imageUrl,
      imageUrls: imageInputs.imageUrls,
      mode: data.mode,
      outputNumber: data.outputNumber,
      generateAudio: data.generateAudio,
      cameraPreset: data.cameraPreset,
      idempotencyKey,
    });

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ProviderRejectedError) {
      return apiError(
        `The video provider rejected the request: ${error.message}`,
        422,
        { code: "PROVIDER_REJECTED" },
      );
    }
    return handleApiError(error);
  }
}
