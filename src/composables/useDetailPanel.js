import { useDetailPolling } from '@/composables/useDetailPolling'
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useRecordsStore } from '@/stores/records'
import { useStatsStore } from '@/stores/stats'
import { useTodoStore } from '@/stores/todo'
import { useActionsStore } from '@/stores/actions'
import { useToastStore } from '@/stores/toast'
import ReviewPanel from '@/components/organisms/ReviewPanel.vue'
import ActionCard from '@/components/organisms/ActionCard.vue'
import { createPrepareKey } from '@/api/actions'
import { useOverlayMotion } from '@/motion/useOverlayMotion'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { formatFullDate } from '@/utils/time'
import { usePaperEntrance } from '@/motion/usePaperEntrance'
import { reportAchievementActivity } from '@/api/achievements'

export function useDetailPanel() {
const ui = useUIStore()
const recordsStore = useRecordsStore()
const statsStore = useStatsStore()
const todoStore = useTodoStore()
const actionsStore = useActionsStore()
const toast = useToastStore()
const panelEl = ref(null)
const readerEl = ref(null)
const overlay = useOverlayMotion({ direction: 'right' })
const reviewPanelRef = ref(null)
const loadingRecord = ref(false)
const detailError = ref('')
const closing = ref(false)
const confirming = ref(false)
const actionError = ref(null)
const authorizationDirty = ref(false)
const rawEditing = ref(false)
const rawDraft = ref('')
const preparedRecordAction = ref(null)
const memoryLifecycleAction = ref(null)
const deleteRecordAction = ref(null)
let pendingRecordPrepareKey = null
let pendingRecordPrepareFingerprint = ''
let pendingMemoryDisableKey = null
let requestGeneration = 0
let authorizationRequestId = 0
useDialogFocus(() => !!ui.selectedRecordId, panelEl, '.detail-back', close)
const removeDetailGuard = ui.registerNavigationGuard('record-detail', () => {
  if (!ui.detailDraftDirty) return true
  if (!window.confirm('记录详情还有未保存修改。放弃修改并离开吗？')) return false
  authorizationDirty.value = false
  rawEditing.value = false
  ui.detailDraftDirty = false
  return true
})
onBeforeUnmount(removeDetailGuard)

const record = computed(() => {
  if (!ui.selectedRecordId) return null
  return recordsStore.getById(ui.selectedRecordId)
})
usePaperEntrance(readerEl, () => record.value?.id, '.detail-folio, .review-original, .record-only-view, .review-growth, .chunk-review-item')
const journalDate = computed(() => {
  const date = new Date(record.value?.created_at)
  if (Number.isNaN(date.getTime())) return null
  return { day: String(date.getDate()).padStart(2, '0'), month: String(date.getMonth() + 1).padStart(2, '0'), year: date.getFullYear(), weekday: date.toLocaleDateString('en', { weekday: 'long' }).toUpperCase() }
})
const memoryState = computed(() => String(record.value?.memory_state ?? record.value?.memoryState ?? (['reviewing', 'record_only'].includes(record.value?.status) ? 'NONE' : 'UNKNOWN')).toUpperCase())
const memoryFailureReason = computed(() => record.value?.memory_failure_reason ?? record.value?.memoryFailureReason ?? record.value?.memory_error ?? record.value?.memoryError ?? '')
const canEditMemorySource = computed(() => memoryState.value === 'NONE')

watch([authorizationDirty, () => rawEditing.value && rawDraft.value !== (record.value?.content || '')], ([authDirty, rawDirty]) => {
  ui.detailDraftDirty = !!(authDirty || rawDirty)
})

// ---- 轮询（8.2：processing → 2.5s 轮询详情，直到终态） ----
const { stopPolling, stopTodoOverlayPolling, stopRecordActionPolling, pollRecordAction, startTodoOverlayPolling, startPolling, startEmbeddingPolling, hasPolling, isEmbeddingPolling } = useDetailPolling({ ui, recordsStore, todoStore, actionsStore, toast, record, preparedRecordAction, onRecordActionUpdated, getGeneration: () => requestGeneration })

/** 处理中三步动画（正在整理原文、识别主题并生成片段。） */
const processingStep = ref(0)
let stepTimers = []

function startStepAnimation() {
  clearStepTimers()
  processingStep.value = 0
  stepTimers.push(setTimeout(() => { processingStep.value = 1 }, 700))
  stepTimers.push(setTimeout(() => { processingStep.value = 2 }, 1400))
}

function clearStepTimers() {
  stepTimers.forEach(clearTimeout)
  stepTimers = []
}

function updateDetailMode(r) {
  if (!r) return
  stopPolling()
  clearStepTimers()
  if (r.status === 'processing') {
    ui.detailMode = 'processing'
    startStepAnimation()
    startPolling(r.id)
  } else if (r.status === 'reviewing') {
    ui.detailMode = 'review'
    // 建议在处理过程中生成（不在审核时）：点进来时记录可能还是 processing，
    // 那时拉到的建议是空的；轮询到审核态必须重拉一次，否则只有整页刷新才看得到
    todoStore.fetch()
    // 审核页「关联待办」数据源（GET /records/{id}/suggestions，拉到时预填裁决）
    todoStore.fetchRecordSuggestions(r.id)
  } else if (r.status === 'failed') {
    ui.detailMode = 'failed'
  } else if (r.status === 'record_only') {
    ui.detailMode = 'view'
  } else {
    ui.detailMode = 'view'
    if (String(r.memory_state ?? r.memoryState ?? '').toUpperCase() === 'PENDING') {
      startEmbeddingPolling(r.id)
    }
    if ((r.chunks || []).length > 0) {
      todoStore.fetchRegistry(true)
      startTodoOverlayPolling(r.id)
    }
  }
}

watch(() => ui.selectedRecordId, async (id) => {
  const generation = ++requestGeneration
  const activity = ui.recordAchievement?.recordId === String(id) ? ui.recordAchievement : null
  ui.recordAchievement = null
  stopPolling()
  stopTodoOverlayPolling()
  if (!id) {
    stopTodoOverlayPolling()
    stopRecordActionPolling()
    overlay.cancel(panelEl.value)
    ui.detailDraftDirty = false
    return
  }
  closing.value = false
  confirming.value = false
  authorizationRequestId += 1
  preparedRecordAction.value = null
  deleteRecordAction.value = null
  stopRecordActionPolling()
  memoryLifecycleAction.value = null
  pendingMemoryDisableKey = null
  pendingRecordPrepareKey = null
  pendingRecordPrepareFingerprint = ''
  authorizationDirty.value = false
  loadingRecord.value = !recordsStore.getById(id)
  detailError.value = ''
  await nextTick()
  if (generation !== requestGeneration || String(ui.selectedRecordId) !== String(id)) return
  overlay.open(panelEl.value)
  actionError.value = null
  // 切记录 = 放弃上一张的关联待办裁决（未入库，不该带过来）
  todoStore.clearResolutions()
  // 建议随"写日记分类"生成（不在审核时），打开记录时重拉一次，
  // 保证审核窗口的建议卡是最新（刚写完日记就来审核的场景）
  todoStore.fetch()
  const r = await recordsStore.fetchRecord(id, { isCurrent: () => generation === requestGeneration && String(ui.selectedRecordId) === String(id) })
  if (generation !== requestGeneration || String(ui.selectedRecordId) !== String(id)) return
  loadingRecord.value = false
  if (!r) { detailError.value = '这条记录暂时无法载入。可以重试，或返回记录列表。'; return }
  updateDetailMode(r)
  if (activity?.recordId === String(id)) {
    for (const item of activity.activities) reportAchievementActivity(item.kind, item.subjectId, item.otherId, item.value, item.contextId)
  }
  reportAchievementActivity('layout.viewed', id, null, ui.isMobile ? 'mobile' : 'desktop')
  // immediate：DetailPanel 在 MainLayout 常驻，若 mounted 时 selectedRecordId 已有值
  // （刷新后恢复/路由直达），watch 不会触发，首次进入就漏掉建议刷新
}, { immediate: true })

/** 建议卡证据行 → 切到证据所在记录（同 id 时组件内已拦截，不会走到这） */
function openRecord(id) {
  if ((authorizationDirty.value || (rawEditing.value && rawDraft.value !== (record.value?.content || '')))
    && !window.confirm('这条记录还有未保存的修改。放弃修改并切换吗？')) return
  const rect = readerEl.value?.getBoundingClientRect?.()
  ui.detailOrigin = rect ? { type: 'record', id: String(id), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } } : null
  ui.selectedRecordId = id
}

watch(record, (newRecord, oldRecord) => {
  if (!newRecord || !ui.selectedRecordId) return
  if (!oldRecord || newRecord.status !== oldRecord.status) {
    updateDetailMode(newRecord)
  }
})

watch(() => `${record.value?.memory_state ?? record.value?.memoryState ?? ''}:${(record.value?.chunks || []).map(chunk => `${chunk.id}:${chunk.embedding_status ?? chunk.embeddingStatus ?? ''}`).join('|')}`, () => {
  if (!record.value) return
  const pending = String(record.value.memory_state ?? record.value.memoryState ?? '').toUpperCase() === 'PENDING'
  if (pending && !hasPolling() && !isEmbeddingPolling()) startEmbeddingPolling(record.value.id)
  else if (!pending && hasPolling()) stopPolling()
})

const headerTitle = computed(() => {
  switch (ui.detailMode) {
    case 'processing': return 'AI 整理中'
    case 'review': return `片段确认 · ${(record.value?.chunks || []).length} 个片段`
    case 'failed': return '处理失败'
    case 'view': return record.value?.status === 'record_only' ? '仅记录' : '记录详情'
    default: return '记录详情'
  }
})

const showConfirm = computed(() => canEditMemorySource.value && ['reviewing', 'done'].includes(record.value?.status))

async function close() {
  if (closing.value) return
  if ((authorizationDirty.value || (rawEditing.value && rawDraft.value !== (record.value?.content || '')))
    && !window.confirm('这条记录还有未保存的修改。放弃修改并返回吗？')) return
  closing.value = true
  requestGeneration += 1
  const id = ui.selectedRecordId
  const result = await overlay.close(panelEl.value)
  if (result.includes('cancelled') || String(ui.selectedRecordId) !== String(id)) return
  stopPolling()
  stopTodoOverlayPolling()
  clearStepTimers()
  // 未入库 → 关联待办裁决一并作废
  todoStore.clearResolutions()
  ui.showDetail = false
  ui.selectedRecordId = null
  ui.detailOrigin = null
  ui.detailDraftDirty = false
  actionError.value = null
  closing.value = false
}

async function retryLoad() {
  if (!ui.selectedRecordId || loadingRecord.value) return
  loadingRecord.value = true
  detailError.value = ''
  const id = ui.selectedRecordId
  const generation = ++requestGeneration
  const result = await recordsStore.fetchRecord(id, { isCurrent: () => generation === requestGeneration && String(ui.selectedRecordId) === String(id) })
  if (generation !== requestGeneration || String(ui.selectedRecordId) !== String(id)) return
  loadingRecord.value = false
  if (!result) detailError.value = '载入失败，请检查网络后重试。'
  else updateDetailMode(result)
}

// ---- 确认入库（长时 loading 文案） ----
const aiMemoryChunkIds = ref([])
const todoChunkIds = ref([])
const growthAdjustments = ref([])
const growthAxesVersion = ref(null)
const growthReviewValid = ref(true)

function onAuthorizationChange(value) {
  aiMemoryChunkIds.value = value.aiMemoryChunkIds
  todoChunkIds.value = value.todoChunkIds
  growthAdjustments.value = value.growthAdjustments || []
  growthAxesVersion.value = value.growthAxesVersion ?? null
  growthReviewValid.value = value.growthValid !== false
  authorizationDirty.value = !!value.dirty
}

async function onConfirm() {
  if (confirming.value) return
  if (!growthReviewValid.value) {
    actionError.value = '请先修正成长分数，或按最新五维定义重新审核。'
    return
  }
  confirming.value = true
  const id = ui.selectedRecordId
  const operation = ++authorizationRequestId
  actionError.value = null
  // 关联待办（AI 建议裁决 + 手动挂载）随「确认入库」一起提交（todoResolutions）；
  // 无任何关联项时不带该字段（body 可选扩展，契约见 api/records.js）
  const todoResolutions = todoStore.resolutionsPayload
  const payload = {
    aiMemoryChunkIds: aiMemoryChunkIds.value,
    todoChunkIds: todoChunkIds.value,
    ...(growthAdjustments.value.length ? { growthAdjustments: growthAdjustments.value, axesVersion: growthAxesVersion.value } : {}),
    ...(todoResolutions.length ? { todoResolutions } : {}),
  }
  const updated = await recordsStore.confirmReview(id, payload, { isCurrent: () => operation === authorizationRequestId && String(ui.selectedRecordId) === String(id) })
  if (operation !== authorizationRequestId || String(ui.selectedRecordId) !== String(id)) return
  confirming.value = false
  if (updated) {
    const rebuilding = (updated.chunks || []).some(chunk => (chunk.embedding_status ?? chunk.embeddingStatus) === 'pending')
    toast.success(rebuilding ? '授权已保存，向量正在后台重建' : '片段授权已更新')
    ui.detailMode = 'view'
    authorizationDirty.value = false
    reviewPanelRef.value?.acceptAuthorizationBaseline(updated.chunks || record.value?.chunks || [], payload)
    // 裁决已随 confirm 落库 → 清掉本地暂存
    todoStore.clearResolutions()
    // 入库后可能产生待办登记行 / pending 状态建议（todo-registry-design.md §3.1/§3.2）：
    // 刷建议 + 证据链 + 强制刷 stats（侧栏待办读 stats.todo.open_items，30s 缓存会挡住新登记项）
    todoStore.fetch()
    todoStore.fetchChains()
    statsStore.fetchStats(30, true)
    if (rebuilding) startEmbeddingPolling(id)
  } else {
    actionError.value = recordsStore.error || '确认失败，请重试'
  }
}

watch(() => record.value?.id, () => {
  rawDraft.value = record.value?.content || ''
  rawEditing.value = false
})

async function saveRaw() {
  const updated = await recordsStore.updateRawRecord(record.value.id, rawDraft.value)
  if (updated) {
    rawEditing.value = false
    toast.success('仅记录已更新')
  } else actionError.value = recordsStore.error || '更新原文失败'
}

async function organizeSavedRecord() {
  if (!record.value || confirming.value) return
  const source = record.value
  const generation = requestGeneration
  const fingerprint = `record.organize:${source.id}:${source.content}`
  if (!pendingRecordPrepareKey || pendingRecordPrepareFingerprint !== fingerprint) {
    pendingRecordPrepareFingerprint = fingerprint
    pendingRecordPrepareKey = createPrepareKey()
  }
  confirming.value = true
  actionError.value = null
  try {
    const action = await actionsStore.prepare('record.organize', {
      rawContent: source.content,
      mode: 'AI_ASSISTED',
      privateInput: false,
      sourceRecordId: source.id,
    }, pendingRecordPrepareKey)
    if (generation !== requestGeneration || String(ui.selectedRecordId) !== String(source.id)) {
      if (action?.id) await actionsStore.cancel(action.id).catch(() => {})
      return
    }
    preparedRecordAction.value = action
    pendingRecordPrepareKey = null
    pendingRecordPrepareFingerprint = ''
    authorizationDirty.value = false
    ui.detailDraftDirty = false
    close()
    toast.info('已交给 AI 整理，可以在列表查看进度')
  } catch (err) {
    actionError.value = err.message || '准备整理候选失败'
  } finally {
    if (generation === requestGeneration) confirming.value = false
  }
}

async function onRecordActionUpdated(card) {
  if (card) preparedRecordAction.value = card
  if (['PENDING', 'EXECUTING'].includes(card?.state)) pollRecordAction(card.id)
  else if (card?.state !== 'PENDING') stopRecordActionPolling()
  if (card?.state !== 'SUCCEEDED' || !record.value) return
  await recordsStore.fetchRecord(record.value.id, { isCurrent: () => String(ui.selectedRecordId) === String(record.value?.id) })
}

async function saveRecordActionDraft(payload) {
  if (!preparedRecordAction.value) return
  try {
    preparedRecordAction.value = await actionsStore.edit(preparedRecordAction.value.id, payload)
  } catch (err) {
    actionError.value = err.message || '候选修改失败，请重试'
  }
}

async function prepareDisableMemory() {
  if (!record.value || memoryState.value !== 'READY' || confirming.value) return
  confirming.value = true
  actionError.value = null
  try {
    pendingMemoryDisableKey ||= createPrepareKey()
    memoryLifecycleAction.value = await actionsStore.prepare('record.memory.disable', {
      recordId: record.value.id,
      expectedRecordVersion: record.value.processing_version ?? record.value.processingVersion,
    }, pendingMemoryDisableKey)
    pendingMemoryDisableKey = null
  } catch (err) {
    actionError.value = err.message || '永久移除记忆的确认卡准备失败'
  } finally {
    confirming.value = false
  }
}

async function onMemoryLifecycleUpdated(card) {
  if (card) memoryLifecycleAction.value = card
  if (card?.state !== 'SUCCEEDED' || !record.value) return
  await recordsStore.fetchRecord(record.value.id, { isCurrent: () => String(ui.selectedRecordId) === String(record.value?.id) })
  if (card.result?.memoryState === 'DISABLED' || card.result?.memory_state === 'DISABLED') {
    toast.success('已永久移出记忆；来源保持只读，成长账本保留，不能重新启用')
    todoStore.fetchRegistry(true)
  }
}

async function onDeleteRecordActionUpdated(card) {
  if (card) deleteRecordAction.value = card
  if (card?.state === 'SUCCEEDED') {
    toast.success('记录已删除，关联成长贡献已按预览移除')
    authorizationDirty.value = false
    rawEditing.value = false
    ui.detailDraftDirty = false
    await close()
  }
}

/** failed：重试 / 删除 */
const submitting = ref(false)

async function retryProcessing() {
  await organizeSavedRecord()
}

async function deleteRecord() {
  if (!record.value || submitting.value) return
  submitting.value = true
  const proposal = await recordsStore.deleteRecord(record.value.id)
  submitting.value = false
  if (proposal) {
    deleteRecordAction.value = proposal
  } else {
    actionError.value = recordsStore.error || '删除失败，请重试'
  }
}

return { ref, ReviewPanel, ActionCard, formatFullDate, ui, panelEl, readerEl, reviewPanelRef, loadingRecord, detailError, closing, confirming, actionError, rawEditing, rawDraft, preparedRecordAction, memoryLifecycleAction, deleteRecordAction, record, journalDate, memoryState, memoryFailureReason, canEditMemorySource, processingStep, openRecord, headerTitle, showConfirm, close, retryLoad, growthReviewValid, onAuthorizationChange, onConfirm, saveRaw, organizeSavedRecord, onRecordActionUpdated, saveRecordActionDraft, prepareDisableMemory, onMemoryLifecycleUpdated, onDeleteRecordActionUpdated, submitting, retryProcessing, deleteRecord }
}
