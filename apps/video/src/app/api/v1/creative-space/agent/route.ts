import { z } from "zod";

import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  fileToDataUrl,
  isSafetyApproved,
  moderateContent,
  safetyMessage,
} from "@/lib/content-safety";
import {
  runCreativeAgent,
  type CreativeAgentAsset,
} from "@/lib/creative-space/agent";
import { createRateLimiter } from "@/lib/rate-limit";

const MAX_VISUALS = 8;
const MAX_VISUAL_SIZE = 10 * 1024 * 1024;
const ALLOWED_VISUAL_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const agentLimiter = createRateLimiter({ limit: 12, windowMs: 60_000 });

const assetSchema = z.object({
  id: z.string().min(1).max(200),
  label: z.string().min(1).max(20),
  name: z.string().min(1).max(300),
  type: z.enum(["image", "video"]),
});

function parseAssets(value: FormDataEntryValue | null): CreativeAgentAsset[] {
  if (typeof value !== "string") return [];
  const parsed = JSON.parse(value) as unknown;
  return z.array(assetSchema).max(20).parse(parsed);
}

async function readVisuals(formData: FormData) {
  const files = formData
    .getAll("visual")
    .filter((value): value is File => value instanceof File)
    .slice(0, MAX_VISUALS);

  for (const file of files) {
    if (!ALLOWED_VISUAL_TYPES.has(file.type) || file.size > MAX_VISUAL_SIZE) {
      throw new ApiError("Invalid visual sample.", 400, {
        code: "INVALID_VISUAL_SAMPLE",
      });
    }
  }

  return Promise.all(
    files.map(async (file) => ({
      url: await fileToDataUrl(file),
      label: file.name.split("__", 1)[0] || file.name,
    })),
  );
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const rateLimit = agentLimiter.check(user.id);
    if (!rateLimit.allowed) {
      throw new ApiError("Too many Agent requests. Please wait a moment.", 429, {
        code: "AGENT_RATE_LIMITED",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }
    const formData = await request.formData();
    const action = formData.get("action") === "moderate" ? "moderate" : "plan";
    const instruction = String(formData.get("instruction") ?? "").slice(0, 5000);
    const locale = String(formData.get("locale") ?? "en").slice(0, 10);
    const assets = parseAssets(formData.get("assets"));
    const images = await readVisuals(formData);

    if (action === "moderate") {
      const safety = await moderateContent({
        text: instruction,
        images,
        context: "upload",
      });
      if (!isSafetyApproved(safety)) {
        throw new ApiError(safetyMessage(safety, locale), 422, {
          code: "CONTENT_BLOCKED",
          decision: safety.decision,
          categories: safety.categories,
        });
      }
      return apiSuccess({ safety });
    }

    if (!instruction.trim()) {
      throw new ApiError("Instruction is required.", 400);
    }

    const result = await runCreativeAgent({
      instruction,
      locale,
      assets,
      images,
    });
    if (!isSafetyApproved(result.safety)) {
      throw new ApiError(safetyMessage(result.safety, locale), 422, {
        code: "CONTENT_BLOCKED",
        decision: result.safety.decision,
        categories: result.safety.categories,
      });
    }

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
