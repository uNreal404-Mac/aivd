import assert from "node:assert/strict";
import test from "node:test";
import { PROGRESS_MESSAGE } from "../src/commands.mjs";
import { fetchProgressSummary } from "../src/progress.mjs";

function fakeKv(seed = {}) {
  const values = new Map(Object.entries(seed));
  const writes = [];
  return {
    values,
    writes,
    async get(key) { return values.get(key) ?? null; },
    async put(key, value, options) {
      values.set(key, value);
      writes.push({ key, value, options });
    },
  };
}

test("caches a GitHub comment summary in KV with a short TTL", async () => {
  const kv = fakeKv();
  let githubCalls = 0;
  const fetchImpl = async (url) => {
    if (String(url).includes("/issues/20/comments")) {
      githubCalls += 1;
      return Response.json([
        {
          user: { login: "alice" },
          created_at: "2026-10-15T10:41:00.000Z",
          body: "验收通过，只剩报价待确认。",
        },
      ]);
    }
    throw new Error(`unexpected ${url}`);
  };

  const first = await fetchProgressSummary({ kv, fetchImpl, now: () => Date.parse("2026-10-15T10:41:00.000Z") });
  const second = await fetchProgressSummary({ kv, fetchImpl, now: () => Date.parse("2026-10-15T10:41:00.000Z") });

  assert.equal(githubCalls, 1);
  assert.equal(first, second);
  assert.match(first, /验收通过/);
  assert.match(first, /台北时间/);
  assert.equal(kv.writes[0].key, "progress:issue:20");
  assert.equal(kv.writes[0].options.expirationTtl, 300);
});

test("falls back to the static progress copy when GitHub is unavailable", async () => {
  const summary = await fetchProgressSummary({
    kv: fakeKv(),
    fetchImpl: async () => { throw new Error("network down"); },
  });
  assert.equal(summary, PROGRESS_MESSAGE);
});

test("does not call generate or upload endpoints while loading progress", async () => {
  const urls = [];
  await fetchProgressSummary({
    kv: fakeKv(),
    fetchImpl: async (url) => {
      urls.push(String(url));
      return Response.json([]);
    },
  });
  assert.equal(urls.some((url) => /\/api\/(generate|upload)(?:\?|$)/.test(url)), false);
  assert.equal(urls.some((url) => /kie\.ai/i.test(url)), false);
});
