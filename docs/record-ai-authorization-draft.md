# 记录、AI 整理与记忆授权：需求草案

状态：讨论稿。用于下一轮需求确认；不代表已实现，也不授权自动执行迁移。
核对日期：2026-10-16。

## 仓库与基线

- Java：`../Mu-mirror-B`，`ai` 分支 `5c7b077`，已 fetch，当前提交同时等于 origin/ai 和 origin/main。
- Python：`../Mu-mirror-AI`，`ai` 分支从 `5fcd074` 快进到 `28ec494`，与 origin/ai、origin/main 一致。
- 前端：本仓 `codex/p3r-ui` 保留全部 UI 改动，合并 origin/main 的部署与文档更新，合并提交 `a16252f`。
- 三仓角色已核实：B 是 Java，AI 是 Python gRPC，F 是 Vue 前端。用户消息中 Python 路径写作 F；按同级目录内容识别出 AI 仓，后续业务改动前仍需告知这一对应关系。

## 已在讨论中明确的边界

1. 保存原文与允许 AI 使用，是两个不同的动作。
2. “仅记录”允许保存、回看、编辑、删除，不授权分类、embedding、对话检索、总结、画像或其他 AI 消费。
3. 请求 AI 整理，仅授权对选定内容进行本次处理。生成候选不等于获得长期记忆授权。
4. 只有用户确认的内容，才允许进入后续 AI 使用范围。原文可用于追溯已确认内容的来源，不能借此读取其余未授权内容。
5. 瞬时情绪与长期特征应区别处理；确认一条观察也不等于确认任意衍生推断。

## 当前代码实际行为

- `RecordServiceImpl.create`：只接收内容，保存后立即置 PROCESSING 并发布事件；没有“仅记录”参数或状态。
- `RecordEventListener.onRecordCreated`：提交事务完成后运行清洗、分类并建立无向量候选 chunk，然后置 REVIEWING。
- `RecordServiceImpl.confirmReview`：按整条 record 确认，读取其全部剩余 chunks；可能补分类，逐个生成向量，然后将 record 置 DONE。不是逐候选的独立确认状态。
- 自动确认分支存在，但受 `review.auto-enabled` 总闸和用户 review_mode 两级限制；不能仅凭代码存在断言线上启用。
- `ChunkMapper.selectLookbackChunks`、`selectRecentContextHints`、`selectCorrectionIndex`：限制 user 来源、未删除、DONE。已有审核门禁，需要在新粒度下继续保留。
- `ChatSearchMapper`：结构化检索显式检查 DONE；其他查询还依赖 embedding/classified_segment 等条件。新授权规则需逐条核对所有检索入口和工具，不能把向量存在当作授权依据。
- `DailySummaryMapper.selectDayRecords`：虽限定 DONE，但读取的是整条 `records.content`。若改成只确认部分片段，此处必须同步改，避免把剩余原文重新发给 AI。
- `SummaryServiceImpl`：系统日报自动标 DONE、userReviewed=true，并尝试 embedding。这里需要区分“系统生成的推断”和“用户亲自确认”，不能直接沿用新语义。
- Python 服务无数据库、无业务状态，输入由 Java 组装。因此授权判定首先落在 Java；Python 负责遵守输入范围及生成结果的表达，不独自充当权限门禁。

## 仍需明确的产品决策

- 默认保存方式：默认仅记录，还是显式选择 AI 整理？建议默认仅记录，并让 AI 整理有清晰入口；这是建议，不是已确认决策。
- 确认粒度：按整条日记、片段，还是片段中的事实/情绪/待办候选？此前例子涉及部分确认，现有 record 状态不能完整表达。
- 已确认内容被编辑、撤回、删除后，哪些记忆立即失效，哪些历史总结/快照需要标过期或重新生成？需覆盖进行中的 AI 任务，防止撤回后回写。
- 系统总结和画像可以直接供用户阅读，但是否可以再参与后续推断？若允许，必须保留系统生成属性及来源授权，不能伪装成人工确认。
- 历史 DONE 包含哪些人工或自动确认来源？现有数据可否辨别，尚未验证。迁移不得假定它们全部经过人工确认，也不得擅自删除旧数据。

## 测试约束与验收方向

用户明确：当前不连接数据库，测试只能使用桩数据。

- Java：Mockito 模拟 mapper、gRPC 和事件依赖；选择不启动数据库/Redis的单元测试。不要直接跑会拉起完整 Spring 环境的 contextLoads。
- Python：桩 LLM、mock gRPC 请求及固定输入，不访问真实模型服务，不启动数据库。
- 前端：独立示例接口覆盖仅记录、待整理、待确认、部分确认、已确认、失败与撤回等状态。
- 关键断言：仅记录不触发任何 AI 调用；候选不被长期使用；只确认 A 时 B 不出现在检索、统计推断、日报或画像输入；编辑/撤回后旧向量不再放行；来源追溯不回退到整篇未授权原文。
- 无数据库测试不能证明 PostgreSQL 查询真实执行结果、迁移可重放性、索引表现或事务并发正确。相关事项列为待真实集成验证，不宣称完成。

本轮仅同步仓库和核对代码，未执行数据库迁移，未启动真实后端，未改变审核与授权逻辑。
