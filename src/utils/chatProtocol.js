function randomUuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  throw new Error('A secure UUID generator is required for chat request IDs')
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
    route: payload.route || null,
    toolsUsed: Array.isArray(payload.tools_used) ? payload.tools_used
      : (Array.isArray(payload.toolsUsed) ? payload.toolsUsed : []),
  }
}

export function normalizeCreatedRecords(records) {
  if (!Array.isArray(records)) return []
  return records.flatMap((record) => {
    if (!record || typeof record !== 'object') return []
    const recordId = record.recordId ?? record.record_id
    if ((typeof recordId !== 'number' && typeof recordId !== 'string') || String(recordId).trim() === '') return []
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

