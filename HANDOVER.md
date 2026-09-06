# Mu-mirror-F 前端交接文档

> 2026-09-06 多 Agent 开发阶段收尾交接。接手人：项目所有者。
> 配套阅读：`docs/2026-09-03-system-design-v2.md`（主设计 v2.3，第八章=前端协作契约）。

## 1. 技术栈与运行

| 项 | 值 |
|---|---|
| Vue 3 + Vite + Pinia + vue-router，**纯 JS（无 TS）**，零 UI 库 | `package.json` |
| Node | ^22.18.0 \|\| >=24.12.0 |
| dev | `npm run dev` → **5199**，proxy `/api` → `http://localhost:9050` |
| build | `npm run build`（当前零警告） |
| 图表 | 纯 SVG 手写（components/charts/），零图表库 |

## 2. 设计语言：「晨纸」亮色主题

- 暖白纸面 `--ink: #FAFAF8` + 墨蓝 `--accent: #2C5FE8` + 白卡细边
- **禁深色 token**（玻璃拟态/aurora/渐变/backdrop-filter 已全部删除，grep 深色 token 应为 0 残留）
- mood 13 色映射在 `src/constants/moodColor.js`（白底降饱和）
- Toast/空态图标全 SVG **无 emoji**
- 动效：卡片 hover 上浮、记录瀑布入场、日历 dayPop、镜子数字 rAF 滚动、气泡入场；尊重 reduced-motion
- 布局：桌面 fluid 居中（内容占比 ~75%）、双导航（sidebar + bottom-nav 凸钮）；移动端 375px 必须走查

## 3. 目录导航

```
views/        Records / Calendar / Mirror / Chat / Vault / Settings / auth
components/   atoms→molecules→organisms→templates 分层；重点：
  VaultDigestReceipt.vue   消化回执卡（确认门禁版：key/描述可编辑 + 确认/仅保管）
  AssetCard.vue            资产卡（五态徽标/未确认灰标/后四位删除/补确认入口）
  VaultRefCard.vue         对话内文件卡（三档引用强度）
  RecordsSidebar.vue       记录页侧栏四卡（今日概览/总结/情绪带/待办速览）
  ToastContainer.vue       带 5 秒撤销窗（删除延迟 5s 真发）
charts/       六图表系统（MoodBand/HourHeat/TodoRing/WeekdayBar/Keywords/Frequency）
stores/       11 个 pinia store（auth/chat/records/mirror/vault/glossary/stats/summaries/settings/ui/toast）
api/          按域分文件；request.js 是 axios 封装（code!==200 判错，R 包装无 success 字段）
composables/  useRecordPolling（2.5s 轮询审核态）
utils/        time.js（Asia/Shanghai 口径）/ storage.js
constants/    moodColor.js + CONTENT_TYPES
```

## 4. mock 开关现状（全部已切真）

| store | 开关 | 值 |
|---|---|---|
| vault.js | USE_MOCK | **false**（真接口） |
| glossary.js | USE_MOCK | **false** |
| mirror.js | USE_MOCK / USE_MOCK_MONTHLY | **false / false** |

demo/演示数据兜底仍在（如 chat store vault_refs 五态 demo），接口不在线时页面不白屏。

## 5. 近两轮大改动（为什么长这样）

1. **确认门禁交互**（ae2bc0c）：上传后不再"已消化✓"，而是 extracted 态——回执卡展示 key/描述可编辑 + [确认，让它可被检索]/[仅保管] 两键；五态徽标（pending 灰/extracted 蓝待确认/confirmed 绿/skipped 灰/failed 红）。
2. **三层防误删**：对话内删除内联确认带文件名；资产页输入文件名后四位（`X-Confirm-Name` 头）；删除 toast 5 秒撤销窗（真删推迟 5s）。
3. **竞态规避**：上传卡显示名不发 PUT（防把 digest_status 覆盖回 pending），显示名在回执确认时以 key 提交才落库。
4. **递归镜子**（c31016b）：设置页"镜子引擎"组回看深度滑块 0-3（0=只继承上月镜子…3=全部原文，慢）。
5. 图片上传 description 必填；未确认置顶区拆两级（低信息无描述 + 有描述未确认）。

## 6. 走查纪律（接手后改前端请保持）

- `node coordination/check-imports.js`（防漏 import 白屏——曾连环出过 3 次）脚本在协作中心目录
- `npm run build` 零警告
- 375px 移动端走查 + 控制台 0 error
- 验证脚本/截图在 `.verify/`（未跟踪，不进构建，可随时删）

## 7. 已知问题 / 待办

| 项 | 说明 |
|---|---|
| 截断 toast 未透出 | 镜子四道防洪闸触发时后端未透 meta 提示，前端"已截取最近部分"toast 按设计稿声明降级为不做 |
| fileReason 差异清单 | 三 mock 切真走查时未发现契约不符；若后端改字段先看 api/ 对应文件 |
| demo 数据 | chat store 里有 vault_refs demo 五态样例，纯展示兜底，接真后不影响 |

## 8. 联调顺序

后端 9050 + Python 50051 在线 → `npm run dev` → 登录 xxx/111111 → 上传文件走确认门禁 → 对话问"我论文咋样了"看文件卡 → 镜子页生成/回看深度滑块 → 资产页五态与删除撤销。
