import { describe, expect, it, vi } from "vitest";

import {
  ALLOWED_TYPES,
  ASPECT_RATIOS,
  DURATIONS,
  GENERATE_ENDPOINT,
  I2V_GENERATION_ENABLED,
  I2V_MODELS,
  MAX_BYTES,
  MAX_PROMPT_LENGTH,
  UPLOAD_ENDPOINT,
  canSubmit,
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
      "wan-2.6",
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

  it("exposes the duration and aspect ratio choices", () => {
    expect([...DURATIONS]).toEqual([5, 10]);
    expect([...ASPECT_RATIOS]).toEqual(["16:9", "9:16", "1:1"]);
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

  it("ships with generation paused", () => {
    expect(I2V_GENERATION_ENABLED).toBe(false);
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

    const result = await submitImageToVideo(body, fetchFn as FetchLike);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: "disabled" });
  });
});
