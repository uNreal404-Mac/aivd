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
