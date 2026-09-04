import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getStorage, removeStorage } from '@/utils/storage'
import {
  getSessions as apiGetSessions,
  getSession as apiGetSession,
  deleteSession as apiDeleteSession,
} from '@/api/chat'

/**
 * 对话 store（T-B-4 已就绪：POST /api/mirror/chat SSE 流式 + 会话 CRUD）
 *
 * SSE 消费用 fetch + ReadableStream（POST 不能用原生 EventSource）：
 *   meta    → { sessionId, route }            意图路由（眉标 + 会话归属）
 *   delta   → { content }                     回答增量（逐块追加渲染）
 *   sources → [{ record_id, quote, date }]    来源追溯（引用芯片，点击跳详情）
 *   done    → { sessionId, route, fallback }  结束标志（fallback=true 为兜底文案）
 *   error   → { message }                     AI 失败兜底（展示"暂时无法回答"类文案）
 *
 * 后端 data 是 JSON 字符串（SseEmitter .data(objectMapper.writeValueAsString(...))），
 * 且 Spring 会在 JSON 内含换行时按 SSE 规范拆成多行 data:，此处按 "\n\n" 分帧、
 * 帧内多行 data: 以 "\n" 合并后 JSON.parse。
 *
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {'user' | 'ai'} role
 * @property {string} content
 * @property {string} [route] - 意图路由（INTENT → HYBRID 等）
 * @property {boolean} [typing] - 是否正在打字
 * @property {{ recordId: number|string, quote: string, date: string }[]} [sources]
 */

/** @typedef {{ id: string, title: string, created_at: string, updated_at: string }} ChatSession */

const FALLBACK_TEXT = '暂时无法回答'

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
  const sending = ref(false)
  /** 最近一次对话的会话 ID（发送时携带，续聊同一会话） */
  const sessionId = ref(null)

  /** @type {import('vue').Ref<ChatSession[]>} */
  const sessions = ref([])
  const sessionsLoading = ref(false)
  const sessionsLoaded = ref(false)
  /** 当前正在浏览历史的会话 ID（null = 新会话草稿） */
  const activeSessionId = ref(null)
  /** 历史加载中 / 网络失败（ChatView 据此展示空态文案，后端未起时不白屏） */
  const historyLoading = ref(false)
  const historyError = ref(false)

  /** 中断当前流（切页/新会话时防串流） */
  let abortController = null

  function pushUser(content) {
    messages.value.push({ id: String(++msgId), role: 'user', content })
  }

  function pushAiPlaceholder(route) {
    const msg = { id: String(++msgId), role: 'ai', content: '', route: route || null, typing: true, sources: [] }
    messages.value.push(msg)
    return msg
  }

  /**
   * 发送消息：fetch POST /api/mirror/chat + ReadableStream 逐帧解析 SSE 五事件
   * @param {string} content
   */
  async function sendMessage(content) {
    const text = content.trim()
    if (!text || sending.value) return

    pushUser(text)
    sending.value = true
    // 续聊中路由未知：不发眉标，等 meta 事件补上
    const aiMsg = pushAiPlaceholder(null)

    abortController = new AbortController()
    let received = false

    try {
      const token = getStorage('token')
      const res = await fetch('/api/mirror/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question: text,
          // 续聊归属同一会话；新会话为 null 由后端创建
          sessionId: sessionId.value,
        }),
        signal: abortController.signal,
      })

      if (!res.ok || !res.body) {
        // 401 未授权：清凭证跳登录（与 request.js 拦截器同口径）
        if (res.status === 401) {
          removeStorage('token')
          removeStorage('user')
          removeStorage('token_expires')
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
          handleFrame(frame, aiMsg)
          received = true
        }
      }
      // 残余帧（部分实现最后不带空行）
      if (buffer.trim()) {
        handleFrame(buffer, aiMsg)
        received = true
      }

      if (!received) {
        finishWithFallback(aiMsg, FALLBACK_TEXT)
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      // fetch / 流读取失败（后端未起、断网等）→ 兜底文案，页面不白屏
      console.error('Chat stream failed:', err)
      finishWithFallback(aiMsg, FALLBACK_TEXT)
    } finally {
      sending.value = false
      abortController = null
    }
  }

  /**
   * 处理一帧 SSE（event: xxx / data: yyy 多行）
   * @param {string} frame
   * @param {ChatMessage} aiMsg
   */
  function handleFrame(frame, aiMsg) {
    let event = 'message'
    const dataLines = []
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^ /, ''))
      }
    }
    if (!dataLines.length) return
    const payload = parseData(dataLines.join('\n'))

    switch (event) {
      case 'meta':
        if (payload) {
          aiMsg.route = payload.route || aiMsg.route
          if (payload.sessionId) {
            sessionId.value = payload.sessionId
            activeSessionId.value = payload.sessionId
          }
        }
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
            .map(s => ({ recordId: s.record_id, quote: s.quote || '', date: s.date || '' }))
        }
        break
      case 'done':
        // done: { sessionId, route, fallback } —— 结束标志，无需额外处理
        // （fallback=true 的兜底文案已通过 delta 推送过，error 走 error 事件）
        break
      case 'error':
        aiMsg.typing = false
        aiMsg.content = (payload && payload.message) || FALLBACK_TEXT
        break
      default:
        break
    }
  }

  /** 兜底收尾：无任何事件/流中断时展示兜底文案 */
  function finishWithFallback(aiMsg, text) {
    aiMsg.typing = false
    if (!aiMsg.content) aiMsg.content = text
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
  async function loadSession(id) {
    if (sending.value) abort()
    historyLoading.value = true
    historyError.value = false
    try {
      const res = await apiGetSession(id)
      const data = res.data
      const list = (data?.messages || []).map(m => ({
        id: String(m.id ?? ++msgId),
        role: m.role === 'assistant' ? 'ai' : 'user',
        content: m.content || '',
        route: null,
        typing: false,
        sources: (m.sources || [])
          .filter(s => s && s.record_id > 0)
          .map(s => ({ recordId: s.record_id, quote: s.quote || '', date: s.date || '' })),
      }))
      messages.value = list
      activeSessionId.value = id
      sessionId.value = id
      return true
    } catch (err) {
      console.error('Failed to load session:', err)
      historyError.value = true
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
      // 删的是当前打开的会话 → 回到新会话空态
      if (activeSessionId.value === id) {
        clearMessages()
      }
      return true
    } catch (err) {
      console.error('Failed to delete session:', err)
      return false
    }
  }

  /** 开新会话：清空当前消息与归属（会话在后端首次发送时才真正创建） */
  function newConversation() {
    if (sending.value) abort()
    clearMessages()
  }

  /** 中断当前流式请求 */
  function abort() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    sending.value = false
  }

  function clearMessages() {
    messages.value = []
    sessionId.value = null
    activeSessionId.value = null
    historyError.value = false
  }

  return {
    messages,
    sending,
    sessionId,
    sessions,
    sessionsLoading,
    sessionsLoaded,
    activeSessionId,
    historyLoading,
    historyError,
    sendMessage,
    fetchSessions,
    loadSession,
    removeSession,
    newConversation,
    abort,
    clearMessages,
  }
})
