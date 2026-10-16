# 飞书项目机器人 Worker

这是独立的 Cloudflare Worker，与仓库根目录的 Pages 配置分开部署。机器人只响应私聊文本和群聊中明确 @ 它的文本。

| 命令 | 行为 |
| --- | --- |
| 进度 | 读取本仓库最近合并的改动、公开待办（主任务卡未完成项 / 未合并的网站 PR），用规则整理成「网站进度」摘要：用户能在站点上看到的变化 + 页面 + 「还没做」。不写 PR 号、提交 SHA 或分支名。写入 KV 短缓存 |
| 网址 | 返回演示站 `https://dreamutopia-video.pages.dev` |
| 健康 | GET 固定地址 `/api/health`，返回 HTTP 状态和选定布尔字段 |
| 需求： / 需求: | 仅白名单群可建单：群 `chat_id` 必须在 `config.allowedChatIds` 或环境变量 `ALLOWED_CHAT_IDS` 中。未设置或为空时 **失败关闭**。通过后在本仓库创建带 `feishu-request` 标签的 GitHub issue（正文已脱敏，不含提出人 / `open_id` / `chat_id`），并在原消息线程回复链接。映射只写 KV。issue 关闭后通过 GitHub webhook 回帖 |
| 其他 @ / 私聊文本 | **默认关闭**。仅当同时配置 `LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY` 且会话在白名单内时，才把未识别文本发给 OpenAI 兼容 chat；否则仍返回帮助说明 |

所有飞书出站回复（进度 / 网址 / 健康 / 需求 / 关单 / 帮助）以及仓库根目录的部署/验收卡片，统一署名为 `Grok Bot · AI视频项目专属机器人 老三`（`botConfig.signature`，复制角色机器人时可覆盖）。用户可见出站文案不得出现「三儿」。需求回复还会提醒「将公开到 GitHub，请勿写客户名、联系方式和报价」。

转发群 oc_ff147ab4f0cf2288fe99fda95e9e54ad 只转发、不回复任何内容（含进度/网址/健康/需求，不调模型）。

未配置可选 LLM 时，其他内容返回帮助说明。「进度 / 网址 / 健康 / 需求」始终走规则，不经过模型。命令名称、数据源和格式化器在 `src/config.mjs` 配置，复制新角色机器人见 [TEMPLATE.md](TEMPLATE.md)。合入 `main` 或验收结果的**出站群通知**走群自定义机器人 webhook，见仓库根 README 的「飞书群通知」一节，不经过本 Worker。

机器人不会调用生成、上传或 KIE。进度摘要不用模型。可选 LLM **默认关闭**；缺任一配置项时不发网络请求。开启后仍只允许白名单会话，出站会去掉 `#数字` / 提交哈希并做隐私脱敏，再署名为老三。

未配置 `FEISHU_ENCRYPT_KEY` 时，按飞书未启用事件加密处理明文回调。以后若重新打开加密，再设置该 secret，Worker 会恢复签名校验与解密。

Worker 将回调请求体限制在 1 MiB。飞书事件路径把读 body、外部请求和 KV 合计限制在 2.5 秒内；健康请求最多 700 毫秒。GitHub webhook 路径单独限 8 秒。外部依赖超过时限时返回可重试错误。

## Resend 重试队列（Cron Trigger）

转发群消息通过 Resend 发信。首次 3 次尝试（0s / 1s / 3s 退避）全部失败时不再丢弃消息：Worker 把 `{ messageId, body, attempts, firstFailedAt, lastStatus, nextAttemptAt }` 写入 KV 待发队列（前缀 `feishu:resend:pending:`，TTL 7 天），把该消息的去重键改成 `pending` 标记（同样 7 天），并写下队列标记 `feishu:resend:__has_pending`（同样 7 天），因此飞书重投不会再发一次；`nextAttemptAt` 首次为「当前时间 + 10 分钟」，队列至少 10 分钟后才会第一次重试。首次与重试请求都带 `Idempotency-Key: feishu-forward-<message_id>`，由 Resend 侧去重。写待发记录失败时退回旧行为（删除去重键）。`forwardToGrok()` 返回 `{ ok, attempts, status, queued }`。

`wrangler.toml` 的 `[triggers] crons = ["*/10 * * * *"]` 每 10 分钟触发一次 `scheduled()`，调用 `retryPendingForwards()`（每次最多 `CRON_BATCH_LIMIT = 20` 条）：

- 队列标记 `feishu:resend:__has_pending` 不存在 → 直接返回全零，连 `kv.list` 都不调。
- 记录的 `nextAttemptAt` 还没到 → 跳过，不写任何 KV（等下一轮）。
- 去重键已是 `1`（已发送）或 `failed`（已放弃）→ 删除待发记录，跳过。
- 去重键是 `sending`（有请求在途）→ 跳过，保留待发记录。
- 去重键已经是 `pending` 时不再改写它；否则先用 `sending` 占位（TTL `CRON_SENDING_TTL_SECONDS = 900` 秒，长于 10 分钟间隔），再用原 JSON body 重发一次（超时 8 秒）。
- 成功 → 去重键写 `1`（7 天），删除待发记录。
- 失败 → 待发记录 `attempts + 1`、`lastStatus` 更新、`nextAttemptAt = now + PENDING_BACKOFF_MS[...]`（10 分钟 / 30 分钟 / 2 小时，之后都按 2 小时）。这条路径只写 1 条 KV（待发记录本身）；只有上面真的把去重键改成 `sending` 时才会多写 1 次把去重键还原成 `pending`。
- `attempts` 达到 `MAX_PENDING_ATTEMPTS = 8`（本轮失败后刚好到 8，或读到时就已 ≥ 8）→ 删除待发记录，去重键写 `failed`（7 天），这条消息不会再发。
- 返回 `{ scanned, sent, failed, skipped, gaveUp }`，每条记录打印一行 `[feishu-forward-cron] message_id=.. status=.. attempts=.. result=sent|failed|skipped|gave_up`。
- 一轮里列出的记录全部被清空（`list_complete`）时删除 `__has_pending` 标记，之后队列为空时不再 `kv.list`。

未配置 `RESEND_API_KEY` 或 `BOT_KV` 时 `retryPendingForwards()` 直接返回全零，不发任何请求。

## 费用边界

- 账号必须使用 Cloudflare Workers Free。部署前在 Cloudflare 账单／Workers 计划设置中确认当前账号没有启用 Workers Paid；不确定时先不要部署。
- 本配置只使用 Workers Free、Workers KV、Workers Cron Trigger 与 `workers.dev` 地址，不添加付费 Cloudflare 绑定、自定义域名或 Workers AI。Cron Trigger 只用于重试转发失败的邮件（每 10 分钟最多一次、每次最多 `CRON_BATCH_LIMIT` 条），仍计入 Free 计划的每日请求与 KV 写入额度。issue 关闭通知用免费的 GitHub webhook，不用 Cron。可选 LLM 走你自己的 OpenAI 兼容接口，**默认不调用**；启用后的模型费用由该接口的运营方承担，本仓库不代为开通。
- Free 计划有每日请求和 KV 用量上限（含 KV 每日约 1000 次写入）；超限可能导致请求失败。不要升级计划来恢复服务。请查看 [Cloudflare Workers 定价与免费额度](https://developers.cloudflare.com/workers/platform/pricing/) 的当前规则。

### KV 用量估算（Workers Free：1000 次写入/天、1000 次 `list`/天）

假设每天最多 30 条消息转发彻底失败进入重试队列，每条最多重试 `MAX_PENDING_ATTEMPTS = 8` 次：

- Cron 每 10 分钟一次 → 144 轮/天。
- 队列为空：每轮只 `kv.get(feishu:resend:__has_pending)` 一次 → 约 144 次读、0 次 `list`、0 次写入。
- 队列非空：`list` 调用 ≤ 144 次/天（远低于 1000）。
- 单条失败消息的写入上限：入队 3 次（队列标记 + 待发记录 + 去重键）+ 每次重试 ≤ 3 次 + 收尾（发送成功或放弃）≤ 2 次，即「最多 8 次重试 × ≤ 3 次写入」。
- 30 条/天的最坏情况约 `30 × 8 × 3 ≈ 720` 次写入/天，仍低于 1000；真实流量（失败邮件很少）通常只有几十次。
- 超限会让请求失败；不要升级计划来恢复服务。

## 密钥（只放 Wrangler / Actions，不要写入代码、日志或 PR 正文）

| 名称 | 是否必须 | 用途与范围 |
| --- | --- | --- |
| `FEISHU_APP_ID` | 必须 | 飞书自建应用 App ID，用来换 `tenant_access_token` |
| `FEISHU_APP_SECRET` | 必须 | 飞书 App Secret，与 App ID 一起换 token |
| `FEISHU_VERIFICATION_TOKEN` | 必须 | 校验飞书 URL Verification 与事件 `header.token` |
| `FEISHU_ENCRYPT_KEY` | 可选 | 飞书事件 Encrypt Key。当前飞书侧加密已关闭，**不要设置**。以后若开启加密，再 `wrangler secret put` 同一把密钥 |
| `GITHUB_TOKEN` | 需求命令必须；进度命令可选 | 细粒度 PAT，**仅本仓库** `CharlesHarry7/dreamutopia-clone`。权限：Issues **Read and write**。进度读公开 issue 正文与 pulls（不用模型）；没有 token 时仍走公开接口。创建/关单回帖需要写权限 |
| `GITHUB_WEBHOOK_SECRET` | 使用关闭回帖时必须 | GitHub webhook 的 HMAC 密钥，校验 `X-Hub-Signature-256`。请用高熵随机串，与 GitHub webhook Secret 填同一值 |
| `ALLOWED_CHAT_IDS` | **需求** 与可选 LLM 必须（合入后由运营填写） | 允许提交需求、以及（若已配置 LLM）自由对话的飞书 `chat_id`，逗号分隔。也可写在 `src/config.mjs` 的 `allowedChatIds`。未设置或为空时 **失败关闭**。这不是 secret |
| `FORWARD_EMAIL_TO` | 可选 | Worker `[vars]`，转发邮件的收件人，逗号分隔（如 `a@example.com,b@example.com`）。未设置或为空时用源码常量 `["tuapi@mail.grokbot.com"]`。这不是 secret |
| `LLM_BASE_URL` | 可选 LLM 必须（与下面两项同时有才开启） | Worker `[vars]` 示例：`https://api.openai.com/v1`（或其他 OpenAI 兼容 host）。**不要**把该值写进源码当运行时默认；缺省则 LLM 关闭 |
| `LLM_MODEL` | 可选 LLM 必须 | Worker `[vars]` 示例：`gpt-4o-mini`。**不要**把模型名写进源码当运行时默认 |
| `LLM_API_KEY` | 可选 LLM 必须 | **仅 Cloudflare Worker Secret**（`wrangler secret put LLM_API_KEY`）。运行时从 `env.LLM_API_KEY` 读取。禁止写入代码、测试、注释、日志或 PR |
| `LLM_DAILY_LIMIT` | 可选 | Worker `[vars]`。每个会话每天最多模型调用次数，默认 `200`。达到上限后礼貌回复并退回规则命令。计数在向模型发请求**之前**写入，超时和 HTTP 错误也计入上限 |
| `LLM_TIMEOUT_MS` | 可选 | Worker `[vars]`。模型 HTTP 请求超时，默认 `9000` 毫秒；会夹到约 200–20000 毫秒。飞书事件路径仍受 Worker 2.5 秒回调预算限制 |

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

   可选 LLM **默认不要开**。若要开启，在 `wrangler.toml` 增加 `[vars]`（示例，按需改 host/模型）：

   ```toml
   [vars]
   LLM_BASE_URL = "https://api.openai.com/v1"
   LLM_MODEL = "gpt-4o-mini"
   LLM_DAILY_LIMIT = "200"
   LLM_TIMEOUT_MS = "9000"
   ```

   确认 `ALLOWED_CHAT_IDS` 已包含允许对话的 `chat_id`，再单独运行（只在 Wrangler 提示中粘贴密钥，不要写进文件或命令参数）：

   ```bash
   npx wrangler secret put LLM_API_KEY
   ```

   缺 `LLM_BASE_URL`、`LLM_MODEL` 或 `LLM_API_KEY` 任一项时 Worker 不会对模型发请求。

4. 发布 Worker：

   ```bash
   npx wrangler deploy
   ```

   Wrangler 会给出 `workers.dev` 主机名。两个回调地址为：

   ```text
   https://feishu-bot.<account-subdomain>.workers.dev/feishu/events
   https://feishu-bot.<account-subdomain>.workers.dev/github/webhook
   ```

## 飞书开放平台配置（老三）

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

## GitHub 配置（老三）

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

## CI
The GitHub Actions workflow lives at `ci/feishu-bot-tests.yml`. The push token has no `workflow` scope, so a maintainer needs to copy it to `.github/workflows/` by hand.
