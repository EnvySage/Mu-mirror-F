<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useChatStore } from '@/stores/chat'
import { timeAgo } from '@/utils/time'

/**
 * 对话页（T-F-R6 + 三轮接线）
 * 数据源（B 的 T-B-4 已就绪）：
 *  - POST /api/mirror/chat：SSE 流式（chat store sendMessage）
 *  - GET /api/mirror/sessions：会话列表（抽屉）
 *  - GET /api/mirror/sessions/{id}：历史回放
 *  - DELETE /api/mirror/sessions/{id}：删除会话
 * 后端未起时：历史加载失败走空态兜底文案，流式失败走"暂时无法回答"，不白屏。
 */
const ui = useUIStore()
const chat = useChatStore()

const input = ref('')
const messagesEl = ref(null)
const inputEl = ref(null)

const showSessions = ref(false)

const canSend = computed(() => input.value.trim().length > 0 && !chat.sending)

/** 空态文案：加载中 / 历史加载失败（后端未起）/ 正常引导 */
const emptyTitle = computed(() => (chat.historyLoading ? '加载会话中…' : '开始今天的对话吧'))
const emptyDesc = computed(() => {
  if (chat.historyLoading) return '正在从服务器拉取历史消息'
  if (chat.historyError) return '历史加载失败 · 请检查服务是否可用'
  return '比如「我最近在忙什么」「我的状态怎么样」'
})

onMounted(() => {
  // 进页自动恢复：存档会话 → 今天最近会话 → 都没有则保持空态
  chat.restoreLastSession()
})

// MobileHeader 历史按钮 → ui store 请求标志 → 打开抽屉（打开时刷新列表，恢复流程可能跳过了列表拉取）
watch(() => ui.chatSessionsRequested, (v) => {
  if (v) {
    ui.consumeChatSessionsRequest()
    chat.fetchSessions()
    showSessions.value = true
  }
})

onBeforeUnmount(() => {
  // 离开页面时若流未结束则中断，防止消息串到下次进入
  if (chat.sending) chat.abort()
})

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

watch(() => chat.messages.length, scrollToBottom)
watch(() => chat.sending, scrollToBottom)
// 流式逐字上屏时跟随滚动
watch(
  () => chat.messages.map(m => m.content.length).join(','),
  scrollToBottom,
)

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
  // 发送成功后刷新会话列表（新会话首次落库）
  chat.fetchSessions()
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

async function openSession(id) {
  showSessions.value = false
  await chat.loadSession(id)
  await scrollToBottom()
}

function startNew() {
  showSessions.value = false
  chat.newConversation()
}

async function removeSession(id) {
  await chat.removeSession(id)
  chat.fetchSessions()
}

// ==================== 抽屉日期分组：今天 / 昨天 / 更早 ====================

/** 按本地日期归类（yyyy-MM-dd），与后端北京时间字符串直接比对 */
function localDateKey(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
    value = new Date(value.replace(' ', 'T'))
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ''
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function dayKeyOffset(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const todayKey = dayKeyOffset(0)
const yesterdayKey = dayKeyOffset(-1)

/** 分组后的会话列表：组间按 今天 → 昨天 → 更早，组内 updated_at 倒序 */
const groupedSessions = computed(() => {
  const groups = [
    { key: 'today', label: '今天', items: [] },
    { key: 'yesterday', label: '昨天', items: [] },
    { key: 'earlier', label: '更早', items: [] },
  ]
  const byKey = Object.fromEntries(groups.map(g => [g.key, g]))
  const sorted = [...chat.sessions].sort((a, b) =>
    String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
  )
  for (const s of sorted) {
    const k = localDateKey(s.updated_at || s.created_at)
    if (k === todayKey) byKey.today.items.push(s)
    else if (k === yesterdayKey) byKey.yesterday.items.push(s)
    else byKey.earlier.items.push(s)
  }
  return groups.filter(g => g.items.length > 0)
})
</script>

<template>
  <div class="page chat-page">
    <div class="page-header">
      <div class="page-title">对话</div>
      <div class="page-subtitle">每个结论都能点回原始记录</div>
      <button class="chat-sessions-btn" @click="showSessions = !showSessions">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M3 6h18M3 12h18M3 18h12"/></svg>
        会话
      </button>
    </div>

    <!-- 会话列表抽屉 -->
    <Transition name="fade">
      <div v-if="showSessions" class="sessions-overlay" @click="showSessions = false" />
    </Transition>
    <Transition name="sessions-drawer">
      <div v-if="showSessions" class="sessions-drawer">
        <div class="sessions-head">
          <span class="sessions-title">历史会话</span>
          <div class="sessions-head-actions">
            <button class="sessions-new" @click="startNew">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:12px;height:12px"><path d="M12 5v14M5 12h14"/></svg>
              新会话
            </button>
            <button class="sessions-close" @click="showSessions = false">关闭</button>
          </div>
        </div>
        <div class="sessions-list">
          <div v-if="chat.sessionsLoading" class="sessions-empty">加载中…</div>
          <div v-else-if="!chat.sessions.length" class="sessions-empty">还没有会话 · 开始第一次提问吧</div>
          <template v-else>
            <section v-for="group in groupedSessions" :key="group.key" class="session-group">
              <div class="session-group-label">{{ group.label }}</div>
              <div
                v-for="s in group.items"
                :key="s.id"
                :class="['session-item', { active: s.id === chat.activeSessionId }]"
                @click="openSession(s.id)"
              >
                <div class="session-item-main">
                  <div class="session-item-title">{{ s.title || '未命名会话' }}</div>
                  <div class="session-item-time">{{ timeAgo(s.updated_at) }}</div>
                </div>
                <button class="session-item-del" title="删除会话" @click.stop="removeSession(s.id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>
                </button>
              </div>
            </section>
          </template>
        </div>
      </div>
    </Transition>

    <div class="page-content">
      <div class="chat-wrap">
        <!-- 空态（含加载中 / 失败兜底） -->
        <div v-if="chat.messages.length === 0" class="chat-empty">
          <div class="empty-icon" style="width:52px;height:52px;margin:0 auto 14px;border-radius:16px;background:var(--ink-2);border:1px solid var(--line);display:grid;place-items:center">
            <svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--text-low);fill:none;stroke-width:1.6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="empty-title">{{ emptyTitle }}</div>
          <div class="empty-desc">{{ emptyDesc }}</div>
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
                INTENT <b>{{ msg.route }}</b>
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
                  @click="openSource(s)"
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
            placeholder="问我任何关于你的事…"
            :disabled="chat.sending"
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
.page-subtitle { font-size: 13px; color: var(--text-low); flex: 1; }

/* 会话入口（桌面 header 右侧） */
.chat-sessions-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; color: var(--text-mid);
  padding: 6px 14px; border-radius: var(--radius-full);
  background: #FFFFFF; border: 1px solid var(--line);
  cursor: pointer;
}
.chat-sessions-btn svg { width: 13px; height: 13px; stroke: currentColor; }
.chat-sessions-btn:hover { border-color: var(--accent); color: var(--accent); }

.page-content {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 10px 18px calc(96px + var(--safe-bottom));
  -webkit-overflow-scrolling: touch;
}
@media (min-width: 900px) {
  .page-content { padding: 18px 32px 20px; max-width: 820px; margin: 0 auto; }
}

.chat-wrap { display: flex; flex-direction: column; height: 100%; }
.chat-empty { text-align: center; padding: 60px 20px; }

.chat-messages { flex: 1; overflow-y: auto; padding: 14px 4px 10px; }
.chat-msg { margin-bottom: 14px; display: flex; animation: cardIn .28s ease backwards; }
.chat-msg-user { justify-content: flex-end; }
.chat-msg-bubble {
  max-width: 84%; padding: 11px 15px; border-radius: 18px;
  font-size: 14.5px; line-height: 1.7; white-space: pre-wrap; word-break: break-word;
}
.chat-msg-user .chat-msg-bubble {
  background: var(--accent); color: #FFFFFF;
  border-bottom-right-radius: 6px; font-weight: 500;
}
.chat-msg-ai .chat-msg-bubble {
  background: #FFFFFF; border: 1px solid var(--line);
  border-bottom-left-radius: 6px;
}

/* 意图路由眉标 */
.chat-route {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em;
  color: var(--text-low); margin-bottom: 7px;
}
.chat-route b { color: var(--text-mid); font-weight: 500; }

/* sources 引用芯片 */
.chat-msg-sources {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: 10px; padding-top: 9px; border-top: 1px dashed var(--line);
}
.chat-source-link {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11.5px; color: var(--accent);
  padding: 3px 10px; border-radius: var(--radius-full);
  background: var(--accent-soft);
  cursor: pointer;
}
.chat-source-link svg { width: 11px; height: 11px; stroke: currentColor; fill: none; }

/* 输入条 */
.chat-input-bar { display: flex; gap: 10px; align-items: flex-end; padding: 10px 0 4px; }
.chat-input {
  flex: 1; background: #FFFFFF; border: 1px solid var(--line);
  border: none; border-radius: 20px; padding: 11px 16px;
  font-size: 14.5px; resize: none; max-height: 110px; color: var(--text-hi);
  overflow: hidden;
}
.chat-input:focus { outline: none; border-color: var(--accent); }
.chat-input:disabled { opacity: .55; }
.chat-send {
  width: 42px; height: 42px; border-radius: 50%;
  background: var(--ink-2); border: 1px solid var(--line);
  display: grid; place-items: center; flex-shrink: 0; transition: all .2s;
}
.chat-send svg { width: 17px; height: 17px; stroke: var(--text-low); fill: none; }
.chat-send.enabled { background: var(--accent); border-color: var(--accent); }
.chat-send.enabled svg { stroke: #FFFFFF; }
.chat-send:disabled { cursor: not-allowed; }

/* typing dots */
.typing-dots { display: inline-flex; gap: 4px; padding: 4px 0; }
.typing-dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--text-low); animation: blink 1.2s infinite; }
.typing-dots i:nth-child(2) { animation-delay: .2s; }
.typing-dots i:nth-child(3) { animation-delay: .4s; }

/* ===== 会话抽屉 ===== */
.sessions-overlay {
  position: fixed; inset: 0; z-index: 44;
  background: rgba(26,26,23,.35);
}
.sessions-drawer {
  position: fixed; left: 50%; bottom: 0; transform: translate(-50%, 0);
  width: 100%; max-width: 640px; max-height: 70dvh; z-index: 45;
  background: #FFFFFF;
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -8px 28px rgba(20,20,15,.14);
  display: flex; flex-direction: column;
  padding-bottom: var(--safe-bottom);
}
@media (min-width: 900px) {
  .sessions-drawer { border-radius: 20px; bottom: 8dvh; }
}
.sessions-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px 10px;
}
.sessions-title { font-family: var(--font-display); font-size: 16px; }
.sessions-head-actions { display: flex; gap: 14px; }
.sessions-new {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; color: var(--accent); cursor: pointer;
}
.sessions-new svg { width: 12px; height: 12px; }
.sessions-close { font-size: 14.5px; color: var(--text-mid); padding: 6px 2px; cursor: pointer; }

.sessions-list { overflow-y: auto; padding: 4px 14px 18px; }
.sessions-empty {
  text-align: center; color: var(--text-low); font-size: 13px;
  padding: 30px 0;
}
.session-group { margin-bottom: 6px; }
.session-group-label {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .16em;
  color: var(--text-low);
  margin: 14px 8px 4px;
  display: flex; align-items: center; gap: 10px;
}
.session-group-label::after { content: ""; flex: 1; height: 1px; background: var(--line); }
.session-group:first-child .session-group-label { margin-top: 6px; }
.session-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 8px; border-radius: var(--radius-sm);
  cursor: pointer; transition: background .15s;
}
.session-item:hover { background: var(--ink-2); }
.session-item.active { box-shadow: inset 0 0 0 1.5px var(--accent); background: var(--accent-soft); }
.session-item-main { flex: 1; min-width: 0; }
.session-item-title {
  font-size: 14px; color: var(--text-hi);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.session-item-time { font-family: var(--font-mono); font-size: 11px; color: var(--text-low); margin-top: 3px; }
.session-item-del {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
  display: grid; place-items: center; opacity: 0; transition: opacity .15s;
}
.session-item:hover .session-item-del { opacity: 1; }
.session-item-del svg { width: 13px; height: 13px; stroke: var(--danger); }
.session-item-del:hover { background: var(--danger-bg); }

.sessions-drawer-enter-active, .sessions-drawer-leave-active { transition: transform .32s cubic-bezier(.32,.72,.28,1); }
.sessions-drawer-enter-from, .sessions-drawer-leave-to { transform: translate(-50%, 110%) !important; }
</style>
