import { describe, expect, it, vi } from "vitest";

import {
  ALLOWED_TYPES,
  GENERATE_ENDPOINT,
  I2V_MODELS,
  MAX_BYTES,
  MAX_PROMPT_LENGTH,
  UPLOAD_ENDPOINT,
  UploadError,
  aspectRatiosFor,
  canSubmit,
  durationsFor,
  imageFileError,
  isI2VGenerationEnabled,
  normalizeSettings,
  parseUploadResponse,
  submitImageToVideo,
  uploadErrorText,
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
    expect(durationsFor("seedance-1.5-pro")).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
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

describe("imageFileError", () => {
  it("accepts every allowed image type", () => {
    for (const type of ALLOWED_TYPES) {
      expect(imageFileError({ type, size: 1024 })).toBeNull();
    }
  });

  it("tells a non-image apart from an unsupported image format", () => {
    expect(imageFileError({ type: "application/pdf", size: 1024 })).toBe(
      "not_image",
    );
    expect(imageFileError({ type: "", size: 1024 })).toBe("not_image");
    expect(imageFileError(null)).toBe("not_image");
    expect(imageFileError({ type: "image/heic", size: 1024 })).toBe(
      "unsupported_type",
    );
  });

  it("rejects files above the size limit", () => {
    expect(imageFileError({ type: "image/png", size: MAX_BYTES })).toBeNull();
    expect(imageFileError({ type: "image/png", size: MAX_BYTES + 1 })).toBe(
      "too_large",
    );
  });
});

describe("validateImageFile", () => {
  it("returns null for an acceptable file", () => {
    expect(validateImageFile({ type: "image/png", size: 1024 })).toBeNull();
  });

  it("stays English by default so older callers keep working", () => {
    expect(validateImageFile({ type: "image/png", size: MAX_BYTES + 1 })).toBe(
      "That image is over 10 MB. Choose a smaller one.",
    );
  });

  it("speaks the page's language when asked", () => {
    expect(
      validateImageFile({ type: "image/heic", size: 1024 }, true),
    ).toBe("不支持这个图片格式，请换用 JPG、PNG、WebP 或 GIF");
    expect(
      validateImageFile({ type: "image/png", size: MAX_BYTES + 1 }, "zh"),
    ).toBe("图片超过 10 MB，请换一张小一点的");
    expect(
      validateImageFile({ type: "text/plain", size: 1 }, "en-US"),
    ).toBe("Choose an image file.");
  });
});

describe("uploadErrorText", () => {
  it("turns every code into Chinese and English text", () => {
    expect(uploadErrorText("not_image", "zh")).toBe("请选择图片文件");
    expect(uploadErrorText("unsupported_type", "zh")).toBe(
      "不支持这个图片格式，请换用 JPG、PNG、WebP 或 GIF",
    );
    expect(uploadErrorText("too_large", "zh")).toBe(
      "图片超过 10 MB，请换一张小一点的",
    );
    expect(uploadErrorText("unauthorized", "zh")).toBe("请先登录再上传");
    expect(uploadErrorText("upload_unavailable", "zh")).toBe(
      "暂时无法上传，请稍后再试",
    );
    expect(uploadErrorText("upload_failed", "zh")).toBe("上传失败，请重试");
    expect(uploadErrorText("missing_item", "zh")).toBe(
      "这张图片已失效，请重新上传",
    );
    expect(uploadErrorText("unauthorized", "en")).toBe("Sign in to upload.");
    expect(uploadErrorText("missing_item", false)).toBe(
      "This image is no longer available. Upload it again.",
    );
  });

  it("reads the code off an upload result or a thrown UploadError", () => {
    expect(uploadErrorText(parseUploadResponse(401, null), true)).toBe(
      "请先登录再上传",
    );
    const error = new UploadError("missing_item");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("missing_item");
    expect(error.message).toBe(
      "This image is no longer available. Upload it again.",
    );
    expect(uploadErrorText(error, "zh-CN")).toBe("这张图片已失效，请重新上传");
  });

  it("falls back to a plain retry message for anything unknown", () => {
    expect(uploadErrorText(new Error("socket hang up"), "zh")).toBe(
      "上传失败，请重试",
    );
    expect(uploadErrorText("toString", "en")).toBe("Upload failed. Try again.");
    expect(uploadErrorText(undefined, "en")).toBe("Upload failed. Try again.");
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
    ).toEqual({ ok: false, code: "unauthorized", message: "Sign in to upload." });
  });

  it("maps 503 to the unavailable code", () => {
    expect(parseUploadResponse(503, null)).toEqual({
      ok: false,
      code: "upload_unavailable",
      message: "Uploads aren't available right now. Try again later.",
    });
  });

  it("maps a content-safety block to its own code", () => {
    expect(
      parseUploadResponse(422, {
        success: false,
        error: { message: "内容不符合安全规则", details: { code: "CONTENT_BLOCKED" } },
      }),
    ).toMatchObject({ ok: false, code: "content_blocked" });
  });

  it("recognises the route's size and type rejections", () => {
    expect(
      parseUploadResponse(400, { success: false, error: { message: "File too large" } }),
    ).toMatchObject({ ok: false, code: "too_large" });
    expect(
      parseUploadResponse(400, {
        success: false,
        error: { message: "Invalid content type. Allowed: image/jpeg" },
      }),
    ).toMatchObject({ ok: false, code: "unsupported_type" });
  });

  it("never shows raw server text for other failures", () => {
    expect(
      parseUploadResponse(500, { success: false, error: { message: "boom" } }),
    ).toEqual({ ok: false, code: "upload_failed", message: "Upload failed. Try again." });

    expect(
      parseUploadResponse(200, {
        success: false,
        error: { message: "no key returned" },
      }),
    ).toMatchObject({ ok: false, code: "upload_failed" });

    expect(parseUploadResponse(500, null)).toMatchObject({
      ok: false,
      code: "upload_failed",
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
      { ok: false, code: "upload_failed", message: "Upload failed. Try again." },
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
});
