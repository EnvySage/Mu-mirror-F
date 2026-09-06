import request from './request'

/**
 * 查询最新画像快照（优先 manual，其次 monthly；从未生成时返回空 VO id=null）
 * @returns {Promise<{ code: number, data: import('@/stores/mirror').MirrorProfile }>}
 */
export function getMirror() {
  return request.get('/mirror')
}

/**
 * 生成 manual 画像快照（阻塞数秒到数十秒，调用方需 loading 态）
 * @returns {Promise<{ code: number, data: import('@/stores/mirror').MirrorProfile }>}
 */
export function generateMirror() {
  // 画像生成阻塞数十秒（五维统计+LLM+Embedding），绕开 axios 全局 15s 超时
  return request.post('/mirror/generate', null, { timeout: 120000 })
}

/**
 * 聚合统计（GET /mirror/stats?days=30）
 *
 * 返回最近 N 天的六维统计：moodDaily（按日情绪）/ hourDist（24 小时分布）/
 * weekdayDist（周分布，周一=0）/ keywordTop（关键词 Top）/ todo（待办完成度 +
 * openItems）/ recordDaily（按日记录数）。hourDist/weekdayDist/recordDaily 后端补零全量返回。
 *
 * 注意：响应拦截器会把 camelCase 统一转 snake_case（mood_daily / hour_dist /
 * keyword_top / open_items / task_status 等），stats store 内做双格式归一。
 *
 * @param {number} [days] - 统计窗口天数（默认 30）
 * @returns {Promise<{ code: number, data: Object }>}
 */
export function getStats(days) {
  return request.get('/mirror/stats', { params: days ? { days } : {} })
}

/**
 * 按月生成 monthly 画像快照（POST /mirror/generate-monthly?month=YYYY-MM）
 *
 * month 可空 = 上个月（与月度定时任务同语义）。指定月份需早于当前月：
 * 当前月用 POST /generate（manual 语义），未来月份无数据，二者后端均返回 400。
 * 同 (user, month) 重复调用为重生成（替换该月旧 monthly 快照），无 409 幂等冲突。
 * 阻塞数秒到数十秒（该月五维统计 + LLM + Embedding），调用方需 loading 态并放宽超时。
 *
 * @param {string} [month] - 目标月份 "2026-08"；缺省 = 上个月
 * @returns {Promise<{ code: number, data: import('@/stores/mirror').MirrorProfile }>}
 */
export function generateMonthly(month) {
  // 与 generateMirror 同口径：阻塞数十秒，绕开 axios 全局 15s 超时
  return request.post('/mirror/generate-monthly', null, {
    params: month ? { month } : {},
    timeout: 120000,
  })
}

/**
 * 快照历史列表（GET /mirror/snapshots）
 *
 * 当前用户全量快照（manual 保 2 + monthly 保 12，上限 14），按时间倒序。
 * 轻量结构：{ id, snapshotType, createdAt, driftDistance, overallSummary(前 50 字截断) }。
 * driftDistance 仅 monthly 快照有值，manual 无对比基线为 null（响应里字段可能缺省）。
 *
 * 注意：camelCase 经响应拦截器统一转 snake_case（snapshot_type / created_at / drift_distance）。
 *
 * @returns {Promise<{ code: number, data: Array<{ id: number, snapshot_type: string, created_at: string, drift_distance: number|null, overall_summary: string }> }>}
 */
export function getSnapshots() {
  return request.get('/mirror/snapshots')
}

/**
 * 单份完整快照（GET /mirror/snapshots/{id}）
 *
 * 结构与 GET /mirror 的 MirrorProfileVO 一致（含 id/snapshotType/driftDistance 等字段）。
 * 后端做归属校验：不存在或非本人快照一律 RECORD_NOT_FOUND。
 *
 * @param {number|string} id - 快照 ID
 * @returns {Promise<{ code: number, data: import('@/stores/mirror').MirrorProfile }>}
 */
export function getSnapshot(id) {
  return request.get(`/mirror/snapshots/${id}`)
}
