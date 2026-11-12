import { parseCitations, citeTitle } from '@/utils/chatViewCitations'
import { reportAchievementActivity } from '@/api/achievements'
import ChatImageDraft from '@/components/molecules/ChatImageDraft.vue'
import PageMasthead from '@/components/molecules/PageMasthead.vue'
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { usePresentationMode } from '@/composables/usePresentationMode'
import { useUIStore } from '@/stores/ui'
import { useChatStore } from '@/stores/chat'
import { useActionsStore } from '@/stores/actions'
import { useVaultStore } from '@/stores/vault'
import { useToastStore } from '@/stores/toast'
import ChatSessionsPanel from '@/components/organisms/ChatSessionsPanel.vue'
import FilePreviewModal from '@/components/organisms/FilePreviewModal.vue'
import VaultRefCard from '@/components/molecules/VaultRefCard.vue'
import VaultUploadCard from '@/components/molecules/VaultUploadCard.vue'
import VaultDigestReceipt from '@/components/molecules/VaultDigestReceipt.vue'
import ActionCard from '@/components/organisms/ActionCard.vue'
import ChatDaySummaryCard from '@/components/organisms/ChatDaySummaryCard.vue'
import ChatMemoryPanel from '@/components/organisms/ChatMemoryPanel.vue'
import CreatedRecordReceipt from '@/components/molecules/CreatedRecordReceipt.vue'
import ToolTrail from '@/components/molecules/ToolTrail.vue'
import FileTypeIcon from '@/components/atoms/FileTypeIcon.vue'
import { validateVaultFile, deriveDisplayName, formatBytes } from '@/constants/fileTypes'
import request from '@/api/request'
import { retryDaySummary as apiRetryDaySummary } from '@/api/chat'
import { resolveDaySummaryActions } from '@/utils/chatDaySummaryActions'
import { useChatScroll } from '@/motion/useChatScroll'
import { createMotionScope, duration, gsap, prefersReducedMotion } from '@/motion/core'
import { useOverlayMotion } from '@/motion/useOverlayMotion'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useSceneActivity } from '@/motion/useSceneActivity'
import ChatMessageContent from '@/components/molecules/ChatMessageContent.vue'

export function useChatView() {

const ui = useUIStore()
const router = useRouter()
const presentation = usePresentationMode()
const isMobile = computed(() => presentation.mode.value === 'mobile')
const chat = useChatStore()
const actions = useActionsStore()
const vault = useVaultStore()
const toast = useToastStore()


const orderedMessages = computed(() => {
  const list = chat.messages
  const out = []
  const consumed = new Set()
  for (const userMessage of list) {
    if (userMessage.role !== 'user') continue
    out.push(userMessage)



    const userIds = new Set([String(userMessage.id)])
    if (userMessage.serverMessageId) userIds.add(String(userMessage.serverMessageId))
    for (const reply of list) {
      if (reply.role !== 'ai' || !userIds.has(String(reply.actionSourceMessage))) continue
      out.push(reply)
      consumed.add(reply)
    }
  }
  for (const message of list) {
    if (!consumed.has(message) && !out.includes(message)) out.push(message)
  }
  return out
})

const input = computed({ get: () => chat.draft, set: value => { chat.draft = value } })
const messagesEl = ref(null)
const inputEl = ref(null)
const sceneEl = ref(null)
const sceneActive = useSceneActivity(sceneEl)
const mailDate = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date())

const showSessions = ref(false)
const sessionsDialog = ref(null)
const sessionsMotion = useOverlayMotion({ xPercent: -50, distance: 32 })
useDialogFocus(() => showSessions.value, sessionsDialog, 'button', () => { showSessions.value = false })
const showMemoryPanel = ref(false)
const showMore = ref(false)
const moreDialog = ref(null)
watch(showMore, async open => {
  await nextTick()
  if (!moreDialog.value) return
  if (open && !moreDialog.value.open) moreDialog.value.showModal()
  else if (!open && moreDialog.value.open) moreDialog.value.close()
})
watch(isMobile, () => { showMore.value = false })
function openMemory() {
  showMore.value = false
  moreDialog.value?.close()
  showMemoryPanel.value = true
}
function openModels() {
  showMore.value = false
  router.push('/models')
}
function openHistory() {
  chat.fetchSessions()
  showSessions.value = true
}

const imageDraft = ref(null)
const imageCount = ref(0)
const removeImageGuard = ui.registerNavigationGuard('chat-images', () => !imageCount.value || window.confirm('离开后将清除尚未发送的图片预览，继续吗？'))
onBeforeUnmount(removeImageGuard)
function onPasteImages(event) {
  const files = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith('image/'))
  if (!files.length || chat.sending) return
  event.preventDefault()
  imageDraft.value?.addFiles(files)
}
const canSend = computed(() => input.value.trim().length > 0 && !chat.sending && imageCount.value === 0)
const retryingSummaryId = ref(null)
const visibleEndedSummaries = computed(() => chat.endedDaySummaries || [])

function summaryActions(summary) {
  return resolveDaySummaryActions({
    summary,
    activeSessionId: chat.activeSessionId,
    actionsById: actions.byId,
    getSessionActions: sessionId => actions.inSession(sessionId),
  })
}

async function retrySummary(summary) {
  const sessionId = summary.sourceSessionId || summary.source_session_id
  if (!sessionId || retryingSummaryId.value) return
  retryingSummaryId.value = sessionId
  try {
    await apiRetryDaySummary(sessionId)
    await chat.fetchTodaySession()
    await chat.fetchSessions()
    toast.success('已重新开始整理')
  } catch (err) {
    toast.error(err?.message || '重试失败，请稍后再试')
  } finally {
    retryingSummaryId.value = null
  }
}
function actionCardsFor(message) {




  if (message?.role !== 'ai') return []
  const sessionId = chat.activeSessionId || chat.sessionId
  return actions.inSession(sessionId).filter(card => String(card.source_message_id || card.sourceMessageId || '') === String(message.actionSourceMessage || message.serverMessageId || ''))
}


const receiptItems = computed(() =>
  vault.items.filter(i => i.digest_status === 'extracted' && i._receiptOpen)
)


const previewItem = ref(null)
const previewMessageId = ref(null)


const downloadingRef = ref(false)

async function downloadRef(item) {
  if (downloadingRef.value) return
  downloadingRef.value = true
  try {

    const blob = await request.get(`/vault/${item.vaultItemId ?? item.id}/download`, { responseType: 'blob', timeout: 60000 })
    const realBlob = blob instanceof Blob ? blob : new Blob([blob])
    const name = item.displayName || item.display_name || `file-${item.vaultItemId ?? item.id}`
    const url = URL.createObjectURL(realBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  } catch (err) {
    console.error('Ref download failed:', err)
    toast.error(err?.message || '下载失败')
  } finally {
    downloadingRef.value = false
  }
}


const activeSessionTitle = computed(() => {
  const s = chat.sessions.find(x => x.id === chat.activeSessionId)
  return s?.title || ''
})


const emptyTitle = computed(() => (chat.historyLoading ? '加载会话中…' : '开始今天的对话吧'))
const emptyDesc = computed(() => {
  if (chat.historyLoading) return '正在从服务器拉取历史消息'
  if (chat.historyError) return '历史加载失败 · 请检查服务是否可用'
  return '比如「我最近在忙什么」「我的状态怎么样」'
})

onMounted(async () => {

  const restoration = chat.restoreLastSession()

  chat.fetchSessions()

  vault.fetch()
  nextTick(autoGrow)
  await restoration
  if (!chat.historyError && localStorage.getItem('mirror.home-page') === 'chat') reportAchievementActivity('home.opened', 'chat')
})


watch(() => ui.chatSessionsRequested, (v) => {
  if (v) {
    ui.consumeChatSessionsRequest()
    chat.fetchSessions()
    showSessions.value = true
  }
})













const chatScroll = useChatScroll(messagesEl,
  () => [chat.sending, chat.messages.map(m => `${m.id}:${(m.content || '').length}:${(m.thinking || '').length}:${m.status}:${m.toolsUsed?.length}:${m.vaultRefs?.length}:${m.createdRecords?.length}`).join(','), receiptItems.value.map(i => i.id).join(','), actions.inSession(chat.activeSessionId || chat.sessionId).map(card => `${card.id}:${card.status}`).join(',')],
)
const followingBottom = chatScroll.following
async function scrollToBottom() {
  await nextTick()
  chatScroll.requestBottom({ force: true })
}


const bubbleScopes = new WeakMap()
const enteredMessageIds = new Set(chat.messages.map(message => message.id))
const vMessageEnter = {
  mounted(el, binding) {
    const { id, animate } = binding.value
    if (enteredMessageIds.has(id)) return
    enteredMessageIds.add(id)
    if (!animate || prefersReducedMotion()) return
    const scope = createMotionScope(el)
    bubbleScopes.set(el, scope)
    const user = el.classList.contains('chat-msg-user')
    scope.run(() => gsap.fromTo(el,

      { x: user ? 100 : -100, skewX: user ? -9 : 9, scaleX: .72, opacity: 0, transformOrigin: user ? 'right bottom' : 'left bottom' },
      { x: 0, skewX: 0, scaleX: 1, opacity: 1, duration: duration(650), ease: 'back.out(1.65)', clearProps: 'transform,opacity,transformOrigin' }))
  },
  beforeUnmount(el) { bubbleScopes.get(el)?.dispose() },
}

function autoGrow() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  const maxHeight = isMobile.value ? 112 : 110
  el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
  el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  chatScroll.requestBottom()
}

async function send() {
  if (!canSend.value) return
  const text = input.value
  input.value = ''
  if (inputEl.value) inputEl.value.style.height = 'auto'


  scrollToBottom()
  const sent = await chat.sendMessage(text)
  if (sent === false) {
    input.value = text
    await nextTick()
    autoGrow()
    return
  }

  chat.fetchSessions()
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault()
    send()
  }
}


function openSource(source, message) {
  if (!source.recordId) return
  const contextId = message?.serverMessageId
  ui.openRecordWithActivity(source.recordId, contextId ? { kind: 'record.source_opened', subjectId: source.recordId, contextId } : [])
}

function openCreatedRecord(receipt) {
  if (!receipt?.recordId) return
  ui.selectedRecordId = receipt.recordId
  ui.showDetail = true
}

async function refreshRun(message) {
  const run = await chat.refreshRun(message)
  if (!run) {
    toast.error('查询本轮状态失败，请稍后再试')
  } else if (run.outcome === 'action_unknown') {
    toast.info('保存结果仍待确认，请稍后重新查询')
  }
}











function openVaultRef(ref, message) {
  if (ref.deleted) {
    toast.info('文件已删除')
    return
  }
  if (ref.digestStatus === 'pending') {
    toast.info('索引中…稍后再试')
    return
  }
  previewItem.value = ref
  previewMessageId.value = message?.serverMessageId ?? null
}
function onVaultPreviewLoaded() {
  if (previewMessageId.value && previewItem.value) reportAchievementActivity('vault.search_opened', previewItem.value.vaultItemId ?? previewItem.value.vault_item_id ?? previewItem.value.id, null, null, previewMessageId.value)
}



const fileInput = ref(null)
const dragOver = ref(false)

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
  if (chat.sending) return
  const files = [...(e.dataTransfer?.files || [])]
  const images = files.filter(file => file.type.startsWith('image/'))
  if (images.length) imageDraft.value?.addFiles(images)
  else if (files[0]) acceptFile(files[0])
}


function acceptFile(file) {
  if (file.type.startsWith('image/')) { imageDraft.value?.addFiles([file]); return }
  const v = validateVaultFile(file)
  if (!v.ok) {
    toast.error(v.reason, 4200)
    return
  }
  pendingUpload.value = {
    file,
    displayName: deriveDisplayName(file.name),
    category: v.category,
    file_type: v.ext,
  }
}


async function confirmUpload({ description, displayName }) {
  if (!pendingUpload.value) return
  const file = pendingUpload.value.file
  const res = await vault.upload(file, description)
  if (!res.ok) {
    toast.error(res.error || '上传失败')
    return
  }



  if (displayName && res.item) res.item.display_name = displayName
  pendingUpload.value = null
  toast.success(`已存入 · ${formatBytes(file.size)} · 提取后回执卡等你确认`, 4200)
}

function cancelUpload() {
  pendingUpload.value = null
}



const busyReceiptId = ref(null)


async function onReceiptConfirm(item) {
  busyReceiptId.value = item.id
  const ok = await vault.confirmDigest(item.id, {
    key: item.display_name,
    description: item.description,
    category: item.category === 'document' ? 'learning' : 'note',
  })
  busyReceiptId.value = null
  item._receiptOpen = false
  if (ok) toast.success('已可检索', 3600)
  else toast.error(vault.error || '确认失败')
}


async function onReceiptSave(item, data) {
  busyReceiptId.value = item.id
  const ok = await vault.confirmDigest(item.id, {
    key: data.display_name,
    description: data.description,
    category: data.category === 'document' ? 'learning' : (data.category || 'note'),
  })
  busyReceiptId.value = null
  item._receiptOpen = false
  if (ok) toast.success('已更新 · 已可检索', 3600)
  else toast.error(vault.error || '保存失败')
}


async function onReceiptSkip(item) {
  busyReceiptId.value = item.id
  const ok = await vault.update(item.id, { description: item.description })
  busyReceiptId.value = null
  item._receiptOpen = false
  item.digest_status = 'skipped'
  if (ok) toast.info('好的 · 仅保管，需要时可再确认让它可检索', 4200)
  else toast.error(vault.error || '操作失败')
}


async function onReceiptRemove(item) {
  busyReceiptId.value = item.id
  const ok = await vault.remove(item.id, { inline: true })
  busyReceiptId.value = null
  if (ok) toast.info(`「${item.display_name}」已删除`)
  else toast.error(vault.error || '删除失败')
}


async function onOpenSession(id) {
  showSessions.value = false
  await chat.loadSession(id)
  if (chat.messages.length) reportAchievementActivity('session.opened', id)
  await scrollToBottom()
}

async function onNewSession() {
  showSessions.value = false
  await chat.openTodaySession()
  await scrollToBottom()
}

async function onRemoveSession(id) {
  await chat.removeSession(id)
  chat.fetchSessions()
}

return { parseCitations, citeTitle, ChatImageDraft, PageMasthead, ref, ChatSessionsPanel, FilePreviewModal, VaultRefCard, VaultUploadCard, VaultDigestReceipt, ActionCard, ChatDaySummaryCard, ChatMemoryPanel, CreatedRecordReceipt, ToolTrail, FileTypeIcon, ChatMessageContent, router, isMobile, chat, actions, vault, toast, orderedMessages, input, messagesEl, inputEl, sceneEl, sceneActive, mailDate, showSessions, sessionsDialog, sessionsMotion, showMemoryPanel, showMore, moreDialog, openMemory, openModels, openHistory, imageDraft, imageCount, onPasteImages, canSend, retryingSummaryId, visibleEndedSummaries, summaryActions, retrySummary, actionCardsFor, receiptItems, previewItem, downloadRef, activeSessionTitle, emptyTitle, emptyDesc, chatScroll, followingBottom, scrollToBottom, vMessageEnter, autoGrow, send, onKeydown, openSource, openCreatedRecord, refreshRun, openVaultRef, onVaultPreviewLoaded, fileInput, dragOver, pendingUpload, pickFile, onPickChange, onDragOver, onDragLeave, onDrop, confirmUpload, cancelUpload, busyReceiptId, onReceiptConfirm, onReceiptSave, onReceiptSkip, onReceiptRemove, onOpenSession, onNewSession, onRemoveSession }
}
