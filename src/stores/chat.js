import { normalizeVaultRefs, normalizeToolsUsed, normalizeChatHistory } from '@/utils/chatMessages'
import { createChatFrameHandler } from '@/utils/chatFrames'
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getStorage, setStorage, removeStorage as removeAppStorage } from '@/utils/storage'
import { IS_DEMO_PREVIEW } from '@/preview/mode'
import {
  getSessions as apiGetSessions,
  getSession as apiGetSession,
  deleteSession as apiDeleteSession,
  getTodaySession as apiGetTodaySession,
  resolveTodaySession as apiResolveTodaySession,
  getRun as apiGetRun,
} from '@/api/chat'
import { useActionsStore } from '@/stores/actions'
import {
  applyChatError,
  applyTransportError,
  createChatRequest,
  normalizeCreatedRecords,
  retryChatRequest,
} from '@/utils/chatProtocol'

const FALLBACK_TEXT = '暂时无法回答'

const LAST_SESSION_KEY = 'last_chat_session'

let msgId = 0

export const useChatStore = defineStore('chat', () => {

  const messages = ref([])
  // Draft remains session-scoped in memory so presentation changes can swap
  // page composition without persisting potentially sensitive text.
  const draft = ref('')
  const sending = ref(false)

  const sessionId = ref(null)
  const todaySession = ref(null)
  const todaySessionLoaded = ref(false)
  const endedDaySummaries = ref([])
  const daySummary = ref(null)

  const sessions = ref([])
  const sessionsLoading = ref(false)
  const sessionsLoaded = ref(false)

  const activeSessionId = ref(null)

  const historyLoading = ref(false)
  const historyError = ref(false)

  const recovering = ref(false)
  let recoveryTimer = null
  let recoveryToken = 0

  let abortController = null
  let activeAiMessage = null
  let pendingRetry = null

  function stopRecovery() {
    recoveryToken += 1
    if (recoveryTimer) clearTimeout(recoveryTimer)
    recoveryTimer = null
    recovering.value = false
  }

  function maybeStartRecovery(sessionIdToLoad, list) {
    const last = list[list.length - 1]
    if (!last || last.role !== 'user') return
    const ts = Date.parse(String(last.createdAt || '').replace(' ', 'T'))
    if (!Number.isFinite(ts) || Date.now() - ts > 5 * 60 * 1000) return
    stopRecovery()
    const token = recoveryToken
    const assistantCount = list.filter(message => message.role === 'ai').length
    let attempts = 0
    recovering.value = true
    const tick = async () => {
      if (token !== recoveryToken) return
      attempts += 1
      try {
        const res = await apiGetSession(sessionIdToLoad)
        const serverMessages = res.data?.messages || []
        if (serverMessages.filter(message => message.role === 'assistant').length > assistantCount) {
          await loadSession(sessionIdToLoad, { preserveLocalState: true, recovery: true, force: true })
          return
        }
      } catch {
        // 网络抖动继续重试
      }
      if (token !== recoveryToken) return
      if (attempts >= 60) {
        stopRecovery()
        return
      }
      recoveryTimer = setTimeout(tick, 2000)
    }
    recoveryTimer = setTimeout(tick, 2000)
  }

  let hasLocalChatActivity = false

  let restoreInProgress = null

  function readDailyPayload(data) {
    const value = data && typeof data === 'object' ? data : {}
    historyError.value = false
    const session = value.session || value.todaySession || value.today_session || (value.id ? value : null)
    todaySession.value = session?.id ? session : null
    todaySessionLoaded.value = true
    const summaries = value.endedDaySummaries || value.ended_day_summaries || value.summaries
    if (Array.isArray(summaries)) {
      endedDaySummaries.value = summaries
      const actionStore = useActionsStore()
      summaries.flatMap(summary => summary?.actions || []).forEach(action => actionStore.upsert(action))
    }
    return todaySession.value
  }

  async function fetchTodaySession() {
    const response = await apiGetTodaySession()
    return readDailyPayload(response?.data)
  }

  async function ensureTodaySession() {
    let current = await fetchTodaySession()
    if (!current) {
      const response = await apiResolveTodaySession()
      current = readDailyPayload(response?.data)
    }
    if (!current?.id) throw new Error('无法建立今日会话')
    if (String(activeSessionId.value || '') !== String(current.id)) {
      const loaded = await loadSession(String(current.id))
      if (!loaded) throw new Error('无法读取今日会话')
    }
    todaySession.value = current
    return current
  }

  async function openTodaySession() {
    try {
      const current = await fetchTodaySession()
      if (current?.id) return await loadSession(String(current.id))
      clearMessages()
      return false
    } catch (err) {
      console.error('Failed to open today session:', err)
      historyError.value = true
      return false
    }
  }

  function discardRetry() {
    if (pendingRetry?.message) pendingRetry.message.retryable = false
    pendingRetry = null
  }

  function pushUser(content) {
    const message = { id: String(++msgId), role: 'user', content }
    messages.value.push(message)
    return messages.value[messages.value.length - 1]
  }

  function pushAiPlaceholder(route) {
    const msg = {
      id: String(++msgId), role: 'ai', content: '', thinking: '', route: route || null,
      typing: true, status: null, outcome: null, errorCode: null, errorMessage: '',
      requestId: null, runId: null, retryable: false, checkingRun: false,
      sources: [], toolsUsed: [], vaultRefs: [], createdRecords: [],
    }
    messages.value.push(msg)
    // Return the reactive array entry so streamed updates repaint immediately.
    return messages.value[messages.value.length - 1]
  }

  const handleFrame = createChatFrameHandler({ sessionId, activeSessionId, saveSessionId, fallbackText: FALLBACK_TEXT })

  async function sendMessage(content) {
    const text = content.trim()
    if (!text || sending.value) return
    // Lock before resolving the session to prevent duplicate submissions.
    sending.value = true
    stopRecovery()

    // Resolve the server day once before starting this turn. A stream that
    // crosses midnight keeps its original session; the next send resolves again.
    try {
      await ensureTodaySession()
    } catch (err) {
      sending.value = false
      console.error("Failed to resolve today's chat session:", err)
      historyError.value = true
      return false
    }

    discardRetry()
    hasLocalChatActivity = true
    const request = createChatRequest(text, sessionId.value)
    const userMsg = pushUser(text)
    // 续聊中路由未知：不发眉标，等 meta 事件补上
    const aiMsg = pushAiPlaceholder(null)
    aiMsg.requestId = request.requestId
    aiMsg.actionSourceMessage = userMsg.id
    return runChatRequest(request, aiMsg, userMsg)
  }

  async function retryLastMessage(messageId = null) {
    if (sending.value || !pendingRetry) return false
    if (messageId != null && String(pendingRetry.message.id) !== String(messageId)) return false
    const { request, message } = pendingRetry
    pendingRetry = null
    message.content = ''
    message.thinking = ''
    message.route = null
    message.status = null
    message.outcome = null
    message.errorCode = null
    message.errorMessage = ''
    message.requestId = request.requestId
    message.runId = null
    message.retryable = false
    message.sources = []
    message.toolsUsed = []
    message.vaultRefs = []
    message.createdRecords = []
    message.typing = true
    return runChatRequest(retryChatRequest(request), message)
  }

  async function runChatRequest(request, aiMsg, userMsg = null) {
    sending.value = true
    activeAiMessage = aiMsg
    const cards = useActionsStore()
    const aiIndex = messages.value.indexOf(aiMsg)
    const sourceUserMessage = userMsg || messages.value.slice(0, aiIndex).reverse().find(message => message.role === 'user') || null

    if (IS_DEMO_PREVIEW) {
      try {
        await new Promise(resolve => setTimeout(resolve, 650))
        // Cancellation or a newer message may have replaced this mock run while it waited.
        if (activeAiMessage !== aiMsg) return false
        aiMsg.typing = false
        aiMsg.status = 'completed'
        aiMsg.route = 'reflection'
        aiMsg.content = `这是预览环境中的示例回应。你提到“${request.question.slice(0, 80)}”，可以先把它拆成一件具体的小事，再看看它和最近的节奏、感受有什么联系。演示对话不会发送到 AI 服务，也不会保存。`
      } finally {
        if (activeAiMessage === aiMsg) {
          sending.value = false
          activeAiMessage = null
        }
      }
      return true
    }

    const controller = new AbortController()
    abortController = controller
    let receivedTerminal = false

    try {
      const token = getStorage('token')
      const res = await fetch('/api/mirror/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        // 401 未授权：清凭证跳登录（与 request.js 拦截器同口径）
        if (res.status === 401) {
          removeAppStorage('token')
          removeAppStorage('user')
          removeAppStorage('token_expires')
          window.location.href = '/auth/login'
        }
        throw new Error(`chat http ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE 以空行分帧
        let idx
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          if (handleFrame(frame, aiMsg, sourceUserMessage, cards)) receivedTerminal = true
        }
      }
      // 残余帧（部分实现最后不带空行）
      if (buffer.trim()) {
        if (handleFrame(buffer, aiMsg, sourceUserMessage, cards)) receivedTerminal = true
      }

      // A clean EOF without a done event is still an interrupted stream.
      if (!receivedTerminal && aiMsg.status !== 'cancelled') applyTransportError(aiMsg, FALLBACK_TEXT)
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('Chat stream failed:', err)
      applyTransportError(aiMsg, FALLBACK_TEXT)
    } finally {
      if (abortController === controller) abortController = null
      if (activeAiMessage === aiMsg) {
        sending.value = false
        activeAiMessage = null
      }
    }
    if (receivedTerminal || aiMsg.status !== 'transport_error') {
      aiMsg.retryable = false
      if (pendingRetry?.message === aiMsg) pendingRetry = null
    } else {
      aiMsg.retryable = true
      pendingRetry = { request: retryChatRequest(request), message: aiMsg }
    }
    return receivedTerminal
  }

  async function refreshRun(message) {
    if (!message?.runId || message.checkingRun) return null
    message.checkingRun = true
    try {
      const response = await apiGetRun(message.runId)
      const run = response?.data
      if (!run) return null
      message.status = run.status || message.status
      message.outcome = run.outcome || null
      message.errorCode = run.error_code || null
      if (run.assistant) {
        const assistant = run.assistant
        if (assistant.id != null) message.serverMessageId = String(assistant.id)
        if (typeof assistant.content === 'string') message.content = assistant.content
        message.sources = (assistant.sources || [])
          .filter(source => source && source.record_id > 0)
          .map(source => ({ n: source.n ?? null, recordId: source.record_id, quote: source.quote || '', date: source.date || '' }))
        message.toolsUsed = normalizeToolsUsed(assistant.tools_used || [])
        message.vaultRefs = normalizeVaultRefs(assistant.vault_refs || [])
        message.createdRecords = normalizeCreatedRecords(assistant.created_records || [])
      }
      message.typing = false
      return run
    } catch (err) {
      console.error('Failed to refresh chat run:', err)
      return null
    } finally {
      message.checkingRun = false
    }
  }

  // ==================== 会话存档（localStorage） ====================

  function getSavedSessionId() {
    const id = getStorage(LAST_SESSION_KEY)
    return id && typeof id === 'string' && id.trim() ? id.trim() : null
  }

  function saveSessionId(id) {
    if (id) setStorage(LAST_SESSION_KEY, id)
    else removeAppStorage(LAST_SESSION_KEY)
  }

  function clearSavedSessionId() {
    removeAppStorage(LAST_SESSION_KEY)
  }

  // ==================== 会话列表 / 历史 / 删除 ====================

  async function fetchSessions() {
    sessionsLoading.value = true
    try {
      const res = await apiGetSessions()
      sessions.value = res.data || []
      sessionsLoaded.value = true
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
      sessions.value = []
    } finally {
      sessionsLoading.value = false
    }
  }

  async function loadSession(id, { preserveLocalState = false, recovery = false, force = false } = {}) {
    if (!recovery) stopRecovery()
    if (!preserveLocalState && !force) {
      hasLocalChatActivity = true
      if (sending.value) abort()
    }
    discardRetry()
    historyLoading.value = true
    historyError.value = false
    try {
      const res = await apiGetSession(id)
      // 自动恢复可能与用户发送、点选其他会话或新建会话并发；本地操作优先。
      if (preserveLocalState && !force && (hasLocalChatActivity || sending.value || messages.value.length > 0)) {
        return false
      }
      const data = res.data
      const cards = useActionsStore()
      const sessionActions = Array.isArray(data?.actions) ? data.actions : await cards.loadForSession(id).catch(() => [])
      sessionActions.forEach(card => cards.upsert(card))
      daySummary.value = data?.daySummary || data?.day_summary || null
      let lastUserMessageId = null
      const list = normalizeChatHistory(data?.messages, () => ++msgId)
      messages.value = list
      activeSessionId.value = id
      sessionId.value = id
      // 历史会话设为当前会话 → 同步写入存档
      saveSessionId(id)
      if (recovery) stopRecovery()
      else maybeStartRecovery(id, list)
      return true
    } catch (err) {
      console.error('Failed to load session:', err)
      historyError.value = true
      // Numeric codes are server rejections; other failures are transport errors.
      return false
    } finally {
      historyLoading.value = false
    }
  }

  async function removeSession(id) {
    try {
      await apiDeleteSession(id)
      sessions.value = sessions.value.filter(s => s.id !== id)
      endedDaySummaries.value = endedDaySummaries.value.filter(summary => String(summary.sourceSessionId || summary.source_session_id || '') !== String(id))
      if (String(todaySession.value?.id || '') === String(id)) todaySession.value = null
      // 删的是当前打开的会话 → 回到新会话空态
      if (activeSessionId.value === id) {
        clearMessages()
      }
      // 删的是存档会话 → 清存档（下次进页不再尝试恢复）
      if (getSavedSessionId() === id) {
        clearSavedSessionId()
      }
      return true
    } catch (err) {
      console.error('Failed to delete session:', err)
      return false
    }
  }

  function newConversation() {
    stopRecovery()
    hasLocalChatActivity = true
    if (sending.value) abort()
    clearMessages()
  }

  function abort() {
    discardRetry()
    if (activeAiMessage) {
      activeAiMessage.typing = false
      activeAiMessage.status = 'cancelled'
      activeAiMessage.retryable = false
    }
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    sending.value = false
    activeAiMessage = null
  }

  // ==================== 进页自动恢复 ====================

  async function restoreLastSession() {
    // 自动恢复只负责首次填充；已有内存消息/本地操作时不能覆盖当前状态。
    if (hasLocalChatActivity || sending.value || messages.value.length > 0) return false
    if (restoreInProgress) return restoreInProgress

    restoreInProgress = (async () => {
      // The server owns Asia/Shanghai day boundaries. Never auto-restore a
      // yesterday session just because it was the last locally saved one.
      historyLoading.value = true
      try {
        const current = await fetchTodaySession()
        if (current?.id) return await loadSession(String(current.id), { preserveLocalState: true })
        if (!sessionsLoaded.value) await fetchSessions()
      } catch (err) {
        console.error('Failed to resolve today session:', err)
        historyError.value = true
      } finally {
        historyLoading.value = false
      }
      return false
    })()
    try {
      return await restoreInProgress
    } finally {
      restoreInProgress = null
    }
  }

  function clearMessages() {
    stopRecovery()
    hasLocalChatActivity = true
    discardRetry()
    messages.value = []
    sessionId.value = null
    activeSessionId.value = null
    historyError.value = false
    daySummary.value = null
    clearSavedSessionId()
  }

  return {
    messages,
    draft,
    sending,
    sessionId,
    todaySession,
    todaySessionLoaded,
    endedDaySummaries,
    daySummary,
    sessions,
    sessionsLoading,
    sessionsLoaded,
    activeSessionId,
    historyLoading,
    historyError,
    recovering,
    sendMessage,
    retryLastMessage,
    refreshRun,
    fetchSessions,
    loadSession,
    removeSession,
    newConversation,
    abort,
    clearMessages,
    restoreLastSession,
    openTodaySession,
    fetchTodaySession,
    getSavedSessionId,
  }
})
