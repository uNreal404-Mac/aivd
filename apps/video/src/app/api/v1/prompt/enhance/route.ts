import type { NextRequest } from "next/server";
import { ZodError, z } from "zod";

import { requireAuth } from "@/lib/api/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  MAX_INPUT_CHARS,
  detectLanguage,
  isPromptEnhanceEnabled,
} from "@/lib/prompt-enhance/config";
import { checkPromptSafety } from "@/lib/prompt-enhance/content-filter";
import {
  PromptEnhanceUpstreamError,
  enhanceWithDeepSeek,
} from "@/lib/prompt-enhance/deepseek";
import { checkEnhanceRateLimit } from "@/lib/prompt-enhance/rate-limit";

const enhanceRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(MAX_INPUT_CHARS),
  language: z.enum(["auto", "en", "zh"]).default("auto"),
});

type EnhanceRequest = z.infer<typeof enhanceRequestSchema>;

/**
 * Public capability probe so the UI can hide the Enhance button without
 * requiring a session.
 */
export async function GET() {
  return apiSuccess({
    enabled: isPromptEnhanceEnabled(),
    maxInputChars: MAX_INPUT_CHARS,
  });
}

export async function POST(request: NextRequest) {
  // Kill switch is evaluated before auth on purpose: when the feature is off
  // we do not touch the session at all.
  if (!isPromptEnhanceEnabled()) {
    return apiError("Prompt enhancement is not available yet.", 503, {
      code: "ENHANCE_DISABLED",
    });
  }

  try {
    const user = await requireAuth(request);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiError("Invalid request body.", 400, {
        code: "INVALID_INPUT",
      });
    }

    let body: EnhanceRequest;
    try {
      body = enhanceRequestSchema.parse(rawBody);
    } catch (error) {
      if (error instanceof ZodError) {
        return apiError("Invalid request body.", 400, {
          code: "INVALID_INPUT",
        });
      }
      throw error;
    }

    const { prompt } = body;

    const rate = checkEnhanceRateLimit(user.id);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: "Too many requests, please try again later.",
            details: {
              code: "RATE_LIMITED",
              scope: rate.scope,
              retryAfterSeconds: rate.retryAfterSeconds,
            },
          },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rate.retryAfterSeconds),
          },
        }
      );
    }

    const inputSafety = checkPromptSafety(prompt);
    if (!inputSafety.ok) {
      return apiError("This prompt can't be enhanced.", 422, {
        code: "CONTENT_BLOCKED",
        reason: inputSafety.reason,
      });
    }

    const language =
      body.language === "auto" ? detectLanguage(prompt) : body.language;
    const apiKey = process.env.DEEPSEEK_API_KEY ?? "";

    const result = await enhanceWithDeepSeek({
      input: prompt,
      language,
      apiKey,
    });

    if (result.text.includes("[[REFUSED]]")) {
      return apiError("This prompt can't be enhanced.", 422, {
        code: "CONTENT_BLOCKED",
        reason: "policy",
      });
    }

    const outputSafety = checkPromptSafety(result.text);
    if (!outputSafety.ok) {
      return apiError("This prompt can't be enhanced.", 422, {
        code: "CONTENT_BLOCKED",
        reason: outputSafety.reason,
      });
    }

    return apiSuccess({ prompt: result.text, language });
  } catch (error) {
    if (error instanceof PromptEnhanceUpstreamError) {
      // Never log the upstream body, the API key, or the prompt itself.
      console.warn("[prompt-enhance] upstream error", {
        status: error.status,
      });
      return apiError("Prompt enhancement failed, please try again.", 502, {
        code: "UPSTREAM_ERROR",
      });
    }
    return handleApiError(error);
  }
}
