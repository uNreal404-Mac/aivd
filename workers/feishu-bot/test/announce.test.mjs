import test from "node:test";
import assert from "node:assert/strict";
import { pendingItemsWithEta, extractEta, parseHighlights, formatAnnouncement, summarizeHighlights } from "../src/announce.mjs";

test("extractEta", () => {
  assert.deepEqual(extractEta("支付开通（预计 2026-11-01）"), { text: "支付开通", eta: "2026-11-01" });
  assert.deepEqual(extractEta("正式域名还没定"), { text: "正式域名还没定", eta: "" });
  assert.deepEqual(extractEta("上线案例页 截止：11月5日"), { text: "上线案例页", eta: "11月5日" });
});

test("pendingItemsWithEta", () => {
  const result = pendingItemsWithEta("## 卡点\n- [ ] 支付开通 预计：2026-11-01\n- [ ] 正式域名购买");
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { item: "支付还没开通", eta: "2026-11-01" });
  assert.deepEqual(result[1], { item: "正式域名还没定", eta: "待定" });
});

test("parseHighlights", () => {
  assert.deepEqual(parseHighlights("1. 新增A\n- 新增B\n\n• 新增C"), ["新增A", "新增B", "新增C"]);
});

test("formatAnnouncement", () => {
  const announcement = formatAnnouncement({
    header: "项目更新",
    highlights: ["新增登录", "支持支付"],
    pending: [
      { item: "支付开通", eta: "2026-11-01" },
      { item: "正式域名", eta: "待定" }
    ],
    link: "https://example.com"
  });

  assert.match(announcement, /项目更新\n\n本次重点：\n• 新增登录\n• 支持支付\n\n还没完成（预计完成时间）：\n• 支付开通（2026-11-01）\n• 正式域名（待定）\n\nhttps:\/\/example.com/);

  const announcementNoPending = formatAnnouncement({
    header: "项目更新",
    highlights: ["新增登录", "支持支付"],
    link: "https://example.com"
  });

  assert.match(announcementNoPending, /项目更新\n\n本次重点：\n• 新增登录\n• 支持支付\n\nhttps:\/\/example.com/);
});

test("summarizeHighlights", async () => {
  // Test 1: LLM call succeeds
  const result1 = await summarizeHighlights({
    llm: { timeoutMs: 1000 },
    completeChat: async () => "- 新增登录\n- 支持支付",
    title: "标题A",
    body: "Some body text"
  });
  assert.deepEqual(result1, ["新增登录", "支持支付"]);

  // Test 2: LLM call throws error
  const result2 = await summarizeHighlights({
    llm: { timeoutMs: 1000 },
    completeChat: async () => { throw new Error("LLM HTTP error"); },
    title: "标题A",
    body: "Some body text"
  });
  assert.deepEqual(result2, ["标题A"]);

  // Test 3: llm is null
  const result3 = await summarizeHighlights({
    llm: null,
    completeChat: async () => "- 新增登录\n- 支持支付",
    title: "标题A",
    body: "Some body text"
  });
  assert.deepEqual(result3, ["标题A"]);
});
