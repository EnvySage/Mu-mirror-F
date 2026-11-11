# Mu-mirror-F

Vue 前端通过 Java 后端的 REST API 提供桌面和移动端界面。

- 跨端状态见同级后端仓库的 [项目进度](../Mu-mirror-B/docs/PROGRESS.md)。本仓启动和构建见 [README](README.md)，界面规范见 [Blue hour 改版说明](docs/ui-redesign.md)。
- 写新组件或规则前先找现有实现。业务 API 复用 [请求封装](src/api/request.js)，其中统一处理认证和响应字段转换。
- pre-commit 钩子会拒绝超过约 20KB 的文本文件；提交被拒时按报错拆分，不要绕过钩子。
- 新克隆后运行 `git config core.hooksPath .githooks` 启用钩子。
- 新增页面时同时检查 [路由](src/router/index.js)、[布局页面映射](src/router/presentationPages.js) 和桌面、移动端入口。
- 涉及记录审核时先读 [记录流程](docs/record-workflow.md)，记录保存、AI 整理和后续记忆授权各有独立语义。

## 成就素材维护

| 规则 | 由什么检查 |
| --- | --- |
| 蚀刻章成图的英文逐枚对应目录名称，不能整套统一写成品牌名。 | `tests/achievement-sets.test.mjs` 检查目录英文唯一性和图集完整性；成图文字必须按 `docs/achievement-art-manifest.json` 人工逐套核对，并附实际界面截图。目录测试不代替成图文字校对。 |
| 成就页筛选默认收起；详情采用紧凑档案与分段显影，避免大章面瞬间弹出。 | 浏览器验证初始隐藏、展开/收起保留条件，以及桌面、手机、矮屏详情和打开动画；截图保存在 `.verify/achievement-geometry/`。 |
