import { generationRequestKey, readGenerationReplay } from "@/lib/api/generation-replay";
import { assertMediaAccount } from "@/lib/api/media-account";
import { NextRequest } from "next/server";
import { videoService } from "@/services/video";
import { requireAuth } from "@/lib/api/auth";
import { canGenerateInPreview } from "@/lib/internal-test-account";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { z } from "zod";
import { invalidKeyframes } from "@/services/kling-keyframes";
import { KLING_MAX_MIDDLE_FRAMES } from "@/lib/kling-keyframes";
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

import { VIDEO_MOTION_MODEL } from "@/lib/video-tool";

const generateSchema = z.object({
  prompt: z.string().max(10000),
  model: z.string().min(1),
  duration: z.number().optional(),
  outputFormat: z.enum(["mp4", "mov"]).optional(),
  aspectRatio: z.string().optional(),
  quality: z.string().optional(),
  imageUrl: imageRefSchema.optional(),
  imageUrls: z.array(imageRefSchema).optional(),
  keyframes: z.object({
    first: z.string().min(1).max(1024).optional(),
    middle: z.array(z.string().min(1).max(1024)).max(KLING_MAX_MIDDLE_FRAMES).optional(),
    last: z.string().min(1).max(1024).optional(),
  }).strict().optional(),
  videoKeys: z.array(z.string().min(1).max(512)).min(1).max(WAN_REFERENCE_MAX_FILES).optional(),
  mode: z.string().optional(),
  preset: z.string().max(64).optional(),
  outputNumber: z.number().int().min(1).optional().default(1),
  generateAudio: z.boolean().optional(),
  idempotencyKey: z.string().max(200).optional(),
  /** Extend a video: one of the caller's own finished videos. */
  sourceVideoUuid: z.string().max(64).optional(),
  sourceVideoKey:z.string().max(512).optional(),
  orientation:z.enum(["image","video"]).optional(),
  characterKey:z.string().max(512).optional(),
  expectedCredits:z.number().int().positive().optional(),
}).refine(data => data.prompt.length > 0 || data.model === VIDEO_MOTION_MODEL, {path:["prompt"], message:"Enter a prompt."});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    assertMediaAccount(request, user.id);

    const body = await request.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      if (parsed.error.issues.some((issue) => issue.path[0] === "keyframes")) throw invalidKeyframes();
      throw parsed.error;
    }
    const data = parsed.data;
    const idempotencyKey = generationRequestKey(request, data.idempotencyKey);
    const replay = await readGenerationReplay(user.id, idempotencyKey);
    if (replay) return apiSuccess(replay);
    if (data.model === VIDEO_MOTION_MODEL) {
      return apiError("Motion Control is no longer available.", 410, {
        code: "VIDEO_TOOL_REMOVED",
      });
    }
    if (!canGenerateInPreview(user)) {
      return apiError(
        "Video generation is coming soon — this preview does not run real video generation. No credits were used.",
        503,
        { code: "GENERATION_DISABLED" },
      );
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

    const locale = request.headers.get("accept-language") ?? "en";
    // The service moderates role-based frames after resolving their owner and
    // exact output index, immediately before reserving credits.
    if (!data.keyframes && data.model !== VIDEO_MOTION_MODEL) {
      const safety = await moderateContent({
        text: data.prompt,
        images: imageUrls.map((imageUrl, index) => ({
          url: /^https?:\/\//i.test(imageUrl) ? imageUrl : getStorage().getSignedUrl(imageUrl),
          label: `reference-${index + 1}`,
        })),
        context: "generation",
      });
      if (!isSafetyApproved(safety)) {
        return apiError(safetyMessage(safety, locale), 422, {
          code: "CONTENT_BLOCKED", decision: safety.decision, categories: safety.categories,
        });
      }
    }

    const result = await videoService.generate({
      userId: user.id,
      prompt: data.prompt,
      model: data.model,
      duration: data.duration,
      outputFormat: data.outputFormat,
      aspectRatio: data.aspectRatio,
      quality: data.quality,
      imageUrl: data.imageUrl,
      imageUrls: data.imageUrls,
      mode: data.mode,
      preset: data.preset,
      videoKeys: data.videoKeys,
      ...(data.keyframes ? { keyframes: data.keyframes, locale } : {}),
      outputNumber: data.outputNumber,
      generateAudio: data.generateAudio,
      idempotencyKey,
      sourceVideoUuid: data.sourceVideoUuid,
      sourceVideoKey: data.sourceVideoKey,
      orientation: data.orientation,
      expectedCredits: data.expectedCredits,
      characterKey: data.characterKey,
      ...(data.model === VIDEO_MOTION_MODEL ? {locale} : {}),
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
