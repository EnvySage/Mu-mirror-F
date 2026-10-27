# 塔罗首版验收（2026-10-27）

## 最新反馈修订：透明碎片与原图查看

此节替代下面旧版展示方式的说明。

- 修复全局 `button` 的 CSS transform 过渡干扰 GSAP 翻面终点：显式从 -180° 到 0°，卡面按钮不再叠加全局 transform 过渡。正常动画和减少动画下均检查正面朝向。
- 展示使用明亮水面、半透明不规则玻璃切面与反光边缘；移除实心蓝色大板和整屏黑色压暗。碎片错位入场，按钮使用错切边角。
- 点击每日或问一问的未抽牌背也可启动原流程；收下卡牌时缩小落下并淡出。每日不可重抽、问一问不解锁的规则保持。
- 点击卡牌直接全屏显示完整原图；没有第二层标题、背景装饰或牌列。支持双指/滚轮缩放、放大后拖动、双击切换缩放、还原、Escape 关闭，收藏原图可前后切换已获得的牌。
- 手机底栏固定为记录、对话、新建、镜子、探索。探索首位为塔罗，下方保留日历、记忆资产、每日总结、设置与布局切换；面板可滚动，取消后恢复焦点。

验证：`tests/browser/tarot-motion.mjs` 覆盖正常/减少动画、等待点击、正面揭牌、牌背点击、收下退场、原图适屏、滚轮缩放、真实双指事件、拖动以及退出后页面触摸滚动。`tests/browser/mobile-explore.mjs` 覆盖 320×600、375×812、844×390，以及宽屏强制手机布局的入口、导航、滚动、焦点和新建记录。`tests/browser/tarot.mjs` 的三屏宽 HTTP 夹具验收通过；生产构建及 50 项现有测试通过。上述移动验收为浏览器模拟，不是真机测试。

回档：牌背修复 `a52a737`；点击与收下动画 `64f26ac`；手机探索 `43a4539`；透明碎片 `9db6d7e`；原图查看见本节所在提交。

最新截图：[手机展示](tarot-evidence/acquisition-revised-375.png)、[全屏原图](tarot-evidence/gallery-revised-1440.png)、[手机探索](tarot-evidence/explore-375.png)。

## 视频动效修订（2026-10-27）

按用户补充意见重新检查参考视频塔罗段：约 31–36 秒的黑色罗马时钟、等待点击与收回揭牌，约 52–58 秒的主牌特写和错位牌列。

- 修复页面缺少受约束滚动容器的问题：每日运势、问一问、收藏册均可独立滚动。
- 问一问先展开全屏黑色时钟；不计时跳转、不提前请求抽牌。用户点击时钟或用键盘确认后，时钟旋转收回，蓝色斜切幕过场，再翻转揭牌。退出等待不抽牌。
- 每日抽取沿用一次点击；首次解锁按服务端 `newly_collected` 展示独立「初次相遇 / 新收藏」画面和「收下这张牌」按钮。重复鉴赏不冒充新收藏。
- 全屏鉴赏使用大卡面、环形背景、斜切巨型字、已收藏牌列；可切换、放大并滚动查看细节。问一问结果不进入收藏牌列。
- 减少动态效果设置保留相同的用户确认流程，跳过旋转和飞入；请求失败可找回同一次抽牌。

验证：`npm test` 50/50、生产构建通过；`tests/browser/tarot.mjs` 三种屏宽全部通过（HTTP 响应夹具，含跨日丢响应重试和收藏牌列切换）。`tests/browser/tarot-motion.mjs` 在 375/768/1440 宽度验证鼠标滚动、等待期间无揭牌、整屏时钟点击、首次收藏、问一问不解锁、嵌套鉴赏退出、细节滚动及关闭后触摸滚动；覆盖正常动画和减少动画两种设置。实际截图检查包括 375×600 的短屏布局。

动效验收启动独立演示服务：`VITE_DEMO_PREVIEW=true`，默认端口 5190；运行 `node tests/browser/tarot-motion.mjs`。这是合成数据预览，正式服务与真实模型验收边界仍见下文。

截图：[黑色时钟](tarot-evidence/clock-revised-375.png)、[首次获得](tarot-evidence/acquisition-revised-375.png)、[收藏特写](tarot-evidence/gallery-revised-1440.png)。

回档点：滚动修复 `34135fe`；时钟与首次获得 `a87394b`；收藏特写与交互验收见后续 `feat(tarot): stage collection closeups and verify motion` 提交。

短屏补充：844×390 横屏下原字号会裁掉收藏确认文字，现按可用高度压缩字号与间距；竖屏为倾斜文字保留底部余量。动效浏览器验收额外覆盖横屏，并检查首次获得文字完整位于展示区域内。

状态：正式功能已实现，位于三仓 codex/tarot-20261026 分支；未推送、未部署。上线前仍需使用目标模型进行语气验收。独立代码审查的两项问题已修复并完成失败→通过的回归验证。

## 已完成

- 12 张原创牌面、每日随机且同日不可替换、上海零点换日。
- 每日抽牌才解锁收藏；问一问只抽单张、不解锁收藏。
- 日记 7/30/90 天、未完成待办、已有镜子可独立配置；没有问题不读取私人材料。
- 解读持久化、刷新恢复、超时失败可重新解读同一张牌；来源失效隐藏旧解读。
- 日牌只进入聊天最终答复，规划和画像不带牌义；闲聊同会话每天最多预留一次机会，支持停用。
- 桌面侧栏及镜子页入口，375/768/1440 布局、减少动画、放大鉴赏、锁定牌背和账号隔离。

## 验证证据

| 检查 | 结果 |
| --- | --- |
| F npm test | 50 通过 |
| F npm run build | 通过 |
| F tests/browser/tarot.mjs | 375/768/1440 全通过：网络响应丢失重试、同日不可换、失败解读保留牌、资料配置、刷新恢复、跨日更新、鉴赏、无横向溢出 |
| B 3 个 Tarot 数据库体验测试类 | 8 通过，无跳过；包括 20 次并发日牌、跨日请求别名、两端聊天额度 |
| B 全量 mvnw test（完整独立 PG 库） | 497 项，488 通过、9 失败、0 错误、0 跳过 |
| B 改动前 abe7ea2 的 ChatRetrievalTest / ToolsTest | 同样 9 项断言失败，确认为原有基线问题 |
| A pytest tests/ | 715 通过、15 跳过；塔罗相关检查未跳过 |
| A upload 同步 | 已运行同步脚本，运行时产物一致 |
| 完整 schema、旧基线升级 + v12 重放 | PostgreSQL 18.6 / pgvector 0.8.7 独立库应用成功 |
| B scripts/tarot_e2e.py | 真实 HTTP / PostgreSQL / Python gRPC / OpenAI 兼容本地桩闭环通过：并发抽取、无模型错误、账号隔离、幂等、三类引用、撤回失效、同牌重试 |
| F tests/browser/tarot-live.mjs | 不拦截 API：恢复真实结果、打开三类原始资料、运行中换账号后结果与收藏清空，通过 |

本地模型桩仅验证协议和产品行为，不代表真实模型措辞质量。测试使用合成账号和日记，没有读取真实用户日记，也没有使用真实模型密钥。AI/tests/fixtures/tarot-evaluation.json 留有 20 条目标模型语气验收样例。

## 运行浏览器验收

在普通 Vite 开发服务上运行（不要使用 preview mock 模式）。安装 Playwright/Chrome，或通过 PLAYWRIGHT_MODULE 指向现有 Playwright 模块。

```powershell
$env:TAROT_UI_URL='http://127.0.0.1:5179'
$env:TAROT_CATALOG='../B/src/main/resources/tarot/catalog-v1.json'
node tests/browser/tarot.mjs
```

真实链路先启动独立测试库和 B 服务、A 的 build_legacy_server(port=18003)、A/scripts/tarot_stub_model.py。B 的模型 RPC 地址指向 127.0.0.1:18003；前端 VITE_API_TARGET 指向测试 B 的端口。设置 MIRROR_TAROT_TEST_DSN 和 MIRROR_TAROT_TEST_OUTPUT 后运行 B/scripts/tarot_e2e.py，再运行 F/tests/browser/tarot-live.mjs。输出目录中的测试登录信息只用于本地验收，不提交仓库。

## 实施取舍

- 按用户要求保留用户能感知的集成与浏览器测试，没有扩张为大量内部实现测试。
- 使用 JdbcTemplate 显式事务与原子 SQL，复用现有依赖。
- 短问题的日记/待办相关性采用有限候选集上的关键词匹配，避免额外向量模型调用；可能漏掉语义相近但不重词的材料，页面显示这一限制。
- 保留已确认的原始 PNG，收藏图按需加载；首张图片下载比 WebP 缩略图大。
- Docker 不可用时使用隔离 PostgreSQL；完整 schema 联调最终使用 WSL 内独立解包的 PostgreSQL/pgvector，未触碰现有业务库。

发布和回退见后端 docs/tarot-operations.md。当前无真实模型可用于语气评审，此项明确保留为上线前检查。

## 最终审查与回档点

两项审查问题已修复：跨零点找回旧牌时单独显示原日期结果，用户再主动抽今天；停止提牌后支持“可以再提”恢复。

- F 页面首版：ce48696；真实来源/日期修复：407d920；演示模式：b87d99b；跨日恢复：见本仓后续 fix(tarot) 提交。
- B 抽牌持久化：86774a6；资料范围：11597a6；异步分析：65c3cd1；聊天限制：e60276c；语义恢复：见本仓 fix(tarot) 提交。
- AI 解读：28d66b4；聊天隔离：4a23e74；最终文档：96f7c9e。

[完整实施取舍](tarot-implementation-decisions.md)。截图：[手机每日牌](tarot-evidence/daily-375.png)、[桌面收藏册](tarot-evidence/collection-1440.png)、[真实接口的问题解读](tarot-evidence/live-question-1440.png)。

开发时使用了共享依赖目录与独立 worktree，原工作目录未合并。功能分支为三个仓库的 codex/tarot-20261026，实际工作目录为 own/worktrees/tarot-20261026/F、B、AI。未推送或部署。
