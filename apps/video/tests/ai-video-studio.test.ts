import { describe, expect, it, vi } from "vitest";

import {
  applyResultStatus,
  buildGenerateRequest,
  fetchRecentResults,
  fetchResultStatus,
  isResultPending,
  mergeResults,
  toStudioStatus,
  canGenerate,
  defaultSettings,
  estimateCredits,
  PROMPT_PARAM_MAX,
  selectModel,
  settingsFromSearchParams,
  STUDIO_MODELS,
  submitGeneration,
} from "@/lib/ai-video-studio";
import { calculateModelCredits } from "@/config/credits";

const byId = (id: string) => {
  const model = STUDIO_MODELS.find((item) => item.id === id);
  if (!model) throw new Error(`missing studio model ${id}`);
  return model;
};
const WAN = byId("wan2.6");
const VEO = byId("veo-3.1");

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
    const model = STUDIO_MODELS[1];
    const settings = defaultSettings(model);

    expect(settings.modelId).toBe(model.id);
    expect(settings.duration).toBe(model.durations[0]);
    expect(settings.audio).toBe(model.audio);
  });
});

describe("selectModel", () => {
  it("keeps supported options when switching between available models", () => {
    const start = defaultSettings(VEO);
    const next = selectModel(start, WAN.id);

    expect(next.modelId).toBe(WAN.id);
    expect(next.aspect).toBe(start.aspect);
    expect(next.resolution).toBe(start.resolution);
    // Veo only offers 8s, which Wan does not, so the length falls back.
    expect(next.duration).toBe(WAN.durations[0]);
  });

  it("falls back to the new model's defaults for unsupported options", () => {
    const start = {
      ...defaultSettings(VEO),
      duration: 7,
      aspect: "2:1",
      resolution: "4k",
    };
    const next = selectModel(start, WAN.id);

    expect(next.modelId).toBe(WAN.id);
    expect(next.duration).toBe(WAN.durations[0]);
    expect(next.aspect).toBe(WAN.aspects[0]);
    expect(next.resolution).toBe(WAN.resolutions[0]);
  });

  it("disables audio when the new model has no audio", () => {
    const start = { ...defaultSettings(VEO), audio: true };
    const next = selectModel(start, WAN.id);

    expect(next.audio).toBe(false);
  });

  it("returns the settings unchanged for an unknown id", () => {
    const start = defaultSettings(WAN);
    const next = selectModel(start, "does-not-exist");

    expect(next).toEqual(start);
  });

  it("ignores an unavailable model", () => {
    const start = defaultSettings(WAN);
    const next = selectModel(start, "kling-3");

    expect(next).toEqual(start);
  });
});

describe("estimateCredits", () => {
  it("matches what the server charges for every available model and setting", () => {
    for (const model of STUDIO_MODELS.filter((item) => item.available)) {
      for (const duration of model.durations) {
        for (const resolution of model.resolutions) {
          for (const audio of [false, true]) {
            const settings = {
              ...defaultSettings(model),
              duration,
              resolution,
              audio,
            };

            expect(
              estimateCredits(settings),
              `${model.id} ${duration}s ${resolution} audio=${audio}`,
            ).toBe(
              calculateModelCredits(model.id, { duration, quality: resolution }),
            );
          }
        }
      }
    }
  });

  it("returns a positive price for every available model", () => {
    for (const model of STUDIO_MODELS.filter((item) => item.available)) {
      expect(estimateCredits(defaultSettings(model)), model.id).toBeGreaterThan(0);
    }
  });

  it("pins the published prices", () => {
    const price = (modelId: string, duration: number, resolution: string) =>
      estimateCredits({ modelId, duration, resolution });

    expect(price("veo-3.1", 8, "720p")).toBe(90);
    expect(price("wan2.6", 5, "720p")).toBe(100);
    expect(price("wan2.6", 5, "1080p")).toBe(150);
    expect(price("wan2.6", 10, "720p")).toBe(195);
    expect(price("wan2.6", 15, "1080p")).toBe(435);
  });

  it("prices models that are off sale at zero", () => {
    expect(estimateCredits({ modelId: "sora-2", duration: 10, resolution: "720p" })).toBe(0);
    expect(estimateCredits({ modelId: "seedance-1.5-pro", duration: 4, resolution: "480p" })).toBe(0);
  });
});

describe("canGenerate", () => {
  it("reports empty-prompt when the prompt is blank", () => {
    const settings = defaultSettings(WAN);

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
      ...defaultSettings(WAN),
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
      ...defaultSettings(WAN),
      modelId: "kling-3",
      prompt: "a cat",
    };

    expect(canGenerate(settings, false)).toEqual({
      ok: false,
      reason: "unavailable-model",
    });
  });

  it("reports disabled when generation is turned off", () => {
    const settings = { ...defaultSettings(WAN), prompt: "a cat" };

    expect(canGenerate(settings, false)).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("reports ok when the prompt exists and generation is enabled", () => {
    const settings = { ...defaultSettings(WAN), prompt: "a cat" };

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
      ...defaultSettings(WAN),
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
        model: "wan2.6",
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
      { ...defaultSettings(WAN), prompt: "  a cat  " },
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
        { ...defaultSettings(WAN), prompt: "   " },
        "key-1",
      ),
    ).toEqual({ ok: false, reason: "empty-prompt" });
  });

  it("reports unsupported-model for an unavailable model", () => {
    expect(
      buildGenerateRequest(
        {
          ...defaultSettings(WAN),
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
          ...defaultSettings(WAN),
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
    ...defaultSettings(WAN),
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
        model: "wan2.6",
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

describe("settingsFromSearchParams", () => {
  it("prefills a valid model id and adjusts duration to that model", () => {
    const settings = settingsFromSearchParams({ model: "wan2.6" });
    const model = STUDIO_MODELS.find((item) => item.id === "wan2.6");

    expect(model).toBeDefined();
    expect(settings.modelId).toBe("wan2.6");
    expect(model?.durations).toContain(settings.duration);
  });

  it("ignores an unavailable model id", () => {
    const settings = settingsFromSearchParams({ model: "kling-3" });

    expect(settings).toEqual({ ...defaultSettings(), preset: undefined });
    expect(settings.modelId).not.toBe("kling-3");
  });

  it("ignores an unknown model id", () => {
    const settings = settingsFromSearchParams({ model: "does-not-exist" });

    expect(settings.modelId).toBe(defaultSettings().modelId);
  });

  it("ignores aliases like veo-3-1", () => {
    const settings = settingsFromSearchParams({ model: "veo-3-1" });

    expect(settings.modelId).toBe(defaultSettings().modelId);
  });

  it("takes the first value when a param is an array", () => {
    const settings = settingsFromSearchParams({
      model: ["wan2.6", "veo-3.1"],
      prompt: ["first shot", "second shot"],
    });

    expect(settings.modelId).toBe("wan2.6");
    expect(settings.prompt).toBe("first shot");
  });

  it("trims the prompt", () => {
    const settings = settingsFromSearchParams({ prompt: "  a cat  " });

    expect(settings.prompt).toBe("a cat");
  });

  it("caps the prompt at PROMPT_PARAM_MAX characters", () => {
    const settings = settingsFromSearchParams({
      prompt: `  ${"a".repeat(PROMPT_PARAM_MAX + 500)}  `,
    });

    expect(settings.prompt).toHaveLength(PROMPT_PARAM_MAX);
    expect(settings.prompt).toBe("a".repeat(PROMPT_PARAM_MAX));
  });

  it("accepts a valid preset", () => {
    const settings = settingsFromSearchParams({ preset: "slow-zoom" });

    expect(settings.preset).toBe("slow-zoom");
  });

  it("lowercases and trims a preset", () => {
    const settings = settingsFromSearchParams({ preset: "  Slow-Zoom  " });

    expect(settings.preset).toBe("slow-zoom");
  });

  it("rejects an invalid preset", () => {
    expect(
      settingsFromSearchParams({ preset: "<script>" }).preset,
    ).toBeUndefined();
    expect(settingsFromSearchParams({ preset: "A B" }).preset).toBeUndefined();
    expect(
      settingsFromSearchParams({ preset: "a".repeat(65) }).preset,
    ).toBeUndefined();
  });

  it("returns the defaults for empty params", () => {
    expect(settingsFromSearchParams({})).toEqual(defaultSettings());
  });

  it("never adds a preset key to the generate request body", () => {
    const result = buildGenerateRequest(
      { ...defaultSettings(), prompt: "a cat", preset: "slow-zoom" },
      "key-1",
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect("preset" in result.body).toBe(false);
    }
  });
});

describe("studio results", () => {
  it("maps server statuses onto studio states", () => {
    expect(toStudioStatus("PENDING")).toBe("queued");
    expect(toStudioStatus("GENERATING")).toBe("generating");
    expect(toStudioStatus("UPLOADING")).toBe("generating");
    expect(toStudioStatus("COMPLETED")).toBe("completed");
    expect(toStudioStatus("FAILED")).toBe("failed");
    expect(toStudioStatus(undefined)).toBe("queued");
  });

  it("only treats unfinished clips with a uuid as pending", () => {
    expect(isResultPending({ id: "a", status: "queued", videoUuid: "a" })).toBe(true);
    expect(isResultPending({ id: "a", status: "generating", videoUuid: "a" })).toBe(true);
    expect(isResultPending({ id: "a", status: "completed", videoUuid: "a" })).toBe(false);
    expect(isResultPending({ id: "a", status: "failed", videoUuid: "a" })).toBe(false);
    expect(isResultPending({ id: "a", status: "queued", videoUuid: null })).toBe(false);
  });

  it("reads a completed status with its video url", async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse(200, {
        success: true,
        data: { status: "COMPLETED", videoUrl: "https://cdn.test/v.mp4" },
      }),
    );

    const result = await fetchResultStatus("vid_1", fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/video/vid_1/status", { cache: "no-store" });
    expect(result).toEqual({
      ok: true,
      status: "completed",
      videoUrl: "https://cdn.test/v.mp4",
      message: null,
    });
  });

  it("reports status errors as not ok instead of throwing", async () => {
    const http = vi.fn(async () => fakeResponse(500, { success: false }));
    const network = vi.fn(async () => {
      throw new Error("offline");
    });

    expect(await fetchResultStatus("vid_1", http as unknown as typeof fetch)).toEqual({ ok: false });
    expect(await fetchResultStatus("vid_1", network as unknown as typeof fetch)).toEqual({ ok: false });
  });

  it("loads history and returns an empty list when signed out", async () => {
    const ok = vi.fn(async () =>
      fakeResponse(200, {
        success: true,
        data: {
          videos: [
            { uuid: "vid_2", status: "COMPLETED", videoUrl: "https://cdn.test/2.mp4", prompt: "a cat" },
            { uuid: "vid_1", status: "FAILED", errorMessage: "boom" },
            { status: "PENDING" },
          ],
        },
      }),
    );
    const signedOut = vi.fn(async () => fakeResponse(401, { success: false }));

    expect(await fetchRecentResults(ok as unknown as typeof fetch)).toEqual([
      { id: "vid_2", videoUuid: "vid_2", status: "completed", videoUrl: "https://cdn.test/2.mp4", prompt: "a cat", message: null },
      { id: "vid_1", videoUuid: "vid_1", status: "failed", videoUrl: null, prompt: null, message: "boom" },
    ]);
    expect(await fetchRecentResults(signedOut as unknown as typeof fetch)).toEqual([]);
  });

  it("merges history under local entries without duplicates", () => {
    const merged = mergeResults(
      [{ id: "vid_3", status: "queued", videoUuid: "vid_3" }],
      [
        { id: "vid_3", status: "completed", videoUuid: "vid_3" },
        { id: "vid_2", status: "completed", videoUuid: "vid_2" },
      ],
    );

    expect(merged.map((item) => `${item.id}:${item.status}`)).toEqual([
      "vid_3:queued",
      "vid_2:completed",
    ]);
  });

  it("applies a status update to the matching clip only", () => {
    const list = [
      { id: "vid_1", status: "queued" as const, videoUuid: "vid_1" },
      { id: "vid_2", status: "queued" as const, videoUuid: "vid_2" },
    ];

    const next = applyResultStatus(list, "vid_2", {
      ok: true,
      status: "completed",
      videoUrl: "https://cdn.test/2.mp4",
      message: null,
    });

    expect(next[0]).toBe(list[0]);
    expect(next[1]).toMatchObject({ status: "completed", videoUrl: "https://cdn.test/2.mp4" });
    expect(applyResultStatus(list, "vid_2", { ok: false })).toBe(list);
  });
});
