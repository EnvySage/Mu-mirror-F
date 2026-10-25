function randomUuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  // crypto.randomUUID 只在安全上下文（HTTPS / localhost）存在；线上是 http://IP:10000，
  // 直接抛错会让发送卡死且不发请求。getRandomValues 在非安全上下文也可以用来生成 v4。
  const bytes = new Uint8Array(16)
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('A secure random generator is required for chat request IDs')
  }
  globalThis.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Create one immutable identity for one user submission. */
export function createChatRequest(question, sessionId, idFactory = randomUuid) {
  const text = typeof question === 'string' ? question.trim() : ''
  if (!text) throw new TypeError('question must be non-empty')
  const requestId = idFactory()
  if (typeof requestId !== 'string' || !requestId.trim()) {
    throw new TypeError('request ID factory must return a non-empty string')
  }
  return { question: text, sessionId: sessionId || null, requestId }
}

/** Reconnect the same accepted submission without allocating a new id. */
export function retryChatRequest(request) {
  if (!request || typeof request.requestId !== 'string' || !request.requestId) {
    throw new TypeError('a request ID is required to retry a chat submission')
  }
  return {
    question: request.question,
    sessionId: request.sessionId || null,
    requestId: request.requestId,
  }
}

export function normalizeChatMeta(payload = {}) {
  return {
    sessionId: payload.sessionId ?? payload.session_id ?? null,
    runId: payload.runId ?? payload.run_id ?? null,
    requestId: payload.requestId ?? payload.request_id ?? null,
    sourceMessageId: payload.sourceMessageId ?? payload.source_message_id ?? null,
    route: payload.route || null,
    toolsUsed: Array.isArray(payload.tools_used) ? payload.tools_used
      : (Array.isArray(payload.toolsUsed) ? payload.toolsUsed : []),
  }
}

export function normalizeCreatedRecords(records) {
  if (!Array.isArray(records)) return []
  const seen = new Set()
  return records.flatMap((record) => {
    if (!record || typeof record !== 'object') return []
    const recordId = record.recordId ?? record.record_id
    if ((typeof recordId !== 'number' && typeof recordId !== 'string') || String(recordId).trim() === '') return []
    const key = String(recordId)
    if (seen.has(key)) return []
    seen.add(key)
    return [{
      recordId,
      status: record.status || 'record_only',
      createdAt: record.createdAt ?? record.created_at ?? '',
    }]
  })
}

export function normalizeChatDone(payload = {}) {
  return {
    sessionId: payload.sessionId ?? payload.session_id ?? null,
    runId: payload.runId ?? payload.run_id ?? null,
    requestId: payload.requestId ?? payload.request_id ?? null,
    status: payload.status || 'completed',
    outcome: payload.outcome || null,
    stopReason: payload.stop_reason ?? payload.stopReason ?? null,
    errorCode: payload.error_code ?? payload.errorCode ?? null,
    route: payload.route || null,
    fallback: Boolean(payload.fallback),
    createdRecords: normalizeCreatedRecords(payload.created_records ?? payload.createdRecords),
  }
}

/** Keep a streamed partial answer visible when the server reports a failure. */
export function applyChatError(message, payload = {}, fallbackText = '暂时无法回答') {
  message.typing = false
  message.status = 'failed'
  message.retryable = false
  message.errorCode = payload.code || payload.error_code || payload.errorCode || null
  message.errorMessage = payload.message || ''
  if (!message.content) message.content = payload.message || fallbackText
  return message
}

/** Mark an interrupted transport so the same request can be retried safely. */
export function applyTransportError(message, fallbackText = '暂时无法回答') {
  message.typing = false
  message.status = 'transport_error'
  message.retryable = true
  message.errorMessage = '连接中断，本轮可能仍在服务端处理'
  if (!message.content) message.content = fallbackText
  return message
}
