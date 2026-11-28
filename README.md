# DreamUtopia Clone｜AI 图像与视频生成复刻项目

基于 Cloudflare Pages、D1、KV 和 R2 的生成工具站。前端使用 HTML、CSS 与原生 JavaScript，后端通过 Pages Functions 调用 KIE API，提供图生视频、文生视频、首尾帧生成及图片生成流程。

这是参考 [DreamUtopia](https://dreamutopia.net) 的学习与复刻项目。产品代码、部署资源与 [Pikbo](https://github.com/CharlesHarry7/pikbo)、[MagicRemover Clone](https://github.com/CharlesHarry7/magicremover-clone) 各自独立。

## 功能与状态

- 游客 Lite 图生视频试用；次数由 KV 记录。
- 账号注册、登录、积分与生成记录。
- 图片上传到 R2，生成任务轮询、结果下载和主动发布到图库。
- 图生视频、文生视频、首尾帧与图片生成接口。
- 英文、中文、日文、西班牙文界面与 PWA 资源。
- 可选 Stripe 积分包和 Resend 邮件。

上述为仓库实现范围。线上生成、上传、邮件和支付是否可用取决于对应绑定与密钥；运行状态应以 `/api/health` 和实际流程验证为准。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | 静态 HTML / CSS / JavaScript，无前端构建步骤 |
| API | Cloudflare Pages Functions |
| 数据 | D1 数据库、KV 会话与游客状态 |
| 文件 | R2 上传与结果存储 |
| 生成 | KIE Market API |
| 支付 | 可选 Stripe Checkout 与 webhook |
| 邮件 | 可选 Resend |

## 本地预览

仅预览静态界面：

```bash
python3 -m http.server 4173 --directory out
```

需要 Functions 的本地开发：

```bash
npx wrangler pages dev out
```

真实生成还需要 Cloudflare 绑定和 KIE 密钥。完整配置与迁移顺序见 [BACKEND.md](BACKEND.md)。

## 仓库导航

| 路径 | 用途 |
| --- | --- |
| [out/](out/) | 首页、工作区、账号、定价、政策及多语言静态资源 |
| [functions/api/](functions/api/) | 账号、上传、生成、图库、支付和回调接口 |
| [libs/](libs/) | 鉴权、积分、限流、供应商调用和结算逻辑 |
| [schema.sql](schema.sql) | 新数据库初始结构 |
| [migrations/](migrations/) | 已有数据库升级脚本 |
| [wrangler.toml](wrangler.toml) | Pages 与 Cloudflare 绑定配置 |
| [workers/feishu-bot/](workers/feishu-bot/) | 独立的飞书项目机器人 Worker（进度 / 网址 / 健康 / 需求，只回复 @；可选 LLM 默认关闭），与下方出站群通知分开 |
| [BACKEND.md](BACKEND.md) | 后端配置、API 示例与验证清单 |

## 必要配置

| 绑定／变量 | 用途 |
| --- | --- |
| `SESSIONS` | 会话与游客生成状态 |
| `DB` | 账号、积分、生成记录与支付数据 |
| `MEDIA` | R2 图片上传与媒体存储 |
| `KIE_API_KEY` | 真实图片／视频生成 |
| `KIE_WEBHOOK_HMAC_KEY` | 可选供应商回调认证 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | 可选支付与支付回调 |
| `RESEND_API_KEY` / `MAIL_FROM` | 可选找回密码与邮件 |

缺少 KIE、R2、Stripe 或 Resend 配置时，相应接口返回配置错误；这些功能分别配置和验收。

## 部署与验证

1. 按 `BACKEND.md` 创建 D1、KV、R2，并初始化数据库及适用迁移。
2. 配置 `DB`、`SESSIONS`、`MEDIA` 绑定与服务密钥。
3. Pages 输出目录设置为 `out`，不设置前端构建命令；也可运行 `npx wrangler pages deploy out`。
4. 检查 `/api/health`，再分别验证账号、上传、生成、下载与可选支付流程。

Cloudflare 资源名为 Pages `dreamutopia-clone`、D1 `dreamutopia-db`、R2 `dreamutopia-media`。生成 API 按账户用量计费，托管服务的免费额度以平台当前规则为准。

## 飞书群通知（自定义机器人）

向飞书群推送两类**出站**消息：（1）`main` 合入并部署到生产站；（2）只读验收 / 回归结果。这与 [`workers/feishu-bot/`](workers/feishu-bot/) 的入站 @ 回复机器人无关，也不调用生成、上传或任何付费 Cloudflare / AI 能力。生产站为 https://dreamutopia-clone.pages.dev 。

### 在群里添加自定义机器人

1. 打开目标飞书群 → 右上角 **设置** → **群机器人** → **添加机器人** → 选择 **自定义机器人**。
2. 填写名称（例如「DreamUtopia 通知」）后添加。复制 webhook 地址，格式形如：
   `https://open.feishu.cn/open-apis/bot/v2/hook/<token>`
   **不要**把完整地址写入仓库、Issue、PR 或日志。
3. 安全设置建议启用 **签名校验**（不要用 IP 白名单：GitHub Actions 出口 IP 会变）。保存签名密钥。
4. 若改用 **自定义关键词**，请包含消息里会出现的词，例如「网站进度」「改动」「问题」或「验收」。

### 把密钥放到 GitHub Actions

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中新增：

| Secret 名称 | 是否必须 | 用途 |
| --- | --- | --- |
| `FEISHU_WEBHOOK_URL` | 要真正发消息时必须 | 自定义机器人 webhook |
| `FEISHU_WEBHOOK_SECRET` | 可选 | 签名校验密钥；未设置则不带 `timestamp` / `sign` |

工作流 [`.github/workflows/feishu-notify.yml`](.github/workflows/feishu-notify.yml) 在 **push 到 `main`**（含 PR 合并进 main、Pages 生产部署）时运行 `node scripts/feishu-notify.mjs deploy`。卡片标题为「网站进度」，用规则（改动文件路径 / 标题 / 标签，不用模型）写成用户能在站点上看到的中文变化，并带「还没做」待办；正文不含 PR 号、提交 SHA 或分支名，最多一个「详情」指向生产站。页脚署名为 `Grok Bot · AI视频项目专属机器人 三儿`。

同一个工作流还会在以下情况发一张简短卡片（`node scripts/feishu-notify.mjs activity`），方便合伙人跟进：

- **有人新开或重新打开 PR、草稿 PR 转为正式**：「新的改动待审核」，写明标题、提交人、一句说明和「查看改动」按钮。
- **新开 Issue**（例如审查报告、问题反馈）：「新的问题 / 报告」，同样带标题、提交人和链接。

PR 通知使用 `pull_request_target`，这样从 fork 提的 PR 也能读到密钥；工作流只检出默认分支、只读取事件里的标题和链接，从不运行 PR 里的代码。

**未配置 `FEISHU_WEBHOOK_URL` 时步骤会跳过并以成功结束，不会让 CI 失败。** 本地或 CI 都不会打印 webhook 或签名密钥。

### 发送验收（回归）结果

在已导出上述环境变量的 shell 中：

```bash
# 通过
node scripts/feishu-notify.mjs acceptance \
  --title "主路径回归" \
  --status pass \
  --summary "登录、定价页、/api/health 只读检查通过" \
  --link "https://dreamutopia-clone.pages.dev/api/health"

# 未通过
node scripts/feishu-notify.mjs acceptance \
  --title "主路径回归" \
  --status fail \
  --summary "健康检查返回非 200" \
  --link "https://dreamutopia-clone.pages.dev/api/health"
```

未设置 `FEISHU_WEBHOOK_URL` 时同样跳过并返回成功。单元测试不访问网络、不需要真实密钥：

```bash
node scripts/test-feishu-notify.mjs
```


## 中文预览

打开这个链接即可直接查看中文版预览（会记住中文选择，工作区、登录和定价页会继续保持中文）：

https://dreamutopia-clone.pages.dev/zh


## Google sign-in and Stripe

Google sign-in uses Google OAuth with the callback `/api/auth/google/callback`. Configure
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the production callback URL in Google Cloud.
Stripe uses one-time Checkout credit packs and the existing signature-verified webhook at
`/api/stripe/webhook`. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as
Cloudflare Pages secrets, then apply `migrations/005_stripe_sessions.sql` before accepting
paid webhooks. The pricing page probes `GET /api/checkout` and only opens Stripe when the
backend reports both checkout and secrets as configured.
