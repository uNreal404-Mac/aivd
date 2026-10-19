import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import {
  PromptEnhanceUpstreamError,
  enhanceWithDeepSeek,
} from "@/lib/prompt-enhance/deepseek";
import { resetEnhanceRateLimits } from "@/lib/prompt-enhance/rate-limit";

import { GET, POST } from "@/app/api/v1/prompt/enhance/route";

vi.mock("@/lib/api/auth", () => ({
  requireAuth: vi.fn(),
  getAuthUser: vi.fn(),
}));

vi.mock("@/lib/prompt-enhance/deepseek", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/prompt-enhance/deepseek")>();
  return {
    ...actual,
    enhanceWithDeepSeek: vi.fn(),
  };
});

type AnyMock = ReturnType<typeof vi.fn>;

const requireAuthMock = requireAuth as unknown as AnyMock;
const enhanceMock = enhanceWithDeepSeek as unknown as AnyMock;

const OK_TEXT =
  "A cinematic low-angle shot of a cat on a rooftop at dusk, slow dolly in, warm rim light.";

function postRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/v1/prompt/enhance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

async function readJson(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: Record<string, unknown>;
    error?: { message: string; details?: Record<string, unknown> };
  };
}

beforeEach(() => {
  process.env.PROMPT_ENHANCE_ENABLED = "true";
  process.env.DEEPSEEK_API_KEY = "test-key-not-real";
  resetEnhanceRateLimits();
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue({ id: "u1" });
  enhanceMock.mockResolvedValue({ text: OK_TEXT });
});

afterEach(() => {
  Reflect.deleteProperty(process.env, "PROMPT_ENHANCE_ENABLED");
  Reflect.deleteProperty(process.env, "DEEPSEEK_API_KEY");
});

describe("GET /api/v1/prompt/enhance", () => {
  it("reports the feature state without requiring auth", async () => {
    const enabledResponse = await GET();
    expect(enabledResponse.status).toBe(200);
    const enabledJson = await readJson(enabledResponse);
    expect(enabledJson.data?.enabled).toBe(true);
    expect(enabledJson.data?.maxInputChars).toBe(500);

    process.env.PROMPT_ENHANCE_ENABLED = "false";
    const disabledJson = await readJson(await GET());
    expect(disabledJson.data?.enabled).toBe(false);

    expect(requireAuthMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/prompt/enhance", () => {
  it("returns 503 ENHANCE_DISABLED before auth when the switch is off", async () => {
    process.env.PROMPT_ENHANCE_ENABLED = "false";

    const response = await POST(postRequest({ prompt: "a cat" }));
    expect(response.status).toBe(503);

    const json = await readJson(response);
    expect(json.error?.details?.code).toBe("ENHANCE_DISABLED");
    expect(requireAuthMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the DeepSeek API key is missing", async () => {
    Reflect.deleteProperty(process.env, "DEEPSEEK_API_KEY");

    const response = await POST(postRequest({ prompt: "a cat" }));
    expect(response.status).toBe(503);

    const json = await readJson(response);
    expect(json.error?.details?.code).toBe("ENHANCE_DISABLED");
    expect(requireAuthMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is not authenticated", async () => {
    requireAuthMock.mockRejectedValue(new ApiError("Unauthorized", 401));

    const response = await POST(postRequest({ prompt: "a cat" }));
    expect(response.status).toBe(401);

    const json = await readJson(response);
    expect(json.error?.message).toBe("Unauthorized");
    expect(enhanceMock).not.toHaveBeenCalled();
  });

  it("rejects an empty prompt with 400 INVALID_INPUT", async () => {
    const response = await POST(postRequest({ prompt: "   " }));
    expect(response.status).toBe(400);

    const json = await readJson(response);
    expect(json.error?.details?.code).toBe("INVALID_INPUT");
    expect(enhanceMock).not.toHaveBeenCalled();
  });

  it("rejects a prompt longer than 500 characters with 400", async () => {
    const response = await POST(postRequest({ prompt: "a".repeat(501) }));
    expect(response.status).toBe(400);

    const json = await readJson(response);
    expect(json.error?.details?.code).toBe("INVALID_INPUT");
    expect(enhanceMock).not.toHaveBeenCalled();
  });

  it("blocks unsafe input with 422 and never calls upstream", async () => {
    const response = await POST(
      postRequest({ prompt: "a nude woman on the beach" })
    );
    expect(response.status).toBe(422);

    const json = await readJson(response);
    expect(json.error?.details?.code).toBe("CONTENT_BLOCKED");
    expect(json.error?.details?.reason).toBe("adult");
    expect(enhanceMock).not.toHaveBeenCalled();
  });

  it("returns the enhanced prompt on success", async () => {
    const response = await POST(postRequest({ prompt: "a cat on a rooftop" }));
    expect(response.status).toBe(200);

    const json = await readJson(response);
    expect(json.success).toBe(true);
    expect(json.data?.prompt).toBe(OK_TEXT);
    expect(json.data?.language).toBe("en");
    expect(enhanceMock).toHaveBeenCalledTimes(1);
  });

  it("maps [[REFUSED]] output to 422 CONTENT_BLOCKED", async () => {
    enhanceMock.mockResolvedValue({ text: "[[REFUSED]]" });

    const response = await POST(postRequest({ prompt: "a cat on a rooftop" }));
    expect(response.status).toBe(422);

    const json = await readJson(response);
    expect(json.error?.details?.code).toBe("CONTENT_BLOCKED");
    expect(json.error?.details?.reason).toBe("policy");
  });

  it("blocks unsafe output with 422 CONTENT_BLOCKED", async () => {
    enhanceMock.mockResolvedValue({
      text: "a nude woman dancing in the rain, wide shot",
    });

    const response = await POST(postRequest({ prompt: "a cat on a rooftop" }));
    expect(response.status).toBe(422);

    const json = await readJson(response);
    expect(json.error?.details?.code).toBe("CONTENT_BLOCKED");
    expect(json.error?.details?.reason).toBe("adult");
  });

  it("returns 502 UPSTREAM_ERROR when DeepSeek fails", async () => {
    enhanceMock.mockRejectedValue(new PromptEnhanceUpstreamError(500));

    const response = await POST(postRequest({ prompt: "a cat on a rooftop" }));
    expect(response.status).toBe(502);

    const json = await readJson(response);
    expect(json.error?.details?.code).toBe("UPSTREAM_ERROR");
    expect(json.error?.message).toBe(
      "Prompt enhancement failed, please try again."
    );
  });

  it("rate limits the sixth request in a minute", async () => {
    for (let i = 0; i < 5; i += 1) {
      const allowed = await POST(postRequest({ prompt: "a cat on a rooftop" }));
      expect(allowed.status).toBe(200);
    }

    const limited = await POST(postRequest({ prompt: "a cat on a rooftop" }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();

    const json = await readJson(limited);
    expect(json.error?.details?.code).toBe("RATE_LIMITED");
    expect(json.error?.details?.scope).toBe("minute");
    expect(typeof json.error?.details?.retryAfterSeconds).toBe("number");
    expect(enhanceMock).toHaveBeenCalledTimes(5);
  });

  it("detects Chinese input for language=auto", async () => {
    const response = await POST(
      postRequest({ prompt: "城市夜景延时摄影，霓虹灯下的街道" })
    );
    expect(response.status).toBe(200);

    expect(enhanceMock).toHaveBeenCalledWith(
      expect.objectContaining({ language: "zh" })
    );

    const json = await readJson(response);
    expect(json.data?.language).toBe("zh");
  });
});
