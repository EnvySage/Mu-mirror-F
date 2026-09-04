import { ref, nextTick } from 'vue'
import { defineStore } from 'pinia'

/**
 * 对话 store（T-F-R6 结构先行）
 *
 * 后端 POST /api/mirror/chat 流式接口（T-B-4）未就绪 —— sendMessage 当前为本地 mock
 * （按关键词匹配原型对话脚本），接口就绪后只需把 mock 段替换为流式调用，
 * 消息结构（route 眉标 / typing / sources 引用芯片）不变。
 *
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {'user' | 'ai'} role
 * @property {string} content
 * @property {string} [route] - 意图路由（INTENT → HYBRID 等）
 * @property {boolean} [typing] - 是否正在打字
 * @property {{ recordId: string|number, quote: string, date: string }[]} [sources]
 */

/** mock 响应脚本（对齐原型 v2 CHAT_SCRIPT） */
const MOCK_SCRIPT = [
  {
    match: /最近|忙|学了|学习/,
    route: 'HYBRID',
    answer: '基于你的记录，我可以看到你最近的学习与工作重心。接口就绪后，这里会返回真实检索结果。',
    sources: [],
  },
  {
    match: /状态|心情|情绪|累/,
    route: 'PROFILE',
    answer: '按你的画像快照：情绪整体平稳偏积极。接口就绪后，这里会引用真实快照数据。',
    sources: [],
  },
  {
    match: /待办|没做完|未完成|todo/i,
    route: 'STRUCTURED',
    answer: '从元数据过滤的角度看待办事项。接口就绪后，这里会列出真实的挂起事项。',
    sources: [],
  },
]

const MOCK_DEFAULT = {
  route: 'SEMANTIC',
  answer: '这是个好问题。对话通道尚未开放——后端 POST /api/mirror/chat 就绪后，我会基于你的记录向量检索来回答。',
  sources: [],
}

let msgId = 0

export const useChatStore = defineStore('chat', () => {
  /** @type {import('vue').Ref<ChatMessage[]>} */
  const messages = ref([])
  const sending = ref(false)

  function pushUser(content) {
    messages.value.push({ id: String(++msgId), role: 'user', content })
  }

  function pushAiPlaceholder(route) {
    const msg = { id: String(++msgId), role: 'ai', content: '', route, typing: true, sources: [] }
    messages.value.push(msg)
    return msg
  }

  /**
   * 发送消息（mock 流式：typing dots → 逐字上屏 → sources 芯片）
   * TODO: 替换为 POST /api/mirror/chat 流式读取
   * @param {string} content
   */
  async function sendMessage(content) {
    const text = content.trim()
    if (!text || sending.value) return

    pushUser(text)
    sending.value = true

    const hit = MOCK_SCRIPT.find(s => s.match.test(text)) || MOCK_DEFAULT
    const aiMsg = pushAiPlaceholder(hit.route)

    // 模拟首包延迟
    await new Promise(r => setTimeout(r, 600))
    aiMsg.typing = false

    // 模拟流式逐字
    let i = 0
    while (i < hit.answer.length) {
      i = Math.min(i + 2, hit.answer.length)
      aiMsg.content = hit.answer.slice(0, i)
      await new Promise(r => setTimeout(r, 24))
    }

    aiMsg.sources = hit.sources || []
    sending.value = false
  }

  function clearMessages() {
    messages.value = []
  }

  return { messages, sending, sendMessage, clearMessages }
})
