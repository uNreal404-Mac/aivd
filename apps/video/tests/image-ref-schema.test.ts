import { describe, expect, it } from "vitest";
import { IMAGE_REF_MAX_LENGTH, imageRefSchema } from "@/lib/image-ref-schema";

const r2Base =
  "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/dreamutopia-video-media/uploads/u1/a.png?";

const presignedR2Url =
  r2Base +
  [
    "X-Amz-Algorithm=AWS4-HMAC-SHA256",
    "X-Amz-Credential=0123456789abcdef0123456789abcdef%2F20260616%2Fauto%2Fs3%2Faws4_request",
    "X-Amz-Date=20260616T120000Z",
    "X-Amz-Expires=3600",
    "X-Amz-SignedHeaders=host",
    `X-Amz-Signature=${"0123456789abcdef".repeat(37)}`,
  ].join("&");

describe("imageRefSchema", () => {
  it("accepts a realistic presigned R2 URL longer than 500 characters", () => {
    expect(presignedR2Url.length).toBeGreaterThan(500);
    expect(presignedR2Url.length).toBeLessThanOrEqual(IMAGE_REF_MAX_LENGTH);
    expect(imageRefSchema.safeParse(presignedR2Url).success).toBe(true);
  });

  it("accepts a 2048-character https URL", () => {
    const url = `https://example.com/${"a".repeat(
      IMAGE_REF_MAX_LENGTH - "https://example.com/".length,
    )}`;
    expect(url.length).toBe(IMAGE_REF_MAX_LENGTH);
    expect(imageRefSchema.safeParse(url).success).toBe(true);
  });

  it("rejects a 2049-character https URL", () => {
    const url = `https://example.com/${"a".repeat(
      IMAGE_REF_MAX_LENGTH + 1 - "https://example.com/".length,
    )}`;
    expect(url.length).toBe(IMAGE_REF_MAX_LENGTH + 1);
    expect(imageRefSchema.safeParse(url).success).toBe(false);
  });

  it("accepts a relative storage path", () => {
    expect(imageRefSchema.safeParse("uploads/u_1/abc.png").success).toBe(true);
  });

  it("accepts a canvas upload path", () => {
    expect(imageRefSchema.safeParse("uploads/u_1/canvas/abc.png").success).toBe(true);
  });

  it("rejects path traversal", () => {
    expect(imageRefSchema.safeParse("../x").success).toBe(false);
  });

  it("rejects non-http(s) schemes", () => {
    expect(imageRefSchema.safeParse("ftp://x").success).toBe(false);
  });
});
