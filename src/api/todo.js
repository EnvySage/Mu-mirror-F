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
 * 字段口径（snake_case，与 request.js 拦截器输出一致）：
 * @typedef {Object} TodoSuggestion
 * @property {number|string} suggestion_id
 * @property {number|string} todo_id
 * @property {string} todo_title
 * @property {'not_started'|'in_progress'|'completed'} suggested_status
 * @property {{ chunk_id: number|string, excerpt: string, created_at: string,
 *              record_id?: number|string }} evidence   record_id 供证据行跳记录详情
 *                                                      （联调字段需求，见 F 日志差异清单）
 * @property {string} todo_created_at
 */

/**
 * 拉取 pending 建议列表
 * @returns {Promise<{ code: number, data: TodoSuggestion[] }>}
 */
export function getPendingSuggestions() {
  return request.get('/todos/pending-suggestions')
}

/**
 * 裁决建议（用户主权：确认带三态可改 LLM 建议；忽略永久静默同一证据）
 * @param {number|string} id - suggestion_id
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
 * @returns {Promise<{ code: number, data: Array<{ id: number|string, title: string,
 *            current_status: string, source_chunk_id?: number|string }> }>}
 */
export function getTodos() {
  return request.get('/todos')
}
