# Higgsfield-1：三模板集成裁决

日期：2026-10-16
状态：架构裁决与源码核查完成；本文不代表应用已集成、构建通过或上线。
唯一产品仓库：CharlesHarry7/higgsfield-1。

## 1. 唯一裁决

完整 VideoFly 是新视频站唯一运行底座。mkfast-app 是按需参考/移植的界面与内容组织来源；mkfast-template 是基础能力对照与上游参考，不再引入第二套平台。

不是把三套程序各取三分之一。先让一套完整的视频产品成立，再补确有必要的小模块。禁止继续把零散文件堆进 merged.ts，并把导出计划对象称为完成集成。

新应用落在同仓库 apps/video/，第一轮完整保留 VideoFly 的源码结构、配置、锁文件与许可证。现有 out/、functions/、libs/、migrations/、schema.sql、wrangler.toml 与 workers/ 原地保留，生产切换前不得删除、改写或共享其业务数据。

## 2. 本轮证据与边界

核查基线：
- higgsfield-1 main：5a7ad80f5aa03b1558ea20fba33e92cf7de58780。
- VideoFly main：16c26ea13a6ac1be34efebd077759cf973082a23。

已直接读取最终仓库、合并副本，以及 VideoFly 的依赖、文档、许可证、页面分组、数据库入口和生成服务关键代码。saas-sources-org 两个原始仓库通过当前 GitHub 连接返回 404；因此对它们的结论来自最终仓库内的副本和作者官方文档，不声称已完整审计两套原仓库，也不声称副本等于最新上游。

发现：
1. 根 README 与目录显示当前应用仍是静态 HTML/JavaScript + Cloudflare Pages Functions、D1、KV、R2。
2. templates/merged/package.json 自称 skeleton，只有 typecheck 与输出提示文字的 lint，没有 dev/build/start。该 lint 不能证明代码质量检查通过。
3. src/auth/merged.ts 只导出 MergedAuthPlan，没有实际认证服务导出。
4. src/payment/merged.ts 只导出 PaymentPlan，没有实际支付集成导出。
5. src/pages/index.ts 明确写着 reference only, not routed here，仅导出目录名称。
6. 合并说明自述页面、支付和积分逻辑不完整；已核查入口没有接入 VideoFly 的运行应用。
7. VideoFly 的数据库入口使用 drizzle-orm/postgres-js 和 postgres。它不是 D1 应用。
8. VideoFly 的 src/services/video.ts 已有真实业务代码：参数校验、任务记录、积分冻结、供应商调用、回调和状态查询。它比重新组合通用 SaaS 模块更贴近本次视频产品目标。

本轮没有安装完整依赖或执行完整构建；容器直接克隆遇到网络解析失败，源码核查经 GitHub 连接完成。未调用付费模型、未测试真实付款、未运行生产迁移、未部署。模板 README 的“生产级”等表述不作为上线验收证据。

## 3. 模块归属：不得再让执行者重新选底座

| 能力 | 唯一运行实现 | 对其他模板的处理 |
| --- | --- | --- |
| 应用框架与路由 | VideoFly 的 Next.js App Router | 不引入 TanStack Start 路由和 Vite 运行壳 |
| 认证与会话 | VideoFly 现有 Better Auth 配置 | 不导入 mkfast 的认证入口或 cookies 适配器 |
| 用户、订单、积分与任务数据 | VideoFly 的 PostgreSQL + Drizzle schema | 不混入 mkfast 的 D1 表；不自动迁移旧生产数据 |
| 视频生成与状态 | src/services/video.ts、src/ai/、现有 API 路由 | 不重写第二套供应商框架 |
| 积分与支付 | src/services/credit.ts、src/payment/、现有回调 | 只保留一套运行账本与支付处理；是否开放真实收费另行验收 |
| 上传、媒体与作品库 | VideoFly 现有 storage、工具页和 dashboard | 验证持久保存与权限，不以临时 URL 冒充可靠作品库 |
| 首屏、创作工作台、作品展示 | 优先用 VideoFly 的现成组件和页面 | mkfast-app 只补确实缺失的卡片、筛选、提示词组织等表现层 |
| 基础营销、SEO、设置页 | 先用 VideoFly 现有能力 | mkfast-template 仅作对照；缺什么才评估一个小模块 |

mkfast-app 的上游 MkImage 建立在 TanStarter 上，两者本来存在继承关系，不应当作两套独立商业基础设施叠加。

移植条件必须同时满足：功能确有缺口；已确认适用许可；已识别所有依赖；只修改必要的表现层或纯数据逻辑；改用 VideoFly 的路由、认证与服务接口；有实际验收。缺一项就不进入运行应用。

禁止直接复制 mkfast 的 createServerFn、TanStack 路由、tanstackStartCookies、D1 绑定或整套 payment/auth/credits 目录到 Next.js 应用。最终仓库的 mkfast auth 副本已经显示框架专属 cookies 适配器和多项原项目别名依赖，不能按文件名直接拼接。

## 4. 产品形态

第一版只收敛三条主要入口：发现、创作、我的作品；登录、设置与价格等作为辅助页面。保留现有项目品牌，不使用 Higgsfield 的标志或冒充其官方产品。

发现页以真实可用的结果和玩法入口为中心；创作页用现成上传/参数/任务组件；作品页复用现有列表与预览能力。玩法卡必须把选中的真实配置带到同一个生成工作台，不能做成一组与生成流程无关的展示页。

核心验收路径：发现入口 → 进入创作 → 上传素材与必要提示词 → 服务端提交任务 → 看见状态 → 刷新后仍可找回 → 作品库播放与下载。

先开放一条实际配置且经过验证的生成路径，不为填满页面同时增加所有模型或玩法。没有真实生成结果时使用诚实空状态；演示素材不得冒充本站生成案例。不得把其他项目的特定定价、三视频 Pack 或某个关键词站的设定自动带入本项目。

## 5. 同仓库集成边界

目标目录：

```text
higgsfield-1/
  apps/video/              # 完整 VideoFly 派生应用，唯一新产品运行入口
  templates/merged/        # 历史抽取材料，不被 apps/video 导入
  out/ functions/ libs/    # 现有 Cloudflare 产品，切换前保持不动
  migrations/ schema.sql  # 旧产品数据库资料，不用于初始化 PostgreSQL
  workers/                # 既有机器人等独立 Worker，保持不动
  docs/architecture/      # 本裁决与核查证据
```

apps/video/ 是目标目录，不是本次已经创建的运行应用。第一轮使用 VideoFly 原生 Next.js/Node 部署方式，目标为隔离的预览环境；不为沿用旧 Pages 配置而先改造到 D1 或跨框架部署。若使用 Vercel，项目根目录是 apps/video/，不是仓库根或 out/。任何云资源创建、密钥设置、数据库迁移与生产发布均遵守既有授权边界。

旧用户与订单不得假定自动兼容新应用。先保持两环境隔离，核清旧业务后再制定有备份、校验和回滚的切换方案。不并行让两套系统写同一本业务账。

## 6. 三个工程切片

### 切片一：完整模板导入与可运行预览

范围：从固定 VideoFly SHA 完整导入 apps/video/，保留 LICENSE、锁文件、必要配置与目录结构；完成必要品牌配置；复用现成发现/创作/作品页，不改旧生产目录。

证据：来源 SHA 与路径清单；相对上游 diff；真实安装与 typecheck/lint/build 的命令、退出码；桌面和手机页面检查；已获部署权限时给出真实预览地址。

停止条件：模板许可或来源无法确认；锁文件与依赖无法安装；构建阻塞；必须破坏旧生产才能继续。出现问题先报告实际阻塞，不用跳过检查或返回假成功掩盖。

不在这一切片移植 mkfast；先建立真实可运行基线。

### 切片二：一条生成闭环与收费前护栏

范围：复用上传、视频服务、积分、回调与作品库，验证并修补用户隔离、任务持久化、幂等、私有下载和失败恢复。

已发现的上线前风险：VideoFly generate() 将 provider.createTask() 与随后保存 taskId 的数据库更新放在同一 try 内，catch 统一 release 并标记 FAILED。供应商已接受但网络响应丢失、或本地保存失败时，不能据此证明供应商未收费。必须区分明确拒绝与结果未知，保留可对账状态，禁止未知状态下自动再次发起付费任务。该风险来自代码阅读，尚未故障注入复现。

证据：模拟供应商接受后超时、数据库写入失败、重复提交、重复回调、刷新、不同用户访问等测试；用两个独立测试用户验权。真实视频或付款只在对应既有授权和预算内测试，记录调用和结果。

停止条件：任一模糊失败会重复调用或错误结算；作品权限或输出持久性未验证；无真实调用授权。没有授权时继续零付费测试，但不得标记真实生成通过。

### 切片三：必要界面移植与产品验收

范围：在切片一和二的缺口清单基础上，才从 mkfast-app 移植最少的卡片/筛选/提示词表现层；mkfast-template 原则上不增加运行代码。统一现有视觉系统、路由入口、加载态和错误态。

证据：每个移植文件的来源和许可记录、依赖改写说明、桌面/手机实际截图，以及端到端真实用户路径证据。

停止条件：为了一个界面模块必须引入第二套路由、认证、账本或数据库；无权使用素材；界面宣称超过已验证能力。

## 7. 完成的含义

当前完成的是源码核查和集成裁决，不是视频站实现。

应用完成需同时证明：真实可运行构建、可访问预览、核心交互、可靠任务与作品、权限隔离和计费护栏。生产已上线还需正式发布证据。分支存在、文件拷贝、计划对象、模拟结果或文档齐全均不能替代这些证据。

## 8. 可复核来源

最终仓库固定基线：
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/README.md
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/templates/merged/package.json
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/templates/merged/MERGE_NOTES.md
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/templates/merged/src/auth/merged.ts
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/templates/merged/src/payment/merged.ts
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/templates/merged/src/pages/index.ts
- https://github.com/CharlesHarry7/higgsfield-1/blob/5a7ad80f5aa03b1558ea20fba33e92cf7de58780/templates/merged/src/auth/mkfast-template/auth.ts

VideoFly 固定基线：
- https://github.com/zifeixu85/videofly-template/blob/16c26ea13a6ac1be34efebd077759cf973082a23/package.json
- https://github.com/zifeixu85/videofly-template/blob/16c26ea13a6ac1be34efebd077759cf973082a23/src/db/index.ts
- https://github.com/zifeixu85/videofly-template/blob/16c26ea13a6ac1be34efebd077759cf973082a23/src/services/video.ts
- https://github.com/zifeixu85/videofly-template/blob/16c26ea13a6ac1be34efebd077759cf973082a23/LICENSE
- https://github.com/zifeixu85/videofly-template/blob/16c26ea13a6ac1be34efebd077759cf973082a23/README.md

作者官方文档，仅用于核对上游产品关系，不代表已获得用户副本的许可证明：
- https://docs.tanstarter.dev/codebase/
- https://docs.tanstarter.dev/mkimage/
