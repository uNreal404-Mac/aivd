import { afterEach, describe, expect, it, vi } from "vitest";

import { EmptyMediaError, Storage } from "@/lib/storage";

describe("downloadAndUpload refuses what is not a result", () => {
  afterEach(() => vi.unstubAllGlobals());

  const storage = () => {
    const service = Object.create(Storage.prototype) as Storage;
    (service as unknown as { uploadFile: (p: { key: string }) => Promise<{ key: string }> }).uploadFile = vi.fn(async ({ key }) => ({ key }));
    return service;
  };

  it("an empty body or an error page throws EmptyMediaError; a real file is stored with its size", async () => {
    const service = storage();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(0), { status: 200, headers: { "content-type": "video/mp4" } })));
    await expect(service.downloadAndUpload({ sourceUrl: "https://k/a.mp4", key: "k" })).rejects.toBeInstanceOf(EmptyMediaError);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>oops</html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })));
    await expect(service.downloadAndUpload({ sourceUrl: "https://k/a.mp4", key: "k" })).rejects.toBeInstanceOf(EmptyMediaError);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "video/mp4" } })));
    await expect(service.downloadAndUpload({ sourceUrl: "https://k/a.mp4", key: "k" })).resolves.toEqual({ key: "k", size: 3 });
  });
});
