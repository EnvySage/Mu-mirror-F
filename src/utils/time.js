/**
 * 解析日期字符串，兼容 "2026-08-07 06:22:58" 和 ISO 格式
 * @param {string} dateStr - 日期字符串
 * @returns {Date}
 */
export function parseDate(dateStr) {
  if (!dateStr) return new Date()
  // 将 "2026-08-07 06:22:58" 转为 ISO 格式 "2026-08-07T06:22:58"
  const isoStr = dateStr.replace(' ', 'T')
  return new Date(isoStr)
}

/**
 * 格式化时间为相对时间（如"刚刚"、"5分钟前"）
 * @param {string} dateStr - 日期字符串
 * @returns {string}
 */
export function timeAgo(dateStr) {
  const diff = Date.now() - parseDate(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return m + '分钟前'
  const h = Math.floor(m / 60)
  if (h < 24) return h + '小时前'
  const d = Math.floor(h / 24)
  if (d === 1) return '昨天'
  return d + '天前'
}

/**
 * 格式化日期为中文标签（如"7月27日"）
 * @param {string} dateStr - 日期字符串
 * @returns {string}
 */
export function dateLabel(dateStr) {
  return parseDate(dateStr).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

/**
 * 格式化完整日期
 * @param {Date} date
 * @returns {string}
 */
export function formatFullDate(date) {
  return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日'
}
