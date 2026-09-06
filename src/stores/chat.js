import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getStorage, setStorage, removeStorage as removeAppStorage } from '@/utils/storage'
import {
  getSessions as apiGetSessions,
  getSession as apiGetSession,
  deleteSession as apiDeleteSession,
} from '@/api/chat'

/**
 * 对话 store（T-B-4 已就绪：POST /api/mirror/chat SSE 流式 + 会话 CRUD）
 *
 * SSE 消费用 fetch + ReadableStream（POST 不能用原生 EventSource）：
 *   meta       → { sessionId, route, tools_used? }    意图路由 + 工具轨迹（E6）
 *   delta      → { content }                          回答增量（逐块追加渲染）
 *   sources    → [{ record_id, quote, date }]         来源追溯（引用芯片，点击跳详情）
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
 * @property {string} [route] - 意图路由（INTENT → HYBRID 等）
 * @property {boolean} [typing] - 是否正在打字
 * @property {{ recordId: number|string, quote: string, date: string }[]} [sources]
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
    const msg = { id: String(++msgId), role: 'ai', content: '', route: route || null, typing: true, sources: [], toolsUsed: [], vaultRefs: [] }
    messages.value.push(msg)
    return msg
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
          // 工具轨迹（E6）：meta.tools_used ["search_records:12条"] → 气泡上方芯片行
          if (payload.tools_used) aiMsg.toolsUsed = normalizeToolsUsed(payload.tools_used)
          if (payload.sessionId) {
            sessionId.value = payload.sessionId
            activeSessionId.value = payload.sessionId
            // 后端建会话（首条消息）→ 写入存档
            saveSessionId(payload.sessionId)
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
      case 'vault_refs':
        // 对话文件卡（4.1）：Java 解析 AI 输出 [n] 标记后下发，此处归一化 + 同气泡去重
        if (Array.isArray(payload)) {
          aiMsg.vaultRefs = normalizeVaultRefs(payload)
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
        // 历史回放：B 在消息 VO 带出 tools_used / vault_refs 才有值，缺省空数组不渲染
        toolsUsed: normalizeToolsUsed(m.tools_used || []),
        vaultRefs: normalizeVaultRefs(m.vault_refs || []),
      }))
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
      lastLoadFailureKind = (typeof err?.code === 'number') ? 'missing' : 'network'
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

  // ==================== 进页自动恢复 ====================

  /** 最近一次 loadSession 失败归因：null / 'missing'（会话已删等后端明确报错）/ 'network'（网络层失败） */
  let lastLoadFailureKind = null

  /**
   * 进页恢复流程（ChatView onMounted 调用）：
   *   1. 有存档 id → loadSession 恢复消息流；后端明确报错（已删/404）→ 清存档继续；
   *      网络层失败 → 保留存档下次再试
   *   2. 无存档 → 今天有历史会话则自动恢复最近一个（updated_at 最新）
   *   3. 今天没有会话 → 不预建（首条消息时后端自动建），保持空态引导文案
   * @returns {Promise<boolean>} 是否成功恢复了某个会话
   */
  async function restoreLastSession() {
    // 流进行中不碰消息流
    if (sending.value) return false

    // 1. localStorage 存档
    const savedId = getSavedSessionId()
    if (savedId) {
      const ok = await loadSession(savedId)
      if (ok) return true
      // 网络层失败（后端未起/超时）：保留存档下次再试，空态有兜底文案
      if (lastLoadFailureKind === 'network') return false
      // 后端明确报错（会话已删/404/无权限）→ 清存档，继续尝试今天的会话
      clearSavedSessionId()
    }

    // 2. 今天最近一个会话（created_at 为北京时间字符串 yyyy-MM-dd HH:mm:ss，取日期段与本地今天比对）
    if (!sessionsLoaded.value) {
      await fetchSessions()
      // 会话列表也拉不到（后端未起）：不继续，空态兜底
      if (!sessionsLoaded.value) return false
    }
    const todayKey = localDateKey(new Date())
    const todaySession = sessions.value
      .filter(s => localDateKey(s.created_at) === todayKey)
      .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0]
    if (todaySession) {
      return loadSession(todaySession.id)
    }

    // 3. 今天还没有会话：不预建，等首条消息时后端自动建
    return false
  }

  /** 本地日期 key（yyyy-MM-dd），兼容 "yyyy-MM-dd HH:mm:ss" 与 ISO 字符串 */
  function localDateKey(dateLike) {
    if (!dateLike) return ''
    if (typeof dateLike === 'string') {
      const m = dateLike.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (m) return `${m[1]}-${m[2]}-${m[3]}`
      dateLike = new Date(dateLike.replace(' ', 'T'))
    }
    if (!(dateLike instanceof Date) || Number.isNaN(dateLike.getTime())) return ''
    return `${dateLike.getFullYear()}-${String(dateLike.getMonth() + 1).padStart(2, '0')}-${String(dateLike.getDate()).padStart(2, '0')}`
  }

  function clearMessages() {
    messages.value = []
    sessionId.value = null
    activeSessionId.value = null
    historyError.value = false
    clearSavedSessionId()
  }

  /**
   * 注入演示消息（mock 态：对话文件卡三档 + 工具轨迹芯片演示）。
   * B 的 vault_refs / tools_used 事件就绪后此函数仅作演示入口保留
   * （ChatView 空态引导按钮调用；真链路数据全部走 SSE 事件解析）。
   */
  function pushDemoVaultMessage() {
    if (sending.value) return
    messages.value.push({ id: String(++msgId), role: 'user', content: '我的论文咋样了？顺便看看昨天传的东西' })
    messages.value.push({
      id: String(++msgId),
      role: 'ai',
      content: '根据你的开题报告，毕设目前推进到检索评测阶段：骨架已定型，接下来两周主要补三档消融实验。'
        + '\n\n昨天传的东西我找到了：一份文档和一张合照。合照还没确认，我检索不到它的内容——你可以在回执卡或资产页补一句描述并确认，以后就好找了。',
      route: 'HYBRID',
      typing: false,
      sources: [],
      // 工具轨迹芯片（meta.tools_used 同构）
      toolsUsed: [
        { id: 'd1', tool: 'find_item', summary: '开题报告' },
        { id: 'd2', tool: 'search_records', summary: '9 月记录 · 12 条' },
      ],
      // 三档演示：强引用完整卡（quote）/ 弱引用芯片 / 模糊提及芯片
      vaultRefs: normalizeVaultRefs([
        {
          vault_item_id: 7001,
          display_name: '毕业论文-开题报告',
          category: 'document',
          file_type: 'pdf',
          size_bytes: 2.1 * 1024 * 1024,
          digest_status: 'confirmed',
          created_at: daysAgoLocal(4),
          quote: '…本课题采用 Planner-Executor 双层架构，检索评测选用 Recall@K 与 MRR 双指标，消融实验覆盖词典加权与时间衰减两个维度…',
        },
        {
          vault_item_id: 7002,
          display_name: 'IMG_0901 宿舍合照',
          category: 'image',
          file_type: 'jpg',
          size_bytes: 3.4 * 1024 * 1024,
          digest_status: 'extracted',
          created_at: daysAgoLocal(3),
        },
        {
          vault_item_id: null,
          display_name: '昨天传的图片',
          vague: true,
          category: 'image',
          digest_status: 'extracted',
          created_at: daysAgoLocal(1),
        },
      ]),
    })
  }

  /** n 天前 yyyy-MM-dd（demo 引用存入日期） */
  function daysAgoLocal(n) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
    pushDemoVaultMessage,
    fetchSessions,
    loadSession,
    removeSession,
    newConversation,
    abort,
    clearMessages,
    restoreLastSession,
    getSavedSessionId,
  }
})
