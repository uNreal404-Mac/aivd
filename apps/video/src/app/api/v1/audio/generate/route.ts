import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { mediaGenerationService } from "@/services/media-generation";
import { ProviderRejectedError } from "@/ai/types";
// Import proxy configuration for fetch requests
import "@/lib/proxy-config";

const generateSchema = z.object({
  prompt: z.string().min(1).max(3000),
  model: z.string().min(1).optional(),
  instrumental: z.boolean().optional(),
  style: z.string().max(1000).optional(),
  title: z.string().max(80).optional(),
  idempotencyKey: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (process.env.AUDIO_GENERATION_ENABLED !== "true") {
      return apiError(
        "Music generation is coming soon — this preview does not run real music generation. No credits were used.",
        503,
        { code: "GENERATION_DISABLED" },
      );
    }

    const user = await requireAuth(request);
    const body = await request.json();
    const data = generateSchema.parse(body);

    const headerKey = request.headers.get("Idempotency-Key");
    const idempotencyKey = headerKey
      ? headerKey.slice(0, 200)
      : data.idempotencyKey;

    const result = await mediaGenerationService.generate({
      userId: user.id,
      mediaType: "audio",
      prompt: data.prompt,
      model: data.model,
      instrumental: data.instrumental,
      style: data.style,
      title: data.title,
      idempotencyKey,
    });

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ProviderRejectedError) {
      return apiError(
        `The music provider rejected the request: ${error.message}`,
        422,
        { code: "PROVIDER_REJECTED" },
      );
    }
    return handleApiError(error);
  }
}
