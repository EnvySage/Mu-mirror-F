import { normalizeChatMeta, normalizeChatDone, applyChatError } from './chatProtocol.js'
import { normalizeVaultRefs, normalizeToolsUsed } from './chatMessages.js'

function parseData(raw) {
try {
  return JSON.parse(raw)
} catch {
  return null
}
}

export function createChatFrameHandler({ sessionId, activeSessionId, saveSessionId, fallbackText }) {
return function handleFrame(frame, aiMsg, userMsg, cards) {
  let event = 'message'
  const dataLines = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''))
    }
  }
  if (!dataLines.length) return false
  const payload = parseData(dataLines.join('\n'))

  switch (event) {
    case 'meta':
      if (payload) {
        const meta = normalizeChatMeta(payload)
        aiMsg.route = meta.route || aiMsg.route
        aiMsg.runId = meta.runId || aiMsg.runId
        aiMsg.requestId = meta.requestId || aiMsg.requestId
        if (meta.toolsUsed.length) aiMsg.toolsUsed = normalizeToolsUsed(meta.toolsUsed)
        if (meta.sessionId) {
          sessionId.value = meta.sessionId
          activeSessionId.value = meta.sessionId
          saveSessionId(meta.sessionId)
        }
        const sourceMessageId = meta.sourceMessageId
        if (sourceMessageId != null) {
          if (userMsg) userMsg.serverMessageId = String(sourceMessageId)
          aiMsg.actionSourceMessage = String(sourceMessageId)
        }
      }
      break
    case 'thinking':
      // Deliberately discard raw reasoning; the UI exposes only brief action states.
      break
    case 'delta':
      if (payload && typeof payload.content === 'string') {
        aiMsg.typing = false
        aiMsg.content += payload.content
      }
      break
    case 'sources':
      if (Array.isArray(payload)) {
        aiMsg.sources = payload
          .filter(s => s && s.record_id > 0)
          .map(s => ({ n: s.n ?? null, recordId: s.record_id, quote: s.quote || '', date: s.date || '' }))
      }
      break
    case 'vault_refs':
      if (Array.isArray(payload)) aiMsg.vaultRefs = normalizeVaultRefs(payload)
      break
    case 'action_proposal':
    case 'action_status':
      if (payload) cards.upsert(payload)
      break
    case 'done': {
      const done = normalizeChatDone(payload || {})
      if (done.assistantMessageId != null) aiMsg.serverMessageId = String(done.assistantMessageId)
      aiMsg.typing = false
      aiMsg.status = done.status
      aiMsg.outcome = done.outcome
      aiMsg.errorCode = done.errorCode
      aiMsg.runId = done.runId || aiMsg.runId
      aiMsg.requestId = done.requestId || aiMsg.requestId
      aiMsg.route = done.route || aiMsg.route
      aiMsg.createdRecords = done.createdRecords
      if (done.sessionId) {
        sessionId.value = done.sessionId
        activeSessionId.value = done.sessionId
        saveSessionId(done.sessionId)
      }
      if (['failed', 'cancelled', 'abandoned'].includes(done.status) && !aiMsg.content) {
        aiMsg.content = done.status === 'cancelled' ? '本轮请求已取消' : fallbackText
      }
      return true
    }
    case 'error':
      applyChatError(aiMsg, payload || {}, fallbackText)
      break
    default:
      break
  }
  return false
}
}
