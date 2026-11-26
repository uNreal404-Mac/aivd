import { beforeEach, describe, expect, it, vi } from "vitest";
import { nanoid } from "nanoid";

// Real local D1 and credit ledger, fake KIE call and storage (as in
// plan-limits.test.ts and video-generate.test.ts).
const createMarketTask = vi.hoisted(() => vi.fn());
vi.mock("@/ai/kie-market", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai/kie-market")>();
  return { ...actual, createMarketTask };
});
const storageState = vi.hoisted(() => ({
  signFails: false,
  upload: vi.fn(async ({ key }: { key: string }) => ({ key, size: 1234 })),
}));
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    EmptyMediaError: actual.EmptyMediaError,
    getStorage: vi.fn(() => ({
      getSignedUrl: vi.fn((key: string) => {
        if (storageState.signFails) throw new Error("storage not configured");
        return `https://signed.test/${key}`;
      }),
      downloadAndUpload: storageState.upload,
    })),
    isStorageConfigured: vi.fn(() => true),
    isStorageKey: (value: string) => Boolean(value) && !/^https?:\/\//.test(value),
    signMediaRef: vi.fn((value: string | null | undefined) => (value ? `https://signed.test/${value}` : null)),
  };
});
vi.mock("@/lib/video-events", () => ({ emitVideoEvent: vi.fn() }));

import { EXTEND_MODEL_ID, extendCredits, getMarketModel, marketModelsOf } from "@/ai/kie-market";
import { VideoStatus, db, videos } from "@/db";
import { ApiError } from "@/lib/api/error";
import { canSubmitExtend, defaultExtendResolution } from "@/lib/video-extend";
import { EmptyMediaError } from "@/lib/storage";
import { eq } from "drizzle-orm";
import { MAX_SOURCE_VIDEO_BYTES, videoService } from "@/services/video";
import { getBalance, getVideoRow, giveCredits, uniqueUserId } from "./helpers";

const model = getMarketModel(EXTEND_MODEL_ID)!;

async function insertSource(userId: string, overrides: Partial<typeof videos.$inferInsert> = {}) {
  const uuid = `vid_${nanoid(21)}`;
  await db.insert(videos).values({
    uuid,
    userId,
    prompt: "a girl walks in the rain",
    model: "bytedance/seedance-2-5",
    mediaType: "video",
    status: VideoStatus.COMPLETED,
    videoUrl: `videos/${uuid}/clip.mp4`,
    fileSize: 8 * 1024 * 1024,
    ...overrides,
  });
  return uuid;
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe("extend: price and request (PixVerse V6 extend, KIE 2026-11-25)", () => {
  it("charges only the added seconds at KIE's extend rate", () => {
    expect(model.costUsd({ prompt: "x", resolution: "720p", duration: 5, audio: false })).toBeCloseTo(0.18);
    expect(model.costUsd({ prompt: "x", resolution: "720p", duration: 5, audio: true })).toBeCloseTo(0.24);
    expect(model.costUsd({ prompt: "x", resolution: "1080p", duration: 1, audio: true })).toBeCloseTo(0.092);
    expect(model.costUsd({ prompt: "x", resolution: "360p", duration: 1, audio: false })).toBeCloseTo(0.02);
    expect(extendCredits({ resolution: "720p", duration: 5, audio: false })).toBe(55);
    expect(extendCredits({ resolution: "720p", duration: 5, audio: true })).toBe(65);
    expect(extendCredits({ resolution: "360p", duration: 1, audio: false })).toBe(20);
  });

  it("builds KIE's video_url request with every required field", () => {
    const task = model.buildTask({ prompt: "she turns around", videoUrl: "https://signed.test/a.mp4", duration: 20, resolution: "4k", audio: true, seed: 7 });
    expect(task).toEqual({
      model: "pixverse-v6/extend",
      input: {
        video_url: "https://signed.test/a.mp4",
        prompt: "she turns around",
        duration: 15,
        quality: "720p",
        seed: 7,
        generate_audio_switch: true,
      },
    });
  });

  it("is a tool, never offered as a studio model", () => {
    expect(model.tool).toBe("extend");
    expect(marketModelsOf("video").some((item) => item.id === EXTEND_MODEL_ID)).toBe(false);
  });

  it("starts from the source's quality when extend offers it", () => {
    expect(defaultExtendResolution("1080p")).toBe("1080p");
    expect(defaultExtendResolution("480p")).toBe("720p");
    expect(defaultExtendResolution(null)).toBe("720p");
    expect(canSubmitExtend({ prompt: "ok", duration: 5, resolution: "720p", audio: false })).toBe(false);
    expect(canSubmitExtend({ prompt: "she smiles", duration: 5, resolution: "720p", audio: false })).toBe(true);
  });
});

describe("extend: generateMedia()", () => {
  beforeEach(() => {
    process.env.KIE_API_KEY = "test-key";
    createMarketTask.mockReset();
    createMarketTask.mockResolvedValue("task_extend_1");
    storageState.signFails = false;
    storageState.upload.mockReset();
    storageState.upload.mockImplementation(async ({ key }: { key: string }) => ({ key, size: 1234 }));
  });

  it("extends the user's own finished video: signed source, frozen price, source kept by id", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1_000);
    const source = await insertSource(userId);

    const result = await videoService.generate({
      userId,
      model: EXTEND_MODEL_ID,
      prompt: "the camera pulls back as she walks away",
      duration: 5,
      quality: "720p",
      generateAudio: false,
      sourceVideoUuid: source,
      idempotencyKey: `extend-${nanoid(8)}`,
    });

    expect(result.creditsUsed).toBe(55);
    expect(createMarketTask).toHaveBeenCalledTimes(1);
    const [calledModel, request] = createMarketTask.mock.calls[0];
    expect(calledModel.id).toBe(EXTEND_MODEL_ID);
    expect(request.videoUrl).toBe(`https://signed.test/videos/${source}/clip.mp4`);
    expect(request.seed).toBeGreaterThanOrEqual(0);
    expect(request.seed).toBeLessThan(2147483648);
    const balance = await getBalance(userId);
    expect(balance.availableCredits).toBe(1_000 - 55);
    const row = await getVideoRow(result.videoUuid);
    expect(row?.parameters).toMatchObject({ sourceVideoUuid: source });
    expect(JSON.stringify(row?.parameters)).not.toContain("signed.test");
  });

  it("refuses another user's video, an unfinished, deleted or image source, without charging", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1_000);
    const someoneElses = await insertSource(uniqueUserId());
    const unfinished = await insertSource(userId, { status: VideoStatus.GENERATING });
    const deleted = await insertSource(userId, { isDeleted: true });
    const image = await insertSource(userId, { mediaType: "image" });

    for (const sourceVideoUuid of [someoneElses, unfinished, deleted, image, "vid_missing"]) {
      const error = await rejection(
        videoService.generate({ userId, model: EXTEND_MODEL_ID, prompt: "keep going", duration: 5, quality: "720p", sourceVideoUuid }),
      );
      expect(error.status).toBe(400);
      expect(error.details).toMatchObject({ code: "SOURCE_VIDEO_UNAVAILABLE" });
    }
    expect(createMarketTask).not.toHaveBeenCalled();
    expect((await getBalance(userId)).availableCredits).toBe(1_000);
  });

  it("refuses a source over 50 MB, a missing source and a too-short prompt", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1_000);
    const large = await insertSource(userId, { fileSize: MAX_SOURCE_VIDEO_BYTES + 1 });
    const ok = await insertSource(userId);

    expect((await rejection(videoService.generate({ userId, model: EXTEND_MODEL_ID, prompt: "keep going", sourceVideoUuid: large }))).details).toMatchObject({ code: "SOURCE_VIDEO_TOO_LARGE" });
    expect((await rejection(videoService.generate({ userId, model: EXTEND_MODEL_ID, prompt: "keep going" }))).details).toMatchObject({ code: "MISSING_SOURCE_VIDEO" });
    expect((await rejection(videoService.generate({ userId, model: EXTEND_MODEL_ID, prompt: " a ", sourceVideoUuid: ok }))).details).toMatchObject({ code: "PROMPT_TOO_SHORT" });
    expect(createMarketTask).not.toHaveBeenCalled();
  });

  it("a definite KIE rejection gives the credits back", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1_000);
    const source = await insertSource(userId);
    const { ProviderRejectedError } = await import("@/ai/types");
    createMarketTask.mockRejectedValueOnce(new ProviderRejectedError("unsupported video", 422));

    await videoService.generate({ userId, model: EXTEND_MODEL_ID, prompt: "keep going", duration: 5, quality: "720p", sourceVideoUuid: source }).catch(() => null);
    expect((await getBalance(userId)).availableCredits).toBe(1_000);
  });

  it("cannot sign the source: nothing frozen, nothing sent (review #2)", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1_000);
    const source = await insertSource(userId);
    storageState.signFails = true;
    const error = await rejection(videoService.generate({ userId, model: EXTEND_MODEL_ID, prompt: "keep going", duration: 5, quality: "720p", sourceVideoUuid: source }));
    expect(error.status).toBe(503);
    expect(createMarketTask).not.toHaveBeenCalled();
    expect((await getBalance(userId)).availableCredits).toBe(1_000);
  });

  it("a source with no recorded size is measured before freezing (review #6)", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1_000);
    const source = await insertSource(userId, { fileSize: null });
    const fetchMock = vi.fn(async () => new Response("x", { status: 206, headers: { "content-range": `bytes 0-0/${MAX_SOURCE_VIDEO_BYTES + 10}` } }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const error = await rejection(videoService.generate({ userId, model: EXTEND_MODEL_ID, prompt: "keep going", sourceVideoUuid: source }));
      expect(error.details).toMatchObject({ code: "SOURCE_VIDEO_TOO_LARGE" });
      expect(createMarketTask).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("a final state that arrives before the create response is kept (review #5)", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1_000);
    const source = await insertSource(userId);
    createMarketTask.mockImplementationOnce(async () => {
      // The failure callback lands first.
      await db.update(videos).set({ status: VideoStatus.FAILED }).where(eq(videos.status, VideoStatus.PENDING));
      return "task_late";
    });
    const result = await videoService.generate({ userId, model: EXTEND_MODEL_ID, prompt: "keep going", duration: 5, quality: "720p", sourceVideoUuid: source });
    const row = await getVideoRow(result.videoUuid);
    expect(row?.status).toBe(VideoStatus.FAILED);
    expect(row?.externalTaskId).toBe("task_late");
  });

  it("an empty result fails and refunds; a storage error can be retried; size is recorded (review #3, #4)", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1_000);
    const source = await insertSource(userId);
    const start = (key: string) => videoService.generate({ userId, model: EXTEND_MODEL_ID, prompt: "keep going", duration: 5, quality: "720p", generateAudio: false, sourceVideoUuid: source, idempotencyKey: key });
    const done = { taskId: "t", provider: "kie" as const, status: "completed" as const, videoUrl: "https://kie.test/out.mp4" };

    const empty = await start(`empty-${nanoid(6)}`);
    storageState.upload.mockRejectedValueOnce(new EmptyMediaError("https://kie.test/out.mp4"));
    expect((await videoService.tryCompleteGeneration(empty.videoUuid, done)).status).toBe(VideoStatus.FAILED);
    expect((await getBalance(userId)).availableCredits).toBe(1_000);

    const flaky = await start(`flaky-${nanoid(6)}`);
    storageState.upload.mockRejectedValueOnce(new Error("R2 timeout"));
    await expect(videoService.tryCompleteGeneration(flaky.videoUuid, done)).rejects.toThrow("R2 timeout");
    expect((await getVideoRow(flaky.videoUuid))?.status).toBe(VideoStatus.GENERATING);
    expect((await videoService.tryCompleteGeneration(flaky.videoUuid, done)).status).toBe(VideoStatus.COMPLETED);
    const completed = await getVideoRow(flaky.videoUuid);
    expect(completed?.fileSize).toBe(1234);
    expect((await getBalance(userId)).availableCredits).toBe(1_000 - 55);
  });

  it("a source whose size cannot be read is refused before freezing (review 2 #6)", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1_000);
    const source = await insertSource(userId, { fileSize: null });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>denied</html>", { status: 403 })));
    try {
      const error = await rejection(videoService.generate({ userId, model: EXTEND_MODEL_ID, prompt: "keep going", sourceVideoUuid: source }));
      expect(error.details).toMatchObject({ code: "SOURCE_VIDEO_SIZE_UNKNOWN" });
      expect(createMarketTask).not.toHaveBeenCalled();
      expect((await getBalance(userId)).availableCredits).toBe(1_000);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("drops an unusable file from a set or a track list instead of losing the good ones (review 2)", async () => {
    const userId = uniqueUserId();
    const insert = async (mediaType: "image" | "audio") => {
      const uuid = `${mediaType === "image" ? "img" : "aud"}_${nanoid(21)}`;
      await db.insert(videos).values({ uuid, userId, prompt: "p", model: "m", mediaType, status: VideoStatus.GENERATING, creditsUsed: 0 });
      return uuid;
    };
    const image = await insert("image");
    storageState.upload.mockImplementation(async ({ key, sourceUrl }: { key: string; sourceUrl: string }) => {
      if (sourceUrl.includes("bad")) throw new EmptyMediaError(sourceUrl);
      return { key, size: 10 };
    });
    const set = await videoService.tryCompleteGeneration(image, { taskId: "t", provider: "kie", status: "completed", resultUrls: ["https://k/a.png", "https://k/bad.png", "https://k/c.png"] });
    expect(set.status).toBe(VideoStatus.COMPLETED);
    expect(((await getVideoRow(image))?.parameters as { extraKeys?: string[] })?.extraKeys).toHaveLength(1);

    const audio = await insert("audio");
    const track = await videoService.tryCompleteGeneration(audio, { taskId: "t", provider: "kie", status: "completed", resultUrls: ["https://k/bad.mp3", "https://k/good.mp3"] });
    expect(track.status).toBe(VideoStatus.COMPLETED);
    expect(storageState.upload.mock.calls.some(([arg]) => (arg as { sourceUrl: string }).sourceUrl === "https://k/good.mp3")).toBe(true);
  });
});
