import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Mocks (declared before the modules under test are imported)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  createImageTask: vi.fn(),
  createMusicTask: vi.fn(),
  getTaskStatus: vi.fn(),
}));

vi.mock("@/ai/providers/kie-media", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/ai/providers/kie-media")>();
  // Keep the real parsers; only the network calls are faked.
  const realClient = new actual.KieMediaClient("test-kie-key");
  return {
    ...actual,
    getKieMediaClient: vi.fn(() => ({
      createImageTask: mocks.createImageTask,
      createMusicTask: mocks.createMusicTask,
      getTaskStatus: mocks.getTaskStatus,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parseImageCallback: (payload: any) =>
        realClient.parseImageCallback(payload),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parseMusicCallback: (payload: any) =>
        realClient.parseMusicCallback(payload),
    })),
  };
});

const downloadAndUpload = vi.hoisted(() =>
  vi.fn(async ({ key }: { key: string }) => ({ key })),
);

vi.mock("@/lib/storage", () => ({
  getStorage: vi.fn(() => ({
    downloadAndUpload,
    getSignedUrl: vi.fn((k: string) => `https://signed.test/${k}`),
  })),
  isStorageConfigured: vi.fn(() => true),
  isStorageKey: (v: string) => Boolean(v) && !/^https?:\/\//.test(v),
  signMediaRef: vi.fn((v: string | null | undefined) =>
    v ? `https://signed.test/${v}` : null,
  ),
}));

// ---------------------------------------------------------------------------
// Imports under test (after mocks)
// ---------------------------------------------------------------------------

import { db, videos } from "@/db";
import { mediaGenerationService } from "@/services/media-generation";
import { videoService } from "@/services/video";
import { ApiError } from "@/lib/api/error";
import { ProviderRejectedError } from "@/ai/types";
import {
  countHoldsForUser,
  getBalance,
  getHoldRow,
  getVideoRow,
  giveCredits,
  uniqueUserId,
} from "./helpers";

async function rowsForUser(userId: string) {
  return db.select().from(videos).where(eq(videos.userId, userId));
}

function errorCode(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    const details = error.details as { code?: string } | undefined;
    return details?.code;
  }
  return undefined;
}

describe("mediaGenerationService", () => {
  beforeEach(() => {
    process.env.AI_CALLBACK_URL = "https://example.test/api/v1/video/callback";
    process.env.CALLBACK_HMAC_SECRET = "test-hmac-not-real";
    mocks.createImageTask.mockReset();
    mocks.createMusicTask.mockReset();
    mocks.getTaskStatus.mockReset();
    downloadAndUpload.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates an image, freezes credits and signs the callback url", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 100);
    const before = await getBalance(userId);

    mocks.createImageTask.mockResolvedValueOnce({ taskId: "img_task_1" });

    const result = await mediaGenerationService.generate({
      userId,
      mediaType: "image",
      prompt: "a red fox in the snow",
      aspectRatio: "1:1",
    });

    expect(result.uuid.startsWith("img_")).toBe(true);
    expect(result.mediaType).toBe("image");
    expect(result.taskId).toBe("img_task_1");
    expect(result.status).toBe("GENERATING");
    expect(result.creditsUsed).toBe(3);

    const row = await getVideoRow(result.uuid);
    expect(row?.mediaType).toBe("image");
    expect(row?.status).toBe("GENERATING");
    expect(row?.creditsUsed).toBe(3);
    expect(row?.externalTaskId).toBe("img_task_1");

    const hold = await getHoldRow(result.uuid);
    expect(hold?.status).toBe("HOLDING");
    expect(hold?.credits).toBe(3);

    const after = await getBalance(userId);
    expect(after.availableCredits).toBe(before.availableCredits - 3);

    expect(mocks.createImageTask).toHaveBeenCalledTimes(1);
    const call = mocks.createImageTask.mock.calls[0][0] as {
      kieModel: string;
      callbackUrl?: string;
      prompt: string;
    };
    expect(call.kieModel).toBe("google/nano-banana");
    expect(call.prompt).toBe("a red fox in the snow");
    expect(call.callbackUrl).toContain("/kie?videoUuid=");
    expect(call.callbackUrl?.startsWith(
      "https://example.test/api/v1/video/callback/kie",
    )).toBe(true);
  });

  it("marks FAILED and releases credits on a definite provider rejection", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 100);
    const before = await getBalance(userId);

    mocks.createImageTask.mockRejectedValueOnce(
      new ProviderRejectedError("blocked prompt", 400),
    );

    let caught: unknown;
    try {
      await mediaGenerationService.generate({
        userId,
        mediaType: "image",
        prompt: "blocked prompt",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ProviderRejectedError);

    const rows = await rowsForUser(userId);
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.status).toBe("FAILED");
    expect(row.mediaType).toBe("image");

    const hold = await getHoldRow(row.uuid);
    expect(hold?.status).toBe("RELEASED");

    const after = await getBalance(userId);
    expect(after.availableCredits).toBe(before.availableCredits);
  });

  it("keeps the hold when the submission outcome is unknown", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 100);

    mocks.createImageTask.mockRejectedValueOnce(new Error("socket hang up"));

    let caught: unknown;
    try {
      await mediaGenerationService.generate({
        userId,
        mediaType: "image",
        prompt: "an unknown outcome",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(202);
    expect(errorCode(caught)).toBe("SUBMIT_RESULT_UNKNOWN");

    const rows = await rowsForUser(userId);
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.status).not.toBe("FAILED");
    expect(row.errorMessage).toContain("SUBMIT_UNKNOWN");

    const hold = await getHoldRow(row.uuid);
    expect(hold?.status).toBe("HOLDING");
  });

  it("collapses duplicate requests inside the dedupe window", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 100);

    mocks.createImageTask.mockResolvedValue({ taskId: "img_dup_1" });

    const params = {
      userId,
      mediaType: "image" as const,
      prompt: "a mountain lake at sunrise",
      aspectRatio: "1:1",
    };

    const first = await mediaGenerationService.generate(params);
    const second = await mediaGenerationService.generate(params);

    expect(second.uuid).toBe(first.uuid);
    expect(mocks.createImageTask).toHaveBeenCalledTimes(1);
    expect(await countHoldsForUser(userId)).toBe(1);

    const rows = await rowsForUser(userId);
    expect(rows.length).toBe(1);
  });

  it("rejects with 402 when the user has no credits", async () => {
    const userId = uniqueUserId();
    mocks.createImageTask.mockResolvedValue({ taskId: "img_no_credits" });

    let caught: unknown;
    try {
      await mediaGenerationService.generate({
        userId,
        mediaType: "image",
        prompt: "no credits for this",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(402);
    expect(errorCode(caught)).toBe("INSUFFICIENT_CREDITS");
    expect(mocks.createImageTask).not.toHaveBeenCalled();
  });

  it("generates music and settles credits only on the complete callback", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 100);
    const before = await getBalance(userId);

    mocks.createMusicTask.mockResolvedValueOnce({ taskId: "music_task_1" });

    const gen = await mediaGenerationService.generate({
      userId,
      mediaType: "audio",
      prompt: "walking through the city at dusk",
      style: "synthwave",
      title: "Neon Streets",
    });

    expect(gen.uuid.startsWith("aud_")).toBe(true);
    expect(gen.creditsUsed).toBe(9);
    expect(gen.taskId).toBe("music_task_1");

    let row = await getVideoRow(gen.uuid);
    expect(row?.mediaType).toBe("audio");
    expect(row?.status).toBe("GENERATING");
    expect(row?.creditsUsed).toBe(9);

    let hold = await getHoldRow(gen.uuid);
    expect(hold?.status).toBe("HOLDING");

    const afterGenerate = await getBalance(userId);
    expect(afterGenerate.availableCredits).toBe(before.availableCredits - 9);

    // Progress notifications never settle.
    await mediaGenerationService.handleCallback(
      {
        code: 200,
        msg: "ok",
        data: { callbackType: "text", task_id: "music_task_1", data: [] },
      },
      gen.uuid,
    );
    await mediaGenerationService.handleCallback(
      {
        code: 200,
        msg: "ok",
        data: { callbackType: "first", task_id: "music_task_1", data: [] },
      },
      gen.uuid,
    );

    row = await getVideoRow(gen.uuid);
    expect(row?.status).toBe("GENERATING");
    hold = await getHoldRow(gen.uuid);
    expect(hold?.status).toBe("HOLDING");
    expect(downloadAndUpload).not.toHaveBeenCalled();

    const completePayload = {
      code: 200,
      msg: "ok",
      data: {
        callbackType: "complete",
        task_id: "music_task_1",
        data: [
          {
            id: "t1",
            audio_url: "https://cdn.kie.test/1.mp3",
            stream_audio_url: "https://cdn.kie.test/1.stream.mp3",
            image_url: "https://cdn.kie.test/1.png",
            duration: 30,
          },
          {
            id: "t2",
            audio_url: "https://cdn.kie.test/2.mp3",
            stream_audio_url: "https://cdn.kie.test/2.stream.mp3",
            image_url: "https://cdn.kie.test/2.png",
            duration: 31,
          },
        ],
      },
    };

    await mediaGenerationService.handleCallback(completePayload, gen.uuid);

    row = await getVideoRow(gen.uuid);
    expect(row?.status).toBe("COMPLETED");
    expect(row?.thumbnailUrl).toBe("https://cdn.kie.test/1.png");

    hold = await getHoldRow(gen.uuid);
    expect(hold?.status).toBe("SETTLED");

    expect(downloadAndUpload).toHaveBeenCalledTimes(2);
    const keys = downloadAndUpload.mock.calls.map(
      (call) => (call[0] as { key: string }).key,
    );
    expect(keys).toEqual([
      `audio/${gen.uuid}/0.mp3`,
      `audio/${gen.uuid}/1.mp3`,
    ]);

    const parameters = row?.parameters as { resultKeys?: string[] } | null;
    expect(parameters?.resultKeys?.length).toBe(2);

    const afterSettle = await getBalance(userId);
    expect(afterSettle.availableCredits).toBe(before.availableCredits - 9);

    // A second complete callback is a no-op.
    await mediaGenerationService.handleCallback(completePayload, gen.uuid);
    expect(downloadAndUpload).toHaveBeenCalledTimes(2);

    const stillCompleted = await getVideoRow(gen.uuid);
    expect(stillCompleted?.status).toBe("COMPLETED");
  });

  it("marks FAILED and releases credits on an image failure callback", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 100);
    const before = await getBalance(userId);

    mocks.createImageTask.mockResolvedValueOnce({ taskId: "img_fail_1" });

    const gen = await mediaGenerationService.generate({
      userId,
      mediaType: "image",
      prompt: "a lighthouse at night",
    });

    await mediaGenerationService.handleCallback(
      {
        code: 200,
        msg: "ok",
        data: {
          taskId: "img_fail_1",
          state: "fail",
          failCode: "CONTENT_POLICY",
          failMsg: "blocked prompt",
        },
      },
      gen.uuid,
    );

    const row = await getVideoRow(gen.uuid);
    expect(row?.status).toBe("FAILED");
    expect(row?.errorMessage).toBe("blocked prompt");

    const hold = await getHoldRow(gen.uuid);
    expect(hold?.status).toBe("RELEASED");

    const after = await getBalance(userId);
    expect(after.availableCredits).toBe(before.availableCredits);
    expect(downloadAndUpload).not.toHaveBeenCalled();
  });

  it("keeps image rows out of the video list", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 100);

    mocks.createImageTask.mockResolvedValueOnce({ taskId: "img_list_1" });

    const gen = await mediaGenerationService.generate({
      userId,
      mediaType: "image",
      prompt: "a glass tower",
    });

    const list = await videoService.listVideos(userId);
    expect(list.videos.some((video) => video.uuid === gen.uuid)).toBe(false);
    expect(list.videos.length).toBe(0);
  });

  it("rejects another user's uploads key for image input", async () => {
    const userId = uniqueUserId();
    const otherUserId = uniqueUserId("other");
    await giveCredits(userId, 100);

    let caught: unknown;
    try {
      await mediaGenerationService.generate({
        userId,
        mediaType: "image",
        prompt: "edit this",
        model: "nano-banana-edit",
        imageUrls: [`uploads/${otherUserId}/input.png`],
      });
    } catch (error) {
      caught = error;
    }

    expect(errorCode(caught)).toBe("INVALID_IMAGE_REF");
    expect(mocks.createImageTask).not.toHaveBeenCalled();
  });

  it("rejects image input on text-to-image models", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 100);

    let caught: unknown;
    try {
      await mediaGenerationService.generate({
        userId,
        mediaType: "image",
        prompt: "edit this",
        model: "nano-banana",
        imageUrls: [`uploads/${userId}/input.png`],
      });
    } catch (error) {
      caught = error;
    }

    expect(errorCode(caught)).toBe("IMAGE_INPUT_NOT_SUPPORTED");
    expect(mocks.createImageTask).not.toHaveBeenCalled();
  });

  it("refreshes status for the owning user only", async () => {
    const userId = uniqueUserId();
    const otherUserId = uniqueUserId("other");
    await giveCredits(userId, 100);

    mocks.createImageTask.mockResolvedValueOnce({ taskId: "img_status_1" });

    const gen = await mediaGenerationService.generate({
      userId,
      mediaType: "image",
      prompt: "a quiet street",
    });

    const status = await mediaGenerationService.refreshStatus(
      gen.uuid,
      userId,
    );
    expect(status.status).toBe("GENERATING");
    expect(status.mediaType).toBe("image");
    expect(status.urls).toEqual([]);

    await expect(
      mediaGenerationService.refreshStatus(gen.uuid, otherUserId),
    ).rejects.toThrow();
  });
});
