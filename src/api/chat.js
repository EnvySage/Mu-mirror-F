import request from './request'

/**
 * 会话列表（updated_at 倒序；不含消息，历史走 /{id}）
 * @returns {Promise<{ code: number, data: { id: string, title: string, created_at: string, updated_at: string }[] }>}
 */
export function getSessions() {
  return request.get('/mirror/sessions')
}

/** Resolve the server's Asia/Shanghai session for today without creating one. */
export function getTodaySession() {
  return request.get('/mirror/sessions/today')
}

/** Idempotently resolve or create today's session before the first message. */
export function resolveTodaySession() {
  return request.post('/mirror/sessions/today')
}

/** Retry the saved summary for an ended daily session after a model failure. */
export function retryDaySummary(sessionId) {
  return request.post(`/mirror/sessions/${sessionId}/summary/retry`)
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
 * Query a chat run after a stream interruption or an uncertain write result.
 * The shared Axios client attaches the existing user JWT and normalizes response keys.
 * @param {string} runId - Java-owned run UUID
 */
export function getRun(runId) {
  return request.get(`/mirror/runs/${encodeURIComponent(runId)}`)
}

/**
 * 删除会话（消息级联删除）
 * @param {string} id - 会话 ID（UUID）
 * @returns {Promise<{ code: number, data: null }>}
 */
export function deleteSession(id) {
  return request.delete(`/mirror/sessions/${id}`)
}
