# Mu-mirror-F 文档索引

当前状态以三端进度为准：`../Mu-mirror-B/docs/PROGRESS.md`。本仓文档只保留仍需维护的界面、素材与验收说明；历史材料在 `docs/archive/`。

## 当前文档

| 文档 | 用途 |
|---|---|
| [README](../README.md) | 启动、构建、部署与页面概览 |
| [AGENTS](../AGENTS.md) | 仓库级 Agent 约束与成就素材规则 |
| [记录流程](record-workflow.md) | 记录列表、后台整理、审核与记忆授权 |
| [UI 改版](ui-redesign.md) | Blue hour / P3R 视觉规范与素材出处 |
| [模型中心与移动对话](model-center-mobile-chat.md) | `/models` 与移动 `/chat` 行为 |
| [成就目录评审](achievement-catalog-review.md) | 96 枚正式目录、稳定编号与行为口径 |
| [成就套装与镀层](achievement-sets-and-plating.md) | 套装图集、真实账号镀层与行为采集 |
| [塔罗 v2 前端](tarot-v2-frontend.md) | 78 张牌、逆位、历史分页的现行行为 |
| [塔罗 v2 美术](tarot-v2-art.md) | 图集、哈希清单与素材生成 |
| [塔罗素材](tarot-assets.md) | v1/v2 素材与使用位置 |
| [部署](deploy.md) | GitHub Actions + 服务器拉取发布 |
| [美术提示词](art-prompts.md) | 水面背景等素材提示词 |
| [HISTORY](HISTORY.md) | 已归档塔罗首版、验收与交接摘要 |
| [archive/](archive/) | 历史设计、计划、原型与旧交接 |

## 维护规则

1. **代码优先**：界面行为与文档冲突时，以当前 Vue 组件和 stores 为准。
2. **一处维护**：现行行为写对应专题；一次性验收、设计稿、旧版说明移入 `archive/`。
3. **视觉规则**：成就素材的英文对应、筛选默认收起等规则见 `AGENTS.md`；修改后跑 `tests/achievement-sets.test.mjs` 并做浏览器截图。
4. **文件大小**：pre-commit 对超过约 20KB 的文本文件给出提醒，不阻止提交；按职责评估是否拆分，文档同步门禁继续生效。
5. **新克隆**：运行 `git config core.hooksPath .githooks` 启用钩子。
