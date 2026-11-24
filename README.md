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

群机器人播报仓库变更。验收同学也可以用下方命令另行发送回归结果。

### 在群里添加自定义机器人

1. 打开目标飞书群 → 右上角 **设置** → **群机器人** → **添加机器人** → 选择 **自定义机器人**。
2. 填写名称（例如「DreamUtopia 通知」）后添加。复制 webhook 地址，格式形如：
   `https://open.feishu.cn/open-apis/bot/v2/hook/<token>`
   **不要**把完整地址写入仓库、Issue、PR 或日志。
3. 安全设置建议启用 **签名校验**（不要用 IP 白名单：GitHub Actions 出口 IP 会变）。保存签名密钥。
4. 若改用 **自定义关键词**，请包含消息里会出现的词，例如仓库播报里的仓库名，或验收卡片里的「验收」。

### 把密钥放到 GitHub Actions

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中新增：

| Secret 名称 | 是否必须 | 用途 |
| --- | --- | --- |
| `FEISHU_WEBHOOK_URL` | 要真正发消息时必须 | 自定义机器人 webhook |
| `FEISHU_WEBHOOK_SECRET` | 可选 | 签名校验密钥；未设置则不带 `timestamp` / `sign` |

工作流 [Feishu notify](.github/workflows/feishu-notify.yml) 监听分支和标签推送、PR 状态变化及 Release 发布。在 Actions 中手动运行可以测试群消息。一次推送合并成一条消息。同一次操作如果更新了分支和 PR，群里会分别显示代码改动与 PR 进展。

消息带上仓库、分支或标签、操作人、任务状态及 GitHub 链接。PR 播报使用 GitHub 分配的承接人。普通提交只说明代码已推送，上线和验收仍以相应流程的结果为准。

GitHub 按推送的版本读取工作流。在长期开发分支合入此配置后，该分支的推送也会播报。远端仓库收到推送后才会触发。缺少 webhook 或飞书未确认投递时，仓库播报步骤报错，具体运行记录见 Actions。

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

手动验收命令在未设置 `FEISHU_WEBHOOK_URL` 时跳过并返回成功。单元测试不访问网络、不需要真实密钥：

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
