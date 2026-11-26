import { afterEach, describe, expect, it, vi } from "vitest";

import { Storage, UnusableMediaError } from "@/lib/storage";

describe("downloadAndUpload with requireNonEmpty", () => {
  afterEach(() => vi.unstubAllGlobals());

  const storage = () => {
    const service = Object.create(Storage.prototype) as Storage;
    (service as unknown as { uploadFile: (params: { key: string }) => Promise<{ key: string }> }).uploadFile = vi.fn(async ({ key }) => ({ key }));
    return service;
  };
  const serve = (body: BodyInit, type: string) => vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200, headers: { "content-type": type } })));

  it("refuses an empty body or an error page, stores a real file with its size", async () => {
    const service = storage();
    serve(new Uint8Array(0), "video/mp4");
    await expect(service.downloadAndUpload({ sourceUrl: "https://k/a.mp4", key: "k", requireNonEmpty: true })).rejects.toBeInstanceOf(UnusableMediaError);
    serve("<html>error</html>", "text/html; charset=utf-8");
    await expect(service.downloadAndUpload({ sourceUrl: "https://k/a.mp4", key: "k", requireNonEmpty: true })).rejects.toBeInstanceOf(UnusableMediaError);
    serve('{"error":"expired"}', "application/json");
    await expect(service.downloadAndUpload({ sourceUrl: "https://k/a.mp4", key: "k", requireNonEmpty: true })).rejects.toBeInstanceOf(UnusableMediaError);
    serve(new Uint8Array([1, 2, 3]), "video/mp4");
    await expect(service.downloadAndUpload({ sourceUrl: "https://k/a.mp4", key: "k", requireNonEmpty: true })).resolves.toEqual({ key: "k", fileSize: 3 });
  });
});
