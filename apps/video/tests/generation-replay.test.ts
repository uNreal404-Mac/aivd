import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as mediaPost } from "@/app/api/v1/media/generate/route";
import { POST as videoPost } from "@/app/api/v1/video/generate/route";
import { postGeneration } from "@/lib/creative-space/canvas-submit";
import { submitMedia } from "@/lib/media-studio";
import { countHoldsForUser, getBalance, getHoldRow, giveCredits, uniqueUserId } from "./helpers";

const state = vi.hoisted(() => ({ owner: "", blocked: false, preview: true, moderation: vi.fn(), provider: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({ getSession: async () => ({ data: { user: { id: state.owner } } }) }));
vi.mock("@/lib/api/auth", () => ({ requireAuth: async () => ({ id: state.owner }) }));
vi.mock("@/lib/internal-test-account", async (original) => ({
  ...await original<typeof import("@/lib/internal-test-account")>(), canGenerateInPreview: () => state.preview,
}));
vi.mock("@/lib/content-safety", async (original) => ({
  ...await original<typeof import("@/lib/content-safety")>(),
  moderateContent: async () => {
    state.moderation();
    return { decision: state.blocked ? "block" : "allow", categories: [], source: "rules", reason: "fixture" };
  },
}));
vi.mock("@/lib/video-events", () => ({ emitVideoEvent: vi.fn() }));
vi.mock("@/lib/proxy-config", () => ({}));

const image = { model: "kling-image-4", prompt: "A red bicycle in a garden", resolution: "2K", count: 4 };
const media = "/api/v1/media/generate";
const video = "/api/v1/video/generate";
let stored: Map<string,string>;
let keys: string[];
let loseResponse: boolean;
let staleRejection: boolean;
let acceptedUuid: string;

const request = (path: string, body: unknown, key: string, owner = state.owner) => new NextRequest("https://app.test" + path, {
  method: "POST", headers: { "Idempotency-Key": key, "X-Media-Account": owner }, body: JSON.stringify(body),
});

beforeEach(async () => {
  state.owner = uniqueUserId(); state.blocked = false; state.preview = true;
  await giveCredits(state.owner, 2000);
  state.provider.mockReset(); state.moderation.mockReset();
  stored = new Map(); keys = []; loseResponse = false; staleRejection = false; acceptedUuid = "";
  vi.stubEnv("KIE_API_KEY", "test-only");
  vi.stubEnv("VIDEO_MOCK_PROVIDER", "false"); vi.stubEnv("VIDEO_GENERATION_ENABLED", "true");
  vi.stubGlobal("sessionStorage", { getItem: (k:string) => stored.get(k) ?? null, setItem: (k:string,v:string) => stored.set(k,v), removeItem: (k:string) => stored.delete(k) });
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
    if (input.startsWith("https://api.kie.ai/")) {
      state.provider();
      return Response.json({ code: 200, data: { taskId: "task-" + state.provider.mock.calls.length } });
    }
    if (input !== media && input !== video) throw new Error("Unexpected test request: " + input);
    const key = new Headers(init.headers).get("Idempotency-Key")!;
    keys.push(key);
    if (staleRejection) {
      staleRejection = false;
      return Response.json({ success: false, error: { details: { code: "CONTENT_BLOCKED" } } }, { status: 422 });
    }
    const route = input === media ? mediaPost : videoPost;
    const reply = await route(new NextRequest("https://app.test" + input, { method: "POST", body: String(init.body), headers: new Headers(init.headers) }));
    if (loseResponse) {
      loseResponse = false;
      expect(reply.status).toBe(200);
      acceptedUuid = (await reply.json()).data.videoUuid;
      throw new TypeError("Connection lost after the committed job");
    }
    return reply;
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("generation replay after an accepted job loses its response", () => {
  it("recovers the same 62-credit Kling batch even after an intervening 422 from an older worker", async () => {
    loseResponse = true;
    expect(await submitMedia(image, false)).toMatchObject({ ok: false });
    expect(acceptedUuid).toBeTruthy();
    expect(await getHoldRow(acceptedUuid)).toMatchObject({ credits: 62, status: "HOLDING" });
    staleRejection = true;
    expect(await submitMedia(image, false)).toMatchObject({ ok: false, code: "CONTENT_BLOCKED" });
    state.blocked = true;
    expect(await submitMedia(image, false)).toMatchObject({ ok: true, uuid: acceptedUuid, credits: 62 });
    expect(new Set(keys).size).toBe(1);
    expect(state.provider).toHaveBeenCalledTimes(1);
    expect(state.moderation).toHaveBeenCalledTimes(1);
    expect(await countHoldsForUser(state.owner)).toBe(1);
    expect(await getBalance(state.owner)).toMatchObject({ availableCredits: 1938, frozenCredits: 62 });
  });

  it("moderates new and corrected inputs and never replays a different account's reservation", async () => {
    state.blocked = true;
    expect(await submitMedia(image, false)).toMatchObject({ ok: false, code: "CONTENT_BLOCKED" });
    expect(state.provider).not.toHaveBeenCalled();
    expect(await countHoldsForUser(state.owner)).toBe(0);
    state.blocked = false;
    const corrected = { ...image, prompt: "A blue bicycle on an empty road" };
    const result = await submitMedia(corrected, false);
    expect(result.ok).toBe(true);
    expect(keys[0]).not.toBe(keys[1]);
    const ownerA = state.owner;
    state.owner = uniqueUserId(); state.blocked = true;
    expect((await mediaPost(request(media, corrected, keys[1], ownerA))).status).toBe(409);
    expect((await mediaPost(request(media, corrected, keys[1]))).status).toBe(422);
    expect(state.provider).toHaveBeenCalledTimes(1);
    expect(await countHoldsForUser(state.owner)).toBe(0);
    expect(await countHoldsForUser(ownerA)).toBe(1);
  });

  it.each([
    [media, image],
    [video, { model: "kling/v4-reference-to-video", prompt: "A calm garden at sunrise", duration: 10, quality: "1080p" }],
  ] as const)("lets a canvas replay its saved key through %s with moderation or generation availability changed", async (endpoint, options) => {
    const key = crypto.randomUUID();
    const first = await postGeneration(endpoint, options, key);
    expect(first).toMatchObject({ kind: "ok" });
    state.blocked = true; state.preview = false;
    expect(await postGeneration(endpoint, options, key)).toEqual(first);
    expect(state.provider).toHaveBeenCalledTimes(1);
    expect(state.moderation).toHaveBeenCalledTimes(1);
    expect(await countHoldsForUser(state.owner)).toBe(1);
    expect((await (endpoint === media ? mediaPost : videoPost)(request(endpoint, options, crypto.randomUUID()))).status).toBe(503);
  });
});
