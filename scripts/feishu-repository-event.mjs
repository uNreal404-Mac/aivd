import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { feishuCode, firstLine, postFeishuWebhook, redactSecrets } from "./feishu-notify.mjs";

function line(value, limit = 220) {
  return firstLine(value).replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/gu, "").slice(0, limit);
}

function refDetails(ref = "") {
  if (ref.startsWith("refs/tags/")) return { kind: "标签", name: ref.slice("refs/tags/".length) };
  if (ref.startsWith("refs/heads/")) return { kind: "分支", name: ref.slice("refs/heads/".length) };
  return { kind: "引用", name: ref };
}

function describePush(event, repoUrl) {
  const { kind, name } = refDetails(event.ref);
  const verb = event.deleted ? "已删除" : event.created ? "已创建" : event.forced ? "已强制推送" : "已更新";
  const titles = (event.commits || []).slice(-3).map(commit => line(commit.message)).filter(Boolean);
  if (!titles.length && event.head_commit) titles.push(line(event.head_commit.message));

  let link = repoUrl;
  if (!event.deleted && event.after && event.before && !event.created) {
    link += `/compare/${encodeURIComponent(event.before)}...${encodeURIComponent(event.after)}`;
  } else if (!event.deleted && event.after) {
    link += `/commit/${encodeURIComponent(event.after)}`;
  }
  return {
    title: `仓库变动 · ${kind}${verb}`,
    ref: `${kind} ${line(name)}`,
    task: !event.deleted && titles.length ? titles.join(" / ") : `${kind} ${line(name)}`,
    status: `${kind}${verb}`,
    link,
  };
}

const prStates = {
  opened: "已创建，待评审", reopened: "已重新打开", synchronize: "已更新提交",
  ready_for_review: "待评审", converted_to_draft: "草稿处理中",
  assigned: "已更新承接人", unassigned: "已更新承接人", edited: "已编辑",
  review_requested: "已请求评审", review_request_removed: "已撤回评审请求",
};

function describeEvent(event, env, repo, repoUrl) {
  switch (env.GITHUB_EVENT_NAME) {
    case "push":
      return describePush(event, repoUrl);
    case "pull_request":
    case "pull_request_target": {
      const pr = event.pull_request;
      const status = event.action === "closed" ? (pr.merged ? "已合并" : "已关闭（未合并）") : pr.draft ? "草稿处理中" : "待评审 / 合并";
      const change = event.action === "closed" ? status : prStates[event.action] || line(event.action);
      const sourceRepo = pr.head.repo?.full_name || "来源仓库未知";
      const source = sourceRepo === repo ? "" : `${line(sourceRepo)} · `;
      const owners = pr.assignees?.map(person => line(person.login)).filter(Boolean) || [];
      return {
        title: `合并请求 #${pr.number} · ${change}`,
        ref: `${source}${line(pr.head.ref)} → ${line(pr.base.ref)}`,
        task: line(pr.title),
        assignee: owners.join("、") || "未分配",
        status,
        link: `${repoUrl}/pull/${pr.number}`,
      };
    }
    case "release": {
      const release = event.release;
      const tag = line(release.tag_name);
      const status = release.prerelease ? "预发布版本已发布" : "正式版本已发布";
      const description = line(release.body?.trim(), 160);
      return { title: `版本发布 · ${tag}`, ref: `标签 ${tag}`, task: [line(release.name) || tag, description].filter(Boolean).join(" · "), status,
        link: `${repoUrl}/releases/tag/${encodeURIComponent(release.tag_name)}` };
    }
    case "workflow_dispatch":
      return { title: "仓库播报 · 连通性测试", ref: line(refDetails(env.GITHUB_REF).name), task: "手动测试 GitHub 到飞书群的播报", status: "测试消息", link: `${repoUrl}/actions/runs/${env.GITHUB_RUN_ID}` };
    default:
      throw new Error("不支持的 GitHub 播报事件");
  }
}

export function repositoryEventCard(event, env) {
  const repo = env.GITHUB_REPOSITORY || event.repository.full_name;
  const repoUrl = `${env.GITHUB_SERVER_URL || "https://github.com"}/${repo}`;
  const detail = describeEvent(event, env, repo, repoUrl);
  const text = [
    `任务：${detail.task}`,
    `承接人：${detail.assignee || "本事件未提供"}`,
    `仓库 / 分支：${repo} · ${detail.ref}`,
    `状态：${detail.status}`,
    `操作人：${line(event.sender?.login || env.GITHUB_ACTOR || "未知")}`,
  ].join("\n");
  return {
    msg_type: "interactive",
    card: {
      header: { title: { tag: "plain_text", content: detail.title } },
      elements: [
        { tag: "div", text: { tag: "plain_text", content: text } },
        { tag: "action", actions: [{ tag: "button", text: { tag: "plain_text", content: "查看 GitHub 记录" }, url: detail.link }] },
      ],
    },
  };
}

export async function sendRepositoryEvent(event, env, fetchImpl = globalThis.fetch) {
  if (!env.FEISHU_WEBHOOK_URL?.trim()) throw new Error("缺少 FEISHU_WEBHOOK_URL，消息未发送");
  const payload = repositoryEventCard(event, env);
  const response = await postFeishuWebhook(payload, { env, fetchImpl });
  if (feishuCode(response.body) !== 0) throw new Error("飞书未返回成功回执");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    await sendRepositoryEvent(event, process.env);
    console.log("飞书已接收仓库播报");
  } catch (error) {
    console.error(redactSecrets(error.message, process.env));
    process.exitCode = 1;
  }
}
