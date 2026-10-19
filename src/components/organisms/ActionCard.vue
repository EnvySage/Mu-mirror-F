<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useActionsStore } from '@/stores/actions'
import { useGrowthStore } from '@/stores/growth'
import { useRecordsStore } from '@/stores/records'
import TodoActionForm from './action-forms/TodoActionForm.vue'
import RecordActionForm from './action-forms/RecordActionForm.vue'
import GrowthActionForm from './action-forms/GrowthActionForm.vue'
import MemoryActionForm from './action-forms/MemoryActionForm.vue'
import { getActionLabel } from '@/utils/actionLabel'

const props = defineProps({ proposal: { type: Object, required: true }, hideEdit: { type: Boolean, default: false } })
const emit = defineEmits(['updated'])
const actions = useActionsStore()
const growth = useGrowthStore()
const records = useRecordsStore()
const editing = ref(false)
const error = ref('')
const busy = computed(() => !!actions.busy[props.proposal.id])
const title = computed(() => props.proposal.payload?.title || props.proposal.payload?.content?.slice(0, 72) || props.proposal.payload?.memoryDraft?.content?.slice(0, 72) || props.proposal.preview?.memoryDraft?.content?.slice(0, 72) || props.proposal.payload?.recordDraft?.rawContent?.slice(0, 72) || props.proposal.preview?.recordDraft?.rawContent?.slice(0, 72) || props.proposal.preview?.dimension_name || props.proposal.preview?.dimensionName || props.proposal.preview?.after?.title || props.proposal.preview?.before?.title || (props.proposal.kind?.startsWith('growth.') ? '成长贡献' : props.proposal.kind?.startsWith('memory.') ? '记忆候选' : '待办操作'))
const stateLabel = computed(() => ({ PENDING:'等待你确认', EXECUTING:'正在执行', SUCCEEDED:'已完成', FAILED:'执行失败', CANCELLED:'已取消', STALE:'目标已变化' }[props.proposal.state] || props.proposal.state || '状态未知'))
const canEdit = computed(() => actions.canEdit(props.proposal))
const hasGrowthSuggestions = computed(() => Array.isArray(recordDraft.value?.growthSuggestions || recordDraft.value?.growth_suggestions))
const candidateNeedsRecheck = computed(() => {
  if (!props.proposal.kind?.startsWith('record.') || !hasGrowthSuggestions.value) return false
  if (!growth.axesDefinition) return true
  const candidateVersion = Number(recordDraft.value?.axesVersion ?? recordDraft.value?.axes_version ?? -1)
  const currentVersion = Number(growth.axesDefinition.version ?? -2)
  return candidateVersion < 0 || currentVersion < 0 || candidateVersion !== currentVersion
})
const canCancel = computed(() => actions.canCancel(props.proposal))
const canConfirmAction = computed(() => actions.canConfirm(props.proposal) && !candidateNeedsRecheck.value)
const preparationStatus = computed(() => String(props.proposal.preparation_status || props.proposal.preparationStatus || props.proposal.payload?.recordDraft?.preparationStatus || '').toUpperCase())
const isPreparingRecord = computed(() => props.proposal.state === 'PENDING' && props.proposal.kind?.startsWith('record.') && preparationStatus.value === 'RUNNING')
const canEditAction = computed(() => canEdit.value && !candidateNeedsRecheck.value && !['todo.delete', 'record.delete'].includes(props.proposal.kind) && props.proposal.payload?.recordDraft?.preparationStatus !== 'RUNNING' && props.proposal.preview?.recordDraft?.preparationStatus !== 'RUNNING')
const actionLabel = computed(() => getActionLabel(props.proposal.kind))
const recordDraft = computed(() => props.proposal.payload?.recordDraft || props.proposal.preview?.recordDraft)
const recordFallback = computed(() => props.proposal.kind?.startsWith('record.') && recordDraft.value?.preparationStatus === 'SAVE_ONLY')
const preparationFailureMessage = computed(() => {
  if (!props.proposal.kind?.startsWith('record.') || preparationStatus.value !== 'FAILED') return ''
  return props.proposal.preview?.preparationError || recordDraft.value?.preparationError || '候选准备失败，尚未创建或修改记录。请取消后重新准备。'
})
watch(hasGrowthSuggestions, hasSuggestions => {
  if (hasSuggestions && !growth.axesDefinition) growth.fetchAxes().catch(() => {})
}, { immediate: true })
const description = computed(() => recordFallback.value
  ? `${recordDraft.value.preparationError || props.proposal.preview?.description || 'AI 整理未能完成'}。建议仅保存，仍待你确认；确认后不会加入记忆。`
  : props.proposal.preview?.description)
const resultMessage = computed(() => {
  const result = props.proposal.result || {}
  if (result.outcome === 'SAVED_ONLY_FALLBACK' || result.outcome === 'SAVE_ONLY_FALLBACK') return '已仅保存，未加入记忆。'
  if (props.proposal.state === 'SUCCEEDED') return result.message || '服务端已确认完成。'
  if (props.proposal.state === 'CANCELLED') return props.proposal.kind?.startsWith('record.') ? '这条记录没有创建或整理。' : props.proposal.kind?.startsWith('memory.') ? '已放弃此候选，没有启用记忆。' : '没有创建或修改待办。'
  if (props.proposal.state === 'STALE') return '目标数据已变化，请重新发起操作。'
  return result.message || ''
})
const isTodoAction = card => ['todo.create','todo.update','todo.complete','todo.delete'].includes(card?.kind)
const isGrowthAction = card => card?.kind === 'growth.adjust'
const isMemoryAction = card => card?.kind?.startsWith('memory.')
const isRecordDeleteAction = card => card?.kind === 'record.delete'
const deleteImpact = computed(() => {
  if (!isRecordDeleteAction(props.proposal)) return ''
  const preview = props.proposal.preview || {}
  const count = Number(preview.growthEntriesRemoved ?? preview.growth_entries_removed ?? 0)
  const points = Number(preview.growthPointsRemoved ?? preview.growth_points_removed ?? 0)
  return `${preview.warning || '确认后会软删除这条记录。'}${count ? `，并移除关联的 ${count} 笔成长贡献（${points} 分）` : '；当前没有关联成长贡献'}。`
})
let preparationPoll = null
function stopPreparationPoll() {
  if (preparationPoll) clearInterval(preparationPoll)
  preparationPoll = null
}
watch(isPreparingRecord, running => {
  stopPreparationPoll()
  if (!running) return
  preparationPoll = setInterval(() => {
    if (!actions.busy[props.proposal.id]) actions.refresh(props.proposal.id).catch(() => {})
  }, 1500)
}, { immediate: true })
onBeforeUnmount(stopPreparationPoll)
async function refreshTodosIfSucceeded(card) {
  if (card?.state !== 'SUCCEEDED' || !isTodoAction(card)) return
  const { useTodoStore } = await import('@/stores/todo')
  await useTodoStore().refreshAfterAction()
}
async function refreshGrowthIfSucceeded(card) {
  if (card?.state !== 'SUCCEEDED') return
  if (isGrowthAction(card) || isRecordDeleteAction(card)) await growth.refresh()
}
async function refreshRecordsIfSucceeded(card) {
  if (card?.state !== 'SUCCEEDED' || !isRecordDeleteAction(card)) return
  const recordId = card.result?.recordId ?? card.result?.record_id ?? card.payload?.recordId ?? card.payload?.record_id
  if (recordId != null) records.removeRecordLocally(recordId)
}
function previewText(value) {
  if (!value) return ''
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}
async function confirm() {
  error.value = ''
  try {
    const card = await actions.confirm(props.proposal.id)
    await refreshTodosIfSucceeded(card)
    await refreshGrowthIfSucceeded(card)
    await refreshRecordsIfSucceeded(card)
    emit('updated', card)
  } catch (e) {
    error.value = e?.message || '确认结果未知，已尝试查询最新状态。'
    // The confirm response may be lost after the server committed the action.
    // actions.confirm attempts a GET recovery before rethrowing; refresh the
    // todo lists from that recovered state while keeping the original error.
    try { await refreshTodosIfSucceeded(actions.byId[props.proposal.id]) } catch { /* preserve confirm status and error */ }
    try { await refreshGrowthIfSucceeded(actions.byId[props.proposal.id]) } catch { /* preserve confirm status and error */ }
    try { await refreshRecordsIfSucceeded(actions.byId[props.proposal.id]) } catch { /* preserve confirm status and error */ }
  }
}
async function cancel() {
  error.value = ''
  try { await actions.cancel(props.proposal.id) }
  catch (e) { error.value = e?.message || '取消结果未知，已尝试查询最新状态。' }
  emit('updated', actions.byId[props.proposal.id])
}
async function save(payload) {
  error.value = ''
  try { await actions.edit(props.proposal.id, payload); editing.value = false }
  catch (e) { error.value = e?.message || '修改失败，请刷新状态后重试。' }
}
async function refreshStatus() {
  error.value = ''
  try { await actions.refresh(props.proposal.id) }
  catch (e) { error.value = e?.message || '暂时无法查询状态，请稍后重试。' }
}
</script>

<template>
  <section class="action-card" :data-action-id="proposal.id" :data-action-version="proposal.version" aria-label="操作确认卡">
    <header><span class="action-kind">{{ actionLabel }}</span><span class="action-state" :class="`state-${String(proposal.state || '').toLowerCase()}`">{{ candidateNeedsRecheck ? '五维定义需重新确认' : isPreparingRecord ? '正在准备候选' : stateLabel }}</span></header>
    <strong class="action-title">{{ title }}</strong>
    <p v-if="description" class="action-description">{{ description }}</p>
    <p v-if="deleteImpact" class="action-description delete-impact" role="alert">{{ deleteImpact }}</p>
    <p v-if="isPreparingRecord" class="action-description" role="status">正在准备可编辑候选；确认前不会创建或修改记录。</p>
    <p v-if="candidateNeedsRecheck" class="action-error" role="alert">{{ growth.axesDefinition ? '五维定义版本已变化，这份成长建议不能沿用。请取消本卡并重新准备候选。' : '暂时无法核对五维定义版本。请重试加载，核对完成前不会确认这张卡。' }} <button v-if="!growth.axesDefinition" type="button" @click="growth.fetchAxes">重试核对</button></p>
    <p v-if="preparationFailureMessage" class="action-error" role="alert">{{ preparationFailureMessage }}</p>
    <details v-if="proposal.preview"><summary>查看影响与预览</summary><pre>{{ previewText(proposal.preview) }}</pre></details>
    <p v-if="resultMessage" class="action-result" role="status">{{ resultMessage }}</p>
    <p v-if="proposal.error_code" class="action-error-code">状态编号：{{ proposal.error_code }}</p>
    <p v-if="error" class="action-error" role="alert">{{ error }}</p>
    <TodoActionForm v-if="editing && canEditAction && proposal.kind?.startsWith('todo.')" :proposal="proposal" @save="save" @cancel="editing=false" />
    <RecordActionForm v-else-if="editing && canEditAction && proposal.kind?.startsWith('record.')" :proposal="proposal" @save="save" @cancel="editing=false" />
    <GrowthActionForm v-else-if="editing && canEditAction && isGrowthAction(proposal)" :proposal="proposal" @save="save" @cancel="editing=false" />
    <MemoryActionForm v-else-if="editing && canEditAction && isMemoryAction(proposal)" :proposal="proposal" @save="save" @cancel="editing=false" />
    <footer v-else-if="canCancel"><button v-if="isPreparingRecord" type="button" :disabled="busy" @click="refreshStatus">刷新状态</button><button v-if="canEditAction && canEdit && !hideEdit" type="button" :disabled="busy" @click="editing=true">展开修改</button><button type="button" :disabled="busy" @click="cancel">取消</button><button v-if="canConfirmAction" type="button" class="primary" :disabled="busy" @click="confirm">{{ busy ? '正在处理…' : '确认执行' }}</button></footer>
    <footer v-else-if="proposal.state === 'EXECUTING'"><button type="button" :disabled="busy" @click="refreshStatus">刷新状态</button></footer>
  </section>
</template>

<style scoped>
.action-card{margin:12px 0;padding:15px;border:1px solid #7186c966;border-left:4px solid var(--accent,#566bd8);border-radius:10px;background:var(--surface,#f8f9ff);color:var(--text,#18213a);max-width:620px}.action-card header,.action-card footer{display:flex;align-items:center;gap:8px}.action-card header{justify-content:space-between}.action-kind{font-size:11px;letter-spacing:.04em;color:var(--text-low,#6d7895)}.action-state{font-size:12px;font-weight:700}.state-succeeded{color:#14804a}.state-failed,.state-stale{color:#b34332}.state-cancelled{color:#697386}.action-title{display:block;margin-top:9px}.action-description,.action-result{margin:7px 0;font-size:13px;line-height:1.5}.action-card details{margin-top:9px;font-size:12px}.action-card pre{max-height:220px;overflow:auto;padding:9px;background:#68708012;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}.action-card footer{justify-content:flex-end;margin-top:12px}.action-card footer button{padding:7px 10px;border:1px solid #7186c966;border-radius:6px;background:transparent;color:inherit;cursor:pointer}.action-card footer .primary{border-color:var(--accent,#566bd8);background:var(--accent,#566bd8);color:white}.action-card button:disabled{opacity:.55;cursor:wait}.action-error{color:#ad3027;font-size:12px}.action-error-code{font-size:11px;color:#7b6470}
</style>
