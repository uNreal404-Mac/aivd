import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Mocks (must be declared before importing the modules under test)
// ---------------------------------------------------------------------------

const failState = vi.hoisted(() => ({
  failExternalTaskIdWrite: false,
}));

vi.mock("@/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/db")>();
  const wrapped = new Proxy(mod.db, {
    get(target, prop, receiver) {
      if (prop === "update" && failState.failExternalTaskIdWrite) {
        const originalUpdate = Reflect.get(target, prop, receiver) as (
          table: unknown
        ) => unknown;
        return (table: unknown) => {
          const builder = originalUpdate.call(target, table) as {
            set: (values: Record<string, unknown>) => unknown;
          };
          const originalSet = builder.set.bind(builder);
          const patched = {
            set(values: Record<string, unknown>) {
              if (values && "externalTaskId" in values) {
                return {
                  where: () => Promise.reject(new Error("db write failed")),
                };
              }
              return originalSet(values);
            },
          };
          return new Proxy(builder as object, {
            get(bTarget, bProp, bReceiver) {
              if (bProp === "set") {
                return patched.set;
              }
              return Reflect.get(bTarget, bProp, bReceiver);
            },
          });
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return {
    ...mod,
    db: wrapped,
  };
});

const fakeProvider = {
  name: "evolink",
  supportImageToVideo: true,
  createTask: vi.fn(),
  getTaskStatus: vi.fn(),
  parseCallback: vi.fn(),
};

vi.mock("@/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai")>();
  return {
    ...actual,
    getProvider: vi.fn(() => fakeProvider),
  };
});

const downloadAndUpload = vi.fn(async ({ key }: { key: string }) => ({
  url: `http://storage.test/${key}`,
  key,
}));

vi.mock("@/lib/storage", () => ({
  getStorage: vi.fn(() => ({
    downloadAndUpload,
    getSignedUrl: vi.fn((k: string) => `https://signed.test/${k}`),
  })),
  isStorageConfigured: vi.fn(() => true),
  isStorageKey: (v: string) => Boolean(v) && !/^https?:\/\//.test(v),
  signMediaRef: vi.fn((v: string | null | undefined) =>
    v ? `https://signed.test/${v}` : null
  ),
}));

vi.mock("@/lib/video-events", () => ({
  emitVideoEvent: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports under test (after mocks)
// ---------------------------------------------------------------------------

import { db, videos, mediaAssets, creditHolds, CreditTransType } from "@/db";
import {
  RECONCILE_MAX_AGE_MS,
  RECONCILE_NO_TASK_MS,
  RECONCILE_QUIET_MS,
  STALE_UPLOAD_CLAIM_MS,
  videoService,
  type GenerateVideoParams,
} from "@/services/video";
import { creditService } from "@/services/credit";
import { ApiError } from "@/lib/api/error";
import { getModelConfig, calculateModelCredits } from "@/config/credits";
import { transformParamsForProvider, getProviderModelId } from "@/ai/model-mapping";
import { getStorage } from "@/lib/storage";
import {
  countHoldsForUser,
  countTransactions,
  getBalance,
  getHoldRow,
  getVideoRow,
  giveCredits,
  uniqueUserId,
} from "./helpers";

// ---------------------------------------------------------------------------
// Test model selection
// ---------------------------------------------------------------------------

function pickTextToVideoModel(): string {
  const candidates = [
    "wan2.6",
    "veo-3.1",
  ];
  for (const id of candidates) {
    const cfg = getModelConfig(id);
    if (cfg && cfg.enabled !== false) {
      return id;
    }
  }
  throw new Error("No enabled text-to-video model found in config");
}

const MODEL = pickTextToVideoModel();
const DURATION = getModelConfig(MODEL)?.durations[0] ?? 5;
const EXPECTED_COST = calculateModelCredits(MODEL, { duration: DURATION });

function baseParams(userId: string): GenerateVideoParams {
  return {
    userId,
    prompt: "a cat riding a skateboard",
    model: MODEL,
    duration: DURATION,
    aspectRatio: "16:9",
  };
}

function getErrorCode(err: unknown): string | undefined {
  if (err instanceof ApiError) {
    const details = err.details as { code?: string } | undefined;
    return details?.code;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("videoService.generate / creditService integration", () => {
  beforeEach(() => {
    Reflect.deleteProperty(process.env, "DEFAULT_AI_PROVIDER");
    failState.failExternalTaskIdWrite = false;
    fakeProvider.createTask.mockReset();
    fakeProvider.getTaskStatus.mockReset();
    fakeProvider.parseCallback.mockReset();
    downloadAndUpload.mockClear();
  });

  afterEach(() => {
    failState.failExternalTaskIdWrite = false;
    vi.restoreAllMocks();
  });

  it("dispatches owned Wan video references in order, with the existing quote and a stable replay", async () => {
    process.env.DEFAULT_AI_PROVIDER = "kie";
    const userId = uniqueUserId();
    const keys = ["b.mov", "a.mp4"].map((name) => `uploads/${userId}/${name}`);
    await giveCredits(userId, 1000);
    await db.insert(mediaAssets).values(keys.map((key) => ({
      id: key, userId, key, name: key, mimeType: key.endsWith(".mov") ? "video/quicktime" : "video/mp4", size: 2048,
    })));
    fakeProvider.createTask.mockResolvedValue({ taskId: "wan-test", provider: "kie", status: "pending" });
    const request = { ...baseParams(userId), model: "wan2.6", duration: 5, quality: "720p", mode: "reference-to-video", videoKeys: keys, idempotencyKey: "replay" };
    const first = await videoService.generate(request);
    expect(first.creditsUsed).toBe(calculateModelCredits("wan2.6", { duration: 5, quality: "720p" }));
    const providerInput = fakeProvider.createTask.mock.calls[0][0];
    expect(getProviderModelId("wan2.6", "kie", providerInput)).toBe("wan/2-6-video-to-video");
    expect(transformParamsForProvider("wan2.6", "kie", providerInput).input).toEqual({
      prompt: request.prompt, duration: "5", resolution: "720p", multi_shots: false,
      video_urls: keys.map((key) => `https://signed.test/${key}`),
    });
    expect(await getVideoRow(first.videoUuid)).toMatchObject({ aspectRatio: null, parameters: { videoKeys: keys, generateAudio: true } });
    await db.delete(mediaAssets).where(eq(mediaAssets.userId, userId));
    expect((await videoService.generate(request)).videoUuid).toBe(first.videoUuid);
    expect(fakeProvider.createTask).toHaveBeenCalledTimes(1);
  });

  it("rejects unavailable, oversized, mixed and non-video Wan references before holding credits", async () => {
    process.env.DEFAULT_AI_PROVIDER = "kie";
    const userId = uniqueUserId();
    const key = (name: string) => `uploads/${userId}/${name}`;
    await giveCredits(userId, 1000);
    await db.insert(mediaAssets).values([
      { id: key("large"), userId, key: key("large"), name: "a.mov", mimeType: "video/quicktime", size: 11 * 1024 * 1024 },
      { id: key("image"), userId, key: key("image"), name: "a.png", mimeType: "image/png", size: 80 },
    ]);
    const base = { ...baseParams(userId), model: "wan2.6", mode: "reference-to-video" };
    for (const invalid of [
      { videoKeys: [key("large")] }, { videoKeys: [key("image")] }, { videoKeys: [key("missing")] },
      { videoKeys: ["uploads/someone-else/a.mp4"] }, { videoKeys: ["https://remote.test/a.mp4"] },
      { videoKeys: [key("a.mp4")], imageUrl: key("image") }, { model: "veo-3.1", videoKeys: [key("a.mp4")] },
      { duration: 6, videoKeys: [key("a.mp4")] }, { outputNumber: 2, videoKeys: [key("a.mp4")] },
    ]) {
      await expect(videoService.generate({ ...base, ...invalid })).rejects.toMatchObject({ status: 400 });
    }
    expect(fakeProvider.createTask).not.toHaveBeenCalled();
    expect((await getBalance(userId)).availableCredits).toBe(1000);
  });

  it("case 1: provider accepted but response timed out", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    const before = await getBalance(userId);

    const timeoutError = Object.assign(
      new Error("The operation was aborted due to timeout"),
      { name: "TimeoutError" }
    );
    fakeProvider.createTask.mockRejectedValueOnce(timeoutError);

    let caught: unknown;
    try {
      await videoService.generate(baseParams(userId));
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    expect(getErrorCode(caught)).toBe("SUBMIT_RESULT_UNKNOWN");

    expect(fakeProvider.createTask).toHaveBeenCalledTimes(1);

    // Find the video row for this user
    const rows = await db
      .select()
      .from(videos)
      .where(eq(videos.userId, userId));
    expect(rows.length).toBe(1);
    const video = rows[0];
    expect(video.status).not.toBe("FAILED");

    const hold = await getHoldRow(video.uuid);
    expect(hold).not.toBeNull();
    expect(hold?.status).toBe("HOLDING");

    const after = await getBalance(userId);
    expect(after.availableCredits).toBe(before.availableCredits - EXPECTED_COST);

    const refunds = await countTransactions(video.uuid, CreditTransType.REFUND);
    expect(refunds).toBe(0);
  });

  it("case 2: provider returned taskId but local save failed", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    const before = await getBalance(userId);

    fakeProvider.createTask.mockResolvedValueOnce({
      taskId: "ext_task_case2",
      provider: "evolink",
      status: "pending",
    });

    failState.failExternalTaskIdWrite = true;

    let result: { videoUuid: string; taskId: string } | undefined;
    let caught: unknown;
    try {
      result = await videoService.generate(baseParams(userId));
    } catch (err) {
      caught = err;
    } finally {
      failState.failExternalTaskIdWrite = false;
    }

    expect(fakeProvider.createTask).toHaveBeenCalledTimes(1);

    const rows = await db
      .select()
      .from(videos)
      .where(eq(videos.userId, userId));
    expect(rows.length).toBe(1);
    const video = rows[0];
    expect(video.status).not.toBe("FAILED");

    const hold = await getHoldRow(video.uuid);
    expect(hold).not.toBeNull();
    expect(hold?.status).toBe("HOLDING");

    const after = await getBalance(userId);
    expect(after.availableCredits).toBe(before.availableCredits - EXPECTED_COST);

    if (result) {
      expect(result.taskId).toBe("ext_task_case2");
    } else {
      expect(getErrorCode(caught)).toBe("SUBMIT_RESULT_UNKNOWN");
      const details = (caught as ApiError).details as { taskId?: string };
      expect(details?.taskId).toBe("ext_task_case2");
    }
  });

  it("definite provider rejection releases credits", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    const before = await getBalance(userId);

    const { ProviderRejectedError } = await import("@/ai/types");
    fakeProvider.createTask.mockRejectedValueOnce(
      new ProviderRejectedError("invalid prompt", 400)
    );

    await expect(videoService.generate(baseParams(userId))).rejects.toThrow();

    const rows = await db
      .select()
      .from(videos)
      .where(eq(videos.userId, userId));
    expect(rows.length).toBe(1);
    const video = rows[0];
    expect(video.status).toBe("FAILED");

    const hold = await getHoldRow(video.uuid);
    expect(hold).not.toBeNull();
    expect(hold?.status).toBe("RELEASED");

    const after = await getBalance(userId);
    expect(after.availableCredits).toBe(before.availableCredits);
  });

  it("idempotent double submit", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    const before = await getBalance(userId);

    fakeProvider.createTask.mockResolvedValue({
      taskId: "ext_idem",
      provider: "evolink",
      status: "pending",
    });

    const params = {
      ...baseParams(userId),
      idempotencyKey: "idem-1",
    } as GenerateVideoParams & { idempotencyKey: string };

    const [r1, r2] = await Promise.all([
      videoService.generate(params),
      videoService.generate(params),
    ]);

    expect(fakeProvider.createTask).toHaveBeenCalledTimes(1);
    expect(r1.videoUuid).toBe(r2.videoUuid);

    const holds = await countHoldsForUser(userId);
    expect(holds).toBe(1);

    const after = await getBalance(userId);
    expect(after.availableCredits).toBe(before.availableCredits - EXPECTED_COST);
  });

  it("duplicate callback settles once", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    const before = await getBalance(userId);

    fakeProvider.createTask.mockResolvedValueOnce({
      taskId: "ext_dup",
      provider: "evolink",
      status: "pending",
    });

    const gen = await videoService.generate(baseParams(userId));
    const videoUuid = gen.videoUuid;

    fakeProvider.parseCallback.mockReturnValue({
      taskId: "ext_dup",
      provider: "evolink",
      status: "completed",
      videoUrl: "http://provider.test/v.mp4",
    });

    await Promise.all([
      videoService.handleCallback("evolink", {}, videoUuid),
      videoService.handleCallback("evolink", {}, videoUuid),
    ]);
    await videoService.handleCallback("evolink", {}, videoUuid);

    const video = await getVideoRow(videoUuid);
    expect(video?.status).toBe("COMPLETED");

    const hold = await getHoldRow(videoUuid);
    expect(hold?.status).toBe("SETTLED");

    const consumes = await countTransactions(
      videoUuid,
      CreditTransType.VIDEO_CONSUME
    );
    expect(consumes).toBe(1);

    expect(downloadAndUpload).toHaveBeenCalledTimes(1);

    const after = await getBalance(userId);
    expect(after.availableCredits).toBe(before.availableCredits - EXPECTED_COST);
  });

  it("a failed video transfer gives back its claim so the next delivery retries it", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);
    const before = await getBalance(userId);

    fakeProvider.createTask.mockResolvedValueOnce({ taskId: "ext_retry", provider: "evolink", status: "pending" });
    const { videoUuid } = await videoService.generate(baseParams(userId));
    fakeProvider.parseCallback.mockReturnValue({
      taskId: "ext_retry", provider: "evolink", status: "completed", videoUrl: "http://provider.test/v.mp4",
    });

    downloadAndUpload.mockRejectedValueOnce(new Error("transfer cut off"));
    await expect(videoService.handleCallback("evolink", {}, videoUuid)).rejects.toThrow("transfer cut off");
    expect((await getVideoRow(videoUuid))?.status).toBe("GENERATING");
    expect((await getHoldRow(videoUuid))?.status).toBe("HOLDING");

    await videoService.handleCallback("evolink", {}, videoUuid);
    expect((await getVideoRow(videoUuid))?.status).toBe("COMPLETED");
    expect((await getHoldRow(videoUuid))?.status).toBe("SETTLED");
    expect(await countTransactions(videoUuid, CreditTransType.VIDEO_CONSUME)).toBe(1);
    expect((await getBalance(userId)).availableCredits).toBe(before.availableCredits - EXPECTED_COST);
  });

  it("a delivery cut off mid-transfer can be taken over once its claim is stale", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    fakeProvider.createTask.mockResolvedValueOnce({ taskId: "ext_stale", provider: "evolink", status: "pending" });
    const { videoUuid } = await videoService.generate(baseParams(userId));
    fakeProvider.parseCallback.mockReturnValue({
      taskId: "ext_stale", provider: "evolink", status: "completed", videoUrl: "http://provider.test/v.mp4",
    });

    // A fresh claim is respected: a second delivery does nothing.
    await db.update(videos).set({ status: "UPLOADING", updatedAt: new Date() }).where(eq(videos.uuid, videoUuid));
    await videoService.handleCallback("evolink", {}, videoUuid);
    expect((await getVideoRow(videoUuid))?.status).toBe("UPLOADING");
    expect(downloadAndUpload).not.toHaveBeenCalled();

    // An abandoned claim is taken over and the video completes.
    await db.update(videos)
      .set({ updatedAt: new Date(Date.now() - STALE_UPLOAD_CLAIM_MS - 1000) })
      .where(eq(videos.uuid, videoUuid));
    await videoService.handleCallback("evolink", {}, videoUuid);
    expect((await getVideoRow(videoUuid))?.status).toBe("COMPLETED");
    expect((await getHoldRow(videoUuid))?.status).toBe("SETTLED");
  });

  describe("reconcileStuckGenerations", () => {
    const ago = (ms: number) => new Date(Date.now() - ms);
    const age = (videoUuid: string, createdMs: number, updatedMs = createdMs) =>
      db.update(videos).set({ createdAt: ago(createdMs), updatedAt: ago(updatedMs) }).where(eq(videos.uuid, videoUuid));
    const actionFor = async (videoUuid: string) =>
      (await videoService.reconcileStuckGenerations({ limit: 500 })).find((row) => row.uuid === videoUuid);

    it("fails and refunds a submission that never recorded a provider task", async () => {
      const userId = uniqueUserId();
      await giveCredits(userId, 1000);
      const before = await getBalance(userId);
      fakeProvider.createTask.mockResolvedValueOnce({ taskId: "ext_lost", provider: "evolink", status: "pending" });
      const { videoUuid } = await videoService.generate(baseParams(userId));
      await db.update(videos).set({ externalTaskId: null }).where(eq(videos.uuid, videoUuid));

      await age(videoUuid, RECONCILE_QUIET_MS + 60_000);
      expect((await actionFor(videoUuid))?.action).toBe("still_running");
      expect((await getVideoRow(videoUuid))?.status).not.toBe("FAILED");

      await age(videoUuid, RECONCILE_NO_TASK_MS + 60_000);
      expect((await actionFor(videoUuid))?.action).toBe("failed_no_task");
      expect((await getVideoRow(videoUuid))?.status).toBe("FAILED");
      expect((await getHoldRow(videoUuid))?.status).toBe("RELEASED");
      expect((await getBalance(userId)).availableCredits).toBe(before.availableCredits);
    });

    it("completes a task whose callback was lost", async () => {
      const userId = uniqueUserId();
      await giveCredits(userId, 1000);
      fakeProvider.createTask.mockResolvedValueOnce({ taskId: "ext_nocb", provider: "evolink", status: "pending" });
      const { videoUuid } = await videoService.generate(baseParams(userId));
      fakeProvider.getTaskStatus.mockResolvedValue({
        taskId: "ext_nocb", provider: "evolink", status: "completed", videoUrl: "http://provider.test/v.mp4",
      });

      await age(videoUuid, RECONCILE_QUIET_MS + 60_000);
      expect((await actionFor(videoUuid))?.action).toBe("synced");
      expect((await getVideoRow(videoUuid))?.status).toBe("COMPLETED");
      expect((await getHoldRow(videoUuid))?.status).toBe("SETTLED");
    });

    it("leaves a running task alone and moves it to the back of the queue", async () => {
      const userId = uniqueUserId();
      await giveCredits(userId, 1000);
      fakeProvider.createTask.mockResolvedValueOnce({ taskId: "ext_slow", provider: "evolink", status: "pending" });
      const { videoUuid } = await videoService.generate(baseParams(userId));
      fakeProvider.getTaskStatus.mockResolvedValue({ taskId: "ext_slow", provider: "evolink", status: "processing" });

      await age(videoUuid, RECONCILE_QUIET_MS + 60_000);
      expect((await actionFor(videoUuid))?.action).toBe("still_running");
      const row = await getVideoRow(videoUuid);
      expect(row?.status).toBe("GENERATING");
      expect((await getHoldRow(videoUuid))?.status).toBe("HOLDING");
      expect(Date.now() - (row?.updatedAt.getTime() ?? 0)).toBeLessThan(RECONCILE_QUIET_MS);
    });

    it("fails and refunds a generation open for more than a day", async () => {
      const userId = uniqueUserId();
      await giveCredits(userId, 1000);
      const before = await getBalance(userId);
      fakeProvider.createTask.mockResolvedValueOnce({ taskId: "ext_old", provider: "evolink", status: "pending" });
      const { videoUuid } = await videoService.generate(baseParams(userId));

      await age(videoUuid, RECONCILE_MAX_AGE_MS + 60_000, RECONCILE_QUIET_MS + 60_000);
      expect((await actionFor(videoUuid))?.action).toBe("failed_timeout");
      expect((await getVideoRow(videoUuid))?.status).toBe("FAILED");
      expect((await getHoldRow(videoUuid))?.status).toBe("RELEASED");
      expect((await getBalance(userId)).availableCredits).toBe(before.availableCredits);
    });

    it("does not touch a generation that changed recently", async () => {
      const userId = uniqueUserId();
      await giveCredits(userId, 1000);
      fakeProvider.createTask.mockResolvedValueOnce({ taskId: "ext_fresh", provider: "evolink", status: "pending" });
      const { videoUuid } = await videoService.generate(baseParams(userId));
      expect(await actionFor(videoUuid)).toBeUndefined();
      expect(fakeProvider.getTaskStatus).not.toHaveBeenCalled();
    });
  });

  it("user isolation", async () => {
    const userA = uniqueUserId("user_a");
    const userB = uniqueUserId("user_b");
    await giveCredits(userA, 1000);
    await giveCredits(userB, 1000);

    fakeProvider.createTask.mockResolvedValueOnce({
      taskId: "ext_iso",
      provider: "evolink",
      status: "pending",
    });

    const gen = await videoService.generate(baseParams(userA));
    const uuidA = gen.videoUuid;

    const gotB = await videoService.getVideo(uuidA, userB);
    expect(gotB).toBeNull();

    const listB = await videoService.listVideos(userB);
    expect(listB.videos.some((v) => v.uuid === uuidA)).toBe(false);

    await expect(videoService.refreshStatus(uuidA, userB)).rejects.toThrow();

    await videoService.deleteVideo(uuidA, userB);
    const stillThere = await videoService.getVideo(uuidA, userA);
    expect(stillThere).not.toBeNull();
    expect(stillThere?.uuid).toBe(uuidA);

    const undo = (await videoService.deleteVideo(uuidA, userA))!;
    expect(await videoService.deleteVideo(uuidA, userA)).toBe(undo);
    expect(await videoService.restoreVideo(uuidA, userB, undo)).toBe(false);
    expect(await videoService.getVideo(uuidA, userA)).toBeNull();
    expect(await videoService.restoreVideo(uuidA, userA, undo)).toBe(true);
    expect(await videoService.restoreVideo(uuidA, userA, undo)).toBe(true);
    const nextUndo = (await videoService.deleteVideo(uuidA, userA))!;
    expect(nextUndo).not.toBe(undo);
    expect(await videoService.restoreVideo(uuidA, userA, undo)).toBe(false);
    expect(await videoService.getVideo(uuidA, userA)).toBeNull();
    expect(await videoService.restoreVideo(uuidA, userA, nextUndo)).toBe(true);
    expect((await videoService.listVideos(userA)).videos.some((item) => item.uuid === uuidA)).toBe(true);
  });

  it("credit freeze/settle/release consistency", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    const start = await getBalance(userId);

    // freeze then settle
    const videoUuid1 = `vid_settle_${Date.now()}`;
    await creditService.freeze({ userId, credits: 10, videoUuid: videoUuid1 });
    const afterFreeze1 = await getBalance(userId);
    expect(afterFreeze1.availableCredits).toBe(start.availableCredits - 10);
    expect(afterFreeze1.frozenCredits).toBe(10);

    await creditService.settle(videoUuid1);
    const afterSettle = await getBalance(userId);
    expect(afterSettle.availableCredits).toBe(start.availableCredits - 10);
    expect(afterSettle.frozenCredits).toBe(0);

    const consumes = await countTransactions(
      videoUuid1,
      CreditTransType.VIDEO_CONSUME
    );
    expect(consumes).toBe(1);

    // freeze then release
    const videoUuid2 = `vid_release_${Date.now()}`;
    await creditService.freeze({ userId, credits: 10, videoUuid: videoUuid2 });
    const afterFreeze2 = await getBalance(userId);
    expect(afterFreeze2.availableCredits).toBe(start.availableCredits - 20);
    expect(afterFreeze2.frozenCredits).toBe(10);

    await creditService.release(videoUuid2);
    const afterRelease = await getBalance(userId);
    expect(afterRelease.availableCredits).toBe(start.availableCredits - 10);
    expect(afterRelease.frozenCredits).toBe(0);

    // settle after release: throws or no-op without changing balance
    const balanceBeforeSettleAfterRelease = await getBalance(userId);
    let settleAfterReleaseThrew = false;
    try {
      await creditService.settle(videoUuid2);
    } catch {
      settleAfterReleaseThrew = true;
    }
    const balanceAfterSettleAfterRelease = await getBalance(userId);
    expect(balanceAfterSettleAfterRelease.availableCredits).toBe(
      balanceBeforeSettleAfterRelease.availableCredits
    );
    expect(balanceAfterSettleAfterRelease.frozenCredits).toBe(0);
    // Either it threw or it was a no-op; both acceptable
    expect(typeof settleAfterReleaseThrew).toBe("boolean");

    // release twice is a no-op
    const balanceBeforeSecondRelease = await getBalance(userId);
    await creditService.release(videoUuid2);
    const balanceAfterSecondRelease = await getBalance(userId);
    expect(balanceAfterSecondRelease.availableCredits).toBe(
      balanceBeforeSecondRelease.availableCredits
    );
    expect(balanceAfterSecondRelease.frozenCredits).toBe(0);
  });

  it("signs an uploads key before calling the provider", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    // The storage module is mocked for the rest of the suite; pull in the real
    // module so we can exercise actual SigV4 presigning, then point the mocked
    // `getStorage` at it for the duration of this test.
    const realStorage = await vi.importActual<typeof import("@/lib/storage")>(
      "@/lib/storage"
    );
    const mockedGetStorage = vi.mocked(getStorage);
    const originalGetStorage = mockedGetStorage.getMockImplementation();

    const previousEnv = {
      STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
      STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
      STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
      STORAGE_BUCKET: process.env.STORAGE_BUCKET,
    };

    try {
      process.env.STORAGE_ENDPOINT = "https://acc.r2.cloudflarestorage.com";
      process.env.STORAGE_ACCESS_KEY = "AK";
      process.env.STORAGE_SECRET_KEY = "SK";
      process.env.STORAGE_BUCKET = "b";

      realStorage.resetStorageForTests();
      mockedGetStorage.mockImplementation(() => realStorage.getStorage());

      fakeProvider.createTask.mockResolvedValueOnce({
        taskId: "ext_signed_image",
        provider: "evolink",
        status: "pending",
      });

      const rawKey = `uploads/${userId}/input.png`;
      await videoService.generate({ ...baseParams(userId), imageUrl: rawKey });

      expect(fakeProvider.createTask).toHaveBeenCalledTimes(1);

      const sentParams = fakeProvider.createTask.mock.calls[0][0] as {
        imageUrl?: string;
        imageUrls?: string[];
      };
      const signed = sentParams.imageUrl ?? sentParams.imageUrls?.[0];

      expect(typeof signed).toBe("string");
      expect(signed).not.toBe(rawKey);
      expect(
        signed?.startsWith("https://acc.r2.cloudflarestorage.com/b/uploads/")
      ).toBe(true);
      expect(signed?.includes("X-Amz-Signature=")).toBe(true);
      expect(signed?.includes("X-Amz-Expires=")).toBe(true);
    } finally {
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) {
          Reflect.deleteProperty(process.env, key);
        } else {
          process.env[key] = value;
        }
      }

      realStorage.resetStorageForTests();

      if (originalGetStorage) {
        mockedGetStorage.mockImplementation(originalGetStorage);
      }
    }
  });

  it("rejects another user's uploads key without calling the provider", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    const otherUserId = uniqueUserId("other");

    let caught: unknown;
    try {
      await videoService.generate({
        ...baseParams(userId),
        imageUrl: `uploads/${otherUserId}/input.png`,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    expect(getErrorCode(caught)).toBe("INVALID_IMAGE_REF");
    expect(fakeProvider.createTask).not.toHaveBeenCalled();
  });
});
