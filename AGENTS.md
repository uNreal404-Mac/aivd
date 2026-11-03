Read DESIGN.md before any UI work.
For every UI PR, apply the visual review protocol in DESIGN.md and attach the two viewport sizes and independent scores to the PR. Update DESIGN.md in the same change when a visual rule changes.
Before implementing a major new section, write the visual direction, content sequence and interactions in the PR. Compare two real-media compositions, record the decision, and self-check both viewports in Playwright before the independent review. Include observable interaction notes from the reference product and identify any sign-in boundary.

## UI 工作规则

本节适用于 Premiere 后续的 PR-A～F。每次先读 DESIGN.md、.design/critique-log.md、该 PR 的范围原文和 .design/refs/ 中选定的 2–4 张图。计划和评审用 high，常规实现用 low/medium，复杂动效再用 high。有不同模型的真实盲审记录才可称作评审 A。

1. 按字母顺序做完一个 PR 并交付可打开的预览，验收后才进入下一个。草稿先写在 .design/plans/，含 visual thesis、content plan、interaction thesis 和 3–5 个叙事节拍。大改先出两套静态稿，由用户选择后再写产品代码。
2. 一次只动一个 section。每改完一次，运行 npm run shots，打开 375、390、1440 的首屏和全页图。逐张检查截断、横溢、遮挡、CTA 数量、键盘与减少动态。每个组件记录 loading、empty、error 的行为和验证方式；静态无异步/数据的组件写清不适用原因。不得添加无意义的 loading 文案或永不出现的状态。
3. 禁止紫蓝占位渐变、emoji 标识、卡片套卡片、重复同构卡墙、无目的高光、没有具体动作的口号、每节都用眉题。已有未改区域的历史命中与本次引入的问题分开记录。
4. 评审 A 由 Claude 或 Gemini 在干净会话中完成。它只拿对应截图、DESIGN.md 和 2–4 张参考图，无仓库、实现历史、B 结果及往轮分数。保存原文、模型、分数。B 单独归档 AI 味脚本、Impeccable /audit、Vercel Web Interface Guidelines、移动 Lighthouse 及 build/lint/typecheck。B 不读 A 的反馈。开始前固定判分口径；默认 A ≥8/10 且 B 必检项全部通过。缺项为未评，不以自评分或其他 Codex 会话代替 A。
5. 有硬约束冲突则停止相应改动，在 critique-log 写提案。不得改 --du-* 的值或增加颜色；依赖只允许新增 motion；不得动认证、支付、积分扣费、API 路由、env、密钥、title/meta/H1/hreflang 或路由。允许仅读取现有模型能力与价格用于展示。不得提交付款或扣费来验证展示层。
6. 未过门槛不在 GitHub 创建 PR（包括 Draft）。每轮最大三处差距写入 critique-log，同一 section 最多三轮。第三轮仍未过线则保留原分、写提案。过线的 PR 附三段 thesis、前后截图、A 原文、B 输出、删减清单、Lighthouse 对照和预览链接。验收后将新学到的规则写回 DESIGN.md 或本文件；不自行合并。

在 375×812 的实际首屏检查默认模型和最长可选模型的原生下拉宽度。桌面的默认下拉宽度可能由最长选项撑开，使手机端短选项也挤掉分辨率。参数标签与打开控件的触区至少 44px；展开的视频关联当前镜头的文字描述。
在延迟客户端脚本的浏览器中尝试提前提交。含私人草稿的表单要在处理器就绪后启用，并验证提示词不会落进 URL。
