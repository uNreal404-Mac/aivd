import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getStorage, resetStorageForTests } from "@/lib/storage";

const STORAGE_ENV = {
  STORAGE_ENDPOINT: "https://acc.r2.cloudflarestorage.com",
  STORAGE_ACCESS_KEY: "AK",
  STORAGE_SECRET_KEY: "SK",
  STORAGE_BUCKET: "b",
} as const;

const SOURCE = "https://provider.test/video.mp4";

type Call = { method: string; url: URL; size: number };

/** A provider response delivered in uneven chunks, and an S3 endpoint that records every call. */
function stubFetch(body: Uint8Array, options: { failPart?: number } = {}) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.href === SOURCE) {
      let offset = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (offset >= body.byteLength) return controller.close();
          const chunk = body.subarray(offset, offset + 7);
          offset += chunk.byteLength;
          controller.enqueue(chunk);
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "video/mp4" } });
    }
    const method = init?.method ?? "GET";
    const raw = init?.body;
    const size = raw == null ? 0 : typeof raw === "string" ? raw.length : (raw as Uint8Array).byteLength;
    calls.push({ method, url, size });
    if (method === "POST" && url.searchParams.has("uploads")) {
      return new Response("<InitiateMultipartUploadResult><UploadId>up-1</UploadId></InitiateMultipartUploadResult>", { status: 200 });
    }
    if (method === "PUT" && url.searchParams.has("partNumber")) {
      if (Number(url.searchParams.get("partNumber")) === options.failPart) return new Response("boom", { status: 500 });
      return new Response("", { status: 200, headers: { etag: `"etag-${url.searchParams.get("partNumber")}"` } });
    }
    if (method === "POST" && url.searchParams.has("uploadId")) {
      return new Response("<CompleteMultipartUploadResult><ETag>\"x\"</ETag></CompleteMultipartUploadResult>", { status: 200 });
    }
    if (method === "DELETE") return new Response("", { status: 204 });
    return new Response("", { status: 200, headers: { etag: '"single"' } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const bytes = (length: number) => Uint8Array.from({ length }, (_, index) => index % 251);

beforeEach(() => {
  for (const [key, value] of Object.entries(STORAGE_ENV)) process.env[key] = value;
  resetStorageForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetStorageForTests();
});

describe("downloadAndUpload", () => {
  it("stores a file that fits in one part with a single PUT", async () => {
    const calls = stubFetch(bytes(40));
    const result = await getStorage().downloadAndUpload({ sourceUrl: SOURCE, key: "videos/a.mp4", partSize: 64 });
    expect(result).toEqual({ key: "videos/a.mp4", fileSize: 40 });
    expect(calls.map((call) => call.method)).toEqual(["PUT"]);
    expect(calls[0].size).toBe(40);
  });

  it("streams a larger file in equal parts and completes the upload", async () => {
    const calls = stubFetch(bytes(150));
    const result = await getStorage().downloadAndUpload({ sourceUrl: SOURCE, key: "videos/b.mp4", partSize: 64 });
    expect(result).toEqual({ key: "videos/b.mp4", fileSize: 150 });
    const parts = calls.filter((call) => call.url.searchParams.has("partNumber"));
    expect(parts.map((call) => [call.url.searchParams.get("partNumber"), call.size])).toEqual([["1", 64], ["2", 64], ["3", 22]]);
    expect(calls.at(-1)?.method).toBe("POST");
    expect(calls.at(-1)?.url.searchParams.get("uploadId")).toBe("up-1");
  });

  it("aborts the multipart upload when a part fails", async () => {
    const calls = stubFetch(bytes(150), { failPart: 2 });
    await expect(getStorage().downloadAndUpload({ sourceUrl: SOURCE, key: "videos/c.mp4", partSize: 64 })).rejects.toThrow();
    expect(calls.some((call) => call.method === "DELETE" && call.url.searchParams.get("uploadId") === "up-1")).toBe(true);
  });

  it("still refuses an empty download when asked to", async () => {
    stubFetch(new Uint8Array(0));
    await expect(getStorage().downloadAndUpload({ sourceUrl: SOURCE, key: "images/d.png", requireNonEmpty: true })).rejects.toThrow(/empty/);
  });
});
