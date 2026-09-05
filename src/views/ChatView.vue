<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useChatStore } from '@/stores/chat'
import { useVaultStore } from '@/stores/vault'
import { useToastStore } from '@/stores/toast'
import ChatSessionsPanel from '@/components/organisms/ChatSessionsPanel.vue'
import VaultRefCard from '@/components/molecules/VaultRefCard.vue'
import VaultUploadCard from '@/components/molecules/VaultUploadCard.vue'
import VaultDigestReceipt from '@/components/molecules/VaultDigestReceipt.vue'
import ToolTrail from '@/components/molecules/ToolTrail.vue'
import { validateVaultFile, deriveMockDisplayName, formatBytes } from '@/constants/fileTypes'

/**
 * 对话页（T-F-R6 + 六轮任务 B：会话栏常驻 + 十一轮 vault 文件卡/上传入口）
 * 数据源（B 的 T-B-4 已就绪）：
 *  - POST /api/mirror/chat：SSE 流式（chat store sendMessage）
 *  - GET /api/mirror/sessions：会话列表（抽屉 / ≥1440px 常驻栏共用 ChatSessionsPanel）
 *  - GET /api/mirror/sessions/{id}：历史回放
 *  - DELETE /api/mirror/sessions/{id}：删除会话
 * 十一轮新增：
 *  - 输入栏附件按钮 + 输入区拖拽上传（dragover 高亮），校验（白名单 + 20MB）后弹上传卡
 *  - AI 气泡：上方工具轨迹芯片（tools_used）+ 消息内对话文件卡三档（vault_refs）
 *  - 消化回执卡（vault store digesting 完成后追加到消息流，三键纠错）
 * 布局：≥1440px 消息列 fluid 居中限宽 760px + 会话栏 280px 固定右侧；
 * <1440px 保持抽屉交互（MobileHeader / 桌面 header 按钮开抽屉）。
 * 后端未起时：历史加载失败走空态兜底文案，流式失败走"暂时无法回答"，不白屏。
 */
const ui = useUIStore()
const chat = useChatStore()
const vault = useVaultStore()
const toast = useToastStore()

const input = ref('')
const messagesEl = ref(null)
const inputEl = ref(null)

const showSessions = ref(false)

const canSend = computed(() => input.value.trim().length > 0 && !chat.sending)

/** 消化完成待回执的条目（vault store 消化完成置 _receiptOpen=true → 消息流末尾展示回执卡） */
const receiptItems = computed(() =>
  vault.items.filter(i => i.digest_status === 'done' && i._receiptOpen)
)

/** mock 门（B /api/vault + vault_refs 就绪前预览/下载置灰） */
const vaultMockGate = computed(() => vault.source === 'mock')

/** 常驻栏当前会话标题（空 = 新话题草稿） */
const activeSessionTitle = computed(() => {
  const s = chat.sessions.find(x => x.id === chat.activeSessionId)
  return s?.title || ''
})

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
  // 常驻栏（≥1440px）与抽屉共用同一份列表，进页拉一次
  chat.fetchSessions()
  // vault store：附件入口 + 消化回执数据源（mock 态含 otaku_it 三件套演示数据）
  vault.fetch()
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
// 回执卡出现（消化完成）也滚到底
watch(() => vault.items.map(i => `${i.id}:${i.digest_status}`).join(','), () => {
  if (receiptItems.value.length) scrollToBottom()
})

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

// ==================== 附件上传（任务 2） ====================

const fileInput = ref(null)
const dragOver = ref(false)
/** 待确认上传（上传卡挂载态） */
const pendingUpload = ref(null)

function pickFile() {
  fileInput.value?.click()
}

function onPickChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) acceptFile(file)
}

function onDragOver(e) {
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

function onDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) acceptFile(file)
}

/** 前端校验（白名单 + 20MB + 拒绝类专属理由）→ 通过弹上传卡 */
function acceptFile(file) {
  const v = validateVaultFile(file)
  if (!v.ok) {
    toast.error(v.reason, 4200)
    return
  }
  pendingUpload.value = {
    file,
    displayName: deriveMockDisplayName(file.name),
    category: v.category,
    file_type: v.ext,
  }
}

/** 上传卡 [就这样存] → vault store（mock 2s 后消化完成出回执） */
async function confirmUpload({ description, displayName }) {
  if (!pendingUpload.value) return
  const file = pendingUpload.value.file
  const res = await vault.upload(file, description)
  if (!res.ok) {
    toast.error(res.error || '上传失败')
    return
  }
  if (displayName && res.item) {
    await vault.update(res.item.id, { display_name: displayName })
    res.item.display_name = displayName
  }
  pendingUpload.value = null
  toast.success(`已存入 · ${formatBytes(file.size)} · 消化中，稍后给你回执`)
}

function cancelUpload() {
  pendingUpload.value = null
}

// ==================== 消化回执（任务 3） ====================

const busyReceiptId = ref(null)

/** 对的 → 定稿 toast，回执关闭 */
async function onReceiptConfirm(item) {
  busyReceiptId.value = item.id
  await vault.confirmDigest(item.id)
  busyReceiptId.value = null
  item._receiptOpen = false
  toast.success(`「${item.display_name}」没问题 · 以后就这么找它`)
}

/** 改一改 → 保存（VaultDigestReceipt emit save） */
async function onReceiptSave(item, data) {
  busyReceiptId.value = item.id
  const ok = await vault.update(item.id, data)
  busyReceiptId.value = null
  if (ok) toast.success('已更新 · 以后按新的理解找它')
  else toast.error(vault.error || '保存失败')
}

/** 不是这个，删了 → 内联二次确认后触发；淡出动画在回执卡内，此处删除数据 */
async function onReceiptRemove(item) {
  busyReceiptId.value = item.id
  const ok = await vault.remove(item.id)
  busyReceiptId.value = null
  if (ok) toast.info(`「${item.display_name}」已删除`)
  else toast.error(vault.error || '删除失败')
}

// ==================== 演示（mock 文件卡三档 + 工具轨迹） ====================

/** 空态演示按钮：注入三档文件卡 + 工具轨迹演示气泡（真链路走 SSE 事件） */
function showDemo() {
  chat.pushDemoVaultMessage()
  scrollToBottom()
}

/** 面板共用回调：打开会话（抽屉形态需先收起抽屉） */
async function onOpenSession(id) {
  showSessions.value = false
  await chat.loadSession(id)
  await scrollToBottom()
}

function onNewSession() {
  showSessions.value = false
  chat.newConversation()
}

async function onRemoveSession(id) {
  await chat.removeSession(id)
  chat.fetchSessions()
}
</script>

<template>
  <div class="page chat-page">
    <div class="page-header">
      <div class="page-title">对话</div>
      <div class="page-subtitle">每个结论都能点回原始记录</div>
      <!-- ≥1440px 常驻栏已展示会话列表，按钮隐藏避免重复入口 -->
      <button class="chat-sessions-btn" @click="showSessions = !showSessions">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M3 6h18M3 12h18M3 18h12"/></svg>
        会话
      </button>
    </div>

    <!-- 会话列表抽屉（<1440px 主入口；≥1440px 隐藏按钮但仍可通过 MobileHeader 打开） -->
    <Transition name="fade">
      <div v-if="showSessions" class="sessions-overlay" @click="showSessions = false" />
    </Transition>
    <Transition name="sessions-drawer">
      <div v-if="showSessions" class="sessions-drawer">
        <ChatSessionsPanel
          variant="drawer"
          @close="showSessions = false"
          @new-session="onNewSession"
          @open-session="onOpenSession"
          @remove-session="onRemoveSession"
        />
      </div>
    </Transition>

    <div class="page-content">
      <div class="chat-layout">
        <div class="chat-wrap">
          <!-- 空态（含加载中 / 失败兜底 + vault 演示入口） -->
          <div v-if="chat.messages.length === 0" class="chat-empty">
            <div class="empty-icon" style="width:52px;height:52px;margin:0 auto 14px;border-radius:16px;background:var(--ink-2);border:1px solid var(--line);display:grid;place-items:center">
              <svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--text-low);fill:none;stroke-width:1.6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="empty-title">{{ emptyTitle }}</div>
            <div class="empty-desc">{{ emptyDesc }}</div>
            <!-- 演示入口：mock 态看对话文件卡三档 + 工具轨迹（真链路就绪后自然被真实会话取代） -->
            <button v-if="vaultMockGate" class="chat-demo-btn" @click="showDemo">
              看看文件卡长什么样（演示）
            </button>
          </div>

          <!-- 消息列表 -->
          <div ref="messagesEl" class="chat-messages">
            <div
              v-for="msg in chat.messages"
              :key="msg.id"
              :class="['chat-msg', msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai']"
            >
              <div class="chat-msg-bubble">
                <!-- AI 消息：工具轨迹芯片（E6，气泡上方） -->
                <ToolTrail v-if="msg.role !== 'user' && msg.toolsUsed && msg.toolsUsed.length" :tools="msg.toolsUsed" />

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

                <!-- 对话文件卡（vault_refs 三档：强引用完整卡 / 弱引用芯片 / 模糊提及芯片） -->
                <div v-if="msg.vaultRefs && msg.vaultRefs.length" class="chat-msg-vaultrefs">
                  <VaultRefCard
                    v-for="vr in msg.vaultRefs"
                    :key="vr.id"
                    :ref-item="vr"
                    :mock-gate="vaultMockGate"
                  />
                </div>
              </div>
            </div>

            <!-- 消化回执卡（上传消化完成后出现在消息流末尾，三键纠错） -->
            <div v-for="item in receiptItems" :key="`receipt-${item.id}`" class="chat-msg chat-msg-ai">
              <div class="chat-msg-bubble chat-msg-bubble-receipt">
                <VaultDigestReceipt
                  :item="item"
                  :busy="busyReceiptId === item.id"
                  @confirm="() => onReceiptConfirm(item)"
                  @save="(d) => onReceiptSave(item, d)"
                  @remove="() => onReceiptRemove(item)"
                />
              </div>
            </div>
          </div>

          <!-- 输入条（附件按钮 + 拖拽上传区） -->
          <div
            :class="['chat-input-bar', { 'chat-input-drag': dragOver }]"
            @dragover.prevent="onDragOver"
            @dragleave="onDragLeave"
            @drop.prevent="onDrop"
          >
            <button class="chat-attach" title="添加文件" :disabled="chat.sending" @click="pickFile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <input ref="fileInput" type="file" hidden @change="onPickChange">
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

          <!-- 拖拽提示 -->
          <div v-if="dragOver" class="chat-drop-hint">松手把文件交给镜子保管（20MB 内）</div>

          <!-- 上传卡（选文件后弹出，确认才上传） -->
          <VaultUploadCard
            v-if="pendingUpload"
            :pending="pendingUpload"
            :uploading="vault.uploading"
            @confirm="confirmUpload"
            @cancel="cancelUpload"
          />
        </div>

        <!-- ≥1440px 会话常驻栏（280px 固定右侧） -->
        <aside class="chat-rail">
          <ChatSessionsPanel
            variant="rail"
            :active-title="activeSessionTitle"
            @new-session="onNewSession"
            @open-session="onOpenSession"
            @remove-session="onRemoveSession"
          />
        </aside>
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

/* 会话入口（桌面 header 右侧；≥1440px 常驻栏接管 → 隐藏） */
.chat-sessions-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; color: var(--text-mid);
  padding: 6px 14px; border-radius: var(--radius-full);
  background: #FFFFFF; border: 1px solid var(--line);
  cursor: pointer;
}
.chat-sessions-btn svg { width: 13px; height: 13px; stroke: currentColor; }
.chat-sessions-btn:hover { border-color: var(--accent); color: var(--accent); }
@media (min-width: 1440px) { .chat-sessions-btn { display: none; } }

.page-content {
  flex: 1; min-height: 0; overflow: hidden;
  padding: 10px 18px calc(96px + var(--safe-bottom));
  -webkit-overflow-scrolling: touch;
  display: flex;
}
@media (min-width: 900px) {
  .page-content { padding: 18px 32px 20px; }
}

/* ===== 会话双栏布局：消息列 fluid 居中限宽 760 + 会话栏 280 固定（≥1440px） ===== */
.chat-layout { display: flex; flex-direction: column; flex: 1; min-height: 0; width: 100%; }
.chat-rail { display: none; }
@media (min-width: 1440px) {
  .chat-layout { flex-direction: row; gap: 18px; }
  .chat-wrap { flex: 1; max-width: 760px; margin: 0 auto; min-width: 0; }
  .chat-rail {
    display: flex; flex-direction: column;
    flex: 0 0 280px; width: 280px;
    align-self: stretch;
    background: #FFFFFF;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
}

.chat-wrap { display: flex; flex-direction: column; height: 100%; min-height: 0; flex: 1; /* 阅读限宽居中：移动端 100% 不受影响，900~1439 回退原 820 级居中，≥1440 双栏内仍限 760 */ max-width: 760px; margin: 0 auto; }
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

/* 对话文件卡容器（vault_refs，与 sources 分区隔开） */
.chat-msg-vaultrefs { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }

/* 回执气泡：白底全宽（回执卡自身带边框，气泡退为容器） */
.chat-msg-bubble-receipt { background: transparent; border: none; padding: 0; max-width: 100%; width: 100%; }

/* 演示入口按钮（空态；B 接口就绪后 vaultMockGate=false 自动消失） */
.chat-demo-btn {
  margin-top: 16px;
  font-size: 12.5px; color: var(--accent);
  padding: 6px 16px; border-radius: var(--radius-full);
  border: 1px dashed var(--accent);
  transition: background .15s;
}
.chat-demo-btn:hover { background: var(--accent-soft); }

/* 附件按钮（paperclip，无 emoji） */
.chat-attach {
  width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
  background: #FFFFFF; border: 1px solid var(--line);
  display: grid; place-items: center; transition: border-color .15s, color .15s;
}
.chat-attach svg { width: 17px; height: 17px; stroke: var(--text-mid); }
.chat-attach:hover:not(:disabled) { border-color: var(--accent); }
.chat-attach:hover:not(:disabled) svg { stroke: var(--accent); }
.chat-attach:disabled { opacity: .5; cursor: not-allowed; }

/* 拖拽高亮（dragover） */
.chat-input-bar { border: 1px solid transparent; border-radius: 24px; transition: border-color .15s, background .15s; }
.chat-input-drag { border-color: var(--accent); background: var(--accent-soft); }
.chat-drop-hint {
  font-family: var(--font-mono); font-size: 10.5px; color: var(--accent);
  text-align: center; padding-top: 6px; animation: cardIn .2s ease;
}

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

/* ===== 会话抽屉（<1440px） ===== */
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

.sessions-drawer-enter-active, .sessions-drawer-leave-active { transition: transform .32s cubic-bezier(.32,.72,.28,1); }
.sessions-drawer-enter-from, .sessions-drawer-leave-to { transform: translate(-50%, 110%) !important; }
</style>
