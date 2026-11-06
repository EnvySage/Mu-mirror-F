# 塔罗 v2 前端（2026-10-30）

## 完整素材联调（2026-11-04）

78 张卡面均已接入：22 张大牌、四组各 14 张小牌。当前使用 67 张 v2 PNG 和 11 张保留的 v1 PNG；女祭司使用已批准的新版星月边框。完整文件及哈希清单为 `docs/tarot-v2-assets.json`，逐张原生生成提示词及修正记录见两份 art manifest。

`tests/browser/tarot-assets-v2.mjs` 在 375、768、1440 三种宽度逐张请求并解码全部 78 张真实图片，核对名称、灰度、可点击鉴赏与 22/14/14/14/14 分类数量。全部 HTTP 200，无缺图占位或页面异常。最终逐图报告和截图位于本地 `Mirror/tarot-v2-validation/final-2026-11-04/`。

本次重新通过前端 56 项测试、普通/独立预览构建、v2 行为浏览器验收、原有跨日与资料偏好回归、正常/减少动画及短横屏测试。静态预览监听 `127.0.0.1:5190`，使用合成数据。

另行通过真实 HTTP → Java → Python gRPC → 本地 OpenAI 兼容模型桩的隔离验收，覆盖 78 目录、正逆位传递、请求重放、历史分页、分析多版本和来源撤回隐藏。后端 14 项聚焦数据库测试、AI 9 项聚焦测试通过。模型桩验证协议和产品行为，不代表目标模型的解读质量；真实用户库尚未执行 v14 迁移。

真实浏览器也已在 `127.0.0.1:5191` 完整连接 Java `19050`（没有拦截 HTTP）：每日逆位权杖二刷新保留且只计一次收藏；问题逆位宝剑王后的两次分析均完成，历史与两版本刷新后仍存在，问题牌不解锁收藏；页面与塔罗 HTTP 错误均为零。报告位于 `Mirror/tarot-v2-validation/live-ui-2026-11-04/sanitized-report.json`。这轮修正了历史详情窄缩略图的宫廷牌等级挤压中文名称问题，并在 375/1440 宽度重验。

联调发现的创建/重放时间精度差异已修复：Java 在保存前统一微秒精度，加入纳秒时钟回归用例；真实服务严格比较整份抽牌响应（含时间）通过。上述服务使用独立合成账号、数据库和本地模型桩，不读取真实用户日记。

此文记录 v2 的界面与协议验收，替代首版文档中 12 张牌、未获得牌显示牌背、收藏鉴赏只切换已获得牌的行为。旧版动效和资料引用机制继续保留。

## 已实现行为

- 78 张牌按大阿尔卡纳 22 张、权杖/圣杯/宝剑/星币各 14 张展示，支持全部和五类筛选，并显示总进度与各类进度。
- 收藏册显示所有牌的名字和插画。未收藏的插画使用灰度，仍可点击查看原图、牌义与行动提示；已收藏的牌显示彩色、北京时间的首次获得日期和每日抽中次数。问一问不解锁收藏。
- `TarotArtwork` 为五类提供不同的边框与类别标志。`TarotCard`、每日/问题牌桌、揭牌特写、原图鉴赏、找回旧牌和历史详情都接收服务端保存的 `orientation`。逆位仅旋转图片，外部标题保持正向，并使用对应逆位关键词、牌义与行动。
- 「相遇记录」统一展示每日牌与问一问，按 20 条加载；追加分页时若服务端总数变化，则从最新页重新开始，避免其他标签页新增抽牌导致偏移重叠或漏掉新记录。选择历史问题牌可查看它保存的多个解读版本。首次打开优先采用刚读取的版本列表中的最新版本，避免历史列表携带过期 latestAnalysisId；每次选择版本都调用现有详情接口重新校验资料有效性；`stale` 或 `failed` 不展示正文。查看历史不会替换当前的问题牌或问题输入。
- 账号变更立即清空历史、版本、解读与所有抽牌状态；异步响应以账号代次和当前历史选择校验，过期请求不能回写到新账号或新选择。
- 保留每日幂等重试、跨日旧请求找回、同牌重新解读、来源查看、Escape/焦点返回、滚轮/双指缩放、拖动、减少动画与移动端滚动。

## 接口

响应仍通过现有 Axios 拦截器从 camelCase 转为 snake_case；出站请求维持 camelCase。

- 牌目录新增 `category`、`reversedKeyword`、`reversedMeaning`、`reversedAction`。
- 每日 draw 与问题 reading 新增 `orientation: upright | reversed`。
- `GET /tarot/history?limit=20&offset=0` 返回 `{ items, total, limit, offset, hasMore }`。每项含 `id, kind, cardId, catalogVersion, orientation, drawDate, createdAt, latestAnalysisId`。
- `GET /tarot/readings/{id}/analyses` 返回版本元数据数组，正文通过已有 `GET /tarot/analyses/{analysisId}` 按需读取。
- 演示预览适配器同步提供 78 张牌、正逆位、每日/问题统一历史与多版本接口；数据是浏览器内存中的合成数据。

## 本次验证

| 检查 | 已观察结果 |
| --- | --- |
| `npm test` | 56 项通过，0 失败 |
| `npm run build` | 通过 |
| `npm run build:preview -- --outDir .verify/tarot-v2-preview` | 通过，使用独立输出目录 |
| `tests/browser/tarot-v2.mjs` | 375/768/1440 全通过：78 张与五类数量、正逆位内容和图片、每日丢响应重试、未收藏可看、日期次数、问题牌不解锁、同牌失败重解、历史分页及跨标签页新增后的重新分页、最新版本刷新、多版本与失效隐藏、换账号清空、无横向溢出、0 页面异常 |
| `tests/browser/tarot.mjs` | 375/768/1440 全通过：原有偏好设置、刷新恢复、跨零点旧请求找回与新日抽取等回归 |
| `tests/browser/tarot-motion.mjs` | 三类屏宽的真实滚动；375/1440 正常动画、768/844×390 减少动画下的确认等待、正面揭牌、首次获得、嵌套鉴赏、滚轮/双指缩放、拖动、关闭后触摸滚动全部通过 |
| `tests/browser/tarot-preview-v2.mjs` | 不拦截 API，实际预览适配器的 78 目录、每日解锁、两种历史与两次解读版本切换通过 |

浏览器测试使用已安装 Chrome 的 Playwright，无真实用户数据。HTTP 夹具验收证明前端请求/渲染行为，预览验收证明演示适配器；两者不代替后端数据库、模型与整条真实链路验收。新牌插画的完整性与艺术审核由 `tarot-v2-art.md` 和清单单独记录。

## 复现

普通生产构建用于 HTTP 夹具验收（不要用启用了预览适配器的构建）：

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 5179 --strictPort
# 另一个终端；PLAYWRIGHT_MODULE 可指向已有模块目录
$env:TAROT_UI_URL='http://127.0.0.1:5179'
# 不设置 TAROT_CATALOG 时直接读取 src/preview/tarotCatalog.json
node tests/browser/tarot-v2.mjs
node tests/browser/tarot.mjs
```

独立演示构建：

```powershell
npm run build:preview -- --outDir .verify/tarot-v2-preview
npm run preview -- --host 127.0.0.1 --port 5190 --strictPort --outDir .verify/tarot-v2-preview
# 另一个终端
node tests/browser/tarot-preview-v2.mjs
node tests/browser/tarot-motion.mjs
```

`TAROT_SCREENSHOTS` 可配置 HTTP 验收截图输出目录。本次 375/768/1440 的 daily、collection、gallery-reversed、history 截图保存在工作区的 `tarot-v2-validation/screenshots`，用于人工检查。未提交、未推送、未部署。
