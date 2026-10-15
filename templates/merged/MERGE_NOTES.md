# 合并说明

## 源码表
| 模块 | 来源 |
|------|------|
| 平台基础（auth, payment, SEO） | mkfast-template（TanStarter 基础） |
| 信用系统、AI/图像工作流、更丰富的管理后台 | mkfast-app（MkImage 产品） |

## 优先级规则
1. 平台基础模块（auth, payment, SEO）以 mkfast-template 为基础。
2. 信用系统、AI/图像工作流、管理后台功能由 mkfast-app 覆盖。
3. 当两个模块都包含 payment/auth 时，优先使用 template 的结构，记录 app 的差异（如信用挂钩、价格套餐）。
4. SEO 模块：将 lib/seo.ts + sitemap.ts + structured-data.ts 融合为一个薄层 facade，重新导出首选的 helper 并记录差异。

## 布局树
- `src/` 下的模块合并文件（merged.ts）作为入口。
- `src/` 下的页面文件（pages/）按 mkfast-* 命名。
- `src/` 下的模块（auth, payment, credits, admin, seo）通过 merged.ts 实现 facade。
- `src/index.ts` 作为 barrel 文件导出所有 merged 模块。

## 安全与成本
- 禁止使用 shipany、seo-site-template 或任何 shipany 路径/名称。
- 仅生成开发环境代码，不修改生产环境配置。
- `GENERATION_ENABLED` 保持为 false（在根 wrangler.toml 中）。
- 不包含任何真实密钥或敏感信息。

## 已知限制
- 未实现完整的页面逻辑，仅提供结构。
- 未实现完整的支付流程，仅提供 facade。
- 未实现完整的信用系统逻辑，仅提供类型和计划。

## shipany 移除说明
- 所有与 shipany 相关的代码、路径和名称已被移除。
