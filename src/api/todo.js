import request from './request'

/**
 * 待办登记表 API（todo-registry-design.md §2/§3.3/§4 F 行，B Agent 提供）
 *
 * GET  /todos/pending-suggestions      pending 建议列表（机器猜的，等用户裁决）
 * POST /todos/suggestions/{id}/resolve 裁决（confirmed 带状态 / dismissed 永久静默）
 * PUT  /todos/{id}/status              侧栏直调三态（事务内双写 chunk+registry，
 *                                      并自动作废该待办的 pending 建议）
 * GET  /todos                          登记表条目（开放清单，用于 open_items 缺
 *                                      todo_id 时按 title 反查——契约待 B 定稿，
 *                                      前端只消费 id/title/current_status 三个字段）
 *
 * 包装层：GET /todos/pending-suggestions → { data: { suggestions: [...] } }
 *         GET /todos                     → { data: { todos: [...] } }
 * （读取端兼容裸数组，见 store 内的 unwrap）
 *
 * 字段口径（后端 camelCase，经 request.js 拦截器转 snake_case；证据为平铺字段，
 * 不是嵌套对象）：
 * @typedef {Object} TodoSuggestion
 * @property {number|string} id             建议 id（裁决端点路径参数）
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
 * 裁决建议（用户主权：确认带三态可改 LLM 建议；忽略永久静默同一证据）
 * @param {number|string} id - 建议 id（TodoSuggestion.id）
 * @param {'confirmed'|'dismissed'} action
 * @param {string} [status] - action=confirmed 时必带：用户最终选定的状态
 * @returns {Promise<{ code: number, data: Object|null }>}
 */
export function resolveSuggestion(id, action, status) {
  return request.post(`/todos/suggestions/${id}/resolve`, {
    action,
    ...(action === 'confirmed' && status ? { status } : {}),
  })
}

/**
 * 侧栏直调：改待办状态（chunk.metadata.taskStatus + registry.current_status 事务双写）
 * @param {number|string} id - todo_registry.id
 * @param {'not_started'|'in_progress'|'completed'} status
 * @returns {Promise<{ code: number, data: Object|null }>}
 */
export function setTodoStatus(id, status) {
  return request.put(`/todos/${id}/status`, { status })
}

/**
 * 登记表条目清单（开放项；用于 open_items ↔ registry 关联反查）
 * @returns {Promise<{ code: number, data: { todos: Array<{ id: number|string, title: string,
 *            current_status: string, source_chunk_id?: number|string }> } }>}
 */
export function getTodos() {
  return request.get('/todos')
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
