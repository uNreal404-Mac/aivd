# Dreamutopia 项目骨架

这是一个基于 TanStarter（mkfast-template）和 MkImage（mkfast-app）的项目骨架，用于快速构建 SaaS 应用。

## 使用方式

1. 安装依赖
2. 配置环境变量（如 API 密钥等）
3. 启动开发服务器

## 模块表

| 模块 | 描述 |
|------|------|
| `auth/merged.ts` | 身份验证模块，基于 mkfast-template，覆盖 Google 扩展令牌处理等 |
| `credits/merged.ts` | 信用系统模块，仅存在于 mkfast-app，包含类型和计划 |
| `payment/merged.ts` | 支付模块，使用 Stripe、Creem、Waffo 等提供商 |
| `admin/merged.ts` | 管理后台模块，包含用户管理、提示、任务、兑换等功能 |
| `seo/merged.ts` | SEO 模块，融合 mkfast-template 和 mkfast-app 的 SEO 工具 |
| `pages/index.ts` | 页面模块，列出所有可用页面路径（如 `pages/mkfast-*`） |
| `src/index.ts` | 入口文件，导出所有合并模块 |

## 合并说明
请参考 [MERGE_NOTES.md](MERGE_NOTES.md) 了解合并策略和优先级规则。

## License
Upstream mkfast-app / mkfast-template keep their own LICENSE (purchased private sources). Internal reuse only.
