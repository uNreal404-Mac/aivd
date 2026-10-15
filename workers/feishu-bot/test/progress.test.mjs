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

test("caches a website-progress summary in KV with a short TTL", async () => {
  const kv = fakeKv();
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    if (String(url).includes("/pulls") && String(url).includes("state=closed")) {
      return Response.json([
        {
          title: "Public /examples sample pages from existing HD clips (#20) (#34)",
          merged_at: "2026-10-15T08:00:53Z",
          labels: [],
        },
      ]);
    }
    if (String(url).includes("/pulls")) {
      return Response.json([{ title: "Bind Feishu bot KV namespace", merged_at: null, labels: [] }]);
    }
    if (/\/issues\/20$/.test(String(url).split("?")[0])) {
      return Response.json({
        number: 20,
        title: "主任务卡",
        body: "## 任务\n- [ ] 新定价方案\n- [ ] 定域名\n## 卡点\n- 支付：Stripe",
      });
    }
    throw new Error(`unexpected ${url}`);
  };

  const first = await fetchProgressSummary({ kv, fetchImpl, now: () => Date.parse("2026-10-15T10:41:00.000Z") });
  const second = await fetchProgressSummary({ kv, fetchImpl, now: () => Date.parse("2026-10-15T10:41:00.000Z") });

  assert.equal(first, second);
  assert.match(first, /网站进度/);
  assert.match(first, /案例页换成我们自己的样片/);
  assert.match(first, /还没做/);
  assert.match(first, /定价方案还没定/);
  assert.doesNotMatch(first, /#\d+/);
  assert.doesNotMatch(first, /\b[0-9a-f]{7,40}\b/i);
  assert.equal(kv.writes[0].key, "progress:site:20");
  assert.equal(kv.writes[0].options.expirationTtl, 300);
  assert.equal(urls.some((url) => /\/api\/(generate|upload)(?:\?|$)/.test(url)), false);
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
