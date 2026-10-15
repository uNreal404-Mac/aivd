# 飞书项目机器人 Worker

这是独立的 Cloudflare Worker，与仓库根目录的 Pages 配置分开部署。机器人只响应私聊文本和群聊中明确 @ 它的文本，支持「进度」「网址」「健康」三个命令；其他内容返回帮助说明。进度文案可在 `src/commands.mjs` 的 `PROGRESS_MESSAGE` 常量中维护。

机器人不会调用生成、上传或付费 AI 服务。健康命令只请求固定的 `https://dreamutopia-clone.pages.dev/api/health`，并返回 HTTP 状态及选定的布尔状态字段。

配置了 Encrypt Key 后，普通回调必须通过基于原始请求体的签名校验；飞书 URL Verification 握手可不带签名，但仍须解密（如果加密）并匹配 Verification Token。Worker 将同步处理限制在 2.5 秒内，健康请求最多等待 700 毫秒，为飞书 API 回复留出时间；外部依赖超过总时限时返回可重试错误。

## 费用边界

- 账号必须使用 Cloudflare Workers Free。部署前在 Cloudflare 账单／Workers 计划设置中确认当前账号没有启用 Workers Paid；不确定时先不要部署。
- 本配置只使用 Workers Free、Workers KV 与 `workers.dev` 地址，不添加付费绑定、自定义域名、AI 服务或定时任务。
- Free 计划有每日请求和 KV 用量上限；超限可能导致请求失败。不要升级计划来恢复服务。请查看 [Cloudflare Workers 定价与免费额度](https://developers.cloudflare.com/workers/platform/pricing/) 的当前规则。

## 本地测试和开发

需要 Node.js 22 或更新版本，以及 Wrangler。纯单元测试不需要 Cloudflare 登录、飞书凭据或网络请求：

```bash
cd workers/feishu-bot
node --test test/*.test.mjs
```

配置 KV 命名空间后，可用 Wrangler 本地运行：

```bash
npx wrangler dev
```

没有 Wrangler secrets 的本地 Worker 会对回调返回未配置状态；不要为本地调试把飞书凭据写入 `.dev.vars`、仓库文件或 shell 命令参数。回调、安全和 API 行为由上面的单元测试覆盖。

## 部署到 Workers Free

以下命令都在 `workers/feishu-bot/` 目录运行。先确认 Wrangler 登录的是目标账号，并已确认 Workers Free 计划。

1. 创建专用 KV 命名空间：

   ```bash
   npx wrangler kv namespace create feishu-bot
   ```

2. 将命令输出的 namespace ID 填入本目录 `wrangler.toml` 的 `BOT_KV` 绑定，替换示例 ID。不要改仓库根目录 Pages 的 `wrangler.toml`。

3. 逐项运行以下命令。Wrangler 会提示输入值；只在提示中输入飞书开放平台提供的凭据，不要把值放到命令参数、文件、日志或 PR 中：

   ```bash
   npx wrangler secret put FEISHU_APP_ID
   npx wrangler secret put FEISHU_APP_SECRET
   npx wrangler secret put FEISHU_VERIFICATION_TOKEN
   npx wrangler secret put FEISHU_ENCRYPT_KEY
   ```

4. 发布 Worker：

   ```bash
   npx wrangler deploy
   ```

   使用 Wrangler 显示的 `workers.dev` 主机名填事件订阅地址，格式为：

   ```text
   https://feishu-bot.<account-subdomain>.workers.dev/feishu/events
   ```

## 飞书开放平台配置

在飞书开放平台的自建应用中完成以下设置，并发布一个应用版本：

1. 启用机器人能力。
2. 在事件订阅中填写部署后的完整回调地址，保存并通过 URL Verification。订阅 `im.message.receive_v1`。
3. 将应用凭据中的 App ID、App Secret、Verification Token 和 Encrypt Key 分别通过上面的 Wrangler secret 命令设置。平台启用了事件加密时，Encrypt Key 必须与 Worker secret 相同。
4. 申请并在应用版本中启用这些权限：
   - `im:message`
   - `im:message.group_at_msg`
   - `im:message:send_as_bot`
   - 如果飞书权限面板把私聊接收权限单独列出，再申请 `im:message.p2p_msg`。
5. 将应用版本提交发布，并确认机器人对测试用户可见、已加入要测试的群聊。

在群聊中只有 @ 到此应用机器人本身才会触发回复。Worker 使用 KV 的事件和消息标记以及飞书回复 UUID 尽量避免重复回复；Workers KV 最终一致，因此不承诺并发或跨地域投递下严格 exactly-once。
