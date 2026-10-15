# 飞书项目机器人 Worker

这是独立的 Cloudflare Worker，与仓库根目录的 Pages 配置分开部署。机器人只响应私聊文本和群聊中明确 @ 它的文本。

| 命令 | 行为 |
| --- | --- |
| 进度 | 读取本仓库 GitHub issue `#20` 最近几条评论，用规则模板整理成简体中文摘要（台北时间），写入 KV 短缓存 |
| 网址 | 返回演示站 `https://dreamutopia-clone.pages.dev` |
| 健康 | GET 固定地址 `/api/health`，返回 HTTP 状态和选定布尔字段 |
| 需求： / 需求: | 仅白名单群可建单：群 `chat_id` 必须在 `config.allowedChatIds` 或环境变量 `ALLOWED_CHAT_IDS` 中。未设置或为空时 **失败关闭**。通过后在本仓库创建带 `feishu-request` 标签的 GitHub issue（正文已脱敏，不含提出人 / `open_id` / `chat_id`），并在原消息线程回复链接。映射只写 KV。issue 关闭后通过 GitHub webhook 回帖 |

所有飞书出站回复（进度 / 网址 / 健康 / 需求 / 关单 / 帮助）以及仓库根目录的部署/验收卡片，统一署名为 `Grok Bot · AI视频项目专属机器人 三儿`（`botConfig.signature`，复制角色机器人时可覆盖）。用户可见出站文案不得出现「老三」。

其他内容返回帮助说明。命令名称、数据源和格式化器在 `src/config.mjs` 配置，复制新角色机器人见 [TEMPLATE.md](TEMPLATE.md)。合入 `main` 或验收结果的**出站群通知**走群自定义机器人 webhook，见仓库根 README 的「飞书群通知」一节，不经过本 Worker。

机器人不会调用生成、上传、KIE 或任何付费 LLM。进度摘要不用模型，只用去 Markdown / 链接 / 提交哈希后的固定中文模板。

未配置 `FEISHU_ENCRYPT_KEY` 时，按飞书未启用事件加密处理明文回调。以后若重新打开加密，再设置该 secret，Worker 会恢复签名校验与解密。

Worker 将回调请求体限制在 1 MiB。飞书事件路径把读 body、外部请求和 KV 合计限制在 2.5 秒内；健康请求最多 700 毫秒。GitHub webhook 路径单独限 8 秒。外部依赖超过时限时返回可重试错误。

## 费用边界

- 账号必须使用 Cloudflare Workers Free。部署前在 Cloudflare 账单／Workers 计划设置中确认当前账号没有启用 Workers Paid；不确定时先不要部署。
- 本配置只使用 Workers Free、Workers KV 与 `workers.dev` 地址，不添加付费绑定、自定义域名、AI 服务或定时任务。issue 关闭通知用免费的 GitHub webhook，不用 Cron。
- Free 计划有每日请求和 KV 用量上限（含 KV 每日约 1000 次写入）；超限可能导致请求失败。不要升级计划来恢复服务。请查看 [Cloudflare Workers 定价与免费额度](https://developers.cloudflare.com/workers/platform/pricing/) 的当前规则。

## 密钥（只放 Wrangler / Actions，不要写入代码、日志或 PR 正文）

| 名称 | 是否必须 | 用途与范围 |
| --- | --- | --- |
| `FEISHU_APP_ID` | 必须 | 飞书自建应用 App ID，用来换 `tenant_access_token` |
| `FEISHU_APP_SECRET` | 必须 | 飞书 App Secret，与 App ID 一起换 token |
| `FEISHU_VERIFICATION_TOKEN` | 必须 | 校验飞书 URL Verification 与事件 `header.token` |
| `FEISHU_ENCRYPT_KEY` | 可选 | 飞书事件 Encrypt Key。当前飞书侧加密已关闭，**不要设置**。以后若开启加密，再 `wrangler secret put` 同一把密钥 |
| `GITHUB_TOKEN` | 需求命令必须；进度命令可选 | 细粒度 PAT，**仅本仓库** `CharlesHarry7/dreamutopia-clone`。权限：Issues **Read and write**。进度可读公开评论 API；没有 token 时进度仍走公开接口。创建/关单回帖需要写权限 |
| `GITHUB_WEBHOOK_SECRET` | 使用关闭回帖时必须 | GitHub webhook 的 HMAC 密钥，校验 `X-Hub-Signature-256`。请用高熵随机串，与 GitHub webhook Secret 填同一值 |
| `ALLOWED_CHAT_IDS` | **需求** 必须（合入后由运营填写） | 允许提交需求的飞书群 `chat_id`，逗号分隔。也可写在 `src/config.mjs` 的 `allowedChatIds`。未设置或为空时拒绝所有需求建单。这不是 secret，不要把真实群 id 以外的密钥写进仓库 |

不要把飞书 / GitHub secrets 写进 `wrangler.toml`、`.dev.vars`、仓库文件、命令参数或 pull request。`ALLOWED_CHAT_IDS` 可以放在 Worker `[vars]` 或 `config.mjs`。

## 本地测试和开发

需要 Node.js 22 或更新版本，以及 Wrangler。纯单元测试不需要 Cloudflare 登录、飞书凭据、GitHub 凭据或网络请求：

```bash
cd workers/feishu-bot
node --test test/*.test.mjs
```

配置 KV 命名空间后，可用 Wrangler 本地运行：

```bash
npx wrangler dev
```

没有 Wrangler secrets 的本地 Worker 会对回调返回未配置状态；不要为本地调试把凭据写入 `.dev.vars`、仓库文件或 shell 命令参数。

## 部署到 Workers Free

以下命令都在 `workers/feishu-bot/` 目录运行。先确认 Wrangler 登录的是目标账号，并已确认 Workers Free 计划。

1. 创建专用 KV 命名空间：

   ```bash
   npx wrangler kv namespace create feishu-bot
   ```

2. 将命令输出的 namespace ID 填入本目录 `wrangler.toml` 的 `BOT_KV` 绑定，替换示例 ID。不要改仓库根目录 Pages 的 `wrangler.toml`。

3. 逐项运行以下命令。Wrangler 会提示输入值；只在提示中粘贴，不要把值放到命令参数、文件、日志或 PR 中：

   ```bash
   npx wrangler secret put FEISHU_APP_ID
   npx wrangler secret put FEISHU_APP_SECRET
   npx wrangler secret put FEISHU_VERIFICATION_TOKEN
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler secret put GITHUB_WEBHOOK_SECRET
   ```

   不要运行 `FEISHU_ENCRYPT_KEY`，除非飞书开放平台重新启用了事件加密。

4. 发布 Worker：

   ```bash
   npx wrangler deploy
   ```

   Wrangler 会给出 `workers.dev` 主机名。两个回调地址为：

   ```text
   https://feishu-bot.<account-subdomain>.workers.dev/feishu/events
   https://feishu-bot.<account-subdomain>.workers.dev/github/webhook
   ```

## 飞书开放平台配置（三儿）

在飞书开放平台的自建应用中完成以下设置，并发布一个应用版本。当前加密已关闭，保持关闭即可。

1. 启用机器人能力。
2. 事件订阅：填写 `https://feishu-bot.<account-subdomain>.workers.dev/feishu/events`，保存并通过 URL Verification。订阅 `im.message.receive_v1`。
3. 事件订阅页确认 **Encrypt Key / 事件加密为关闭**。不要再生成 Encrypt Key。若以后打开加密，再把同一密钥写入 `FEISHU_ENCRYPT_KEY`。
4. 申请并在应用版本中启用这些权限：
   - `im:message`
   - `im:message.group_at_msg`
   - `im:message:send_as_bot`
   - 如果飞书权限面板把私聊接收权限单独列出，再申请 `im:message.p2p_msg`
5. 将应用版本提交发布，确认机器人对测试用户可见，并已加入要收集需求的群聊。群里只有 @ 到此应用本人才会回复；群里的 `需求：` 也必须 @ 机器人。
6. **合入后必须设置合作方群 id**：把该群的 `chat_id` 写入 `ALLOWED_CHAT_IDS` 或 `config.allowedChatIds`。未设置时需求命令失败关闭，不会创建公开 issue。

## GitHub 配置（三儿）

1. 在本仓库创建标签 `feishu-request`（Issues → Labels）。没有该标签时，Worker 会退化为不带标签建 issue。
2. 创建 **fine-grained personal access token**：
   - Resource owner / Repository：仅 `CharlesHarry7/dreamutopia-clone`
   - Repository permissions：Issues = **Read and write**
   - 不要勾选 Contents 或其他仓库权限
   - 写入 Wrangler secret `GITHUB_TOKEN`（不要提交到仓库）
3. 仓库 **Settings → Webhooks → Add webhook**：
   - Payload URL：`https://feishu-bot.<account-subdomain>.workers.dev/github/webhook`
   - Content type：`application/json`
   - Secret：与 `GITHUB_WEBHOOK_SECRET` 相同的随机串
   - SSL verification：Enable
   - Which events：Let me select individual events → 勾选 **Issues**（关闭 issue 时会收到 `issues` + `action=closed`）
   - Active：勾选

Worker 用 KV 记录 issue 号与飞书 `chat_id` / `message_id` / 提出人的对应关系（**不写入公开 issue 标题或正文**）。公开 issue 会脱敏手机号、邮箱和金额。用 GitHub `X-GitHub-Delivery` 以及飞书 `event_id` / `message_id` 做去重。同一用户 60 秒内重复提交 `需求：` 会被限流。Workers KV 最终一致，不承诺并发下严格 exactly-once。
