import request from './request'

/**
 * 创建记录（触发异步管道）
 * @param {{ content: string }} data
 * @returns {Promise<{ code: number, data: RecordVO }>}
 */
export function createRecord(data) {
  return request.post('/records', data)
}

/**
 * 获取记录列表（支持分页和筛选）
 * @param {Object} [params] - 查询参数
 * @param {number} [params.page] - 页码（从1开始）
 * @param {number} [params.size] - 每页条数
 * @param {string} [params.contentType] - 按内容类型筛选
 * @param {string} [params.mood] - 按情绪筛选
 * @param {string} [params.status] - 按处理状态筛选
 * @param {string} [params.startDate] - 开始日期（yyyy-MM-dd）
 * @param {string} [params.endDate] - 结束日期（yyyy-MM-dd）
 * @returns {Promise<{ code: number, data: RecordVO[] }>}
 */
export function getRecords(params) {
  return request.get('/records', { params })
}

/**
 * 获取记录详情（含 chunks）
 * @param {number|string} id - 记录ID
 * @returns {Promise<{ code: number, data: RecordVO }>}
 */
export function getRecord(id) {
  return request.get(`/records/${id}`)
}

/**
 * 更新 Chunk（扁平结构，仅 REVIEWING 状态允许）
 * 注意：后端 ChunkDTO 为扁平结构（segment/title/summary/contentType/mood/keywords），
 * 不接收嵌套 metadata 对象。
 * @param {number|string} chunkId - Chunk ID
 * @param {Object} data - 更新数据
 * @param {string} [data.segment] - 主题片段
 * @param {string} [data.title] - 标题
 * @param {string} [data.summary] - 摘要
 * @param {string} [data.contentType] - 内容类型
 * @param {string[]} [data.mood] - 情绪标签
 * @param {string[]} [data.keywords] - 关键词
 * @returns {Promise<{ code: number, data: ChunkVO }>}
 */
export function updateChunk(chunkId, data) {
  return request.put(`/chunks/${chunkId}`, data)
}

/**
 * 删除 Chunk（v2.0 扩展，片段卡片模型）
 * @param {number|string} chunkId - Chunk ID
 * @returns {Promise<{ code: number }>}
 */
export function deleteChunk(chunkId) {
  return request.delete(`/chunks/${chunkId}`)
}

/**
 * 新增 Chunk（v2.0 扩展；后端同步单段分类回填 metadata，失败不阻断）
 * @param {number|string} recordId - 记录ID
 * @param {{ segment: string }} data
 * @returns {Promise<{ code: number, data: ChunkVO }>}
 */
export function createChunk(recordId, data) {
  return request.post(`/records/${recordId}/chunks`, data)
}

/**
 * 删除记录（软删除，REVIEWING / FAILED 状态允许）
 * @param {number|string} id - 记录ID
 * @returns {Promise<{ code: number, data: null }>}
 */
export function deleteRecord(id) {
  return request.delete(`/records/${id}`)
}

/**
 * 确认审查完成（阻塞数秒——含补分类 + Embedding，调用方需 loading 态）
 * @param {number|string} id - 记录ID
 * @returns {Promise<{ code: number, data: RecordVO }>}
 */
export function confirmReview(id) {
  // confirm 阻塞数秒~数十秒（补分类+Embedding 逐个 chunk），绕开全局 15s 超时
  return request.put(`/records/${id}/confirm`, null, { timeout: 120000 })
}

/**
 * 重试失败记录（重跑管道；后端实现前调用会 404/405）
 * @param {number|string} id - 记录ID
 * @returns {Promise<{ code: number, data: RecordVO }>}
 */
export function retryRecord(id) {
  return request.post(`/records/${id}/retry`)
}

/**
 * 获取日历标记数据
 * 返回指定月份内每天的有效记录数，用于日历组件标记有记录的日期
 * @param {string} month - 月份，格式 2026-08
 * @returns {Promise<{ code: number, data: Record<string, number> }>}
 */
export function getCalendarMarks(month) {
  return request.get('/records/calendar', { params: { month } })
}
