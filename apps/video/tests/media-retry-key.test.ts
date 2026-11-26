import { afterEach, describe, expect, it, vi } from "vitest";

import { submitMedia } from "@/lib/media-studio";

const body = { model: "seedream-5-5", prompt: "a red bicycle", aspectRatio: "1:1" };

function keysOf(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map(([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers["Idempotency-Key"]);
}

const ok = () => new Response(JSON.stringify({ success: true, data: { videoUuid: "u1", creditsUsed: 6 } }), { status: 200 });

describe("submitMedia idempotency key", () => {
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

  it("keeps the key while the request is still out (a reload then resends under it)", async () => {
    let release: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve; })).mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    const first = submitMedia({ ...body, prompt: "pending job" }, true);
    // Same request again before the first answer (as after a reload).
    await submitMedia({ ...body, prompt: "pending job" }, true);
    release(ok());
    await first;
    const [a, b] = keysOf(fetchMock);
    expect(b).toBe(a);
  });

  it("reports a retried job that had failed as a failure, not a new job", async () => {
    const failed = new Response(JSON.stringify({ success: true, data: { videoUuid: "u9", status: "FAILED", creditsUsed: 9 } }), { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(failed));
    const result = await submitMedia({ ...body, prompt: "earlier failed" }, true);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.code).toBe("PREVIOUS_ATTEMPT_FAILED");
  });

  it("keeps the key after a 503 (the job may exist), drops it after a definite 4xx", async () => {
    const busy = () => new Response(JSON.stringify({ success: false, error: { message: "busy", details: { code: "STORAGE_UNAVAILABLE" } } }), { status: 503 });
    const fetchMock = vi.fn().mockResolvedValueOnce(busy()).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    await submitMedia({ ...body, prompt: "after 503" }, true);
    await submitMedia({ ...body, prompt: "after 503" }, true);
    const [a, b] = keysOf(fetchMock);
    expect(b).toBe(a);
  });
});
