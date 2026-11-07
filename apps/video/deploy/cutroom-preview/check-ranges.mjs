// Exercise real HTTP dispatch, validating each response against its authored MP4.
// Usage: node deploy/cutroom-preview/check-ranges.mjs http://127.0.0.1:3269
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.argv[2];
if (!base) throw new Error("Expected the base URL of a local or deployed Cutroom preview");
const filmSource = await readFile(new URL("../../src/components/hf/cutroom-films.ts", import.meta.url), "utf8");
const urls = [...filmSource.matchAll(/\bvideo:\s*"(\/home\/[\w.-]+\.mp4)"/g)].map(match => match[1]);
assert.ok(urls.length > 0);

for (const route of urls) {
  const source = await readFile(new URL("../../public" + route, import.meta.url));
  const size = source.length;
  const url = new URL(route, base);
  async function verify(method, range, status, first, last, ifRange) {
    const headers = { "Accept-Encoding": "identity" };
    if (range) headers.Range = range;
    if (ifRange) headers["If-Range"] = ifRange;
    const res = await fetch(url, { method, headers });
    assert.equal(res.status, status, route + " " + method + " " + range);
    assert.equal(res.headers.get("x-cutroom-media"), "range-v1");
    assert.equal(res.headers.get("accept-ranges"), "bytes");
    const expected = status === 416 ? 0 : last - first + 1;
    assert.equal(res.headers.get("content-length"), String(expected));
    const contentRange = status === 416 ? "bytes */" + size : status === 206 ? `bytes ${first}-${last}/${size}` : null;
    assert.equal(res.headers.get("content-range"), contentRange);
    const body = Buffer.from(await res.arrayBuffer());
    if (method === "HEAD" || status === 416) assert.equal(body.length, 0);
    else assert.ok(source.subarray(first, last + 1).equals(body), "Unexpected media bytes for " + route);
    return res.headers.get("etag");
  }
  const etag = await verify("HEAD", null, 200, 0, size - 1);
  await verify("HEAD", "bytes=-16", 206, size - 16, size - 1);
  await verify("GET", null, 200, 0, size - 1);
  await verify("GET", "bytes=100-109", 206, 100, 109, etag);
  await verify("GET", "bytes=" + (size - 16) + "-", 206, size - 16, size - 1);
  await verify("GET", "bytes=-31", 206, size - 31, size - 1);
  await verify("GET", "bytes=12-14", 200, 0, size - 1, '"old-version"');
  await verify("GET", "bytes=" + size + "-", 416);
  await verify("GET", "bytes=10-1", 416);
  await verify("GET", "bytes=0-1,8-9", 416);
  console.log("Verified full, partial, HEAD, validators and 416:", route, size);
}
