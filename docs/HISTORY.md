# Mu-mirror-F 历史摘要

本文件汇总已归档文档的结论。原文在 `archive/`；现行界面与交互以 `src/`、`docs/tarot-v2-frontend.md`、`docs/record-workflow.md` 和 `docs/ui-redesign.md` 为准。

## 时间线

- 2026-07/08：早期 AI 日记与前端框架设计，原文在 `archive/2026-07-*`、`archive/2026-08-*`。
- 2026-09-06：多 Agent 收尾交接；`晨纸` 亮色主题等旧视觉说明。原文在 `archive/HANDOVER-2026-09-06.md`。
- 2026-10-16：P3R / Blue hour 视觉重设计，现行规范见 `ui-redesign.md`。
- 2026-10-17：动效计划，已实施；原文在 `archive/plans/`。
- 2026-10-26：塔罗首版需求与实现计划；12 张牌、每日抽牌与收藏。原文在 `archive/specs/2026-10-26-tarot-design.md`、`archive/plans/2026-10-26-tarot.md`、`archive/tarot-implementation-decisions.md`。
- 2026-10-27：塔罗首版验收记录，原文在 `archive/tarot-verification.md`。
- 2026-11-06：塔罗 v2，78 张牌、逆位、收藏与历史；现行说明见 `tarot-v2-*.md`。
- 2026-11-11：成就图鉴与塔罗收藏展区、文档收口。

## 仍然有效的结论

1. 前端只走 REST/SSE，不直接接触 gRPC。
2. 记录、AI 整理、记忆授权是三个独立语义；审核后内容才进长期记忆。
3. AI 发起的写操作先出操作卡，用户确认后才执行。
4. 桌面与移动共享业务 store 和 API，仅布局与呈现分离。
5. 塔罗牌义只用于最终自然语言回答，不进入规划、画像或记忆抽取。

## 已归档

- `archive/HANDOVER-2026-09-06.md`
- `archive/tarot-implementation-decisions.md`
- `archive/tarot-verification.md`
- `archive/specs/2026-10-26-tarot-design.md`
- `archive/plans/2026-10-17-0111-feat-mirror-ui-motion-plan.md`
- `archive/plans/2026-10-26-tarot.md`
- `archive/prototype/` — 早期 HTML 原型
- `archive/2026-*` — 早期设计
