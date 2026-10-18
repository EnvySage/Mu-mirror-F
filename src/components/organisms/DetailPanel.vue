<script setup>
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
import { findObjectSource, playObjectTransition, playElementExit, cancelObjectTransitions } from '@/composables/useObjectTransition'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { formatFullDate } from '@/utils/time'

const ui = useUIStore()
const recordsStore = useRecordsStore()
const statsStore = useStatsStore()
const todoStore = useTodoStore()
const actionsStore = useActionsStore()
const toast = useToastStore()
const panelEl = ref(null)
const readerEl = ref(null)
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
let pendingRecordPrepareKey = null
let pendingRecordPrepareFingerprint = ''
let pendingMemoryDisableKey = null
let requestGeneration = 0
let authorizationRequestId = 0
useDialogFocus(() => !!ui.selectedRecordId, panelEl, '.detail-back', close)
ui.registerNavigationGuard('record-detail', () => {
  if (!ui.detailDraftDirty) return true
  if (!window.confirm('记录详情还有未保存修改。放弃修改并离开吗？')) return false
  authorizationDirty.value = false
  rawEditing.value = false
  ui.detailDraftDirty = false
  return true
})

const record = computed(() => {
  if (!ui.selectedRecordId) return null
  return recordsStore.getById(ui.selectedRecordId)
})
const memoryState = computed(() => String(record.value?.memory_state ?? record.value?.memoryState ?? (['reviewing', 'record_only'].includes(record.value?.status) ? 'NONE' : 'UNKNOWN')).toUpperCase())
const memoryFailureReason = computed(() => record.value?.memory_failure_reason ?? record.value?.memoryFailureReason ?? record.value?.memory_error ?? record.value?.memoryError ?? '')
const canEditMemorySource = computed(() => memoryState.value === 'NONE')
const canOfferCorrection = computed(() => ['READY', 'DISABLED'].includes(memoryState.value))

watch([authorizationDirty, () => rawEditing.value && rawDraft.value !== (record.value?.content || '')], ([authDirty, rawDirty]) => {
  ui.detailDraftDirty = !!(authDirty || rawDirty)
})

// ---- 轮询（8.2：processing → 2.5s 轮询详情，直到终态） ----
let pollTimer = null
let todoOverlayTimer = null
let recordActionPollTimer = null
let embeddingPollInFlight = false

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function stopTodoOverlayPolling() {
  if (todoOverlayTimer) clearTimeout(todoOverlayTimer)
  todoOverlayTimer = null
}

function stopRecordActionPolling() {
  if (recordActionPollTimer) clearTimeout(recordActionPollTimer)
  recordActionPollTimer = null
}

function pollRecordAction(actionId, generation = requestGeneration) {
  stopRecordActionPolling()
  const tick = async () => {
    if (generation !== requestGeneration || String(ui.selectedRecordId) === '') return
    try {
      const latest = await actionsStore.refresh(actionId)
      if (generation !== requestGeneration || preparedRecordAction.value?.id !== actionId) return
      preparedRecordAction.value = latest
      if (latest?.state === 'SUCCEEDED') {
        await onRecordActionUpdated(latest)
      } else if (['PENDING', 'EXECUTING'].includes(latest?.state)) {
        recordActionPollTimer = setTimeout(tick, 1800)
      }
    } catch {
      if (generation === requestGeneration && preparedRecordAction.value?.id === actionId) {
        recordActionPollTimer = setTimeout(tick, 5000)
      }
    }
  }
  recordActionPollTimer = setTimeout(tick, 1500)
}

function startTodoOverlayPolling(recordId) {
  stopTodoOverlayPolling()
  const tick = async () => {
    if (String(ui.selectedRecordId) !== String(recordId)) return
    if (document.visibilityState === 'visible') await todoStore.fetchRegistry(true)
    if (String(ui.selectedRecordId) === String(recordId)) todoOverlayTimer = setTimeout(tick, 15000)
  }
  todoOverlayTimer = setTimeout(tick, 15000)
}

function startPolling(recordId) {
  stopPolling()
  stopTodoOverlayPolling()
  const tick = async () => {
    if (ui.selectedRecordId !== recordId) return
    const generation = requestGeneration
    const r = await recordsStore.fetchRecord(recordId, { isCurrent: () => generation === requestGeneration && String(ui.selectedRecordId) === String(recordId) })
    if (generation !== requestGeneration || String(ui.selectedRecordId) !== String(recordId)) return
    if (!r) return
    if (r.status === 'processing') {
      pollTimer = setTimeout(tick, 2500)
    } else if (r.status === 'reviewing') {
      toast.success('AI 拆分完成，请审核')
    } else if (r.status === 'done') {
      toast.success('AI 整理完成')
    }
  }
  pollTimer = setTimeout(tick, 2500)
}

function startEmbeddingPolling(recordId) {
  if (pollTimer || embeddingPollInFlight) return
  stopPolling()
  const tick = async () => {
    pollTimer = null
    if (String(ui.selectedRecordId) !== String(recordId)) return
    const generation = requestGeneration
    embeddingPollInFlight = true
    const r = await recordsStore.fetchRecord(recordId, {
      isCurrent: () => generation === requestGeneration && String(ui.selectedRecordId) === String(recordId),
    })
    embeddingPollInFlight = false
    if (generation !== requestGeneration || String(ui.selectedRecordId) !== String(recordId)) {
      const current = record.value
      if (!pollTimer && String(current?.memory_state ?? current?.memoryState ?? '').toUpperCase() === 'PENDING') {
        startEmbeddingPolling(current.id)
      }
      return
    }
    if (!r) return
    const pending = String(r.memory_state ?? r.memoryState ?? '').toUpperCase() === 'PENDING'
    if (pending) {
      if (!pollTimer) pollTimer = setTimeout(tick, 1800)
    } else stopPolling()
  }
  pollTimer = setTimeout(tick, 900)
}

onBeforeUnmount(stopPolling)
onBeforeUnmount(stopTodoOverlayPolling)
onBeforeUnmount(stopRecordActionPolling)

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
  stopPolling()
  stopTodoOverlayPolling()
  if (!id) {
    stopTodoOverlayPolling()
    stopRecordActionPolling()
    cancelObjectTransitions()
    ui.detailDraftDirty = false
    return
  }
  closing.value = false
  confirming.value = false
  authorizationRequestId += 1
  preparedRecordAction.value = null
  stopRecordActionPolling()
  memoryLifecycleAction.value = null
  pendingMemoryDisableKey = null
  pendingRecordPrepareKey = null
  pendingRecordPrepareFingerprint = ''
  authorizationDirty.value = false
  loadingRecord.value = !recordsStore.getById(id)
  detailError.value = ''
  await nextTick()
  const origin = ui.detailOrigin
  const source = origin?.type === 'record' && origin.id === String(id) ? origin.rect : null
  const target = readerEl.value?.getBoundingClientRect?.()
  if (source && target) playObjectTransition(source, target, { duration: 540, title: recordsStore.getById(id)?.chunks?.[0]?.metadata?.title || '日记片段' })
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
  if (pending && !pollTimer && !embeddingPollInFlight) startEmbeddingPolling(record.value.id)
  else if (!pending && pollTimer) stopPolling()
})

const headerTitle = computed(() => {
  switch (ui.detailMode) {
    case 'processing': return 'AI 整理中'
    case 'review': return `片段确认 · ${(record.value?.chunks || []).length} 个片段`
    case 'failed': return '处理失败'
    case 'view': return record.value?.status === 'record_only' ? '仅记录' : '片段记忆授权'
    default: return '记录详情'
  }
})

const showConfirm = computed(() => canEditMemorySource.value && ['reviewing', 'done'].includes(record.value?.status))

async function close() {
  if (closing.value) return
  if ((authorizationDirty.value || (rawEditing.value && rawDraft.value !== (record.value?.content || '')))
    && !window.confirm('这条记录还有未保存的修改。放弃修改并返回吗？')) return
  closing.value = true
  cancelObjectTransitions()
  requestGeneration += 1
  const id = ui.selectedRecordId
  const source = id ? findObjectSource('record', id) : null
  const rect = source?.getBoundingClientRect?.()
  const sourceVisible = rect && rect.width && rect.height && rect.bottom > 0 && rect.top < window.innerHeight
  const exit = playElementExit(panelEl.value, { duration: 360, reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches })
  const flight = readerEl.value && sourceVisible
    ? playObjectTransition(readerEl.value.getBoundingClientRect(), rect, { duration: 360, title: record.value?.chunks?.[0]?.metadata?.title || '日记片段', reverse: true })
    : Promise.resolve(false)
  await Promise.all([exit, flight])
  if (String(ui.selectedRecordId) !== String(id)) return
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

function onAuthorizationChange(value) {
  aiMemoryChunkIds.value = value.aiMemoryChunkIds
  todoChunkIds.value = value.todoChunkIds
  authorizationDirty.value = !!value.dirty
}

async function onConfirm() {
  if (confirming.value) return
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
    toast.info('整理候选已准备，确认后才会更新这条记录')
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
    actionError.value = err.message || '停止未来记忆使用的确认卡准备失败'
  } finally {
    confirming.value = false
  }
}

async function onMemoryLifecycleUpdated(card) {
  if (card) memoryLifecycleAction.value = card
  if (card?.state !== 'SUCCEEDED' || !record.value) return
  await recordsStore.fetchRecord(record.value.id, { isCurrent: () => String(ui.selectedRecordId) === String(record.value?.id) })
  if (card.result?.memoryState === 'DISABLED' || card.result?.memory_state === 'DISABLED') {
    toast.success('未来记忆使用已停止；来源保持只读，成长账本记录保留')
    todoStore.fetchRegistry(true)
  }
}

/** failed：重试 / 删除 */
const submitting = ref(false)

async function retryProcessing() {
  await organizeSavedRecord()
}

async function deleteRecord() {
  if (!record.value || submitting.value) return
  if (!window.confirm('确定删除这条记录？软删除后不可恢复。')) return
  submitting.value = true
  const ok = await recordsStore.deleteRecord(record.value.id)
  submitting.value = false
  if (ok) {
    toast.success('记录已删除')
    close()
  } else {
    actionError.value = recordsStore.error || '删除失败，请重试'
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.selectedRecordId" ref="panelEl" :class="['detail-page',{closing}]" role="dialog" aria-modal="true" aria-label="记录详情">
        <div class="detail-header">
          <button class="detail-back" @click="close">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
            返回
          </button>
          <span class="detail-title">{{ headerTitle }}</span>
          <span v-if="record?.created_at" class="detail-date">{{ formatFullDate(new Date(record.created_at)) }}</span>
          <button
            v-if="showConfirm"
            class="detail-confirm"
            :disabled="confirming"
            @click="onConfirm"
          >{{ confirming ? '保存授权…' : record.status === 'reviewing' ? '确认所选片段' : '更新记忆授权' }}</button>
          <button v-if="canOfferCorrection" class="detail-confirm" type="button" @click="ui.openWriteModal(record.id)">补充 / 更正</button>
          <button v-if="memoryState === 'READY'" class="detail-confirm" type="button" :disabled="confirming" @click="prepareDisableMemory">{{ confirming ? '准备确认卡…' : '停止未来记忆使用' }}</button>
          <button v-if="canEditMemorySource && ['record_only', 'done'].includes(record?.status)" class="detail-confirm" :disabled="confirming" @click="organizeSavedRecord">{{ confirming ? '准备候选…' : record.status === 'record_only' ? '让 Mirror 整理' : '重新提交 AI 整理' }}</button>
          <span class="detail-title" />
        </div>

        <div ref="readerEl" class="detail-content detail-reader">
          <div v-if="loadingRecord && !record" class="detail-load-state" role="status"><span class="spinner" /> 正在载入这段记录…</div>
          <div v-else-if="detailError && !record" class="detail-load-state" role="alert"><p>{{ detailError }}</p><button class="detail-confirm" @click="retryLoad">重试</button><button class="detail-back" @click="close">返回列表</button></div>
          <template v-else-if="record">
          <div v-if="actionError" class="detail-error">{{ actionError }}</div>
          <ActionCard v-if="preparedRecordAction" :proposal="preparedRecordAction" hide-edit @updated="onRecordActionUpdated" />
          <ActionCard v-if="memoryLifecycleAction" :proposal="memoryLifecycleAction" hide-edit @updated="onMemoryLifecycleUpdated" />

          <!-- 处理中：三步动画 -->
          <div v-if="ui.detailMode === 'processing'" class="processing-view">
            <div class="processing-ring" />
            <div class="processing-title">正在分析你的记录</div>
            <div class="processing-desc">正在整理原文、识别主题并生成片段。</div>
            <div class="processing-steps">
              <div :class="['processing-step', { active: processingStep === 0, done: processingStep > 0 }]">
                <div class="processing-step-dot" />整理原文
              </div>
              <div :class="['processing-step', { active: processingStep === 1, done: processingStep > 1 }]">
                <div class="processing-step-dot" />识别主题
              </div>
              <div :class="['processing-step', { active: processingStep === 2 }]">
                <div class="processing-step-dot" />生成片段卡片
              </div>
            </div>
          </div>

          <!-- failed：原因 + 重试/删除 -->
          <div v-else-if="ui.detailMode === 'failed'" class="failed-view">
            <div class="review-original">
              <div class="review-label">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                原始内容 · 不可修改
              </div>
              <div class="review-original-text">{{ record.content }}</div>
            </div>
            <div class="status-failed-row" style="font-size:13px;justify-content:center;padding:10px 0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              {{ record.fail_reason || '处理失败（可能是模型配置问题或内容被判定无意义）' }}
            </div>
            <div class="failed-actions">
              <button class="chip chip-accent" :disabled="confirming || submitting" @click="retryProcessing">
                {{ confirming ? '准备候选…' : '重新生成整理候选' }}
              </button>
              <button class="chip chip-danger" :disabled="submitting" @click="deleteRecord">删除</button>
            </div>
          </div>

          <div v-else-if="record.status === 'record_only'" class="record-only-view">
            <p class="record-only-note">记忆状态：{{ memoryState }} · 这条内容当前仅保存在记录中，尚未加入 Mirror 记忆。</p>
            <p v-if="memoryFailureReason" class="record-only-note" role="status">记忆建立未完成，已降级为仅保存。原因：{{ memoryFailureReason }}</p>
            <ReviewPanel v-if="preparedRecordAction" :record="record" :proposal="preparedRecordAction" @proposal-save="saveRecordActionDraft" />
            <textarea v-if="rawEditing" v-model="rawDraft" class="record-only-editor" aria-label="编辑仅记录原文" />
            <div v-else class="review-original-text">{{ record.content }}</div>
            <div class="failed-actions">
              <button v-if="!rawEditing" class="chip chip-accent" @click="rawEditing = true">编辑原文</button>
              <button v-else class="chip chip-accent" @click="saveRaw">保存修改</button>
              <button v-if="rawEditing" class="chip" @click="rawEditing = false; rawDraft = record.content">取消</button>
              <button class="chip chip-danger" @click="deleteRecord">删除记录</button>
            </div>
          </div>

          <div v-else-if="canOfferCorrection" class="record-correction-entry">
            <p>此来源保持只读。补充或更正会另建一条与当前来源关联的记录，不覆盖原内容。</p>
          </div>

          <!-- 审核 / 只读（审核态内含待办建议卡，证据行可切记录） -->
          <ReviewPanel v-else ref="reviewPanelRef" :record="record" :authorization-busy="confirming" @open-record="openRecord" @authorization-change="onAuthorizationChange" />
          </template>
        </div>
    </div>
  </Teleport>
</template>

<style scoped>
.detail-page {
  position: fixed; inset: 0; z-index: 30;
  background: var(--ink-2);
  display: flex; flex-direction: column;
  animation: detail-enter .58s var(--motion-enter) both;
}
.record-correction-entry{margin:12px 0;padding:14px;border:1px solid var(--line);border-left:4px solid var(--accent);background:var(--card);color:var(--text-mid);font-size:13px;line-height:1.6}.record-correction-entry p{margin:0 0 10px}
@keyframes detail-enter{0%{opacity:.65;clip-path:polygon(0 0,0 0,0 0,0 100%,0 100%)}58%{opacity:1;clip-path:polygon(0 0,calc(100% - 54px) 0,100% 54px,100% 100%,22px 100%,0 calc(100% - 22px))}100%{opacity:1;clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}}
@media (min-width: 900px) {
  .detail-page {
    left: var(--sidebar-width);
    box-shadow: -12px 0 32px rgba(20,20,15,.1);
    border-left: 1px solid var(--line);
  }
}

.slide-enter-active, .slide-leave-active { transition: transform .3s cubic-bezier(.32,.72,.28,1); }
.slide-enter-from, .slide-leave-to { transform: translateX(102%); }

.detail-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--card);
}
.detail-back {
  display: flex; align-items: center; gap: 4px;
  font-size: 14.5px; color: var(--text-mid); padding: 6px 8px;
}
.detail-back svg { width: 17px; height: 17px; stroke: currentColor; fill: none; }
.detail-title { font-size: 14px; color: var(--text-mid); }
.detail-confirm {
  font-size: 13.5px; font-weight: 600; color: #FFFFFF;
  background: var(--accent);
  padding: 7px 18px; border-radius: var(--radius-full);
  transition: background .15s, transform .1s;
}
.detail-confirm:hover { background: var(--accent-hover); }
.detail-confirm:active { transform: scale(.97); }
.detail-confirm:disabled { opacity: .55; cursor: not-allowed; }

.detail-content {
  flex: 1; overflow-y: auto;
  padding: 16px 18px calc(40px + var(--safe-bottom));
}
@media (min-width: 900px) { .detail-content { padding: 20px 32px 40px; } }

.detail-error {
  font-size: 12.5px; color: var(--danger);
  padding: 10px 14px; margin-bottom: 12px;
  border-radius: var(--radius-sm); background: var(--danger-bg);
}

/* 原文面板（"光源"）—— 审核组件内复用同款样式，这里给 failed 用 */
.review-original {
  position: relative; padding: 14px 16px; margin-bottom: 14px;
  border-radius: var(--radius);
  background: var(--accent-soft);
  border: 1px solid rgba(44,95,232,.18);
}
.review-label {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .16em;
  color: var(--accent); margin-bottom: 6px;
  display: flex; align-items: center; gap: 6px;
}
.review-label svg { width: 12px; height: 12px; stroke: var(--accent); fill: none; }
.review-original-text { font-size: 14px; line-height: 1.8; color: var(--text-hi); white-space: pre-wrap; word-break: break-word; }

/* 处理中视图 */
.processing-view { text-align: center; padding: 70px 20px; }
.processing-ring {
  width: 58px; height: 58px; margin: 0 auto 22px; border-radius: 50%;
  border: 2.5px solid var(--processing-bg); border-top-color: var(--processing);
  animation: spin 1.1s linear infinite;
}
.processing-title { font-family: var(--font-display); font-size: 17px; }
.processing-desc { font-size: 12.5px; color: var(--text-low); margin-top: 6px; }
.processing-steps { margin-top: 26px; display: inline-flex; flex-direction: column; gap: 12px; text-align: left; }
.processing-step {
  display: flex; align-items: center; gap: 10px;
  font-size: 13.5px; color: var(--text-low); transition: color .3s;
}
.processing-step-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--line-strong); transition: all .3s; }
.processing-step.active { color: var(--text-hi); }
.processing-step.active .processing-step-dot { background: var(--accent); animation: pulse 1s infinite alternate; }
.processing-step.done { color: var(--text-mid); }
.processing-step.done .processing-step-dot { background: var(--success); }

.failed-view { text-align: center; }
.record-only-view{padding:16px;border:1px solid var(--line);background:var(--card);border-radius:var(--radius)}.record-only-note{font-size:12px;color:var(--text-mid);margin-bottom:14px}.record-only-editor{width:100%;min-height:220px;padding:14px;border:1px solid var(--line);font:14px/1.8 var(--font);color:var(--text-hi);background:var(--card)}
.failed-actions { display: flex; gap: 8px; justify-content: center; margin-top: 14px; }
.failed-actions .chip { cursor: pointer; }
.chip-accent { color: var(--accent); }
.chip-danger { color: var(--danger); }

.detail-header { background:#071b50; border-bottom:3px solid var(--cyan); color:white; min-height:64px; }
.detail-back,.detail-title { color:#d4e7ff; }.detail-title{font-weight:800}.detail-back:hover{color:var(--cyan)}
.detail-confirm { background:var(--cyan); color:var(--night); border-radius:2px; font-weight:800; min-height:38px; }.detail-confirm:hover{background:white}
.detail-page { background:#eaf1ff; }.review-original{border-radius:2px}.processing-title{font-family:var(--font);font-weight:800}
.detail-page { background:linear-gradient(135deg,#06123f 0%,#0a2a76 58%,#0737bb 100%); }
.detail-header { padding:12px clamp(16px,3vw,42px); background:#071b50; }
.detail-title { font-family:var(--font-display); font-size:17px; letter-spacing:.04em; }
.detail-date { margin-left:auto; color:#9ec6ff; font:12px var(--font-display); }
.detail-content { width:min(1440px,100%); margin:0 auto; padding:clamp(16px,3vw,38px); }
.detail-reader { min-height:0; border-left:3px solid var(--cyan); background:#eef4ff; box-shadow:12px 14px 0 #020c3435; }
.detail-reader { animation:detail-reader-enter .62s .08s var(--motion-enter) both; }
@keyframes detail-reader-enter { 0%{opacity:.35;clip-path:polygon(0 0,4% 0,4% 100%,0 100%);transform:translateX(24px)} 68%{opacity:1;clip-path:polygon(0 0,calc(100% - 32px) 0,100% 32px,100% 100%,0 100%);transform:translateX(-4px)} 100%{opacity:1;clip-path:polygon(0 0,100% 0,100% 100%,0 100%);transform:none} }
.detail-reader :deep(.review-original) { animation:detail-layer-in .52s .12s var(--motion-enter) both; }
.detail-reader :deep(.chunk-review-item) { animation:detail-layer-in .58s .18s var(--motion-enter) both; }
.detail-reader :deep(.chunk-top) { animation:detail-layer-in .42s .2s var(--motion-enter) both; }
.detail-reader :deep(.chunk-segment) { animation:detail-copy-in .52s .32s var(--motion-enter) both; }
.detail-reader :deep(.chunk-field:nth-of-type(n+2)) { animation:detail-layer-in .46s .44s var(--motion-enter) both; }
.detail-page.closing .detail-reader { animation:detail-reader-exit .25s var(--motion-shift) both; }
@keyframes detail-layer-in { from{opacity:0;transform:translateY(18px) scale(.985);clip-path:polygon(0 0,100% 0,100% 12%,0 12%)} to{opacity:1;transform:none;clip-path:polygon(0 0,100% 0,100% 100%,0 100%)} }
@keyframes detail-copy-in { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:none} }
@keyframes detail-reader-exit { to{opacity:.7;clip-path:polygon(0 0,100% 0,100% 0,0 0);transform:translateX(12px)} }
.detail-load-state { min-height:260px; display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:14px; color:var(--text-mid); }
.detail-load-state p { flex-basis:100%; text-align:center; }
.review-panel { max-width:100%; }
.review-original { max-width:980px; padding:22px 26px; background:#dceaff; border-color:#9ebdec; }
.review-original-text { font-size:16px; line-height:1.9; max-width:74ch; }
.detail-reader :deep(.chunk-card) { position:relative; isolation:isolate; display:block; padding:22px 26px; background:white; clip-path:polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,14px 100%,0 calc(100% - 14px)); box-shadow:0 12px 25px #08245c12; }
.detail-reader :deep(.chunk-card)::before { content:""; position:absolute; z-index:-1; inset:0; transform:translate(7px,7px); background:linear-gradient(135deg,#ff2f78 0 12%,#36e7f2 12% 100%); clip-path:polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,14px 100%,0 calc(100% - 14px)); pointer-events:none; }
.detail-reader :deep(.chunk-segment) { display:block; width:100%; align-self:auto; margin:16px 0 18px; font-size:16px; line-height:1.9; min-height:0; }
.detail-reader :deep(.chunk-field-label) { font-size:11px; letter-spacing:.1em; }
.detail-reader :deep(.chunk-field) { margin-top:12px; }
.detail-reader :deep(.chunk-attributes .chip) { min-height:32px; padding:6px 13px; font-size:13px; }
.detail-reader :deep(.chunk-attributes .chip.selected) { font-weight:750; }
.detail-reader :deep(.chunk-attributes .chip.mood-chip.selected) { background:#fff; box-shadow:inset 0 0 0 2px currentColor; font-weight:750; }
.detail-reader :deep(.chunk-consent) { width:100%; margin:10px 0 18px; }
.detail-reader :deep(.chunk-consent-option) { background:#e7efff; }
.detail-reader :deep(.chunk-review-item) { margin-bottom:18px; }
@media(max-width:760px) { .detail-reader :deep(.chunk-card) { padding:18px; clip-path:polygon(0 0,calc(100% - 13px) 0,100% 13px,100% 100%,10px 100%,0 calc(100% - 10px)); } .detail-reader :deep(.chunk-card)::before { transform:translate(4px,4px); clip-path:polygon(0 0,calc(100% - 13px) 0,100% 13px,100% 100%,10px 100%,0 calc(100% - 10px)); } }
@media(prefers-reduced-motion:reduce) { .detail-page,.detail-reader,.detail-reader :deep(.review-original),.detail-reader :deep(.chunk-review-item),.detail-reader :deep(.chunk-top),.detail-reader :deep(.chunk-segment),.detail-reader :deep(.chunk-field:nth-of-type(n+2)) { animation:none!important; transition:none!important; } }
</style>
