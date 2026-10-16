import { describe, expect, it, vi } from "vitest";

import {
  buildGenerateRequest,
  canGenerate,
  defaultSettings,
  estimateCredits,
  selectModel,
  STUDIO_MODELS,
  submitGeneration,
} from "@/lib/ai-video-studio";

function fakeResponse(status: number, payload: unknown): Response {
  return {
    status,
    json: async () => payload,
  } as unknown as Response;
}

describe("defaultSettings", () => {
  it("uses the first model when none is provided", () => {
    const settings = defaultSettings();

    expect(settings.modelId).toBe(STUDIO_MODELS[0].id);
    expect(settings.duration).toBe(STUDIO_MODELS[0].durations[0]);
    expect(settings.aspect).toBe(STUDIO_MODELS[0].aspects[0]);
    expect(settings.resolution).toBe(STUDIO_MODELS[0].resolutions[0]);
    expect(settings.audio).toBe(STUDIO_MODELS[0].audio);
    expect(settings.prompt).toBe("");
  });

  it("defaults to the first available model, skipping unavailable ones", () => {
    const firstAvailable = STUDIO_MODELS.find((model) => model.available);

    expect(firstAvailable).toBeDefined();
    expect(firstAvailable?.id).not.toBe("kling-3");

    const settings = defaultSettings();

    expect(settings.modelId).toBe(firstAvailable?.id);
    expect(settings.modelId).not.toBe("kling-3");
  });

  it("derives every field from the provided model", () => {
    const model = STUDIO_MODELS[2];
    const settings = defaultSettings(model);

    expect(settings.modelId).toBe(model.id);
    expect(settings.duration).toBe(model.durations[0]);
    expect(settings.audio).toBe(model.audio);
  });
});

describe("selectModel", () => {
  it("keeps supported options when switching between available models", () => {
    const start = defaultSettings(STUDIO_MODELS[2]);
    const next = selectModel(start, STUDIO_MODELS[0].id);

    expect(next.modelId).toBe(STUDIO_MODELS[0].id);
    expect(next.duration).toBe(start.duration);
    expect(next.aspect).toBe(start.aspect);
    expect(next.resolution).toBe(start.resolution);
  });

  it("falls back to the new model's defaults for unsupported options", () => {
    const start = {
      ...defaultSettings(STUDIO_MODELS[1]),
      duration: 7,
      aspect: "2:1",
      resolution: "4k",
    };
    const next = selectModel(start, STUDIO_MODELS[0].id);

    expect(next.modelId).toBe(STUDIO_MODELS[0].id);
    expect(next.duration).toBe(STUDIO_MODELS[0].durations[0]);
    expect(next.aspect).toBe(STUDIO_MODELS[0].aspects[0]);
    expect(next.resolution).toBe(STUDIO_MODELS[0].resolutions[0]);
  });

  it("disables audio when the new model has no audio", () => {
    const start = { ...defaultSettings(STUDIO_MODELS[2]), audio: true };
    const next = selectModel(start, STUDIO_MODELS[0].id);

    expect(next.audio).toBe(false);
  });

  it("returns the settings unchanged for an unknown id", () => {
    const start = defaultSettings(STUDIO_MODELS[0]);
    const next = selectModel(start, "does-not-exist");

    expect(next).toEqual(start);
  });

  it("ignores an unavailable model", () => {
    const start = defaultSettings(STUDIO_MODELS[0]);
    const next = selectModel(start, "kling-3");

    expect(next).toEqual(start);
  });
});

describe("estimateCredits", () => {
  it("multiplies duration by the model rate", () => {
    const settings = defaultSettings(STUDIO_MODELS[1]);

    expect(estimateCredits(settings)).toBe(
      Math.ceil(settings.duration * STUDIO_MODELS[1].creditsPerSecond),
    );
  });

  it("applies the 1080p resolution factor", () => {
    const settings = {
      ...defaultSettings(STUDIO_MODELS[0]),
      resolution: "1080p",
    };

    expect(estimateCredits(settings)).toBe(
      Math.ceil(
        settings.duration * STUDIO_MODELS[0].creditsPerSecond * 1.5,
      ),
    );
  });

  it("applies the audio factor", () => {
    const settings = { ...defaultSettings(STUDIO_MODELS[2]), audio: true };

    expect(estimateCredits(settings)).toBe(
      Math.ceil(
        settings.duration * STUDIO_MODELS[2].creditsPerSecond * 1.2,
      ),
    );
  });
});

describe("canGenerate", () => {
  it("reports empty-prompt when the prompt is blank", () => {
    const settings = defaultSettings(STUDIO_MODELS[0]);

    expect(canGenerate(settings, true)).toEqual({
      ok: false,
      reason: "empty-prompt",
    });
    expect(canGenerate({ ...settings, prompt: "   " }, true)).toEqual({
      ok: false,
      reason: "empty-prompt",
    });
  });

  it("reports unavailable-model when the selected model is unavailable", () => {
    const settings = {
      ...defaultSettings(STUDIO_MODELS[0]),
      modelId: "kling-3",
      prompt: "a cat",
    };

    expect(canGenerate(settings, true)).toEqual({
      ok: false,
      reason: "unavailable-model",
    });
  });

  it("reports unavailable-model before disabled", () => {
    const settings = {
      ...defaultSettings(STUDIO_MODELS[0]),
      modelId: "kling-3",
      prompt: "a cat",
    };

    expect(canGenerate(settings, false)).toEqual({
      ok: false,
      reason: "unavailable-model",
    });
  });

  it("reports disabled when generation is turned off", () => {
    const settings = { ...defaultSettings(STUDIO_MODELS[0]), prompt: "a cat" };

    expect(canGenerate(settings, false)).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("reports ok when the prompt exists and generation is enabled", () => {
    const settings = { ...defaultSettings(STUDIO_MODELS[0]), prompt: "a cat" };

    expect(canGenerate(settings, true)).toEqual({ ok: true });
  });
});

describe("buildGenerateRequest", () => {
  it("sets body.model to the selected model id for every available model", () => {
    for (const model of STUDIO_MODELS.filter((item) => item.available)) {
      const result = buildGenerateRequest(
        { ...defaultSettings(model), prompt: "a cat" },
        "key-1",
      );

      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.body.model).toBe(model.id);
      }
    }
  });

  it("carries the settings and idempotency key into the body", () => {
    const settings = {
      ...defaultSettings(STUDIO_MODELS[0]),
      prompt: "a cat",
      duration: 8,
      aspect: "9:16",
      resolution: "1080p",
    };

    const result = buildGenerateRequest(settings, "key-1");

    expect(result).toEqual({
      ok: true,
      body: {
        prompt: "a cat",
        model: "seedance-1.5-pro",
        duration: 8,
        aspectRatio: "9:16",
        quality: "1080p",
        generateAudio: settings.audio,
        idempotencyKey: "key-1",
      },
    });
  });

  it("trims surrounding whitespace from the prompt", () => {
    const result = buildGenerateRequest(
      { ...defaultSettings(STUDIO_MODELS[0]), prompt: "  a cat  " },
      "key-1",
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.body.prompt).toBe("a cat");
    }
  });

  it("reports empty-prompt for a blank prompt", () => {
    expect(
      buildGenerateRequest(
        { ...defaultSettings(STUDIO_MODELS[0]), prompt: "   " },
        "key-1",
      ),
    ).toEqual({ ok: false, reason: "empty-prompt" });
  });

  it("reports unsupported-model for an unavailable model", () => {
    expect(
      buildGenerateRequest(
        {
          ...defaultSettings(STUDIO_MODELS[0]),
          modelId: "kling-3",
          prompt: "a cat",
        },
        "key-1",
      ),
    ).toEqual({ ok: false, reason: "unsupported-model" });
  });

  it("reports unsupported-model for an unknown model id", () => {
    expect(
      buildGenerateRequest(
        {
          ...defaultSettings(STUDIO_MODELS[0]),
          modelId: "does-not-exist",
          prompt: "a cat",
        },
        "key-1",
      ),
    ).toEqual({ ok: false, reason: "unsupported-model" });
  });
});

describe("submitGeneration", () => {
  const settings = {
    ...defaultSettings(STUDIO_MODELS[0]),
    prompt: "a cat",
    duration: 8,
    aspect: "9:16",
    resolution: "1080p",
  };

  it("posts the request body, url, method and headers", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        fakeResponse(200, {
          success: true,
          data: { videoUuid: "vid-1", taskId: "task-1" },
        }),
      );

    const result = await submitGeneration(settings, "key-1", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "key-1",
      },
      body: JSON.stringify({
        prompt: "a cat",
        model: "seedance-1.5-pro",
        duration: 8,
        aspectRatio: "9:16",
        quality: "1080p",
        generateAudio: false,
        idempotencyKey: "key-1",
      }),
    });
    expect(result).toEqual({
      ok: true,
      videoUuid: "vid-1",
      taskId: "task-1",
    });
  });

  it("returns null ids when the success payload omits them", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(fakeResponse(200, { success: true, data: {} }));

    const result = await submitGeneration(settings, "key-1", fetchImpl);

    expect(result).toEqual({ ok: true, videoUuid: null, taskId: null });
  });

  it("maps a 401 response to a sign-in message", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        fakeResponse(401, { success: false, error: { message: "unauthorized" } }),
      );

    const result = await submitGeneration(settings, "key-1", fetchImpl);

    expect(result).toEqual({
      ok: false,
      message: "Please sign in to generate.",
    });
  });

  it("returns the server message and code for a disabled generation response", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      fakeResponse(503, {
        success: false,
        error: {
          message: "Video generation is currently disabled.",
          details: { code: "GENERATION_DISABLED" },
        },
      }),
    );

    const result = await submitGeneration(settings, "key-1", fetchImpl);

    expect(result).toEqual({
      ok: false,
      message: "Video generation is currently disabled.",
      code: "GENERATION_DISABLED",
    });
  });

  it("falls back to a generic message when the error payload is missing", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(fakeResponse(500, { success: false }));

    const result = await submitGeneration(settings, "key-1", fetchImpl);

    expect(result).toEqual({
      ok: false,
      message: "Generation failed. Please try again.",
    });
  });

  it("returns a network error message when fetch throws", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("boom"));

    const result = await submitGeneration(settings, "key-1", fetchImpl);

    expect(result).toEqual({
      ok: false,
      message: "Network error. Please try again.",
    });
  });

  it("does not call fetch when the prompt is empty", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await submitGeneration(
      { ...settings, prompt: "   " },
      "key-1",
      fetchImpl,
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, message: "Please enter a prompt." });
  });

  it("does not call fetch when the model is unavailable", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await submitGeneration(
      { ...settings, modelId: "kling-3" },
      "key-1",
      fetchImpl,
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      message: "This model is not available yet.",
    });
  });
});
