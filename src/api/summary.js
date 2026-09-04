import request from './request'

/**
 * 查询每日总结
 *
 * 不带 date：返回全部日报列表（新→旧），content 为空、highlights 为前 3 行摘要。
 * 带 date（YYYY-MM-DD）：返回该日单篇数组（含全文 content）。
 * @param {string} [date] - 日报日期（YYYY-MM-DD，可空）
 * @returns {Promise<{ code: number, data: { record_id: number, summary_date: string, content: string | null, stats: Record<string, any>, created_at: string, highlights: string[] | null }[] }>}
 */
export function getSummaries(date) {
  return request.get('/summaries', { params: date ? { date } : {} })
}
