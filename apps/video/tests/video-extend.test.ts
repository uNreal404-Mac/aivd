import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextRequest } from "next/server";

// Real local D1 and credit ledger, fake KIE call and storage (as in
// plan-limits.test.ts and video-generate.test.ts).
const createMarketTask = vi.hoisted(() => vi.fn());
vi.mock("@/ai/kie-market", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai/kie-market")>();
  return { ...actual, createMarketTask };
});
const getObjectSize = vi.hoisted(() => vi.fn());
const downloadAndUpload = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/client", () => ({ getSession }));
const requireAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/auth", () => ({ requireAuth }));
vi.mock("@/lib/content-safety", () => ({
  moderateContent: vi.fn(), isSafetyApproved: () => true, safetyMessage: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({
  getStorage: vi.fn(() => ({ getObjectSize, downloadAndUpload, getSignedUrl: vi.fn((key: string) => `https://signed.test/${key}`) })),
  isStorageConfigured: vi.fn(() => true),
  isStorageKey: (value: string) => Boolean(value) && !/^https?:\/\//.test(value),
  signMediaRef: vi.fn((value: string | null | undefined) => (value ? `https://signed.test/${value}` : null)),
}));
vi.mock("@/lib/video-events", () => ({ emitVideoEvent: vi.fn() }));

import { EXTEND_MODEL_ID, extendCredits, getMarketModel, marketModelsOf } from "@/ai/kie-market";
import { VideoStatus, db, videos } from "@/db";
import { ApiError } from "@/lib/api/error";
import { canSubmitExtend, defaultExtendResolution, submitExtend } from "@/lib/video-extend";
import { MAX_SOURCE_VIDEO_BYTES, videoService } from "@/services/video";
import { countHoldsForUser, getBalance, getVideoRow, giveCredits, uniqueUserId } from "./helpers";

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
    getObjectSize.mockReset().mockResolvedValue(MAX_SOURCE_VIDEO_BYTES);
    createMarketTask.mockReset();
    createMarketTask.mockResolvedValue("task_extend_1");
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

    expect(getObjectSize).toHaveBeenCalledWith(`videos/${source}/clip.mp4`);
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

  it("stores the uploaded byte count on completion and rejects a newly completed oversized source", async () => {
    const userId = uniqueUserId();
    const sourceVideoUuid = await insertSource(userId, { status: VideoStatus.GENERATING, videoUrl: null, creditsUsed: 0 });
    downloadAndUpload.mockImplementationOnce(async ({ key }) => ({ key, fileSize: MAX_SOURCE_VIDEO_BYTES + 1 }));
    await videoService.tryCompleteGeneration(sourceVideoUuid, {
      status: "completed", provider: "kie", taskId: "done", videoUrl: "https://provider.test/clip.mp4",
    });
    expect((await getVideoRow(sourceVideoUuid))?.fileSize).toBe(MAX_SOURCE_VIDEO_BYTES + 1);
    const error = await rejection(videoService.generate({ model: EXTEND_MODEL_ID, prompt: "continue", userId, sourceVideoUuid }));
    expect(error.details).toMatchObject({ code: "SOURCE_VIDEO_TOO_LARGE" });
    expect(getObjectSize).not.toHaveBeenCalled();
    expect(await countHoldsForUser(userId)).toBe(0);
    expect(createMarketTask).not.toHaveBeenCalled();
  });

  it("refuses unknown or oversized historical objects before freezing credits", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);
    const sourceVideoUuid = await insertSource(userId);
    const params = { model: EXTEND_MODEL_ID, userId, sourceVideoUuid, prompt: "keep going" };
    getObjectSize.mockRejectedValueOnce(new Error("HEAD failed"))
      .mockResolvedValueOnce(0).mockResolvedValueOnce(MAX_SOURCE_VIDEO_BYTES + 1);
    for (const code of ["SOURCE_VIDEO_UNVERIFIED", "SOURCE_VIDEO_UNVERIFIED", "SOURCE_VIDEO_TOO_LARGE"]) {
      expect((await rejection(videoService.generate(params))).details).toMatchObject({ code });
    }
    expect(await countHoldsForUser(userId)).toBe(0);
    expect(createMarketTask).not.toHaveBeenCalled();
  });

  it("never inspects or signs external URLs, traversal paths or another creation's object", async () => {
    const userId = uniqueUserId();
    for (const key of ["https://external.test/file.mp4", "videos/vid_other/file.mp4", "videos/vid_test/../file.mp4"]) {
      const sourceVideoUuid = await insertSource(userId, { videoUrl: key });
      const error = await rejection(videoService.generate({ model: EXTEND_MODEL_ID, userId, sourceVideoUuid, prompt: "keep going" }));
      expect(error.details).toMatchObject({ code: "SOURCE_VIDEO_UNAVAILABLE" });
    }
    expect(getObjectSize).not.toHaveBeenCalled();
    expect(await countHoldsForUser(userId)).toBe(0);
    expect(createMarketTask).not.toHaveBeenCalled();
  });

  it("deduplicates simultaneous requests and replays after the source disappears", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);
    const sourceVideoUuid = await insertSource(userId);
    const params = { model: EXTEND_MODEL_ID, userId, sourceVideoUuid, prompt: "keep going", idempotencyKey: nanoid() };
    const [first, second] = await Promise.all([videoService.generate(params), videoService.generate(params)]);
    expect(second.videoUuid).toBe(first.videoUuid);
    await db.update(videos).set({ isDeleted: true }).where(eq(videos.uuid, sourceVideoUuid));
    getObjectSize.mockClear();
    expect((await videoService.generate(params)).videoUuid).toBe(first.videoUuid);
    expect(getObjectSize).not.toHaveBeenCalled();
    expect(await countHoldsForUser(userId)).toBe(1);
    expect(createMarketTask).toHaveBeenCalledTimes(1);
  });

  it("keeps the hold and returns the job id on an ambiguous KIE 5xx", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);
    const sourceVideoUuid = await insertSource(userId);
    const params = { userId, sourceVideoUuid, model: EXTEND_MODEL_ID, prompt: "keep going", idempotencyKey: nanoid() };
    // A 5xx can be emitted by a gateway even with a structured 4xx body.
    const actual = await vi.importActual<typeof import("@/ai/kie-market")>("@/ai/kie-market");
    createMarketTask.mockImplementationOnce(actual.createMarketTask);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: 422 }, { status: 502 })));
    try {
      const error = await rejection(videoService.generate(params));
      expect(error.status).toBe(202);
      const retry = await videoService.generate(params);
      expect(error.details).toMatchObject({ videoUuid: retry.videoUuid, code: "SUBMIT_RESULT_UNKNOWN" });
      expect((await getBalance(userId)).availableCredits).toBe(1000 - retry.creditsUsed);
      expect(createMarketTask).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("a definite KIE rejection gives the credits back", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1_000);
    const source = await insertSource(userId);
    const { ProviderRejectedError } = await import("@/ai/types");
    createMarketTask.mockRejectedValueOnce(new ProviderRejectedError("unsupported video", 422));

    const error = await rejection(videoService.generate({ userId, model: EXTEND_MODEL_ID, prompt: "keep going", duration: 5, quality: "720p", sourceVideoUuid: source }));
    expect(error.status).toBe(422);
    expect((await getBalance(userId)).availableCredits).toBe(1_000);
  });
});

it("rejects an extend if the authenticated account changed after reserving the key", async () => {
  vi.stubEnv("VIDEO_GENERATION_ENABLED", "true");
  requireAuth.mockResolvedValueOnce({ id: "user_b" });
  const generate = vi.spyOn(videoService, "generate").mockRejectedValue(new Error("unexpected submit"));
  try {
    const { POST } = await import("@/app/api/v1/video/generate/route");
    const res = await POST(new NextRequest("https://app.test/api/v1/video/generate", {
      method: "POST",
      headers: { "X-Extend-Account": "user_a", "Idempotency-Key": "reserved" },
      body: JSON.stringify({ model: EXTEND_MODEL_ID, prompt: "keep going", sourceVideoUuid: "vid_a" }),
    }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.details.code).toBe("ACCOUNT_CHANGED");
    expect(generate).not.toHaveBeenCalled();
  } finally {
    generate.mockRestore();
    vi.unstubAllEnvs();
  }
});

describe("submitExtend retry reservations", () => {
  const choice = { prompt: "keep going", duration: 5, resolution: "720p", audio: false };
  let tab: Map<string, string>;
  const accepted = () => Response.json({ success: true, data: { videoUuid: "vid_result", creditsUsed: 55 } });
  const submit = () => submitExtend("vid_source", choice, false);

  beforeEach(() => {
    tab = new Map();
    vi.stubGlobal("sessionStorage", {
      getItem: (slot: string) => tab.get(slot) ?? null,
      setItem: (slot: string, key: string) => tab.set(slot, key),
      removeItem: (slot: string) => tab.delete(slot),
    });
    getSession.mockResolvedValue({ data: { user: { id: "user_a" } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("persists before POST, survives reload while in flight, and isolates late responses", async () => {
    let finish!: (response: Response) => void;
    const post = vi.fn((_url: string, init: RequestInit) => {
      expect([...tab.values()]).toContain(new Headers(init.headers).get("Idempotency-Key"));
      return new Promise<Response>((resolve) => { finish = resolve; });
    });
    vi.stubGlobal("fetch", post);
    const first = submit();
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    vi.resetModules();
    const { submitExtend: reloaded } = await import("@/lib/video-extend");
    post.mockResolvedValueOnce(accepted());
    expect(await reloaded("vid_source", choice, false)).toMatchObject({ ok: true, uuid: "vid_result" });
    const key = (i: number) => new Headers(post.mock.calls[i][1].headers).get("Idempotency-Key");
    expect(key(0)).toBe(key(1));
    post.mockRejectedValueOnce(new TypeError("network"));
    await reloaded("vid_source", choice, false);
    expect(key(2)).not.toBe(key(0));
    finish(accepted());
    await first;
    expect([...tab.values()]).toEqual([key(2)]);
  });

  it("isolates accounts and choices, keeps uncertain keys and clears a definite rejection", async () => {
    const recorded: Array<{ key: string | null; account: string | null }> = [];
    let responseStatus = 502;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("/api/v1/video/generate");
      const headers = new Headers(init.headers);
      recorded.push({ key: headers.get("Idempotency-Key"), account: headers.get("X-Extend-Account") });
      return Response.json({ success: false, error: { message: "failed" } }, { status: responseStatus });
    }));
    await submit();
    await submitExtend("vid_source", { ...choice, audio: true }, false);
    getSession.mockResolvedValueOnce({ data: { user: { id: "user_b" } } });
    await submit();
    responseStatus = 422;
    await submit();
    await submit();
    expect(recorded[2].account).toBe("user_b");
    expect(recorded[0].account).toBe("user_a");
    expect(new Set(recorded.slice(0, 3).map((r) => r.key)).size).toBe(3);
    expect(recorded[3].key).toBe(recorded[0].key);
    expect(recorded[4].key).not.toBe(recorded[0].key);
  });

  it("never posts with inaccessible storage or an unconfirmed write", async () => {
    const post = vi.fn();
    vi.stubGlobal("fetch", post);
    for (const storage of [
      { getItem: () => { throw new Error("denied"); } },
      { getItem: () => null, setItem: () => { throw new Error("quota"); } },
      { getItem: () => null, setItem: () => {} },
    ]) {
      vi.stubGlobal("sessionStorage", storage);
      expect(await submit()).toMatchObject({ ok: false, code: "RETRY_KEY_UNAVAILABLE" });
    }
    expect(post).not.toHaveBeenCalled();
  });
});

describe("source object metadata", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("counts uploaded bytes and accepts only full object metadata from the configured bucket", async () => {
    const { Storage } = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
    const storage = new Storage({ endpoint: "https://storage.test", bucket: "own", region: "auto", accessKeyId: "test", secretAccessKey: "test" });
    const key = "videos/vid_example/result.mp4";
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(new Uint8Array(23), { headers: { "content-length": "10" } }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(storage, "uploadFile").mockResolvedValue({ key });
    expect(await storage.downloadAndUpload({ key, sourceUrl: "https://provider.test/video" })).toEqual({ key, fileSize: 23 });

    fetchMock.mockResolvedValueOnce(new Response(null, { headers: { "content-length": String(MAX_SOURCE_VIDEO_BYTES) } }));
    expect(await storage.getObjectSize(key)).toBe(MAX_SOURCE_VIDEO_BYTES);
    const [url, init] = fetchMock.mock.calls[1];
    expect(new URL(url).origin).toBe("https://storage.test");
    expect(new URL(url).pathname).toBe("/own/" + key);
    expect(init).toMatchObject({ method: "HEAD", redirect: "error" });
    for (const response of [
      new Response(null),
      new Response(null, { headers: { "content-length": "5e3" } }),
      new Response(null, { status: 206, headers: { "content-length": "10" } }),
      new Response(null, { status: 404, headers: { "content-length": "10" } }),
    ]) {
      fetchMock.mockResolvedValueOnce(response);
      await expect(storage.getObjectSize(key)).rejects.toThrow();
    }
  });
});
