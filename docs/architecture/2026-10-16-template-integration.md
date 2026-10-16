# Higgsfield-1：三模板集成裁决

日期：2026-10-16
状态：本轮完成源码核查与架构裁决；尚未实现集成、执行构建或部署。
唯一产品仓库：CharlesHarry7/higgsfield-1。

## 1. 唯一裁决

完整 VideoFly 是新视频站唯一运行底座。mkfast-app 是按需移植的界面与内容组织来源；mkfast-template 是基础能力对照与上游参考，不再引入第二套平台。

不是把三套程序各取三分之一。先让一套完整的视频产品成立，再补确有必要的小模块。禁止继续把零散文件堆进 merged.ts，并把导出计划对象称为完成集成。

新应用计划落在同仓库 apps/video/，第一轮保留 VideoFly 的源码结构、配置、锁文件与许可证。现有 out/、functions/、libs/、migrations/、schema.sql、wrangler.toml 与 workers/ 原地保留；生产切换前不删除、不改写、不让新应用直接写入其业务数据。

## 2. 核查基线与证据边界

- higgsfield-1 main：5a7ad80f5aa03b1558ea20fba33e92cf7de58780。
- VideoFly main：16c26ea13a6ac1be34efebd077759cf973082a23。

直接读取了最终仓库、已合入的 mkfast 副本，以及 VideoFly 的依赖、文档、许可证、页面分组、数据库入口和生成服务关键代码。两个 saas-sources-org 原始仓库经当前 GitHub 连接返回 404；不能据此认定仓库不存在。对它们的判断来自最终仓库副本和作者官方文档，不声称完整审计了原仓库，也不声称副本等于最新上游。

已核实的集成问题：
1. 根 README 与目录显示原应用仍是静态 HTML/JavaScript + Cloudflare Pages Functions、D1、KV、R2。
2. templates/merged/package.json 自称 skeleton，只有 typecheck 与输出提示文字的 lint，没有 dev/build/start。该 lint 不是实际代码质量检查。
3. src/auth/merged.ts 只导出 MergedAuthPlan，没有实际认证服务导出。
4. src/payment/merged.ts 只导出 PaymentPlan，没有实际支付实现导出。
5. src/pages/index.ts 明确写着 reference only, not routed here，只导出目录名称。
6. MERGE_NOTES.md 自述页面、支付与积分逻辑不完整；上述入口不能证明三模板已经形成可运行应用。
7. VideoFly 的数据库入口使用 drizzle-orm/postgres-js 和 postgres，不是 D1 数据库入口。
8. VideoFly 的 src/services/video.ts 已有参数校验、任务写入、积分冻结、供应商调用、回调和状态查询代码，更贴近本次视频产品目标。

本轮通过 GitHub 连接读取源码，没有安装完整依赖或执行完整构建；没有付费模型调用、真实付款测试、生产数据库迁移或部署。不能把模板 README 的“生产级”等宣传表述当成运行验收证据。

## 3. 三个模板各取什么

| 来源 | 本项目角色 | 取用范围 | 不引入什么 |
| --- | --- | --- | --- |
| videofly-template | 唯一新产品运行底座 | 完整 Next.js 应用、认证、用户数据、积分与支付、视频服务、上传、工具页、作品库与现有视觉组件 | 不把这些关联模块再次拆散到其他框架 |
| mkfast-app | 按需界面与内容组织来源 | 经许可与依赖检查后，移植确实缺失的卡片、筛选、提示词浏览等表现层 | TanStack 路由、认证入口、整套支付/积分/数据库、图片生成后端 |
| mkfast-template | 基础能力对照与上游参考 | 检查基础营销、SEO、设置等是否有值得取用的小模块；第一轮不增加运行代码 | 第二套平台框架、认证、支付、用户表与账本 |

作者官方文档确认：mkfast-template 是 TanStarter；mkfast-app 是建立在 TanStarter 上的 MkImage 图像生成应用。它们不是两套需要同时运行的独立商业底座。

## 4. 唯一模块所有权

| 能力 | 新应用的唯一实现 |
| --- | --- |
| 框架与路由 | VideoFly 的 Next.js App Router |
| 认证与会话 | VideoFly 现有 Better Auth 配置 |
| 用户、订单、积分与任务数据 | VideoFly 的 PostgreSQL + Drizzle schema |
| 视频生成、回调与状态 | src/services/video.ts、src/ai/、现有 API 路由 |
| 积分与支付 | src/services/credit.ts、src/payment/ 及其回调；上线前独立验收 |
| 上传、媒体与作品 | 现有 storage、工具页与 dashboard；验证持久保存和访问权限 |
| 首屏、工作台、作品展示 | 先用 VideoFly 现成页面和组件，再补确认有价值的界面缺口 |

移植必须同时满足：功能确有缺口、适用许可已确认、依赖链明确、改用 VideoFly 的路由和服务接口、有实际验收。不为用完模板而增加功能。

禁止直接复制 mkfast 的 createServerFn、TanStack 路由、tanstackStartCookies、D1 绑定或整套 payment/auth/credits 目录到 Next.js 应用。已读取的 mkfast auth 副本包含框架专属 cookies 适配器和多项原项目别名依赖，不能按目录名称直接拼接。

同一新应用只保留一套账户、一套会话、一套订单、一套积分账本。旧生产系统保持隔离，不假定旧数据与新模型自动兼容。

## 5. 怎样形成 Higgsfield 类产品体验

参考的是“看见效果并进入对应创作流程”的产品组织，而不是照抄品牌或堆满菜单。Higgsfield 当前公开首页包含 Explore、Video、Effects，以及效果卡片的 Recreate 入口；本项目不据此宣称拥有其全部能力。

第一版主入口只保留发现、创作、我的作品；登录、设置与价格为辅助页面。

- 发现：展示有使用依据的真实示例和实际可用玩法。没有案例则使用诚实空状态，不冒充本站生成结果。
- 创作：复用上传、提示词、参数与任务组件；玩法入口把预设配置带入同一个工作台，不再建一套平行生成系统。
- 我的作品：复用列表、状态、预览与下载；验证刷新后恢复、用户隔离和可靠保存。

核心验收路径：发现入口 → 创作 → 上传素材与必要提示词 → 服务端提交一次任务 → 查看状态 → 刷新后找回 → 作品库播放与下载。

玩法初期优先使用静态配置，只加入已验证参数与能力；不为少量玩法先建复杂管理平台。保留项目品牌，不使用 Higgsfield 的标志或未经授权的作品。不把其他项目的三视频 Pack、特定价格或关键词站需求自动带入本项目。

## 6. 同仓库落地与部署

以下是目标结构，不是已经创建的运行应用：

```text
higgsfield-1/
  apps/video/              # 完整 VideoFly 派生应用，唯一新产品运行入口
  templates/merged/        # 历史抽取材料，不被新应用导入
  out/ functions/ libs/    # 原 Cloudflare 产品，切换前保持不动
  migrations/ schema.sql  # 旧数据库资料，不用于初始化 PostgreSQL
  workers/                # 既有机器人等独立 Worker，保持不动
  docs/architecture/      # 本裁决与证据
```

选择 VideoFly 原有的 Next.js/Node 路线，第一轮预览部署目标定为 Vercel，根目录设为 apps/video/。使用隔离的测试 PostgreSQL 与测试存储，不为沿用旧 Pages 配置先改造到 D1 或另一个框架。此处是技术裁决，不代表已创建云资源或获得新增费用授权。

任何云资源创建、密钥设置、数据库迁移与生产发布均遵守已有授权边界。旧产品保持可回滚；核查旧用户、订单和业务后，另做有备份、校验与回滚的切换方案。新旧应用不得并行写同一本业务账。

## 7. 三个实施切片

### 一：完整模板基线与可运行预览

范围：从固定 VideoFly SHA 导入 apps/video/；保留锁文件、LICENSE 与必要配置；做最少品牌配置；先用现成页面。暂不移植 mkfast，不改旧生产目录。

验收：来源 SHA 与导入清单、相对上游 diff；实际 install/typecheck/lint/build 命令和退出码；桌面与手机的真实页面检查；具备部署授权时给出真实预览地址。

停止条件：来源或许可无法确认；依赖安装、锁文件或构建有阻塞；需要破坏旧生产才能继续。不跳过检查，不把不运行的文件堆标成完成。

### 二：一条生成闭环和计费护栏

范围：复用上传、视频、积分、回调与作品模块，验证并修补用户隔离、任务持久化、幂等、私有下载和失败恢复。先验证一条实际配置的生成路径，不同时扩展一堆模型。

已发现的上线前风险：VideoFly generate() 把 provider.createTask() 和随后保存 taskId 的数据库更新放在同一 try 内；catch 统一 release 积分并标记 FAILED。供应商已接受但响应丢失，或本地写入失败时，不能据此认定供应商未收费。应区分明确拒绝与结果未知，保留可对账状态，未知状态不自动重新发起付费请求。这是代码阅读发现，尚未故障注入复现。

验收：供应商接受后超时、本地写入失败、重复提交、重复回调、刷新恢复、两个用户互相访问的测试；输出可靠保存与下载。真实视频或付款仅在对应既有授权和预算内验证，记录实际调用结果。

停止条件：模糊状态导致重复调用或错误结算、权限不正确、输出不可靠、无真实调用授权。无授权时继续模拟测试，但不得标记真实生成通过。

### 三：最小必要界面移植与产品验收

范围：根据前两片暴露的真实缺口，才从 mkfast-app 移植少量有价值的卡片、筛选或提示词表现层。mkfast-template 原则上不增加运行代码。统一现成视觉系统、导航、加载态和错误态。

验收：逐文件来源与许可记录、依赖改写说明、桌面/手机截图、从发现到下载的完整路径证据。

停止条件：一个界面模块要求引入第二套路由、认证、账本或数据库；素材无使用依据；页面宣称超过已验证能力。

## 8. 当前交付与完成定义

当前只有源码核查和写入仓库的集成裁决，没有应用代码改造、构建通过或上线证明。

后续实现完成必须同时证明：真实构建、可访问预览、完整交互、可靠任务与作品、权限隔离和计费护栏。生产上线另需正式发布证据。计划对象、文件拷贝、模拟结果、文档或分支存在不能替代这些证据。

## 9. 可复核来源

最终仓库基线：
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/README.md
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/templates/merged/package.json
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/templates/merged/MERGE_NOTES.md
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/templates/merged/src/auth/merged.ts
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/templates/merged/src/payment/merged.ts
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/templates/merged/src/pages/index.ts
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/templates/merged/src/auth/mkfast-template/auth.ts

VideoFly 基线：
- https://github.com/zifeixu85/videofly-template/blob/16c26ea13a6ac1be34efebd077759cf973082a23/package.json
- https://github.com/zifeixu85/videofly-template/blob/16c26ea13a6ac1be34efebd077759cf973082a23/src/db/index.ts
- https://github.com/zifeixu85/videofly-template/blob/16c26ea13a6ac1be34efebd077759cf973082a23/src/services/video.ts
- https://github.com/zifeixu85/videofly-template/blob/16c26ea13a6ac1be34efebd077759cf973082a23/LICENSE
- https://github.com/zifeixu85/videofly-template/blob/16c26ea13a6ac1be34efebd077759cf973082a23/README.md

本轮读取的公开官方资料：
- https://docs.tanstarter.dev/codebase/
- https://docs.tanstarter.dev/mkimage/
- https://higgsfield.ai/

作者文档用于核对产品关系，不等同于用户所持副本的许可证明。VideoFly 仓库存在 MIT LICENSE，仍需保留署名并单独核验模板附带媒体素材的使用依据。
