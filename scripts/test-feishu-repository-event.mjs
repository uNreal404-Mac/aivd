import assert from "node:assert/strict";
import test from "node:test";
import { repositoryEventCard, sendRepositoryEvent } from "./feishu-repository-event.mjs";

const common = { GITHUB_REPOSITORY: "org/site", GITHUB_ACTOR: "operator" };
function render(type, event, env = {}) {
  const { card } = repositoryEventCard(event, { ...common, GITHUB_EVENT_NAME: type, ...env });
  assert.equal(card.elements[0].text.tag, "plain_text");
  return { text: card.elements[0].text.content, url: card.elements[1].actions[0].url };
}

test("push shows actual branch, commit headlines and compare link", () => {
  const result = render("push", {
    ref: "refs/heads/feature/prompt", before: "abc", after: "def",
    commits: [{ message: "修复提交\n未公开正文" }, { message: "调整图片入口" }],
  });
  assert.match(result.text, /org\/site · 分支 feature\/prompt/);
  assert.match(result.text, /修复提交 \/ 调整图片入口/);
  assert.doesNotMatch(result.text, /未公开正文/);
  assert.match(result.text, /承接人：本事件未提供/);
  assert.match(result.text, /操作人：operator/);
  assert.equal(result.url, "https://github.com/org/site/compare/abc...def");
});

test("force pushes, ref creation and deletion have distinct statuses", () => {
  assert.match(render("push", { ref: "refs/heads/bug", forced: true }).text, /分支已强制推送/);
  assert.match(render("push", { ref: "refs/tags/v2", created: true }).text, /标签已创建/);
  assert.equal(render("push", { ref: "refs/tags/v2", deleted: true }).url, "https://github.com/org/site");
  assert.match(render("push", { ref: "refs/heads/bug", deleted: true }).text, /分支已删除/);
});

const pr = { number: 5, title: "编辑 *图片* <at id=all>", assignees: [{ login: "dev" }], head: { repo: { full_name: "fork/site" }, ref: "improve" }, base: { ref: "main" } };
test("PR events distinguish fork, assignee, operator, draft, close and merge", () => {
  const opened = render("pull_request_target", { action: "opened", pull_request: { ...pr, draft: true } });
  assert.match(opened.text, /fork\/site · improve → main/);
  assert.match(opened.text, /状态：草稿处理中/);
  assert.match(opened.text, /编辑 \*图片\* <at id=all>/);
  assert.match(opened.text, /承接人：dev/);
  assert.equal(opened.url, "https://github.com/org/site/pull/5");
  const closed = render("pull_request_target", { action: "closed", pull_request: { ...pr, merged: false, assignees: [] } });
  assert.match(closed.text, /承接人：未分配/);
  assert.match(closed.text, /已关闭（未合并）/);
  assert.match(render("pull_request_target", { action: "closed", pull_request: { ...pr, merged: true } }).text, /状态：已合并/);
});

test("release and manual test use their own details and links", () => {
  const version = render("release", { release: { tag_name: "v2", name: "图片生成", body: "支持提示词草稿\n更新说明" } });
  assert.match(version.text, /正式版本已发布/);
  assert.match(version.text, /支持提示词草稿/);
  assert.equal(version.url, "https://github.com/org/site/releases/tag/v2");
  const manual = render("workflow_dispatch", {}, { GITHUB_REF: "refs/heads/main", GITHUB_RUN_ID: "7" });
  assert.match(manual.text, /org\/site · main/);
  assert.equal(manual.url, "https://github.com/org/site/actions/runs/7");
});

test("Feishu nonzero / absent receipt and missing webhook fail; signed zero receipt passes", async () => {
  const env = { ...common, GITHUB_EVENT_NAME: "push", FEISHU_WEBHOOK_URL: "https://example.invalid", FEISHU_WEBHOOK_SECRET: "test" };
  const event = { ref: "refs/heads/main" };
  await assert.rejects(sendRepositoryEvent(event, { ...env, FEISHU_WEBHOOK_URL: "" }), /缺少/);
  for (const response of ['{"code":100}', '{}', 'not-json']) {
    await assert.rejects(sendRepositoryEvent(event, env, async () => new Response(response)));
  }
  await sendRepositoryEvent(event, env, async (_url, request) => {
    const body = JSON.parse(request.body);
    assert.ok(body.sign);
    assert.equal(body.msg_type, "interactive");
    return new Response('{"StatusCode":0}');
  });
});
