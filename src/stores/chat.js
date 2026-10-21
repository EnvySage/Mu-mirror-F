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
  normalizeChatDone,
  normalizeChatMeta,
  normalizeCreatedRecords,
  retryChatRequest,
} from '@/utils/chatProtocol'

/**
 * 对话 store（T-B-4 已就绪：POST /api/mirror/chat SSE 流式 + 会话 CRUD）
 *
 * SSE 消费用 fetch + ReadableStream（POST 不能用原生 EventSource）：
 *   meta       → { sessionId, route, tools_used? }    意图路由 + 工具轨迹（E6）
 *   thinking   → { content }                          思考增量（与 delta 同构，流式多次到达；
 *                                                     模型不支持思考时该事件完全不出现）
 *   delta      → { content }                          回答增量（逐块追加渲染）
 *   sources    → [{ n, record_id, quote, date }]      来源追溯（引用芯片，点击跳详情）
 *                                                      n = 正文里的 [n] 原始编号；
 *                                                      后端只回被引用子集、编号会跳号，
 *                                                      必须按 n 定位，不能按下标取
 *   vault_refs → [{ n, vault_item_id, display_name, file_type, size_bytes,
 *                   digest_status, quote, category?, created_at? }]  对话文件卡（4.1）
 *   done       → { sessionId, route, fallback }       结束标志（fallback=true 为兜底文案）
 *   error      → { message }                          AI 失败兜底（展示"暂时无法回答"类文案）
 *
 * vault_refs 归一化（VaultRefCard 三档口径）：
 *   有 quote → strength='strong' 完整卡；无 quote → 'weak' 芯片；
 *   后端无法定位具体文件（"昨天传的图片"）→ vague=true 芯片点开确认。
 *   同 vault_item_id 同气泡多引用 → 去重保第一条（含 quote 的强引用优先保留）。
 *
 * 后端 data 是 JSON 字符串（SseEmitter .data(objectMapper.writeValueAsString(...))），
 * 且 Spring 会在 JSON 内含换行时按 SSE 规范拆成多行 data:，此处按 "\n\n" 分帧、
 * 帧内多行 data: 以 "\n" 合并后 JSON.parse。
 *
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {'user' | 'ai'} role
 * @property {string} content
 * @property {string} [thinking] 思考过程累积文本（仅本轮流式产生；历史消息永远没有）
 * @property {string} [route] - 意图路由（INTENT → HYBRID 等）
 * @property {boolean} [typing] - 是否正在打字
 * @property {{ n: number|null, recordId: number|string, quote: string, date: string }[]} [sources]
 * @property {{ id: string, tool: string, summary: string }[]} [toolsUsed] 工具轨迹（气泡上方芯片行）
 * @property {Array} [vaultRefs] 对话文件卡引用（已去重归一化）
 */

/** @typedef {{ id: string, title: string, created_at: string, updated_at: string }} ChatSession */

const FALLBACK_TEXT = '暂时无法回答'

/** localStorage 存档 key（utils/storage 统一加 mirror_ 前缀） */
const LAST_SESSION_KEY = 'last_chat_session'

let msgId = 0

/**
 * 解析 SSE data 载荷为对象（JSON 字符串；解析失败返回 null）
 * @param {string} raw
 * @returns {any}
 */
function parseData(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const useChatStore = defineStore('chat', () => {
  /** @type {import('vue').Ref<ChatMessage[]>} */
  const messages = ref([])
  // Draft remains session-scoped in memory so presentation changes can swap
  // page composition without persisting potentially sensitive text.
  const draft = ref('')
  const sending = ref(false)
  /** 最近一次对话的会话 ID（发送时携带，续聊同一会话） */
  const sessionId = ref(null)
  const todaySession = ref(null)
  const todaySessionLoaded = ref(false)
  const endedDaySummaries = ref([])
  const daySummary = ref(null)

  /** @type {import('vue').Ref<ChatSession[]>} */
  const sessions = ref([])
  const sessionsLoading = ref(false)
  const sessionsLoaded = ref(false)
  /** 当前正在浏览历史的会话 ID（null = 新会话草稿） */
  const activeSessionId = ref(null)
  /** 历史加载中 / 网络失败（ChatView 据此展示空态文案，后端未起时不白屏） */
  const historyLoading = ref(false)
  const historyError = ref(false)

  /** 中断当前流（仅显式切换会话或新建会话时） */
  let abortController = null
  let activeAiMessage = null
  let pendingRetry = null
  /** 用户当前应用会话内操作过对话后，不再用自动恢复覆盖本地消息 */
  let hasLocalChatActivity = false
  /** 合并同一时刻的自动恢复调用（路由重复挂载时只发一次历史请求） */
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
    // 必须返回数组里的响应式代理，不能返回原始 msg：之后 SSE 每一帧都往这个对象上写
    // thinking/content，改原始对象不触发 Vue 更新——界面会一直停着，直到流结束时
    // sending 翻转才一口气刷出全部内容（2026-09-21 联调：后端逐帧推送正常，浏览器仍"等一分钟一次性吐出"）
    return messages.value[messages.value.length - 1]
  }

  /**
   * 归一化 vault_refs 事件载荷 → VaultRefCard 口径（三档 + 同气泡去重）
   * 有 quote=强引用（完整卡）；无 quote=弱引用（芯片）；vague=模糊提及（芯片点开确认）
   * @param {Array} refs
   * @returns {Array}
   */
  function normalizeVaultRefs(refs) {
    const seen = new Map()
    for (const r of refs) {
      if (!r || (r.vault_item_id == null && !r.vague)) continue
      const key = r.vague ? `vague:${r.display_name || r.query || ''}` : String(r.vault_item_id)
      const item = {
        id: key,
        n: r.n ?? null,
        vaultItemId: r.vault_item_id ?? null,
        displayName: r.display_name || r.original_name || '未命名文件',
        category: r.category || null,
        fileType: r.file_type || r.fileType || '',
        sizeBytes: r.size_bytes ?? r.sizeBytes ?? null,
        digestStatus: r.digest_status || r.digestStatus || 'confirmed',
        quote: r.quote || '',
        createdAt: r.created_at || '',
        deleted: !!r.deleted,
        vague: !!r.vague,
        strength: r.quote ? 'strong' : (r.vague ? 'vague' : 'weak'),
      }
      // 同 vault_item_id 多引用同气泡单卡：强引用优先保留
      const prev = seen.get(key)
      if (!prev || (prev.strength !== 'strong' && item.strength === 'strong')) seen.set(key, item)
    }
    return [...seen.values()]
  }

  /**
   * 归一化 meta.tools_used（["search_records:12条"] 或 [{tool, summary}]）
   * → [{ id, tool, summary }]（气泡上方工具轨迹芯片行）
   */
  function normalizeToolsUsed(list) {
    if (!Array.isArray(list)) return []
    return list
      .map((t, i) => {
        if (typeof t === 'string') {
          const idx = t.indexOf(':')
          return idx > -1
            ? { id: `t${i}`, tool: t.slice(0, idx), summary: t.slice(idx + 1) }
            : { id: `t${i}`, tool: t, summary: '' }
        }
        if (t && typeof t === 'object') {
          return { id: `t${i}`, tool: t.tool || t.name || '', summary: t.summary || t.result_summary || '' }
        }
        return null
      })
      .filter(Boolean)
  }

  /**
   * 发送消息：fetch POST /api/mirror/chat + ReadableStream 逐帧解析 SSE 五事件
   * @param {string} content
   */
  async function sendMessage(content) {
    const text = content.trim()
    if (!text || sending.value) return

    // Resolve the server day once before starting this turn. A stream that
    // crosses midnight keeps its original session; the next send resolves again.
    try {
      await ensureTodaySession()
    } catch (err) {
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

  /**
   * 处理一帧 SSE（event: xxx / data: yyy 多行）
   * @param {string} frame
   * @param {ChatMessage} aiMsg
   */
  function handleFrame(frame, aiMsg, userMsg, cards = useActionsStore()) {
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
          aiMsg.content = done.status === 'cancelled' ? '本轮请求已取消' : FALLBACK_TEXT
        }
        return true
      }
      case 'error':
        applyChatError(aiMsg, payload || {}, FALLBACK_TEXT)
        break
      default:
        break
    }
    return false
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

  /** 读取上次会话存档 id（无 / 非法返回 null） */
  function getSavedSessionId() {
    const id = getStorage(LAST_SESSION_KEY)
    return id && typeof id === 'string' && id.trim() ? id.trim() : null
  }

  /** 会话 id 写入存档 */
  function saveSessionId(id) {
    if (id) setStorage(LAST_SESSION_KEY, id)
    else removeAppStorage(LAST_SESSION_KEY)
  }

  /** 清除会话存档 */
  function clearSavedSessionId() {
    removeAppStorage(LAST_SESSION_KEY)
  }

  // ==================== 会话列表 / 历史 / 删除 ====================
  /**
   * 拉取会话列表（GET /api/mirror/sessions，updated_at 倒序）
   */
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

  /**
   * 加载会话历史（GET /api/mirror/sessions/{id}），失败置 historyError（空态兜底不白屏）
   * @param {string} id
   */
  async function loadSession(id, { preserveLocalState = false } = {}) {
    if (!preserveLocalState) {
      hasLocalChatActivity = true
      if (sending.value) abort()
    }
    discardRetry()
    historyLoading.value = true
    historyError.value = false
    try {
      const res = await apiGetSession(id)
      // 自动恢复可能与用户发送、点选其他会话或新建会话并发；本地操作优先。
      if (preserveLocalState && (hasLocalChatActivity || sending.value || messages.value.length > 0)) {
        return false
      }
      const data = res.data
      const cards = useActionsStore()
      const sessionActions = Array.isArray(data?.actions) ? data.actions : await cards.loadForSession(id).catch(() => [])
      sessionActions.forEach(card => cards.upsert(card))
      daySummary.value = data?.daySummary || data?.day_summary || null
      let lastUserMessageId = null
      const list = (data?.messages || []).map(m => {
        const role = m.role === 'assistant' ? 'ai' : 'user'
        if (role === 'user') lastUserMessageId = String(m.id ?? '')
        return {
        id: String(m.id ?? ++msgId),
        serverMessageId: String(m.id ?? ''),
        role,
        actionSourceMessage: role === 'ai' ? lastUserMessageId : null,
        content: m.content || '',
        route: null,
        typing: false,
        sources: (m.sources || [])
          .filter(s => s && s.record_id > 0)
          .map(s => ({ n: s.n ?? null, recordId: s.record_id, quote: s.quote || '', date: s.date || '' })),
        // 历史回放：B 在消息 VO 带出 tools_used / vault_refs 才有值，缺省空数组不渲染
        toolsUsed: normalizeToolsUsed(m.tools_used || []),
        vaultRefs: normalizeVaultRefs(m.vault_refs || []),
        createdRecords: normalizeCreatedRecords(m.created_records || []),
        status: 'completed',
        outcome: null,
        requestId: null,
        runId: null,
        retryable: false,
        checkingRun: false,
        // thinking 不落 conversation_history——历史消息永远没有思考面板（契约）
        thinking: '',
        }
      })
      messages.value = list
      activeSessionId.value = id
      sessionId.value = id
      // 历史会话设为当前会话 → 同步写入存档
      saveSessionId(id)
      return true
    } catch (err) {
      console.error('Failed to load session:', err)
      historyError.value = true
      // 失败归因：err.code 为数字 = 后端明确报错（404 已删 / 业务码）；否则是网络层失败（后端未起/超时）
      return false
    } finally {
      historyLoading.value = false
    }
  }

  /**
   * 删除会话（DELETE /api/mirror/sessions/{id}，消息级联删除）
   * @param {string} id
   */
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

  /** 开新会话：清空当前消息与归属（会话在后端首次发送时才真正创建） */
  function newConversation() {
    hasLocalChatActivity = true
    if (sending.value) abort()
    clearMessages()
  }

  /** 中断当前流式请求 */
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

  /**
   * 进入聊天页时仅恢复服务器认定的今日会话；昨天及更早的会话仍从历史列表打开。
   * 今日会话不存在时保持空态，不创建空会话。
   * @returns {Promise<boolean>} 是否成功恢复了某个会话
   */
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
