import { describe, expect, it, vi } from "vitest";

import { VIDEO_MODEL_PRICING } from "../src/config/pricing-user";
import {
  ALLOWED_TYPES,
  GENERATE_ENDPOINT,
  I2V_COPY,
  I2V_MODELS,
  I2V_MODEL_IDS,
  MAX_BYTES,
  MAX_PROMPT_LENGTH,
  UPLOAD_ENDPOINT,
  aspectRatiosFor,
  canSubmit,
  durationsFor,
  i2vCopy,
  isI2VGenerationEnabled,
  normalizeSettings,
  parseUploadResponse,
  submitImageToVideo,
  uploadImage,
  validateImageFile,
} from "../src/lib/image-to-video";
import type { FetchLike, I2VCopy } from "../src/lib/image-to-video";

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
  it("exposes only the enabled Seedance models", () => {
    expect(I2V_MODEL_IDS).toEqual([
      "seedance-1.5-pro",
      "seedance-1.0-pro-fast",
      "seedance-1.0-pro-quality",
    ]);
    expect(I2V_MODELS.map((model) => model.id)).toEqual([...I2V_MODEL_IDS]);
  });

  it("only exposes models that are enabled in the pricing config", () => {
    for (const id of I2V_MODEL_IDS) {
      expect(VIDEO_MODEL_PRICING[id]?.enabled).toBe(true);
    }
  });

  it("never exposes a legacy provider name", () => {
    const legacy = /\b(wan|veo|sora|kling)\b/i;

    for (const id of I2V_MODEL_IDS) {
      expect(id).not.toMatch(legacy);
    }

    for (const model of I2V_MODELS) {
      expect(model.id).not.toMatch(legacy);
      expect(model.label).not.toMatch(legacy);
    }
  });

  it("reads per-model durations from the shared config", () => {
    expect(durationsFor("seedance-1.5-pro")).toEqual([4, 5, 6, 8, 10, 12]);

    for (const id of I2V_MODEL_IDS) {
      expect(durationsFor(id).length).toBeGreaterThan(0);
      expect(aspectRatiosFor(id).length).toBeGreaterThan(0);
    }
  });

  it("returns nothing for models that are no longer offered", () => {
    expect(durationsFor("wan2.6")).toEqual([]);
    expect(aspectRatiosFor("sora-2")).toEqual([]);
    expect(durationsFor("kling-2.0")).toEqual([]);
  });

  it("snaps unsupported settings onto the model's allowed values", () => {
    for (const id of I2V_MODEL_IDS) {
      const durations = durationsFor(id);
      const aspectRatios = aspectRatiosFor(id);

      expect(normalizeSettings(id, -1, "__unsupported__")).toEqual({
        duration: durations[0],
        aspectRatio: aspectRatios[0],
      });

      expect(normalizeSettings(id, durations[0], aspectRatios[0])).toEqual({
        duration: durations[0],
        aspectRatio: aspectRatios[0],
      });
    }
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

describe("I2V_COPY", () => {
  it("has a non-empty zh translation for every English string", () => {
    const keys = Object.keys(I2V_COPY.en) as (keyof I2VCopy)[];

    expect(keys.length).toBeGreaterThan(0);

    for (const key of keys) {
      const value = I2V_COPY.zh[key];
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("uses a different title in Chinese", () => {
    expect(I2V_COPY.en.title).not.toBe(I2V_COPY.zh.title);
  });

  it("resolves the zh copy only for the zh locale", () => {
    expect(i2vCopy("zh")).toBe(I2V_COPY.zh);
    expect(i2vCopy("en")).toBe(I2V_COPY.en);
    expect(i2vCopy("fr")).toBe(I2V_COPY.en);
  });
});

describe("validateImageFile", () => {
  it("returns the zh message when given the zh copy", () => {
    expect(
      validateImageFile({ type: "application/pdf", size: 1024 }, I2V_COPY.zh),
    ).toBe(I2V_COPY.zh.invalidType);
    expect(
      validateImageFile(
        { type: "image/png", size: MAX_BYTES + 1 },
        I2V_COPY.zh,
      ),
    ).toBe(I2V_COPY.zh.tooLarge);
  });

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
});
