import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

// Real local D1 and credit ledger; fake providers and storage (as in
// video-generate.test.ts and video-extend.test.ts). Each case is a review
// finding from the extend branch that also applies to main's shared paths.
const fakeProvider = vi.hoisted(() => ({
  name: "evolink",
  supportImageToVideo: true,
  createTask: vi.fn(),
  getTaskStatus: vi.fn(),
  parseCallback: vi.fn(),
}));
vi.mock("@/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai")>();
  return { ...actual, getProvider: vi.fn(() => fakeProvider) };
});
const createMarketTask = vi.hoisted(() => vi.fn());
vi.mock("@/ai/kie-market", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai/kie-market")>();
  return { ...actual, createMarketTask };
});
const storageState = vi.hoisted(() => ({ signFails: false, upload: vi.fn() }));
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    UnusableMediaError: actual.UnusableMediaError,
    getStorage: vi.fn(() => ({
      getSignedUrl: vi.fn((key: string) => {
        if (storageState.signFails) throw new Error("storage not configured");
        return `https://signed.test/${key}`;
      }),
      downloadAndUpload: storageState.upload,
      deleteFile: vi.fn(async () => undefined),
      getObjectSize: vi.fn(async () => 1024),
    })),
    isStorageConfigured: vi.fn(() => true),
    isStorageKey: (value: string) => Boolean(value) && !/^https?:\/\//.test(value),
    signMediaRef: vi.fn((value: string | null | undefined) => (value ? `https://signed.test/${value}` : null)),
  };
});
vi.mock("@/lib/video-events", () => ({ emitVideoEvent: vi.fn() }));

import { marketModelsOf } from "@/ai/kie-market";
import { getModelConfig } from "@/config/credits";
import { VideoStatus, db, videos } from "@/db";
import { ApiError } from "@/lib/api/error";
import { UnusableMediaError } from "@/lib/storage";
import { videoService } from "@/services/video";
import { getBalance, getVideoRow, giveCredits, uniqueUserId } from "./helpers";

const MARKET_VIDEO = marketModelsOf("video").find((model) => !model.options.requiresImage)!;
const MARKET_AUDIO = marketModelsOf("audio")[0];
const LEGACY = ["wan2.6", "veo-3.1"].find((id) => getModelConfig(id)?.enabled !== false)!;
const done = (url?: string) => ({ taskId: "t", provider: "kie" as const, status: "completed" as const, ...(url ? { videoUrl: url } : {}) });

async function startMarket(userId: string, model = MARKET_VIDEO.id) {
  return videoService.generateMedia({ userId, model, prompt: "a cat surfing at sunset", idempotencyKey: `k-${nanoid(8)}` });
}

beforeEach(() => {
  process.env.KIE_API_KEY = "test-key";
  createMarketTask.mockReset();
  createMarketTask.mockResolvedValue(`task_${nanoid(6)}`);
  fakeProvider.createTask.mockReset();
  storageState.signFails = false;
  storageState.upload.mockReset();
  storageState.upload.mockImplementation(async ({ key }: { key: string }) => ({ key, fileSize: 2048 }));
});

describe("video and audio results that are not usable", () => {
  it("an empty file or an error page fails the job and returns the credits", async () => {
    for (const model of [MARKET_VIDEO.id, MARKET_AUDIO.id]) {
      const userId = uniqueUserId();
      await giveCredits(userId, 5_000);
      const job = await startMarket(userId, model);
      storageState.upload.mockRejectedValueOnce(new UnusableMediaError("https://kie.test/out"));
      const result = await videoService.tryCompleteGeneration(job.videoUuid, done("https://kie.test/out"));
      expect(result.status, model).toBe(VideoStatus.FAILED);
      expect((await getBalance(userId)).availableCredits, model).toBe(5_000);
    }
  });

  it("success with no result URL fails and refunds instead of freezing the credits", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 5_000);
    const job = await startMarket(userId);
    const result = await videoService.tryCompleteGeneration(job.videoUuid, done());
    expect(result.status).toBe(VideoStatus.FAILED);
    expect(storageState.upload).not.toHaveBeenCalled();
    expect((await getBalance(userId)).availableCredits).toBe(5_000);
  });

  it("a storage error hands the job back so the next callback can finish it", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 5_000);
    const job = await startMarket(userId);
    storageState.upload.mockRejectedValueOnce(new Error("R2 timeout"));
    await expect(videoService.tryCompleteGeneration(job.videoUuid, done("https://kie.test/out.mp4"))).rejects.toThrow("R2 timeout");
    expect((await getVideoRow(job.videoUuid))?.status).toBe(VideoStatus.GENERATING);
    expect((await videoService.tryCompleteGeneration(job.videoUuid, done("https://kie.test/out.mp4"))).status).toBe(VideoStatus.COMPLETED);
    expect((await getVideoRow(job.videoUuid))?.fileSize).toBe(2048);
  });
});

describe("saving the provider task id keeps a final state that arrived first", () => {
  it("market video: a failure callback before the create response stays FAILED", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 5_000);
    createMarketTask.mockImplementationOnce(async () => {
      await db.update(videos).set({ status: VideoStatus.FAILED }).where(eq(videos.status, VideoStatus.PENDING));
      return "task_late";
    });
    const job = await startMarket(userId);
    const row = await getVideoRow(job.videoUuid);
    expect(row?.status).toBe(VideoStatus.FAILED);
    expect(row?.externalTaskId).toBe("task_late");
  });

  it("legacy path: the same holds", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 5_000);
    fakeProvider.createTask.mockImplementationOnce(async () => {
      await db.update(videos).set({ status: VideoStatus.FAILED }).where(eq(videos.status, VideoStatus.PENDING));
      return { taskId: "legacy_late", provider: "evolink", status: "pending" };
    });
    const result = await videoService.generate({ userId, prompt: "a cat", model: LEGACY, duration: getModelConfig(LEGACY)?.durations[0] ?? 5, aspectRatio: "16:9" });
    expect((await getVideoRow(result.videoUuid))?.status).toBe(VideoStatus.FAILED);
  });
});

describe("legacy path signs before reserving credits", () => {
  it("a signing failure answers 503 with nothing frozen and nothing sent", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 5_000);
    storageState.signFails = true;
    const error = await videoService
      .generate({ userId, prompt: "a cat", model: LEGACY, duration: getModelConfig(LEGACY)?.durations[0] ?? 5, aspectRatio: "16:9", imageUrl: `uploads/${userId}/start.png` })
      .then(() => null, (caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
    expect(fakeProvider.createTask).not.toHaveBeenCalled();
    expect((await getBalance(userId)).availableCredits).toBe(5_000);
  });
});
