import request from './request'

/**
 * 创建记录
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
 * 获取记录详情
 * @param {number|string} id - 记录ID
 * @returns {Promise<{ code: number, data: RecordVO }>}
 */
export function getRecord(id) {
  return request.get(`/records/${id}`)
}

/**
 * 更新记录（仅在审查状态下允许）
 * 可以修改标题、摘要、内容类型、情绪标签、关键词等 AI 生成的字段
 * @param {number|string} id - 记录ID
 * @param {Object} data - 更新数据
 * @param {string} [data.title] - 标题
 * @param {string} [data.summary] - 摘要
 * @param {string} [data.contentType] - 内容类型
 * @param {string[]} [data.mood] - 情绪标签
 * @param {string[]} [data.keywords] - 关键词
 * @returns {Promise<{ code: number, data: RecordVO }>}
 */
export function updateRecord(id, data) {
  return request.put(`/records/${id}`, data)
}

/**
 * 删除记录（软删除，仅审查状态下允许）
 * @param {number|string} id - 记录ID
 * @returns {Promise<{ code: number, data: null }>}
 */
export function deleteRecord(id) {
  return request.delete(`/records/${id}`)
}

/**
 * 确认审查完成
 * 将记录状态从"审查中"改为"已完成"，表示用户已确认 AI 生成的标签无误
 * @param {number|string} id - 记录ID
 * @returns {Promise<{ code: number, data: RecordVO }>}
 */
export function confirmReview(id) {
  return request.put(`/records/${id}/confirm`)
}
