# Mu-mirror-F

「AI 日记镜子」系统的前端。用户随手记录日常，AI 自动拆分、分类、打标签，用户审核确认后数据进入 RAG，最终生成用户画像（"镜子"）帮助认识自己。

Vue 3 + Vite，纯 JavaScript。**零 UI 库、零图表库**——所有组件与图表手写，运行时依赖只有 4 个。

## 在系统中的位置

```
本仓（Vue 3）──HTTP(/api, JWT)──> Mu-mirror-B（Spring Boot）──SQL──> PostgreSQL + pgvector
                                            └──gRPC──> Mu-mirror-AI（Python，纯推理）
```

前端只与后端 REST 契约打交道，不直接接触 gRPC。

## 技术栈

| 包 | 版本 | 说明 |
|---|---|---|
| vue | ^3.5.40 | |
| vue-router | ^5.2.0 | |
| pinia | ^4.0.2 | 状态管理，12 个 store |
| axios | ^1.19.0 | HTTP（导出功能用原生 `fetch`，见下） |
| vite | ^8.1.5 | 构建（devDependency） |
| @vitejs/plugin-vue | ^6.0.8 | |

Node 要求：`^22.18.0 || >=24.12.0`

## 页面

| 路由 | 页面 | 说明 |
|---|---|---|
| `/records/:date?` | 记录 | 落地页，按日期分组瀑布流 + 侧栏 |
| `/calendar` | 日历 | 月历、每日情绪标记，点日期跳当天记录 |
| `/mirror` | 镜子 | 画像快照、历史轨迹、快照对比、漂移增量、4 张图表 |
| `/chat` | 对话 | RAG 对话：SSE 流式、思考面板、工具轨迹、来源引用、文件卡 |
| `/vault` | 我的资产 | 文件资产管理，5 态消化徽标、确认门禁、删除三重保护 |
| `/settings` | 设置 | AI 模型（加密）、Embedding（1024 维约束）、审核、词典、镜子引擎、数据导出 |
| `/auth/login` | 登录 | 登录/注册一体（Tab 切换） |

## 目录结构

```
src/
├── api/            axios 封装 + 各业务模块（auth/records/chat/mirror/vault/glossary/summary/todo/settings/export）
├── stores/         12 个 Pinia store（composition API 风格）
├── views/          6 个页面 + auth/
├── components/
│   ├── atoms/      最小单元（按钮、图标、下拉）
│   ├── molecules/  组合单元（记录卡、词典卡、工具轨迹、思考面板…）
│   ├── organisms/  复杂区块（审核面板、侧栏、写记录弹窗…）
│   ├── charts/     手写图表（活动带/节律分布/关键词条/待办环）
│   └── templates/  布局（MainLayout / AuthLayout）
├── composables/    轮询（记录 2.5s / 待办 15s，标签页隐藏时跳过）
├── constants/      内容类型、情绪配色、文件类型白名单
├── utils/          时间（Asia/Shanghai）、localStorage、Markdown 预览
└── assets/styles/  设计令牌 + 全局样式
```

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 开发（默认 5173）
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

`package.json` 只有这三个脚本——**没有 lint、没有测试、没有类型检查**。

### 后端地址

`vite.config.js` 里硬编码代理到 `http://localhost:9050`：

```js
server: { proxy: { '/api': { target: 'http://localhost:9050', changeOrigin: true } } }
```

**没有 `.env` 文件**，改后端地址直接改这里。开发时需先启动 Mu-mirror-B（9050）。

## 设计语言：「晨纸」

亮色主题，设计令牌集中在 `src/assets/styles/variables.css`。

- 底色为暖纸色（`--ink: #F1F0EA`），纯白卡片，单一强调色墨蓝（`--accent: #2C5FE8`）
- 情绪 13 色板为白底专门降饱和（`src/constants/moodColor.js`）
- 字体：正文系统栈 + 苹方/思源黑体；标题用衬线（Noto Serif SC）
- 图标全部内联 SVG，**不用 emoji**
- 明确不用：暗色模式、渐变、玻璃拟态、极光背景、`backdrop-filter`
- 对比度按 WCAG AA 调校

## 几个实现要点

**SSE 流式对话**（`src/stores/chat.js`）用 `fetch` + `ReadableStream` 而非原生 `EventSource`——因为请求是 POST（要带 body 和 Bearer 头）。事件类型：`meta` / `thinking`（思考增量）/ `delta`（回答增量）/ `sources`（引用，按 `n` 定位而非数组下标，编号可能稀疏）/ `vault_refs` / `done` / `error`。

**响应拦截器的键名转换**（`src/api/request.js`）：后端返回 `{code, message, data, timestamp}`，**没有 `success` 字段**，所以错误检测靠 `code !== 200`（即使 HTTP 状态是 200）。拦截器会把响应键递归转成 snake_case，但对 chunk 的 `metadata` 业务 JSON 键（`contentType` / `taskStatus`）有豁免。

**图表零依赖**：`ActivityBand`（30 天记录量+情绪构成融合带）、`RhythmDist`（24 小时 + 7 星期分布）、`TodoRing`（SVG `stroke-dasharray` 叠环）、`KeywordBars`（CSS 条），全部手写。

**导出用原生 fetch**（`src/api/export.js`）：axios 的 JSON 拦截器会破坏二进制流，所以 blob 下载走原生 fetch 并自己解析 `Content-Disposition` 文件名。只导出不导入。

## 部署

- `.github/workflows/deploy.yml` — 推 `main` 时构建（Node 22），打包 `dist` 发到 GitHub Release，再 POST 通知部署钩子
- `Jenkinsfile` — 单并发流水线，`NODE_OPTIONS=--max-old-space-size=384`（服务器 2C2G），通过 `deploy/frontend-release.sh` 做时间戳目录 + 原子 `current` 符号链接切换，保留 5 个版本，零停机

`.gitattributes` 强制 `deploy/**`、`Jenkinsfile`、`*.sh` 用 LF，避免 `/bin/bash^M`。

## 相关仓库

| 仓库 | 说明 |
|---|---|
| `Mu-mirror-B` | Java Spring Boot 后端（REST 契约源头） |
| `Mu-mirror-AI` | Python gRPC AI 服务 |
| `coordination/`（仓库外） | 三仓共享的协作文档与协议登记 |

## 文档

- `docs/2026-09-03-system-design-v2.md` — 系统设计 v2.3（前端契约见第八章）
- `HANDOVER.md` — 前端交接文档
- `docs/prototype/` — 早期 HTML 原型
