import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PENDING_ITEMS,
  ISSUE_REF_PATTERN,
  SHA_PATTERN,
  STATIC_PROGRESS_MESSAGE,
  buildProgressFromGithub,
  describePendingItem,
  describeUserVisibleChange,
  describeUserVisibleChanges,
  extractPendingRaw,
  formatWebsiteProgress,
  hasTrackerTokens,
  pageFromPath,
  pagesFromFiles,
  pendingItemsFromGithub,
  stripTrackerTokens,
} from "../src/site-progress.mjs";

function assertClean(text, label = "progress text") {
  assert.equal(typeof text, "string", label);
  assert.doesNotMatch(text, /#\d+/, `${label} must not contain #\d+ refs`);
  assert.doesNotMatch(text, /\b[0-9a-f]{7,40}\b/i, `${label} must not contain commit SHAs`);
  assert.doesNotMatch(text, /\b(?:cursor|codex|origin)\//, `${label} must not contain branch names`);
  assert.equal(hasTrackerTokens(text), false, `${label} must pass hasTrackerTokens`);
}

test("maps public site paths to partner-facing page names", () => {
  assert.equal(pageFromPath("out/examples.html"), "案例页");
  assert.equal(pageFromPath("out/examples/rain-couple.html"), "案例页");
  assert.equal(pageFromPath("out/pricing.html"), "定价页");
  assert.equal(pageFromPath("out/workspace.html"), "生成页");
  assert.equal(pageFromPath("out/index.html"), "首页");
  assert.equal(pageFromPath("workers/feishu-bot/src/worker.mjs"), "");
  assert.deepEqual(
    pagesFromFiles(["out/examples.html", "libs/examples.ts", "out/workspace.html"]),
    ["案例页", "生成页"],
  );
});

test("describes user-visible changes in plain Chinese from files and titles", () => {
  assert.equal(
    describeUserVisibleChange({
      title: "Public /examples sample pages from existing HD clips (#20) (#34)",
      files: ["out/examples.html", "out/examples/rain-couple.html", "libs/examples.ts"],
    }),
    "案例页换成我们自己的样片",
  );
  assert.equal(
    describeUserVisibleChange({
      title: "feat: frontend-only workspace demo mode",
      files: ["out/workspace.html", "out/demo.html"],
    }),
    "生成页可以用现成片子试看效果",
  );
  assert.equal(
    describeUserVisibleChange({
      title: "feat: noindex /partners progress card for film/TV clients (#20)",
      files: ["out/partners.html"],
    }),
    "合作页加了给影视客户看的进度说明",
  );
});

test("skips internal-only Feishu/bot changes that users cannot see on the site", () => {
  assert.equal(
    describeUserVisibleChange({
      title: "feat: add Feishu custom-bot webhook notifications (#37)",
      files: ["scripts/feishu-notify.mjs", ".github/workflows/feishu-notify.yml"],
    }),
    "",
  );
  assert.deepEqual(
    describeUserVisibleChanges({
      title: "Bind Feishu bot KV namespace",
      files: ["workers/feishu-bot/wrangler.toml"],
    }),
    [],
  );
});

test("strips PR numbers, SHAs, and branch names from any leftover copy", () => {
  const stripped = stripTrackerTokens("PR #21 已合并（6f3fe2a）on cursor/examples-public-samples-66d6 (#34)");
  assert.doesNotMatch(stripped, ISSUE_REF_PATTERN);
  assert.doesNotMatch(stripped, SHA_PATTERN);
  assert.doesNotMatch(stripped, /cursor\//);
  assert.equal(hasTrackerTokens("案例页换成我们自己的样片"), false);
  assert.equal(hasTrackerTokens("见 #20 和 7edc5db"), true);
});

test("maps issue checklist and open PRs into 还没做 lines without tracker tokens", () => {
  const issueBody = [
    "不混进 ZCV（#17）。",
    "## 任务",
    "- [ ] 评审并合并 PR #13、#16（生成接口不再 1101，history JSON）",
    "- [ ] 评审 PR #15（P0 UX）",
    "- [ ] 决定 PR #14（迁移到 Next.js + shadcn）合并还是搁置",
    "- [ ] 新定价方案（1 积分≈$0.01）",
    "- [ ] 定域名",
    "- [ ] 飞书团队同步（合伙人 cou、mac 入群）",
    "- [x] 已完成的不算",
    "## 卡点（需老板）",
    "- 支付：Stripe Dashboard 密钥，国内支付渠道",
  ].join("\n");

  assert.ok(extractPendingRaw(issueBody).some((item) => item.includes("定域名")));
  assert.equal(describePendingItem("定域名"), "正式域名还没定");
  assert.equal(describePendingItem("Bind Feishu bot KV namespace"), "");

  const pending = pendingItemsFromGithub({
    issueBody,
    openPulls: [
      { title: "Bind Feishu bot KV namespace" },
      { title: "fix: generate worker_exception JSON (never 1101); real history/jobs/creations files" },
      { title: "fix: P0 Pages UX — auth dialog, human errors, credits skeleton, gallery empty" },
    ],
  });
  assert.ok(pending.includes("定价方案还没定"));
  assert.ok(pending.includes("正式域名还没定"));
  assert.ok(pending.includes("支付还没开通"));
  assert.ok(pending.includes("生成失败时页面提示还不稳"));
  assert.ok(pending.includes("登录和积分显示还要再改"));
  assert.ok(pending.includes("整站改版方案还没定"));
  assert.equal(pending.some((item) => /飞书|入群/.test(item)), false);
  for (const item of pending) assertClean(item, item);
});

test("renders 网站进度 with 还没做 and at most one 详情 link", () => {
  const text = formatWebsiteProgress({
    doneItems: ["案例页换成我们自己的样片", "见 PR #34 和 1c5dd76"],
    pendingItems: ["定价方案还没定", "还要看 #20"],
    detailUrl: "https://dreamutopia-clone.pages.dev",
  });
  assert.match(text, /^网站进度/m);
  assert.match(text, /案例页换成我们自己的样片/);
  assert.match(text, /还没做/);
  assert.match(text, /定价方案还没定/);
  assert.equal((text.match(/详情/g) || []).length, 1);
  assert.equal((text.match(/https?:\/\//g) || []).length, 1);
  assertClean(text);
});

test("buildProgressFromGithub uses merged PR titles and checklist, never tracker tokens", () => {
  const text = buildProgressFromGithub({
    issueBody: "## 任务\n- [ ] 新定价方案\n- [ ] 定域名\n## 卡点\n- 支付：Stripe",
    mergedPulls: [
      { title: "Public /examples sample pages from existing HD clips (#20) (#34)", labels: [] },
      { title: "feat(feishu-bot): 署名三儿 + 公开 issue 脱敏 (#41)", labels: [] },
    ],
    openPulls: [{ title: "Bind Feishu bot KV namespace" }],
    detailUrl: "https://dreamutopia-clone.pages.dev",
  });
  assert.match(text, /案例页换成我们自己的样片/);
  assert.doesNotMatch(text, /脱敏/);
  assert.match(text, /还没做/);
  assert.match(text, /定价方案还没定/);
  assertClean(text);
});

test("static fallback copy is partner-facing and tracker-free", () => {
  assert.match(STATIC_PROGRESS_MESSAGE, /^网站进度/m);
  assert.match(STATIC_PROGRESS_MESSAGE, /还没做/);
  assert.equal((STATIC_PROGRESS_MESSAGE.match(/详情/g) || []).length, 1);
  for (const item of DEFAULT_PENDING_ITEMS) {
    assert.match(STATIC_PROGRESS_MESSAGE, new RegExp(item));
  }
  assertClean(STATIC_PROGRESS_MESSAGE);
});
