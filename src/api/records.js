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
 * 获取记录列表（返回所有未删除记录）
 * @param {Object} [params] - 可选查询参数
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
 * 删除记录（软删除）
 * @param {number|string} id - 记录ID
 * @returns {Promise<{ code: number, data: null }>}
 */
export function deleteRecord(id) {
  return request.delete(`/records/${id}`)
}

/**
 * 审核通过（可附带修改后的标签，触发 Embedding + 存 chunks）
 * @param {number|string} id - 记录ID
 * @param {Object} [modifications] - 用户修改的标签数据
 * @param {string} [modifications.title] - 标题
 * @param {string} [modifications.summary] - 摘要
 * @param {string} [modifications.content_type] - 内容类型
 * @param {string[]} [modifications.mood] - 情绪标签
 * @param {string[]} [modifications.keywords] - 关键词
 * @returns {Promise<{ code: number, data: RecordVO }>}
 */
export function approveRecord(id, modifications) {
  return request.post(`/records/${id}/approve`, modifications)
}

/**
 * 审核拒绝（软删除，不入 RAG）
 * @param {number|string} id - 记录ID
 * @returns {Promise<{ code: number, data: null }>}
 */
export function rejectRecord(id) {
  return request.post(`/records/${id}/reject`)
}
