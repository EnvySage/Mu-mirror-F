import request from './request'

/**
 * 会话列表（updated_at 倒序；不含消息，历史走 /{id}）
 * @returns {Promise<{ code: number, data: { id: string, title: string, created_at: string, updated_at: string }[] }>}
 */
export function getSessions() {
  return request.get('/mirror/sessions')
}

/**
 * 会话历史（全部消息时间正序，assistant 消息带 sources [{record_id, quote, date}]）
 * @param {string} id - 会话 ID（UUID）
 * @returns {Promise<{ code: number, data: { id: string, title: string, messages: { id: number, role: string, content: string, sources: {record_id: number, quote: string, date: string}[] | null, created_at: string }[] } }>}
 */
export function getSession(id) {
  return request.get(`/mirror/sessions/${id}`)
}

/**
 * 删除会话（消息级联删除）
 * @param {string} id - 会话 ID（UUID）
 * @returns {Promise<{ code: number, data: null }>}
 */
export function deleteSession(id) {
  return request.delete(`/mirror/sessions/${id}`)
}
