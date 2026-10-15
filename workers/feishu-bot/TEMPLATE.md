# 复制一个新的角色机器人

本目录是可复制的飞书角色机器人模板：命令、数据源和回复格式都在配置里，不写死在路由中。新机器人只应改配置和文案，不要接入付费 LLM、KIE、`/api/generate` 或 `/api/upload`。

## 目录

```text
workers/feishu-bot/
  wrangler.toml          Worker 名、Free 计划、BOT_KV
  README.md              本实例的密钥与飞书 / GitHub 开通步骤
  TEMPLATE.md            本文件
  src/config.mjs         命令表、GitHub 仓库、署名、allowedChatIds —— 复制后先改这里
  src/worker.mjs         路由：POST /feishu/events 与 POST /github/webhook
  src/commands.mjs       按 config.commands 解析「进度 / 网址 / 健康 / 需求」
  src/summary.mjs        规则摘要（去 Markdown、链接、提交哈希，台北时间）
  src/site-progress.mjs  网站进度：页面规则、还没做、去掉 PR 号 / SHA
  src/github.mjs         GitHub REST 与 webhook HMAC
  src/progress.mjs       网站进度数据 + KV 短缓存
  src/requests.mjs       需求建单、映射、关闭回帖、去重限流
  src/events.mjs         飞书回调解码与是否 @ 本机器人
  src/feishu-api.mjs     token、回复、发群
  src/health.mjs         固定 /api/health
  src/security.mjs       飞书签名与可选解密
  src/dedupe.mjs         飞书 event_id / message_id 标记
  test/                  Node 内置测试，网络全部注入 mock
```

## 命令配置

`src/config.mjs` 里每一项是：

| 字段 | 含义 |
| --- | --- |
| `name` | `parseCommand` 返回值，Worker 用来选数据源 |
| `match` | `prefix`（如 `需求：`）或 `pattern`（正则片段，如 `进度`） |
| `prefixes` / `pattern` | 匹配文本 |
| `source` | `github-website-progress` / `static` / `health-http` / `github-create-issue` |
| `formatter` | `websiteProgress` / `static` / `healthSummary` / `issueCreatedReply` |

新增命令时：在 `commands` 数组里加一项，再在 `src/worker.mjs` 的 `commandReply` 中接上对应 source。不要在命令处理里调用模型 API。

## 复制步骤

1. 复制整个 `workers/feishu-bot/` 为 `workers/<new-bot>/`。
2. 修改 `wrangler.toml` 的 `name`，并创建**新的** KV namespace（不要复用 `feishu-bot` 的 ID）。
3. 编辑 `src/config.mjs`：`name`、`signature`、`allowedChatIds`、`siteUrl`、`healthUrl`、`github.owner/repo/progressIssueNumber/requestLabel`、命令列表。复制实例默认署名在 `DEFAULT_SIGNATURE` / `botConfig.signature`，出站文案经 `signOutboundText` 追加；改 `signature` 即可覆盖，不要把「老三」写进用户可见回复。
4. 如需改帮助/兜底进度文案，编辑 `src/commands.mjs` 的 `HELP_MESSAGE` 与 `PROGRESS_MESSAGE`（署名仍走 `config.signature`，不要手写进每条模板）。
5. `allowedChatIds`（或环境变量 `ALLOWED_CHAT_IDS`，逗号分隔）是 **需求** 建公开 GitHub issue 的白名单。未设置或为空时 **失败关闭**，未知群 `chat_id` 一律拒绝。合入后由运营把合作方群 id 填进去；提出人、`open_id`、`chat_id` 只进 KV，不进公开 issue。
6. 复制 `README.md` 开通步骤，换成新 Worker 的 `workers.dev` 主机名和飞书应用。
7. 在 Cloudflare 只设置该 Worker 自己的 secrets（见 README 表格）。密钥不要进 git。`ALLOWED_CHAT_IDS` 不是 secret，可用 `[vars]` 或 `config.allowedChatIds`。
8. 跑 `node --test test/*.test.mjs`。为新命令补 mock 测试，不要对真实 GitHub / 飞书发网。
9. `npx wrangler deploy`，再按 README 配飞书事件订阅和（如需要）GitHub webhook。

## 硬限制

- 仅 Workers Free + KV + `workers.dev`。
- 不添加 Cron、Queues、Durable Objects、Workers AI、自定义域名。
- 不设置、不读取、不修改 `GENERATION_ENABLED`。
- 飞书 Encrypt Key 可空：未配置时走明文事件；配置后才验签/解密。
