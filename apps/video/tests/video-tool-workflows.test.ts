import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextRequest } from "next/server";
const kie = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => vi.fn());
const approve = vi.hoisted(() => vi.fn());
vi.mock("@/ai/kie-market", async (base) => ({
  ...(await base<typeof import("@/ai/kie-market")>()),
  createMarketTask: kie,
}));
vi.mock("@/lib/api/auth", () => ({ requireAuth: auth }));
vi.mock("@/lib/content-safety", () => ({
  moderateContent: approve,
  isSafetyApproved: (v: { allowed: boolean }) => v.allowed,
  safetyMessage: () => "blocked",
}));
vi.mock("@/lib/video-events", () => ({ emitVideoEvent: vi.fn() }));
const objects = new Map<string, Buffer>();
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    getSignedUrl: (key: string) => `https://test-files.invalid/${key}`,
    getObjectSize: async (key: string) => objects.get(key)?.length,
  }),
  isStorageKey: (v: string) => Boolean(v) && !v.startsWith("https:"),
  isStorageConfigured: () => true,
}));
import { db, mediaAssets, videos } from "@/db";
import { getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";
import { readMovieBox, readVideoTrack } from "@/lib/video-track";
import { VIDEO_EDIT_MODEL, VIDEO_MOTION_MODEL } from "@/lib/video-tool";
import { POST as submit } from "@/app/api/v1/video/generate/route";
import { POST as inspect } from "@/app/api/v1/video/tool-source/route";
import { getBalance, giveCredits, uniqueUserId } from "./helpers";

function box(type: string, ...parts: Buffer[]) {
  const contents = Buffer.concat(parts),
    header = Buffer.alloc(8);
  header.writeUInt32BE(contents.length + 8);
  header.write(type, 4, "ascii");
  return Buffer.concat([header, contents]);
}
function mp4(seconds = 5, width = 1280, height = 720, fps = 30) {
  const md = Buffer.alloc(24),
    movie = Buffer.alloc(24),
    tk = Buffer.alloc(84),
    hd = Buffer.alloc(24),
    st = Buffer.alloc(16);
  md.writeUInt32BE(fps * 1000, 12);
  md.writeUInt32BE(seconds * fps * 1000, 16);
  movie.writeUInt32BE(1000, 12);
  movie.writeUInt32BE(seconds * 1000, 16);
  tk.writeUInt32BE(width * 65536, 76);
  tk.writeUInt32BE(height * 65536, 80);
  hd.write("vide", 8);
  st.writeUInt32BE(1, 4);
  st.writeUInt32BE(seconds * fps, 8);
  st.writeUInt32BE(1000, 12);
  return box(
    "moov",
    box("mvhd", movie),
    box(
      "trak",
      box("tkhd", tk),
      box(
        "mdia",
        box("hdlr", hd),
        box("mdhd", md),
        box("minf", box("stbl", box("stts", st))),
      ),
    ),
  );
}
function png(width = 640, height = 480) {
  const b = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(b);
  b.write("IHDR", 12);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}
async function upload(owner: string, bytes: Buffer, mime: string) {
  const key = `uploads/${owner}/${nanoid()}.${mime === "image/png" ? "png" : "mp4"}`;
  objects.set(key, bytes);
  await db.insert(mediaAssets).values({
    userId: owner,
    id: nanoid(),
    key,
    name: "test",
    mimeType: mime,
    size: bytes.length,
  });
  return key;
}
function req(body: unknown, user: string, key?: string) {
  return new NextRequest("https://example.test/api/v1/video/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Media-Account": user,
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}
let owner = "",
  input = "";
beforeEach(async () => {
  owner = uniqueUserId();
  await giveCredits(owner, 1000);
  input = await upload(owner, mp4(), "video/mp4");
  vi.stubEnv("KIE_API_KEY", "test");
  vi.stubEnv("VIDEO_GENERATION_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_IS_PREVIEW", "false");
  auth.mockReset().mockResolvedValue({ id: owner, isAdmin: false });
  approve.mockReset().mockResolvedValue({ allowed: true });
  kie.mockReset().mockResolvedValue("provider-123");
  const realFetch = globalThis.fetch.bind(globalThis);
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    if (!String(url).startsWith("https://test-files.invalid/"))
      return realFetch(url, init);
    const bytes = objects.get(new URL(String(url)).pathname.slice(1));
    return new Response(bytes ? new Uint8Array(bytes) : null, {
      status: bytes ? 200 : 404,
      headers: { "content-length": String(bytes?.length ?? 0) },
    });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  objects.clear();
});
function inputBody(model = VIDEO_EDIT_MODEL) {
  return {
    model,
    prompt: "Make the room look like evening",
    sourceVideoKey: input,
    duration: 5,
    quality: "720p",
    expectedCredits: 130,
  };
}
describe("video edit and motion end-to-end request contract", () => {
  it("quotes the measured time and validates on generate; lost responses reuse one charge", async () => {
    const quote = await inspect(
      req({ model: VIDEO_EDIT_MODEL, sourceVideoKey: input }, owner),
    );
    expect(await quote.json()).toMatchObject({
      success: true,
      data: { seconds: 5 },
    });
    const key = crypto.randomUUID(),
      body = inputBody();
    const resp = await submit(req(body, owner, key)),
      result = await resp.json();
    expect(result).toMatchObject({ success: true, data: { creditsUsed: 130 } });
    const repeated = await submit(req(body, owner, key));
    expect((await repeated.json()).data.videoUuid).toBe(result.data.videoUuid);
    const [model, request] = kie.mock.calls[0];
    expect(model.buildTask(request)).toEqual({
      model: VIDEO_EDIT_MODEL,
      input: {
        video_urls: [`https://test-files.invalid/${input}`],
        resolution: "720p",
        aspect_ratio: "auto",
        audio: false,
        prompt: body.prompt,
      },
    });
    expect(kie).toHaveBeenCalledTimes(1);
    expect((await getBalance(owner)).availableCredits).toBe(870);
    const [row] = await db
      .select()
      .from(videos)
      .where(eq(videos.uuid, result.data.videoUuid));
    expect(row.parameters).toMatchObject({
      sourceVideoKey: input,
      duration: 5,
    });
    expect(JSON.stringify(row.parameters)).not.toContain("https:");
  });
  it("runs real motion control input mapping with an optional prompt and character orientation", async () => {
    const characterKey = await upload(owner, png(), "image/png");
    const body = {
      ...inputBody(VIDEO_MOTION_MODEL),
      prompt: "",
      quality: "1080p",
      expectedCredits: 165,
      orientation: "image",
      characterKey,
    };
    expect(
      await (await submit(req(body, owner, crypto.randomUUID()))).json(),
    ).toMatchObject({ success: true, data: { creditsUsed: 165 } });
    const [model, request] = kie.mock.calls[0];
    expect(model.buildTask(request)).toEqual({
      model: VIDEO_MOTION_MODEL,
      input: {
        mode: "1080p",
        character_orientation: "image",
        video_urls: [`https://test-files.invalid/${input}`],
        input_urls: [`https://test-files.invalid/${characterKey}`],
      },
    });
    expect(approve).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          {
            label: "character",
            url: `https://test-files.invalid/${characterKey}`,
          },
        ],
      }),
    );
  });
  it("rejects a lower duration/price, foreign assets, invalid dimensions and blocked characters before reserving credits", async () => {
    const body = inputBody(),
      foreign = await upload(uniqueUserId(), mp4(), "video/mp4");
    const small = await upload(owner, png(200, 200), "image/png");
    const characterKey = await upload(owner, png(), "image/png");
    for (const [overrides, status] of [
      [{ duration: 1 }, 409],
      [{ expectedCredits: 1 }, 409],
      [{ sourceVideoKey: foreign }, 400],
      [{ model: VIDEO_MOTION_MODEL, characterKey: small }, 400],
    ] as const) {
      expect(
        (
          await submit(
            req({ ...body, ...overrides }, owner, crypto.randomUUID()),
          )
        ).status,
      ).toBe(status);
    }
    approve.mockResolvedValue({ allowed: false });
    expect(
      (
        await submit(
          req(
            { ...body, model: VIDEO_MOTION_MODEL, characterKey },
            owner,
            crypto.randomUUID(),
          ),
        )
      ).status,
    ).toBe(422);
    expect(kie).not.toHaveBeenCalled();
    expect((await getBalance(owner)).availableCredits).toBe(1000);
  });
  it("validates completed creation ownership and reads the stored timeline rather than the database duration", async () => {
    const uuid = `vid_${nanoid()}`,
      key = `videos/${uuid}/clip.mp4`;
    objects.set(key, mp4(6));
    await db.insert(videos).values({
      uuid,
      userId: owner,
      prompt: "clip",
      model: "example",
      mediaType: "video",
      status: "COMPLETED",
      videoUrl: key,
      duration: 3,
    });
    expect(
      await (
        await inspect(
          req({ model: VIDEO_EDIT_MODEL, sourceVideoUuid: uuid }, owner),
        )
      ).json(),
    ).toMatchObject({ success: true, data: { seconds: 6 } });
    auth.mockResolvedValue({ id: "other" });
    expect(
      (
        await inspect(
          req({ model: VIDEO_EDIT_MODEL, sourceVideoUuid: uuid }, "other"),
        )
      ).status,
    ).toBe(400);
  });
  it("extends a private upload at the unchanged added-seconds price and rejects a mixed or foreign source", async () => {
    const body = {
      model: "pixverse-v6/extend",
      prompt: "Continue the action",
      sourceVideoKey: input,
      quality: "720p",
      duration: 5,
      generateAudio: false,
    };
    const foreign = await upload(uniqueUserId(), mp4(), "video/mp4");
    expect(
      (
        await submit(
          req(
            { ...body, sourceVideoUuid: "vid_other" },
            owner,
            crypto.randomUUID(),
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await submit(
          req({ ...body, sourceVideoKey: foreign }, owner, crypto.randomUUID()),
        )
      ).status,
    ).toBe(400);
    expect(
      await (await submit(req(body, owner, crypto.randomUUID()))).json(),
    ).toMatchObject({ success: true, data: { creditsUsed: 55 } });
    const [model, request] = kie.mock.calls[0];
    expect(model.buildTask(request)).toMatchObject({
      model: "pixverse-v6/extend",
      input: { video_url: `https://test-files.invalid/${input}`, duration: 5 },
    });
    expect(kie).toHaveBeenCalledTimes(1);
  });
  it("releases the reservation on a definitive upstream rejection, and allows corrected inputs", async () => {
    const { ProviderRejectedError } = await import("@/ai");
    kie.mockRejectedValueOnce(
      new ProviderRejectedError("Unsupported source", 422),
    );
    const first = await submit(req(inputBody(), owner, crypto.randomUUID()));
    expect(first.status).toBe(422);
    expect(await first.json()).toMatchObject({
      error: { details: { code: "TOOL_PROVIDER_REJECTED" } },
    });
    expect((await getBalance(owner)).availableCredits).toBe(1000);
    expect(
      (
        await submit(
          req(
            { ...inputBody(), prompt: "Change the sky" },
            owner,
            crypto.randomUUID(),
          ),
        )
      ).status,
    ).toBe(200);
    expect((await getBalance(owner)).availableCredits).toBe(870);
  });
  it("finds a tail movie atom without downloading megabytes of media samples", async () => {
    const movie = mp4();
    const media = box("mdat", Buffer.alloc(2 * 1024 * 1024));
    const file = Buffer.concat([media, movie]);
    const ranges: number[] = [];
    const bytes = await readMovieBox(file.length, async (start, end) => {
      ranges.push(end - start + 1);
      return file.subarray(start, end + 1);
    });
    expect(readVideoTrack(bytes).seconds).toBe(5);
    expect(ranges.reduce((sum, n) => sum + n, 0)).toBeLessThan(70000);
  });
  it("keeps the tools outside the creation catalog and prices all resolution options", () => {
    for (const id of [VIDEO_EDIT_MODEL, VIDEO_MOTION_MODEL]) {
      const m = getMarketModel(id)!;
      expect(marketModelsOf("video")).not.toContain(m);
      expect(
        m.costUsd({ prompt: "", duration: 5, resolution: "720p" }),
      ).toBeCloseTo(0.5675);
      expect(
        marketCredits(m, { prompt: "", duration: 5, resolution: "1080p" }),
      ).toBe(165);
    }
    expect(readVideoTrack(mp4(5))).toEqual({
      seconds: 5,
      width: 1280,
      height: 720,
      fps: 30,
    });
    expect(() => readVideoTrack(mp4().subarray(0, 32))).toThrow();
  });
});
