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
});
