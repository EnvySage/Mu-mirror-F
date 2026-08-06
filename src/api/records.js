import request from './request'

/**
 * 创建记录
 * @param {{ title?: string, content?: string, summary?: string, contentType?: string, mood?: string[], keywords?: string[], status?: string }} data
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

/**
 * 记录类型枚举
 */
export const CONTENT_TYPES = [
  { value: 'todo', label: '待办', icon: '✓' },
  { value: 'thought', label: '想法', icon: '💭' },
  { value: 'learning', label: '学习', icon: '📚' },
  { value: 'plan', label: '计划', icon: '📋' },
  { value: 'note', label: '笔记', icon: '📝' },
  { value: 'work', label: '工作', icon: '💼' },
  { value: 'social', label: '社交', icon: '👥' },
  { value: 'health', label: '健康', icon: '❤️' },
]

/**
 * 心情标签
 */
export const MOOD_OPTIONS = [
  { value: 'happy', label: '开心', emoji: '😊' },
  { value: 'calm', label: '平静', emoji: '😌' },
  { value: 'excited', label: '兴奋', emoji: '🎉' },
  { value: 'tired', label: '疲惫', emoji: '😴' },
  { value: 'stressed', label: '压力', emoji: '😰' },
  { value: 'sad', label: '难过', emoji: '😢' },
  { value: 'angry', label: '生气', emoji: '😠' },
  { value: 'confused', label: '困惑', emoji: '🤔' },
]
