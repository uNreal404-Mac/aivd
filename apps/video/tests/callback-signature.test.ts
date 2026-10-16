import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  generateSignedCallbackUrl,
  verifyCallbackSignature,
} from "../src/ai/utils/callback-signature";

const CALLBACK_URL = "https://example.com/api/v1/video/callback";
const VIDEO_UUID = "video-123";
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

/** Generate a valid (ts, sig) pair as if it had been created at `at`. */
function signAt(at: Date): { ts: string; sig: string } {
  vi.useFakeTimers();
  vi.setSystemTime(at);
  const url = new URL(generateSignedCallbackUrl(CALLBACK_URL, VIDEO_UUID));
  const ts = url.searchParams.get("ts") as string;
  const sig = url.searchParams.get("sig") as string;
  vi.useRealTimers();
  return { ts, sig };
}

describe("verifyCallbackSignature", () => {
  beforeAll(() => {
    process.env.CALLBACK_HMAC_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a freshly generated signature", () => {
    const url = new URL(generateSignedCallbackUrl(CALLBACK_URL, VIDEO_UUID));

    const result = verifyCallbackSignature(
      VIDEO_UUID,
      url.searchParams.get("ts") as string,
      url.searchParams.get("sig") as string
    );

    expect(result).toEqual({ valid: true });
  });

  it("rejects a timestamp more than five minutes in the future", () => {
    const signedAt = new Date("2024-01-01T00:00:00.000Z");
    const { ts, sig } = signAt(signedAt);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(signedAt.getTime() - (MAX_FUTURE_SKEW_MS + 60_000)));

    const result = verifyCallbackSignature(VIDEO_UUID, ts, sig);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Signature timestamp in the future");
  });

  it("still accepts a timestamp exactly at the future skew limit", () => {
    const signedAt = new Date("2024-01-01T00:00:00.000Z");
    const { ts, sig } = signAt(signedAt);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(signedAt.getTime() - MAX_FUTURE_SKEW_MS));

    const result = verifyCallbackSignature(VIDEO_UUID, ts, sig);

    expect(result.valid).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const url = new URL(generateSignedCallbackUrl(CALLBACK_URL, VIDEO_UUID));

    const result = verifyCallbackSignature(
      VIDEO_UUID,
      url.searchParams.get("ts") as string,
      "0".repeat(64)
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid signature");
  });

  it("rejects a mismatched video id", () => {
    const url = new URL(generateSignedCallbackUrl(CALLBACK_URL, VIDEO_UUID));

    const result = verifyCallbackSignature(
      "other-video",
      url.searchParams.get("ts") as string,
      url.searchParams.get("sig") as string
    );

    expect(result.valid).toBe(false);
  });
});
