import { describe, expect, it, vi } from "vitest";

import {
  ALLOWED_TYPES,
  GENERATE_ENDPOINT,
  I2V_MODELS,
  MAX_BYTES,
  MAX_PROMPT_LENGTH,
  UPLOAD_ENDPOINT,
  aspectRatiosFor,
  canSubmit,
  durationsFor,
  isI2VGenerationEnabled,
  normalizeSettings,
  parseUploadResponse,
  submitImageToVideo,
  uploadImage,
  validateImageFile,
} from "../src/lib/image-to-video";
import type { FetchLike } from "../src/lib/image-to-video";

function stubResponse(
  status: number,
  body: unknown,
): { status: number; json: () => Promise<unknown> } {
  return { status, json: () => Promise.resolve(body) };
}

function stubFile(type = "image/png", size = 2048): File {
  return { type, size, name: "frame.png" } as unknown as File;
}

describe("constants", () => {
  it("exposes exactly the four supported models", () => {
    expect(I2V_MODELS.map((model) => model.id)).toEqual([
      "seedance-1.5-pro",
      "wan2.6",
      "veo-3.1",
      "sora-2",
    ]);
    expect(I2V_MODELS.map((model) => model.label)).toEqual([
      "Seedance 1.5 Pro",
      "Wan 2.6",
      "Veo 3.1",
      "Sora 2",
    ]);
  });

  it("reads per-model durations from the shared config", () => {
    expect(durationsFor("sora-2")).toEqual([10, 15]);
    expect(durationsFor("veo-3.1")).toEqual([8]);
    expect(durationsFor("wan2.6")).toEqual([5, 10, 15]);
    expect(durationsFor("seedance-1.5-pro")).toEqual([4, 5, 6, 8, 10, 12]);
  });

  it("omits 1:1 for models that do not support it", () => {
    expect(aspectRatiosFor("sora-2")).not.toContain("1:1");
    expect(aspectRatiosFor("veo-3.1")).not.toContain("1:1");
  });

  it("snaps unsupported settings onto the model's allowed values", () => {
    expect(normalizeSettings("veo-3.1", 5, "1:1")).toEqual({
      duration: 8,
      aspectRatio: "16:9",
    });
  });

  it("accepts the four image types and caps size at 10MB", () => {
    expect([...ALLOWED_TYPES]).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);
    expect(MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  it("enables generation only for the exact 'true' value", () => {
    expect(isI2VGenerationEnabled({ VIDEO_GENERATION_ENABLED: "true" })).toBe(
      true,
    );
    expect(isI2VGenerationEnabled({ VIDEO_GENERATION_ENABLED: "1" })).toBe(
      false,
    );
    expect(isI2VGenerationEnabled({ VIDEO_GENERATION_ENABLED: "false" })).toBe(
      false,
    );
    expect(isI2VGenerationEnabled({})).toBe(false);
  });
});

describe("validateImageFile", () => {
  it("accepts every allowed image type", () => {
    for (const type of ALLOWED_TYPES) {
      expect(validateImageFile({ type, size: 1024 })).toBeNull();
    }
  });

  it("rejects unsupported types", () => {
    expect(validateImageFile({ type: "application/pdf", size: 1024 })).toEqual(
      expect.any(String),
    );
    expect(validateImageFile({ type: "", size: 1024 })).toEqual(
      expect.any(String),
    );
  });

  it("rejects files above the size limit", () => {
    expect(validateImageFile({ type: "image/png", size: MAX_BYTES })).toBeNull();
    expect(
      validateImageFile({ type: "image/png", size: MAX_BYTES + 1 }),
    ).toEqual(expect.any(String));
  });
});

describe("parseUploadResponse", () => {
  it("prefers the signed url on 200", () => {
    const result = parseUploadResponse(200, {
      success: true,
      data: {
        key: "uploads/a.png",
        signedUrl: "https://cdn.test/a.png?sig=1",
        publicUrl: "https://cdn.test/a.png",
        expiresIn: 900,
      },
    });

    expect(result).toEqual({
      ok: true,
      key: "uploads/a.png",
      url: "https://cdn.test/a.png?sig=1",
    });
  });

  it("falls back to the public url on 200", () => {
    const result = parseUploadResponse(200, {
      success: true,
      data: { key: "uploads/b.png", publicUrl: "https://cdn.test/b.png" },
    });

    expect(result).toEqual({
      ok: true,
      key: "uploads/b.png",
      url: "https://cdn.test/b.png",
    });
  });

  it("maps 401 to a sign-in prompt", () => {
    expect(
      parseUploadResponse(401, {
        success: false,
        error: { message: "unauthenticated" },
      }),
    ).toEqual({ ok: false, message: "Sign in to upload" });
  });

  it("maps 503 to the unavailable message", () => {
    expect(parseUploadResponse(503, null)).toEqual({
      ok: false,
      message: "Uploads are not available yet",
    });
  });

  it("surfaces the server error message for other failures", () => {
    expect(
      parseUploadResponse(500, { success: false, error: { message: "boom" } }),
    ).toEqual({ ok: false, message: "boom" });

    expect(
      parseUploadResponse(200, {
        success: false,
        error: { message: "no key returned" },
      }),
    ).toEqual({ ok: false, message: "no key returned" });
  });

  it("falls back to a generic failure message", () => {
    expect(parseUploadResponse(500, null)).toEqual({
      ok: false,
      message: "Upload failed. Please try again.",
    });
  });
});

describe("uploadImage", () => {
  it("posts multipart form data and parses the response", async () => {
    const fetchFn = vi.fn(async () =>
      stubResponse(200, {
        success: true,
        data: { key: "k1", signedUrl: "https://cdn.test/k1" },
      }),
    );

    const result = await uploadImage(stubFile(), fetchFn as FetchLike);

    expect(result).toEqual({
      ok: true,
      key: "k1",
      url: "https://cdn.test/k1",
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const [input, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit | undefined,
    ];
    expect(input).toBe(UPLOAD_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it("never rejects when the network call throws", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("offline");
    });

    await expect(uploadImage(stubFile(), fetchFn as FetchLike)).resolves.toEqual(
      { ok: false, message: "Upload failed. Please try again." },
    );
  });
});

describe("canSubmit", () => {
  it("requires an uploaded image and a non-empty prompt", () => {
    expect(canSubmit({ imageKey: "k", prompt: "slow dolly in" })).toBe(true);
    expect(canSubmit({ imageKey: "k", prompt: "   " })).toBe(false);
    expect(canSubmit({ imageKey: null, prompt: "slow dolly in" })).toBe(false);
    expect(canSubmit({ imageKey: "k", prompt: "" })).toBe(false);
  });

  it("blocks while an upload is in flight", () => {
    expect(
      canSubmit({ imageKey: "k", prompt: "slow dolly in", uploading: true }),
    ).toBe(false);
  });

  it("enforces the prompt length limit", () => {
    expect(
      canSubmit({ imageKey: "k", prompt: "a".repeat(MAX_PROMPT_LENGTH) }),
    ).toBe(true);
    expect(
      canSubmit({ imageKey: "k", prompt: "a".repeat(MAX_PROMPT_LENGTH + 1) }),
    ).toBe(false);
  });
});

describe("submitImageToVideo", () => {
  const body = {
    model: "seedance-1.5-pro",
    prompt: "gentle push in",
    duration: 5,
    aspectRatio: "16:9",
    imageKey: "k1",
  };

  it("never calls fetch while generation is disabled", async () => {
    const fetchFn = vi.fn(async () => stubResponse(200, { success: true }));

    const result = await submitImageToVideo(body, {
      enabled: false,
      fetchFn: fetchFn as FetchLike,
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: "disabled" });
  });

  it("sends the provided idempotency key when enabled", async () => {
    const fetchFn = vi.fn(async () => stubResponse(200, { success: true }));

    await submitImageToVideo(body, {
      enabled: true,
      fetchFn: fetchFn as FetchLike,
      idempotencyKey: "key-123",
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);

    const [input, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit | undefined,
    ];
    expect(input).toBe(GENERATE_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(
      (init?.headers as Record<string, string>)["Idempotency-Key"],
    ).toBe("key-123");
  });

  it("sends the uploaded image key as imageUrl in image-to-video mode", async () => {
    const fetchFn = vi.fn(async () => stubResponse(200, { success: true }));

    await submitImageToVideo(body, {
      enabled: true,
      fetchFn: fetchFn as FetchLike,
      idempotencyKey: "key-123",
    });

    const [, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit | undefined,
    ];
    const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;

    expect(payload.imageUrl).toBe("k1");
    expect(payload.mode).toBe("image-to-video");
    expect(payload).not.toHaveProperty("imageKey");
  });

  it("refuses to submit without an uploaded image", async () => {
    const fetchFn = vi.fn(async () => stubResponse(200, { success: true }));

    const result = await submitImageToVideo(
      { ...body, imageKey: "" },
      { enabled: true, fetchFn: fetchFn as FetchLike },
    );

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      reason: "error",
      message: "Please upload an image first.",
      retryable: false,
    });
  });

  it("treats 2xx with success:true as ok", async () => {
    const fetchFn = vi.fn(async () =>
      stubResponse(200, { success: true, data: { id: "vid-1" } }),
    );

    const result = await submitImageToVideo(body, {
      enabled: true,
      fetchFn: fetchFn as FetchLike,
    });

    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { success: true, data: { id: "vid-1" } },
    });
  });

  it("maps a 202 SUBMIT_RESULT_UNKNOWN onto a pending result", async () => {
    const fetchFn = vi.fn(async () =>
      stubResponse(202, {
        success: false,
        error: {
          message: "cannot confirm",
          details: {
            code: "SUBMIT_RESULT_UNKNOWN",
            videoUuid: "vid-abc",
          },
        },
      }),
    );

    const result = await submitImageToVideo(body, {
      enabled: true,
      fetchFn: fetchFn as FetchLike,
      idempotencyKey: "key-123",
    });

    expect(result).toEqual({
      ok: false,
      reason: "pending",
      message: expect.any(String),
      videoUuid: "vid-abc",
    });
  });

  it("marks 400 responses as non-retryable", async () => {
    const fetchFn = vi.fn(async () =>
      stubResponse(400, { success: false, error: { message: "bad input" } }),
    );

    const result = await submitImageToVideo(body, {
      enabled: true,
      fetchFn: fetchFn as FetchLike,
    });

    expect(result).toEqual({
      ok: false,
      reason: "error",
      message: "bad input",
      retryable: false,
    });
  });

  it("marks 500 responses as retryable", async () => {
    const fetchFn = vi.fn(async () =>
      stubResponse(500, { success: false, error: { message: "boom" } }),
    );

    const result = await submitImageToVideo(body, {
      enabled: true,
      fetchFn: fetchFn as FetchLike,
    });

    expect(result).toEqual({
      ok: false,
      reason: "error",
      message: "boom",
      retryable: true,
    });
  });

  it("marks network errors as retryable", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("offline");
    });

    const result = await submitImageToVideo(body, {
      enabled: true,
      fetchFn: fetchFn as FetchLike,
    });

    expect(result).toEqual({
      ok: false,
      reason: "error",
      message: "Generation request failed. Please try again.",
      retryable: true,
    });
  });
});
