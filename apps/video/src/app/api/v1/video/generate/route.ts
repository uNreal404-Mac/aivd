import { NextRequest } from "next/server";
import { videoService } from "@/services/video";
import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { z } from "zod";
import { isAllowedImageInput } from "@/lib/image-url-allowlist";
// Import proxy configuration for fetch requests
import "@/lib/proxy-config";

const generateSchema = z.object({
  prompt: z.string().min(1).max(5000),
  model: z.string().min(1),
  duration: z.number().optional(),
  aspectRatio: z.string().optional(),
  quality: z.string().optional(),
  imageUrl: z.string().min(1).max(2048).optional(),
  imageUrls: z.array(z.string().min(1).max(2048)).optional(),
  mode: z.string().optional(),
  outputNumber: z.number().int().min(1).optional().default(1),
  generateAudio: z.boolean().optional(),
  idempotencyKey: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (process.env.VIDEO_GENERATION_ENABLED === "false") {
      return apiError(
        "Video generation is coming soon — this preview does not run real video generation. No credits were used.",
        503,
        { code: "GENERATION_DISABLED" },
      );
    }

    const user = await requireAuth(request);
    const body = await request.json();
    const data = generateSchema.parse(body);

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
      outputNumber: data.outputNumber,
      generateAudio: data.generateAudio,
      idempotencyKey,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
