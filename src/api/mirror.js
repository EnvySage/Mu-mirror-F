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
