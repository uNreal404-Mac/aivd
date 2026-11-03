# B 机检与 A 盲审

B 的证据单独归档，原始输出不要送给 A。B 单独出通过 / 不通过 / 未评，绝不将不完整的检查当成 10 分。

- 对包含实际 UI 改动的分支运行 `node apps/video/scripts/audit-ui.cjs <该 PR 的 base>`。按 section 调试时可附仓库相对路径，最终需检查整个 diff，再审查依赖锁、原调色板、页面 H1/title/meta/alternate/路由前后快照。脚本的 raw key 等候选需要对照真实 DOM，合法 i18n key 与中性媒体遮罩应注明证据。AST 能发现同文件内嵌套 Card；跨组件的卡片由实际 DOM 复核。
- 运行 `npm run shots -- --base http://127.0.0.1:3000`，脚本通过 npx playwright test 使用外部工具缓存。参数有 `--lang`、`--pages home,pricing,generator`、`--out`；默认输出到 .design/artifacts。已装浏览器时可指定 `--channel chrome`。离线且已有临时 npx 工具项目可传 `--tool-prefix <外部 npm 缓存项目>`。记录真实 API/空数据/错误/加载状态的安全夹具，检查命名、Tab、错误恢复、键盘焦点和实际青色占比。
- 按 [Impeccable 官方 audit](https://github.com/pbakaus/impeccable/blob/9fadc41729c38fd47d7ae622b501558653f9d2e9/.agents/skills/impeccable/reference/audit.md) 执行相应版本的检查，保存目标、命令、版本和原始报告；单纯阅读规则不算执行。按 [Vercel 的官方规则](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md) 检查改动文件，记录 file:line 与通过证据。两个工具都保持在项目依赖之外。
- 同一目标、同一移动限速、三次冷导航，前后比较 Lighthouse P/A/SEO、LCP/CLS/TBT；运行 apps/video 的 npm run build、lint、typecheck。变化的环境策略（例如 noindex）单列，不覆盖原始得分。
- A 用新 Claude/Gemini 会话。独立资料包只放本轮截图、DESIGN.md、该 PR 的 2–4 张参考图。可提示：「作为设计总监，只凭所附图和规范，指出 3–5 个最大差距，以元素、属性、数值说明。不要猜测交互。分别评价 375/390/1440 并给此 section 一个 0–10 分。列明无法从截图确认之处。」保存原文、模型名和版本。provider 未登录、额度不足或拒绝看图均算未评，不能以本助手评分补足。
