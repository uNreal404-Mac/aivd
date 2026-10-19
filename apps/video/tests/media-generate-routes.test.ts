import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/api/auth", () => ({
  requireAuth: vi.fn(() => {
    throw new Error("requireAuth must not be called when generation is disabled");
  }),
}));

const generateMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/media-generation", () => ({
  mediaGenerationService: { generate: generateMock },
  getRowMediaType: vi.fn(async () => null),
}));

import { POST as imagePost } from "@/app/api/v1/image/generate/route";
import { POST as audioPost } from "@/app/api/v1/audio/generate/route";

function buildRequest(url: string): NextRequest {
  return new Request(url, {
    method: "POST",
    body: "{}",
  }) as unknown as NextRequest;
}

describe("media generate routes feature flags", () => {
  beforeEach(() => {
    Reflect.deleteProperty(process.env, "IMAGE_GENERATION_ENABLED");
    Reflect.deleteProperty(process.env, "AUDIO_GENERATION_ENABLED");
    generateMock.mockReset();
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, "IMAGE_GENERATION_ENABLED");
    Reflect.deleteProperty(process.env, "AUDIO_GENERATION_ENABLED");
    vi.restoreAllMocks();
  });

  it("returns 503 for image generation when the flag is unset", async () => {
    const response = await imagePost(
      buildRequest("http://localhost/api/v1/image/generate"),
    );

    expect(response.status).toBe(503);
    const json = (await response.json()) as {
      success: boolean;
      error: { message: string; details: { code: string } };
    };
    expect(json.success).toBe(false);
    expect(json.error.details.code).toBe("GENERATION_DISABLED");
    expect(json.error.message).toContain("Image generation is coming soon");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 503 for image generation when the flag is false", async () => {
    process.env.IMAGE_GENERATION_ENABLED = "false";

    const response = await imagePost(
      buildRequest("http://localhost/api/v1/image/generate"),
    );

    expect(response.status).toBe(503);
    const json = (await response.json()) as {
      error: { details: { code: string } };
    };
    expect(json.error.details.code).toBe("GENERATION_DISABLED");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 503 for music generation when the flag is unset", async () => {
    const response = await audioPost(
      buildRequest("http://localhost/api/v1/audio/generate"),
    );

    expect(response.status).toBe(503);
    const json = (await response.json()) as {
      success: boolean;
      error: { message: string; details: { code: string } };
    };
    expect(json.success).toBe(false);
    expect(json.error.details.code).toBe("GENERATION_DISABLED");
    expect(json.error.message).toContain("Music generation is coming soon");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 503 for music generation when the flag is false", async () => {
    process.env.AUDIO_GENERATION_ENABLED = "false";

    const response = await audioPost(
      buildRequest("http://localhost/api/v1/audio/generate"),
    );

    expect(response.status).toBe(503);
    const json = (await response.json()) as {
      error: { details: { code: string } };
    };
    expect(json.error.details.code).toBe("GENERATION_DISABLED");
    expect(generateMock).not.toHaveBeenCalled();
  });
});
