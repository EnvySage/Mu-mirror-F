import request from './request'

/**
 * 查询每日总结
 *
 * 不带 date：返回日报列表（新→旧），content 为空、highlights 为前 3 行摘要；
 * 支持游标分页（limit 每页条数 / before = summary_date 游标，只返回更早的）。
 * 带 date（YYYY-MM-DD）：返回该日单篇数组（含全文 content），忽略分页参数。
 *
 * @param {string} [date] - 日报日期（YYYY-MM-DD，可空）
 * @param {{ limit?: number, before?: string }} [page] - 分页参数（仅列表查询生效）
 * @returns {Promise<{ code: number, data: { record_id: number, summary_date: string, content: string | null, stats: Record<string, any>, created_at: string, highlights: string[] | null }[] }>}
 */
export function getSummaries(date, page) {
  const params = {}
  if (date) params.date = date
  if (page?.limit != null) params.limit = page.limit
  if (page?.before) params.before = page.before
  return request.get('/summaries', { params })
}

/**
 * 补生成 / 重生成指定日期的日报（POST /summaries/regenerate）
 *
 * 日报平时只由 01:00 定时任务生成且只跑"昨天"，某天失败就丢了；这个接口是手工补入口。
 * @param {string} date - YYYY-MM-DD（必须早于今天）
 * @param {boolean} [force=false] - true = 已有日报时删旧重建；false = 已有则跳过
 * @returns {Promise<{ code: number, data: object|null, message: string }>} data 为 null 表示无需生成
 */
export function regenerateSummary(date, force = false) {
  return request.post('/summaries/regenerate', null, { params: { date, force } })
}

/**
 * 查询最近 N 天内「有记录但缺日报」的日期（GET /summaries/missing）
 * @param {number} [days=7] - 回溯天数
 * @returns {Promise<{ code: number, data: string[] }>} 日期数组（yyyy-MM-dd，新→旧）
 */
export function getMissingSummaries(days = 7) {
  return request.get('/summaries/missing', { params: { days } })
}

/**
 * 回溯补生成最近 N 天缺失的日报（POST /summaries/backfill）
 *
 * 没生成成功的那天不会出现在列表里，也就点不到「重新生成」——这个接口按天回溯补。
 * 每天一次 LLM 调用，阻塞较久，单独放宽超时（与 confirm 同口径）。
 * @param {number} [days=3] - 回溯天数（1~7）
 * @returns {Promise<{ code: number, data: number, message: string }>} data = 补生成了几份
 */
export function backfillSummaries(days = 3) {
  return request.post('/summaries/backfill', null, { params: { days }, timeout: 120000 })
}
