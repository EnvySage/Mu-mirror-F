import request from './request'

/**
 * 待办登记表 API（todo-registry-design.md §2/§3.3/§4 F 行，B Agent 提供）
 *
 * GET    /todos/pending-suggestions   pending 建议列表（机器猜的，等用户裁决；
 *                                      侧栏只读展示 + 导航，裁决唯一入口 = 记录审核页）
 * GET    /todos                       登记列表（审核页「手动关联待办」选择面板数据源；
 *                                      后端按"未完成在前"排序，含已完成 todo）
 * DELETE /todos/{id}                  软删待办（侧栏「管理层操作」特例直点）
 * GET    /todos/open-chain            未完成待办证据链（TodoChainCard 数据源）
 *
 * 包装层：GET /todos/pending-suggestions → { data: { suggestions: [...] } }
 *         GET /todos/open-chain          → { data: { chains: [...] } }
 *         GET /todos                     → { data: { todos: [...] } }
 * （读取端兼容裸数组，见 store 内的 unwrap）
 *
 * 已下线（随「状态变更唯一入口 = 记录审核页」重构）：旧直调 PUT /todos/{id}/status、
 * 逐条裁决 POST /todos/suggestions/{id}/resolve；后端 B 侧同步删除这两个端点。
 * （GET /todos 清单端点重新启用，仅用于审核页手动关联选择，不再做 registry 直调反查。）
 *
 * 字段口径（后端 camelCase，经 request.js 拦截器转 snake_case；证据为平铺字段，
 * 不是嵌套对象）：
 * @typedef {Object} TodoSuggestion
 * @property {number|string} id             建议 id（关联待办裁决 body 的 suggestionId）
 * @property {number|string} todo_id        关联登记表条目 id
 * @property {string} title                 待办标题
 * @property {'not_started'|'in_progress'|'completed'} current_status   条目当前状态
 * @property {'not_started'|'in_progress'|'completed'} suggested_status 机器建议改成的状态
 * @property {string} evidence_excerpt      证据摘录
 * @property {number|string} evidence_record_id 证据所在记录 id（证据行跳记录详情）
 * @property {string} created_at            建议/证据时间
 */

/**
 * 拉取 pending 建议列表
 * @returns {Promise<{ code: number, data: { suggestions: TodoSuggestion[] } }>}
 */
export function getPendingSuggestions() {
  return request.get('/todos/pending-suggestions')
}

/**
 * 未完成待办的证据链（R17 TodoChainCard 数据源；与 B Agent 契约同一份，逐字为准）
 *
 * GET /todos/open-chain → { chains: [{ todoId, title, currentStatus, createdAt,
 *   origin: { chunkId, recordId, excerpt, date } | null,
 *   evidence: [{ chunkId, recordId, excerpt, date, confirmedAt }],
 *   pendingSuggestionCount }] }
 *
 * chains 已按 createdAt DESC（仅未完成待办）。pending 建议明细不在此接口内，
 * 仍走 GET /todos/pending-suggestions，由 store 组合渲染（链尾部虚线节点）。
 *
 * @returns {Promise<{ code: number, data: { chains: Array } }>}
 */
export function getOpenChains() {
  return request.get('/todos/open-chain')
}

/**
 * 待办登记列表（审核页「手动关联待办」选择面板数据源）
 *
 * 契约：GET /api/todos → { data: { todos: [{ id, title, currentStatus,
 *   sourceChunkId, sourceExcerpt, orphan, linkCount, pendingSuggestionCount,
 *   createdAt, closedAt }] } }
 * 响应经 request.js 拦截器转 snake_case（current_status / source_chunk_id …）。
 * 后端已加"未完成在前"排序，可选范围含已完成 todo（用户拍板）。
 * @returns {Promise<{ code: number, data: { todos: Array } }>}
 */
export function getTodos() {
  return request.get('/todos')
}

/**
 * 删除待办（软删；侧栏「管理层操作」特例直点，需先经影响清单弹框确认）
 * 契约：DELETE /api/todos/{id}
 * @param {number|string} id - todo_registry.id
 * @returns {Promise<{ code: number, data: Object|null }>}
 */
export function deleteTodo(id) {
  return request.delete(`/todos/${id}`)
}
