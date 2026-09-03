<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { useMirrorStore } from '@/stores/mirror'
import { useChatStore } from '@/stores/chat'
import { useRecordsStore } from '@/stores/records'
import PageHeader from '@/components/organisms/PageHeader.vue'
import PortraitSection from '@/components/molecules/PortraitSection.vue'
import MoodBar from '@/components/molecules/MoodBar.vue'
import StatBlock from '@/components/molecules/StatBlock.vue'
import ChatMessage from '@/components/molecules/ChatMessage.vue'

const mirror = useMirrorStore()
const chat = useChatStore()
const records = useRecordsStore()

const chatInput = ref('')
const chatMessagesEl = ref(null)

const canSend = ref(false)

onMounted(() => {
  // 如果还没有记录数据，先获取
  if (records.records.length === 0) {
    records.fetchRecords()
  }
})

function onChatInput() {
  canSend.value = chatInput.value.trim().length > 0
}

async function sendMessage() {
  if (!chatInput.value.trim()) return
  const text = chatInput.value
  chatInput.value = ''
  canSend.value = false
  await chat.sendMessage(text)
  await nextTick()
  if (chatMessagesEl.value) {
    chatMessagesEl.value.scrollTop = chatMessagesEl.value.scrollHeight
  }
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <div class="page mirror-page">
    <PageHeader title="镜子" subtitle="认识你自己" />
    <div class="page-content">
      <!-- Hero -->
      <div class="mirror-hero">
        <div class="mirror-greeting">这是我在你身上看到的</div>
        <div class="mirror-name">你的镜子</div>
        <div class="mirror-stats">
          <StatBlock :num="records.totalCount" label="条记录" />
          <StatBlock num="3" label="天" />
          <StatBlock num="1.7" label="日均" />
        </div>
      </div>

      <!-- Portrait Grid -->
      <div class="portrait-grid">
        <PortraitSection icon="book2" icon-bg="#4F46E5" title="学习进展">
          <div class="portrait-text">{{ mirror.profile.learning.text }}</div>
          <div class="portrait-evidence">
            <div class="portrait-evidence-label">来源</div>
            <div v-for="(ev, i) in mirror.profile.learning.evidence" :key="i" class="portrait-evidence-item">
              <div class="evidence-dot" />
              <span class="evidence-date">{{ ev.date }}</span>
              <span>{{ ev.text }}</span>
            </div>
          </div>
        </PortraitSection>

        <PortraitSection icon="smile" icon-bg="#10B981" title="情绪分布">
          <MoodBar :segments="mirror.profile.mood.segments" />
        </PortraitSection>

        <PortraitSection icon="checkSquare" icon-bg="#F59E0B" title="未完成事项">
          <div class="portrait-text">{{ mirror.profile.todos }}</div>
        </PortraitSection>

        <PortraitSection icon="tag" icon-bg="#7C3AED" title="个人标签">
          <div class="portrait-text">{{ mirror.profile.tags }}</div>
        </PortraitSection>
      </div>

      <!-- Chat Section -->
      <div class="chat-section">
        <div class="chat-section-title">向镜子提问</div>
        <div ref="chatMessagesEl" class="chat-messages">
          <ChatMessage v-for="msg in chat.messages" :key="msg.id" :message="msg" />
        </div>
        <div class="chat-input-box">
          <textarea
            v-model="chatInput"
            class="chat-input"
            placeholder="你想了解什么?"
            rows="1"
            @input="onChatInput"
            @keydown="onKeydown"
          />
          <button :class="['chat-send', { enabled: canSend }]" @click="sendMessage">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: var(--bg); overflow-y: auto; overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.page-content { padding: 12px 16px calc(32px + var(--nav-height) + var(--safe-bottom)); }

@media (min-width: 900px) {
  .page-content { padding: 20px 36px 36px; }
}

/* Hero */
.mirror-hero {
  background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
  border-radius: 0 0 24px 24px;
  padding: 28px 20px 24px; margin: 0 -16px 20px;
  color: #fff; position: relative; overflow: hidden;
}
.mirror-hero::after { content: ''; position: absolute; top: -30%; right: -15%; width: 160px; height: 160px; border-radius: 50%; background: rgba(255,255,255,0.07); }
.mirror-hero::before { content: ''; position: absolute; bottom: -25%; left: -10%; width: 100px; height: 100px; border-radius: 50%; background: rgba(255,255,255,0.04); }
.mirror-greeting { font-size: 13px; opacity: 0.75; margin-bottom: 2px; }
.mirror-name { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; margin-bottom: 16px; }
.mirror-stats { display: flex; gap: 20px; }

@media (min-width: 900px) {
  .mirror-hero { margin: 0 -36px 28px; padding: 44px 36px 32px; border-radius: 0 0 28px 28px; }
  .mirror-hero .mirror-greeting { font-size: 14px; }
  .mirror-hero .mirror-name { font-size: 32px; margin-bottom: 24px; }
  .mirror-hero .mirror-stats { gap: 32px; }
}

/* Portrait */
.portrait-grid { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
.portrait-text { font-size: 13px; color: var(--text-secondary); line-height: 1.65; }
.portrait-evidence { margin-top: 12px; padding-top: 12px; border-top: 0.5px solid var(--border); }
.portrait-evidence-label { font-size: 10px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.portrait-evidence-item { display: flex; align-items: flex-start; gap: 6px; padding: 4px 0; font-size: 11px; color: var(--text-secondary); }
.evidence-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); margin-top: 5px; flex-shrink: 0; }
.evidence-date { font-size: 10px; color: var(--text-tertiary); font-family: var(--font-mono); flex-shrink: 0; min-width: 36px; }

@media (min-width: 900px) {
  .portrait-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
  .portrait-text { font-size: 14px; line-height: 1.75; }
  .portrait-evidence { margin-top: 14px; padding-top: 14px; }
  .portrait-evidence-label { font-size: 11px; margin-bottom: 8px; }
  .portrait-evidence-item { font-size: 12px; gap: 8px; padding: 5px 0; }
  .evidence-date { font-size: 11px; min-width: 40px; }
}

/* Chat */
.chat-section { margin-top: 20px; }
.chat-section-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.chat-messages { margin-bottom: 10px; max-height: 240px; overflow-y: auto; }
.chat-input-box { display: flex; gap: 8px; align-items: flex-end; }
.chat-input {
  flex: 1; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: var(--radius-md);
  font-size: 13px; font-family: var(--font); color: var(--text-primary);
  outline: none; resize: none; min-height: 40px; max-height: 100px; line-height: 1.5; transition: border-color 0.2s;
}
.chat-input:focus { border-color: var(--accent); }
.chat-send {
  width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--accent);
  border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all 0.15s; opacity: 0.3; pointer-events: none;
}
.chat-send.enabled { opacity: 1; pointer-events: auto; }
.chat-send:hover { background: var(--accent-hover); }
.chat-send:active { transform: scale(0.9); }
.chat-send svg { width: 16px; height: 16px; }

@media (min-width: 900px) {
  .chat-section { margin-top: 28px; }
  .chat-section-title { font-size: 15px; margin-bottom: 14px; }
  .chat-messages { max-height: 300px; }
  .chat-input { font-size: 14px; padding: 12px 16px; min-height: 44px; }
  .chat-send { width: 44px; height: 44px; }
  .chat-send svg { width: 18px; height: 18px; }
}
</style>
