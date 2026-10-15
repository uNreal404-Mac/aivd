import assert from "node:assert/strict";
import test from "node:test";
import { formatCommentSummary, formatTaipeiDate, keyLines, stripMarkdown } from "../src/summary.mjs";

test("strips markdown, links, commit hashes, and fenced code from partner-facing text", () => {
  const raw = [
    "## 更新",
    "PR [#21](https://github.com/CharlesHarry7/dreamutopia-clone/pull/21) 已合并（6f3fe2a）。",
    "```js",
    "fetch('/api/generate')",
    "```",
    "详见 https://example.com/secret 和 `wrangler.toml`。",
    "![img](https://img.example/a.png)",
  ].join("\n");

  const stripped = stripMarkdown(raw);
  assert.doesNotMatch(stripped, /```/);
  assert.doesNotMatch(stripped, /https?:\/\//i);
  assert.doesNotMatch(stripped, /6f3fe2a/);
  assert.doesNotMatch(stripped, /\/api\/generate/);
  assert.match(stripped, /PR #21 已合并/);
  assert.doesNotMatch(stripped, /wrangler\.toml/);
});

test("keeps a short key line and drops empty or decoration-only lines", () => {
  const lines = keyLines("# 标题\n\n---\n\n健康检查通过。\n第二行补充费用边界。\n第三行不应出现。", 2);
  assert.deepEqual(lines, ["健康检查通过。", "第二行补充费用边界。"]);
});

test("formats timestamps in Asia/Taipei without using an LLM", () => {
  assert.equal(formatTaipeiDate("2026-10-15T10:41:00.000Z"), "2026-10-15 18:41");
});

test("builds a short Chinese summary from the latest comments", () => {
  const summary = formatCommentSummary([
    {
      user: { login: "old-user" },
      created_at: "2026-10-01T00:00:00.000Z",
      body: "很早以前的评论，不应出现在最近五条之外。",
    },
    {
      user: { login: "cursor[bot]" },
      created_at: "2026-10-15T10:00:00.000Z",
      body: "PR #21 已合并（6f3fe2a），`/api/history` 恢复 JSON。\nhttps://github.com/x/y",
    },
    {
      user: { login: "partner" },
      created_at: "2026-10-15T12:00:00.000Z",
      body: "定价方案待确认汇率。",
    },
  ], { issueNumber: 20, limit: 2, now: Date.parse("2026-10-15T12:00:00.000Z") });

  assert.match(summary, /项目进度（台北时间 2026-10-15 20:00）/);
  assert.match(summary, /cursor\[bot\]/);
  assert.match(summary, /PR #21 已合并/);
  assert.match(summary, /定价方案待确认汇率/);
  assert.doesNotMatch(summary, /很早以前的评论/);
  assert.doesNotMatch(summary, /6f3fe2a/);
  assert.doesNotMatch(summary, /https?:\/\//i);
});

test("uses a plain fallback when comments have no readable text", () => {
  const summary = formatCommentSummary([
    { user: { login: "bot" }, created_at: "2026-10-15T10:41:00.000Z", body: "```\ncode only\n```" },
  ], { issueNumber: 20, now: Date.parse("2026-10-15T10:41:00.000Z") });

  assert.match(summary, /台北时间 2026-10-15 18:41/);
  assert.match(summary, /#20/);
  assert.match(summary, /没有可展示/);
});
