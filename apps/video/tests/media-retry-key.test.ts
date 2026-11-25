import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { submitMedia } from "@/lib/media-studio";
import { POST } from "@/app/api/v1/media/generate/route";

const { getSession, requireAuth, moderateContent, generateMedia } = vi.hoisted(() => ({
  getSession: vi.fn(), requireAuth: vi.fn(), moderateContent: vi.fn(), generateMedia: vi.fn(),
}));
vi.mock("@/lib/auth/client", () => ({ getSession }));
vi.mock("@/lib/api/auth", () => ({ requireAuth }));
vi.mock("@/lib/internal-test-account", () => ({ canGenerateInPreview: () => true }));
vi.mock("@/lib/content-safety", () => ({ moderateContent, isSafetyApproved: () => true }));
vi.mock("@/lib/proxy-config", () => ({}));
vi.mock("@/services/video", () => ({ videoService: { generateMedia } }));

const body = { model: "seedream-5-5", prompt: "a red bicycle", aspectRatio: "1:1" };
const audio = { model: "elevenlabs-v3", prompt: "a red bicycle", voice: "Rachel" };
const session = (id: string) => ({ data: { user: { id } } });

function keysOf(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map(([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers["Idempotency-Key"]);
}

const ok = () => new Response(JSON.stringify({ success: true, data: { videoUuid: "u1", creditsUsed: 6 } }), { status: 200 });
const rejected = (status: number, code: string) => Response.json({ success: false, error: { details: { code } } }, { status });

describe("submitMedia idempotency key", () => {
  let tab: Map<string, string>;
  beforeEach(() => {
    getSession.mockReset().mockResolvedValue(session("user_a"));
    tab = new Map();
    vi.stubGlobal("sessionStorage", {
      getItem: (slot: string) => tab.get(slot) ?? null,
      setItem: (slot: string, key: string) => tab.set(slot, key),
      removeItem: (slot: string) => tab.delete(slot),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends a request whose answer was lost again under the same key (no second charge)", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    expect((await submitMedia(body, true)).ok).toBe(false);
    expect((await submitMedia(body, true)).ok).toBe(true);
    const [first, second] = keysOf(fetchMock);
    expect(second).toBe(first);
  });

  it("uses a new key for a changed request, and after an answer arrived", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    await submitMedia(body, true);
    await submitMedia({ ...body, prompt: "a blue bicycle" }, true);
    await submitMedia({ ...body, prompt: "a blue bicycle" }, true);
    const [first, changed, again] = keysOf(fetchMock);
    expect(changed).not.toBe(first);
    expect(again).not.toBe(changed);
  });

  it("keeps the key when the answer's body broke off", async () => {
    const broken = new Response("{\"success\": tr", { status: 200 });
    const fetchMock = vi.fn().mockResolvedValueOnce(broken).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    expect((await submitMedia({ ...body, prompt: "broken body" }, true)).ok).toBe(false);
    expect((await submitMedia({ ...body, prompt: "broken body" }, true)).ok).toBe(true);
    const [first, second] = keysOf(fetchMock);
    expect(second).toBe(first);
  });

  it("keeps the key when another job is sent in between", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    await submitMedia({ ...body, prompt: "job A" }, true);
    await submitMedia({ ...body, prompt: "job B" }, true);
    await submitMedia({ ...body, prompt: "job A" }, true);
    const [a, , aAgain] = keysOf(fetchMock);
    expect(aAgain).toBe(a);
  });

  it.each([body, audio])("persists $model before POST and survives a reload during the request", async (params) => {
    let finish!: (value: Response) => void;
    let savedAtPost: string[] = [];
    const post = vi.fn().mockImplementationOnce(() => {
      savedAtPost = [...tab.values()];
      return new Promise<Response>((resolve) => { finish = resolve; });
    });
    vi.stubGlobal("fetch", post);
    const first = submitMedia(params, false);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [key] = keysOf(post);
    expect(savedAtPost).toEqual([key]);

    vi.resetModules();
    const { submitMedia: reloaded } = await import("@/lib/media-studio");
    post.mockResolvedValueOnce(ok());
    const reordered = Object.fromEntries(Object.entries(params).reverse()) as typeof params;
    expect(await reloaded(reordered, false)).toMatchObject({ ok: true, uuid: "u1" });
    expect(keysOf(post)[1]).toBe(key);
    post.mockRejectedValueOnce(new TypeError("network"));
    await reloaded(params, false);
    const newKey = keysOf(post)[2];
    expect(newKey).not.toBe(key);
    finish(ok());
    expect((await first).ok).toBe(true);
    expect([...tab.values()]).toEqual([newKey]);
  });

  it("keeps each account's key through 5xx, expired sessions and account changes", async () => {
    const post = vi.fn()
      .mockResolvedValueOnce(rejected(503, "UNAVAILABLE"))
      .mockResolvedValueOnce(rejected(401, "UNAUTHORIZED"))
      .mockResolvedValueOnce(rejected(409, "ACCOUNT_CHANGED"))
      .mockResolvedValueOnce(rejected(502, "UNAVAILABLE"))
      .mockResolvedValueOnce(rejected(422, "CONTENT_BLOCKED"))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", post);
    await submitMedia(audio, false);
    expect(await submitMedia(audio, false)).toMatchObject({ ok: false, needsLogin: true });
    expect(await submitMedia(audio, false)).toMatchObject({ ok: false, code: "ACCOUNT_CHANGED" });
    getSession.mockResolvedValueOnce(session("user_b"));
    await submitMedia(audio, false);
    expect(await submitMedia(audio, false)).toMatchObject({ code: "CONTENT_BLOCKED" });
    await submitMedia(audio, false);
    getSession.mockResolvedValueOnce(session("user_b"));
    await submitMedia(audio, false);

    const [a, after503, after401, b, afterSwitch, after422, bAgain] = keysOf(post);
    expect([after503, after401, afterSwitch]).toEqual([a, a, a]);
    expect(b).not.toBe(a);
    expect(after422).toBe(a);
    expect(bAgain).toBe(b);
    expect(post.mock.calls.map(([, init]) => init.headers["X-Media-Account"]))
      .toEqual(["user_a", "user_a", "user_a", "user_b", "user_a", "user_a", "user_b"]);
  });

  it("sends nothing when the account that filled the form differs from the current session", async () => {
    getSession.mockResolvedValueOnce(session("user_b"));
    const post = vi.fn();
    vi.stubGlobal("fetch", post);
    expect(await submitMedia(audio, false, undefined, "user_a")).toMatchObject({ ok: false, code: "ACCOUNT_CHANGED" });
    expect(post).not.toHaveBeenCalled();
    expect(tab.size).toBe(0);
  });

  it.each(["af77f17d-e690-4960-a8d8-6816e93ff284", "1733097600000"])(
    "recovers legacy key %s once per account even when the other account retries first", async (legacyKey) => {
      // Original storage fixture for the red bicycle body, including the old Date.now() key format.
      tab.set("aivd:media-lost-answers", JSON.stringify({ "2jxgc6:69": { key: legacyKey, at: 1733097600000 } }));
      const post = vi.fn().mockImplementation(ok);
      vi.stubGlobal("fetch", post);
      getSession.mockResolvedValueOnce(session("user_b"));
      await submitMedia(body, false);
      post.mockResolvedValueOnce(rejected(502, "UNAVAILABLE"));
      await submitMedia({ prompt: body.prompt, aspectRatio: body.aspectRatio, model: body.model }, false);
      await submitMedia(body, false);
      await submitMedia(body, false);
      getSession.mockResolvedValueOnce(session("user_b"));
      await submitMedia(body, false);
      const keys = keysOf(post);
      expect(keys.slice(0, 3)).toEqual([legacyKey, legacyKey, legacyKey]);
      expect(new Set([legacyKey, ...keys.slice(3)]).size).toBe(3);
    },
  );

  it("treats a replayed FAILED job as an error and forgets the stale retry key", async () => {
    const failedReplay = () =>
      new Response(JSON.stringify({ success: true, data: { videoUuid: "u-failed", status: "FAILED", creditsUsed: 0, errorMessage: "Error: Insufficient credits. Required: 130, Available: 10" } }), { status: 200 });
    const post = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(failedReplay()).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", post);
    expect((await submitMedia(body, true)).ok).toBe(false);
    expect(await submitMedia(body, true)).toMatchObject({ ok: false, code: "INSUFFICIENT_CREDITS", requiredCredits: 130 });
    expect(await submitMedia(body, true)).toMatchObject({ ok: true, uuid: "u1" });
    const [first, second, third] = keysOf(post);
    expect(second).toBe(first);
    expect(third).not.toBe(first);
  });

  it("does not POST without a confirmed account and a durably saved key", async () => {
    const post = vi.fn();
    vi.stubGlobal("fetch", post);
    getSession.mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({ error: { status: 503 } });
    expect(await submitMedia(body, false)).toMatchObject({ ok: false, needsLogin: true });
    expect((await submitMedia(body, false)).ok).toBe(false);
    expect(tab.size).toBe(0);
    for (const storage of [
      { getItem: () => { throw new Error("denied"); } },
      { getItem: () => null, setItem: () => { throw new Error("quota"); } },
      { getItem: () => null, setItem: () => {} },
    ]) {
      vi.stubGlobal("sessionStorage", storage);
      expect(await submitMedia(audio, false)).toMatchObject({ ok: false, code: "RETRY_KEY_UNAVAILABLE" });
    }
    expect(post).not.toHaveBeenCalled();
  });
});

describe("media generate account check", () => {
  const request = (headers: Record<string, string>) => new NextRequest("https://app.test/api/v1/media/generate", {
    method: "POST", headers: { "Idempotency-Key": "reserved", ...headers }, body: JSON.stringify(body),
  });

  beforeEach(() => {
    requireAuth.mockResolvedValue({ id: "user_b" });
    moderateContent.mockClear();
    generateMedia.mockReset().mockResolvedValue({ videoUuid: "u1" });
  });

  it("rejects a cookie switch before moderation or generation", async () => {
    const response = await POST(request({ "X-Media-Account": "user_a" }));
    expect(response.status).toBe(409);
    expect((await response.json()).error.details.code).toBe("ACCOUNT_CHANGED");
    expect(moderateContent).not.toHaveBeenCalled();
    expect(generateMedia).not.toHaveBeenCalled();
  });

  it.each([{}, { "X-Media-Account": "user_b" }] as Record<string, string>[])(
    "forwards the authenticated user and original key with headers %j", async (headers) => {
      expect((await POST(request(headers))).status).toBe(200);
      expect(generateMedia).toHaveBeenCalledWith(expect.objectContaining({ userId: "user_b", idempotencyKey: "reserved" }));
    },
  );
});
