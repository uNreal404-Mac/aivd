import { nanoid } from "nanoid";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMarketModel, marketCredits } from "@/ai/kie-market";
import { db, mediaAssets, videos, VideoStatus } from "@/db";
import { videoService } from "@/services/video";
import { countHoldsForUser, getBalance, getVideoRow, giveCredits, uniqueUserId } from "./helpers";

// Exercise the real provider task builder and credit ledger. Only HTTP and
// object storage are replaced, so credentials and billable calls never leave this test.
const signKey = vi.hoisted(() => vi.fn((key: string) => `https://signed.test/${key}?signature=local-test`));
vi.mock("@/lib/storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...real,
    getStorage: () => ({ getSignedUrl: signKey }),
    isStorageConfigured: () => true,
    signMediaRef: (key: string | null | undefined) => key ? signKey(key) : null,
  };
});
vi.mock("@/lib/video-events", () => ({ emitVideoEvent: vi.fn() }));
const moderate = vi.hoisted(() => vi.fn());
const requireAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/auth", () => ({ requireAuth }));
vi.mock("@/lib/content-safety", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content-safety")>()),
  moderateContent: moderate,
}));

const kling = "kling/v4-reference-to-video";
const prompt = "The camera follows a travelling cyclist from sunrise through the evening.";
const startingCredits = 10_000;
const quote = (duration: number) => marketCredits(getMarketModel(kling)!, { prompt, duration, resolution: "1080p" });
const signed = (key: string) => `https://signed.test/${key}?signature=local-test`;
const http = vi.fn<typeof fetch>();
type Keyframes = { first?: string; middle?: string[]; last?: string };

async function owner() {
  const userId = uniqueUserId();
  await giveCredits(userId, startingCredits);
  return userId;
}

async function upload(userId: string, name: string, mimeType = "image/png", keyOwner = userId) {
  const id = nanoid();
  const key = `uploads/${keyOwner}/${id}-${name}`;
  await db.insert(mediaAssets).values({ id, userId, name, mimeType, key, size: 1024 });
  return key;
}

async function gallery(userId: string, overrides: Partial<typeof videos.$inferInsert> = {}) {
  const uuid = `vid_${nanoid(21)}`;
  const first = `videos/${uuid}/result.png`;
  const second = `videos/${uuid}/result-2.png`;
  await db.insert(videos).values({
    uuid, userId, model: "seedream-5-5", prompt, mediaType: "image", status: VideoStatus.COMPLETED,
    videoUrl: first, parameters: { extraKeys: [second] }, ...overrides,
  });
  return { uuid, first, second };
}

function submit(userId: string, keyframes: Keyframes, overrides: Partial<Parameters<typeof videoService.generate>[0]> = {}) {
  const request = { userId, model: kling, prompt, duration: 10, quality: "1080p", keyframes, ...overrides };
  return videoService.generate(request);
}

async function expectInvalid(request: Promise<unknown>) {
  await expect(request).rejects.toMatchObject({ status: 400, details: { code: "INVALID_KEYFRAMES" } });
}

function sentTask(i: number) {
  const [url, init] = http.mock.calls[i];
  expect(url).toBe("https://api.kie.ai/api/v1/jobs/createTask");
  expect(init?.method).toBe("POST");
  expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer local-keyframe-test");
  return JSON.parse(String(init?.body)) as { model: string; input: Record<string, unknown> };
}

describe("Kling 4 keyframes through the generation service", () => {
  beforeEach(() => {
    vi.stubEnv("KIE_API_KEY", "local-keyframe-test");
    signKey.mockClear();
    moderate.mockReset().mockResolvedValue({ decision: "allow", reason: "fixture", categories: [], source: "rules" });
    http.mockReset();
    http.mockImplementation(async () => Response.json({ code: 200, data: { taskId: `task_${nanoid()}` } }));
    vi.stubGlobal("fetch", http);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("signs the distinct frame slots in caller order, saves stable references, and bills one idempotent request", async () => {
    const userId = await owner();
    const first = await upload(userId, "opening.png");
    const one = await gallery(userId);
    const two = await upload(userId, "second-middle.png");
    const last = await upload(userId, "ending.png");
    const work = `work:${one.uuid}:1`;
    const frames = { first, middle: [work, two], last };
    const idempotencyKey = `keyframes-${nanoid()}`;
    const result = await submit(userId, frames, { idempotencyKey });
    const replay = await submit(userId, frames, { idempotencyKey });

    expect(replay.videoUuid).toBe(result.videoUuid);
    expect(http).toHaveBeenCalledTimes(1);
    const task = sentTask(0);
    expect(task.model).toBe("kling-4.0/keyframe-to-video");
    expect(task.input).toMatchObject({
      prompt, resolution: "1080p", duration: 10, first_frame_url: signed(first),
      keyframe_urls: [signed(one.second), signed(two)], last_frame_url: signed(last),
    });
    expect(task.input).not.toHaveProperty("image_urls");
    expect(task.input).not.toHaveProperty("aspect_ratio");
    expect(moderate).toHaveBeenCalledTimes(1);
    expect(moderate.mock.calls[0][0].images.map((image: { url: string }) => image.url)).toEqual([first, one.second, two, last].map(signed));

    const saved = (await getVideoRow(result.videoUuid))?.parameters;
    const stored = saved?.keyframes as Keyframes;
    expect(stored.first).toBe(first);
    expect(stored.last).toBe(last);
    expect(stored.middle).toHaveLength(2);
    expect(stored.middle?.[0]).toBe(work);
    expect(stored.middle?.[1]).toBe(two);
    expect(JSON.stringify(saved)).not.toContain("signed.test");
    expect(result.creditsUsed).toBe(quote(10));
    expect(await countHoldsForUser(userId)).toBe(1);
    expect((await getBalance(userId)).availableCredits).toBe(startingCredits - quote(10));
  });

  it("keeps regular Kling references and pricing intact at the same settings", async () => {
    const userId = await owner();
    const img = await upload(userId, "regular.png");
    const ordinary = await videoService.generate({ userId, model: kling, prompt, duration: 10, quality: "1080p", imageUrls: [img] });
    expect(sentTask(0)).toMatchObject({ model: "kling-4.0/reference-to-video", input: { image_urls: [signed(img)], aspect_ratio: "auto" } });
    expect(sentTask(0).input).not.toHaveProperty("first_frame_url");
    const frameOwner = await owner();
    const first = await upload(frameOwner, "regular.png");
    const withFrame = await submit(frameOwner, { first });
    expect(sentTask(1)).toMatchObject({ model: "kling-4.0/keyframe-to-video", input: { first_frame_url: signed(first) } });
    expect(sentTask(1).input).not.toHaveProperty("last_frame_url");
    expect(withFrame.creditsUsed).toBe(ordinary.creditsUsed);
    expect(getMarketModel(kling)!.costUsd({ prompt, duration: 10, resolution: "1080p" })).toBeCloseTo(2.125);
  });

  it("does not send the provider request or reserve credits when keyframe moderation refuses a frame", async () => {
    const userId = await owner();
    const last = await upload(userId, "ending.png");
    moderate.mockResolvedValueOnce({ decision: "block", reason: "fixture", categories: ["fixture"], source: "rules" });
    await expect(submit(userId, { last })).rejects.toMatchObject({ status: 422, details: { code: "CONTENT_BLOCKED" } });
    expect(http).not.toHaveBeenCalled();
    expect(await countHoldsForUser(userId)).toBe(0);
  });

  it("preserves the browser's last-frame-only request through the public video route and rejects malformed role lists", async () => {
    vi.stubEnv("VIDEO_GENERATION_ENABLED", "true");
    const userId = await owner();
    requireAuth.mockResolvedValue({ id: userId });
    const last = await upload(userId, "last.png");
    const { POST } = await import("@/app/api/v1/video/generate/route");
    const send = (keyframes: Keyframes) => POST(new NextRequest("https://app.test/api/v1/video/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": nanoid(), "X-Media-Account": userId },
      body: JSON.stringify({ model: kling, prompt, quality: "1080p", duration: 10, keyframes }),
    }));
    const invalid = await send({ middle: Array(9).fill(last) });
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.details.code).toBe("INVALID_KEYFRAMES");
    expect(http).not.toHaveBeenCalled();
    const accepted = await send({ last });
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).data.videoUuid).toBeTruthy();
    const task = sentTask(0);
    expect(task).toMatchObject({ model: "kling-4.0/keyframe-to-video", input: { last_frame_url: signed(last) } });
    expect(task.input).not.toHaveProperty("first_frame_url");
    expect(task.input).not.toHaveProperty("keyframe_urls");
  });

  it("rejects foreign, missing or non-image uploads and unusable gallery outputs before any provider call or hold", async () => {
    const userId = await owner();
    const other = uniqueUserId();
    const wrongOwner = await upload(other, "foreign.png");
    const wrongDatabaseOwner = await upload(other, "misbound.png", "image/png", userId);
    const wrongType = await upload(userId, "looks-like-an-image.png", "video/mp4");
    const mine = await gallery(userId);
    const foreign = await gallery(other);
    const unfinished = await gallery(userId, { status: VideoStatus.GENERATING });
    const deleted = await gallery(userId, { isDeleted: true });
    const video = await gallery(userId, { mediaType: "video" });
    for (const frame of [
      wrongOwner, wrongDatabaseOwner, wrongType, `uploads/${userId}/missing.png`,
      "https://untrusted.test/a.png", `work:${foreign.uuid}:0`, `work:${unfinished.uuid}:0`,
      `work:${deleted.uuid}:0`, `work:${video.uuid}:0`, `work:${mine.uuid}:2`, `work:${mine.uuid}:-1`,
    ]) await expectInvalid(submit(userId, { first: frame }));
    expect(http).not.toHaveBeenCalled();
    expect(await countHoldsForUser(userId)).toBe(0);
    expect((await getBalance(userId)).availableCredits).toBe(startingCredits);
  });

  it("rejects mixed reference modes, other models and both independent frame-count limits", async () => {
    const userId = await owner();
    const ids = await Promise.all(Array.from({ length: 11 }, (_, n) => upload(userId, `frame-${n}.png`)));
    await expectInvalid(submit(userId, { first: ids[0] }, { imageUrl: ids[1] }));
    await expectInvalid(submit(userId, { last: ids[0] }, { imageUrls: [ids[1]] }));
    await expectInvalid(submit(userId, { first: ids[0] }, { model: "kling/v4-flash-reference-to-video" }));
    // Nine middle images are invalid even when there are fewer than ten images overall.
    await expectInvalid(submit(userId, { middle: ids.slice(0, 9) }, { duration: 10 }));
    // Five total images for a three-second clip exceeds duration + 1.
    await expectInvalid(submit(userId, { first: ids[0], middle: ids.slice(1, 4), last: ids[4] }, { duration: 3 }));
    expect(http).not.toHaveBeenCalled();
    expect(await countHoldsForUser(userId)).toBe(0);
    expect((await getBalance(userId)).availableCredits).toBe(startingCredits);
  });

  it.each([3, 10])("accepts the precise total-frame boundary for %i seconds", async duration => {
    const userId = await owner();
    const count = Math.min(10, duration + 1);
    const slots = await Promise.all(Array.from({ length: count }, (_, n) => upload(userId, `slot-${n}.png`)));
    await submit(userId, { first: slots[0], middle: slots.slice(1, -1), last: slots.at(-1) }, { duration });
    expect(sentTask(0).input).toMatchObject({
      duration, first_frame_url: signed(slots[0]), keyframe_urls: slots.slice(1, -1).map(signed), last_frame_url: signed(slots[count - 1]),
    });
    expect(http).toHaveBeenCalledTimes(1);
  });
});
