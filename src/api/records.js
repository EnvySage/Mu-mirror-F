import request from './request'

/**
 * 创建记录
 * @param {{ content: string, status?: string }} data
 * @returns {Promise<{ code: number, data: RecordVO }>}
 */
export function createRecord(data) {
  return request.post('/records', data)
}

/**
 * 获取记录列表
 * @param {Object} params - 查询参数
 * @returns {Promise<{ code: number, data: RecordVO[] }>}
 */
export function getRecords(params) {
  return request.get('/records', { params })
}

/**
 * 获取记录详情
 * @param {number} id - 记录ID
 * @returns {Promise<{ code: number, data: RecordVO }>}
 */
export function getRecord(id) {
  return request.get(`/records/${id}`)
}

/**
 * 更新记录
 * @param {number} id - 记录ID
 * @param {Object} data - 更新数据
 * @returns {Promise<{ code: number, data: RecordVO }>}
 */
export function updateRecord(id, data) {
  return request.put(`/records/${id}`, data)
}

/**
 * 删除记录
 * @param {number} id - 记录ID
 * @returns {Promise<{ code: number, data: null }>}
 */
export function deleteRecord(id) {
  return request.delete(`/records/${id}`)
}
