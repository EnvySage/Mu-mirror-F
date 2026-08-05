import { ref, nextTick } from 'vue'
import { defineStore } from 'pinia'

const chatResponses = {
  '学习': '根据你的记录，你最近在学习 Spring Security（认证和授权）以及数据库概念设计。你的学习模式显示你偏好后端技术方向。',
  '心情': '你最近的情绪分布：40% 开心，30% 平静，20% 焦虑，10% 疲惫。完成任务后你会感到满足，但在截止日期前会有些焦虑。',
  '待办': '你目前有 1 项待办：准备项目进度会议的演示文稿。',
  '朋友': '你最近和朋友一起吃了饭，聊了毕业设计，朋友建议你用 Vue 写前端。',
  'default': '这是个好问题。根据你的记录，我可以看到你在学习、情绪和日常活动方面的模式。你可以问我更具体的问题，比如"我最近学了什么"或"我的心情怎么样"。',
}

/**
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {'user' | 'assistant'} role
 * @property {string} content
 * @property {string} [sources]
 */

export const useChatStore = defineStore('chat', () => {
  /** @type {import('vue').Ref<ChatMessage[]>} */
  const messages = ref([])
  const sending = ref(false)

  /**
   * 发送消息（demo 模拟）
   * @param {string} content
   */
  async function sendMessage(content) {
    if (!content.trim()) return

    // 添加用户消息
    messages.value.push({
      id: String(Date.now()),
      role: 'user',
      content: content.trim(),
    })

    sending.value = true

    // 模拟 AI 响应延迟
    await new Promise(resolve => setTimeout(resolve, 800))

    let response = chatResponses.default
    for (const [key, val] of Object.entries(chatResponses)) {
      if (key !== 'default' && content.includes(key)) {
        response = val
        break
      }
    }

    messages.value.push({
      id: String(Date.now() + 1),
      role: 'assistant',
      content: response,
      sources: '查看来源',
    })

    sending.value = false
  }

  function clearMessages() {
    messages.value = []
  }

  return {
    messages,
    sending,
    sendMessage,
    clearMessages,
  }
})
