<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useChatStore } from '@/stores/chat'
import { useToastStore } from '@/stores/toast'
import { timeAgo } from '@/utils/time'

/**
 * 对话页（T-F-R6，结构先行）
 * 后端 POST /api/mirror/chat（T-B-4）未就绪：
 *  - 发送按钮置灰（ui.chatReady=false 时禁用）
 *  - 空态提示"对话功能即将上线"
 * 接口就绪时：chat store sendMessage 走流式 + sources 引用芯片即插即用。
 */
const router = useRouter()
const ui = useUIStore()
const chat = useChatStore()
const toast = useToastStore()

const input = ref('')
const messagesEl = ref(null)
const inputEl = ref(null)

const canSend = computed(() => ui.chatReady && input.value.trim().length > 0 && !chat.sending)

onMounted(() => {
  if (ui.chatReady && chat.messages.length === 0) {
    chat.sendGreeting?.()
  }
})

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

watch(() => chat.messages.length, scrollToBottom)
watch(() => chat.sending, scrollToBottom)

function autoGrow() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 110) + 'px'
}

async function send() {
  if (!canSend.value) return
  const text = input.value
  input.value = ''
  if (inputEl.value) inputEl.value.style.height = 'auto'
  await chat.sendMessage(text)
  await scrollToBottom()
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

/** 引用芯片点击 → 打开对应记录详情 */
function openSource(msg) {
  if (!msg.recordId) return
  ui.selectedRecordId = msg.recordId
  ui.showDetail = true
}
</script>

<template>
  <div class="page chat-page">
    <div class="page-header">
      <div class="page-title">对话</div>
      <div class="page-subtitle">每个结论都能点回原始记录</div>
    </div>
    <div class="page-content">
      <div class="chat-wrap">
        <!-- 空态 / 未就绪提示 -->
        <div v-if="chat.messages.length === 0" class="chat-empty">
          <div class="empty-icon" style="width:52px;height:52px;margin:0 auto 14px;border-radius:18px;background:var(--glass);box-shadow:inset 0 0 0 1px var(--line);display:grid;place-items:center">
            <svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--text-low);fill:none;stroke-width:1.6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="empty-title">问我任何关于你的事</div>
          <div class="empty-desc">{{ ui.chatReady ? '比如「我最近在忙什么」「我的状态怎么样」' : '对话功能即将上线 · AI 检索通道就绪后开放' }}</div>
        </div>

        <!-- 消息列表 -->
        <div ref="messagesEl" class="chat-messages">
          <div
            v-for="msg in chat.messages"
            :key="msg.id"
            :class="['chat-msg', msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai']"
          >
            <div class="chat-msg-bubble">
              <!-- AI 消息：意图路由眉标 -->
              <div v-if="msg.role !== 'user' && msg.route" class="chat-route">
                INTENT → <b>{{ msg.route }}</b>
              </div>

              <!-- typing dots -->
              <span v-if="msg.typing" class="typing-dots"><i /><i /><i /></span>
              <template v-else>{{ msg.content }}</template>

              <!-- sources 引用芯片 -->
              <div v-if="msg.sources && msg.sources.length" class="chat-msg-sources">
                <button
                  v-for="(s, i) in msg.sources"
                  :key="i"
                  class="chat-source-link"
                  @click="openSource({ recordId: s.recordId })"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  {{ s.date }} · {{ s.quote.slice(0, 10) }}…
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入条 -->
        <div class="chat-input-bar">
          <textarea
            ref="inputEl"
            v-model="input"
            class="chat-input"
            rows="1"
            :placeholder="ui.chatReady ? '问我任何关于你的事…' : '对话功能即将上线'"
            :disabled="!ui.chatReady"
            @input="autoGrow"
            @keydown="onKeydown"
          />
          <button :class="['chat-send', { enabled: canSend }]" :disabled="!canSend" @click="send">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.page-header { display: none; padding: 26px 32px 0; align-items: baseline; gap: 14px; }
@media (min-width: 900px) { .page-header { display: flex; } }
.page-title { font-family: var(--font-display); font-size: 26px; font-weight: 600; }
.page-subtitle { font-size: 13px; color: var(--text-low); }

.page-content {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 10px 18px calc(10px + var(--safe-bottom));
}
@media (min-width: 900px) {
  .page-content { padding: 18px 32px 20px; max-width: 760px; }
}

.chat-wrap { display: flex; flex-direction: column; height: 100%; }
.chat-empty { text-align: center; padding: 60px 20px; }

.chat-messages { flex: 1; overflow-y: auto; padding: 14px 4px 10px; }
.chat-msg { margin-bottom: 14px; display: flex; }
.chat-msg-user { justify-content: flex-end; }
.chat-msg-bubble {
  max-width: 84%; padding: 11px 15px; border-radius: 18px;
  font-size: 14.5px; line-height: 1.7; white-space: pre-wrap; word-break: break-word;
}
.chat-msg-user .chat-msg-bubble {
  background: var(--accent-grad); color: #0B0E1A;
  border-bottom-right-radius: 6px; font-weight: 500;
}
.chat-msg-ai .chat-msg-bubble {
  background: var(--glass); box-shadow: inset 0 0 0 1px var(--line);
  border-bottom-left-radius: 6px;
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
}

/* 意图路由眉标 */
.chat-route {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em;
  color: var(--text-low); margin-bottom: 7px;
}
.chat-route b { color: var(--cyan); font-weight: 500; }

/* sources 引用芯片 */
.chat-msg-sources {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: 10px; padding-top: 9px; border-top: 1px dashed var(--line);
}
.chat-source-link {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11.5px; color: var(--cyan);
  padding: 3px 10px; border-radius: var(--radius-full);
  background: rgba(110,231,240,.08); box-shadow: inset 0 0 0 1px rgba(110,231,240,.22);
  cursor: pointer;
}
.chat-source-link svg { width: 11px; height: 11px; stroke: currentColor; fill: none; }

/* 输入条 */
.chat-input-bar { display: flex; gap: 10px; align-items: flex-end; padding: 10px 0 4px; }
.chat-input {
  flex: 1; background: var(--glass); box-shadow: inset 0 0 0 1px var(--line);
  border: none; border-radius: 20px; padding: 11px 16px;
  font-size: 14.5px; resize: none; max-height: 110px; color: var(--text-hi);
  overflow: hidden;
}
.chat-input:focus { outline: none; box-shadow: inset 0 0 0 1px rgba(110,231,240,.4); }
.chat-input:disabled { opacity: .55; }
.chat-send {
  width: 42px; height: 42px; border-radius: 50%;
  background: var(--glass-2); box-shadow: inset 0 0 0 1px var(--line);
  display: grid; place-items: center; flex-shrink: 0; transition: all .2s;
}
.chat-send svg { width: 17px; height: 17px; stroke: var(--text-low); fill: none; }
.chat-send.enabled { background: var(--accent-grad); }
.chat-send.enabled svg { stroke: #0B0E1A; }
.chat-send:disabled { cursor: not-allowed; }

/* typing dots */
.typing-dots { display: inline-flex; gap: 4px; padding: 4px 0; }
.typing-dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--text-low); animation: blink 1.2s infinite; }
.typing-dots i:nth-child(2) { animation-delay: .2s; }
.typing-dots i:nth-child(3) { animation-delay: .4s; }
</style>
