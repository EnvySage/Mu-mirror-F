<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useActionsStore } from '@/stores/actions'
import { useGrowthStore } from '@/stores/growth'
import { useRecordsStore } from '@/stores/records'
import TodoActionForm from './action-forms/TodoActionForm.vue'
import RecordActionForm from './action-forms/RecordActionForm.vue'
import GrowthActionForm from './action-forms/GrowthActionForm.vue'
import MemoryActionForm from './action-forms/MemoryActionForm.vue'
import DetailSheet from './DetailSheet.vue'
import ActionPreview from './ActionPreview.vue'
import { typeMap } from '@/constants/tags'
import { getActionLabel } from '@/utils/actionLabel'

const props = defineProps({ proposal: { type: Object, required: true }, hideEdit: { type: Boolean, default: false } })
const emit = defineEmits(['updated'])
const actions = useActionsStore()
const growth = useGrowthStore()
const records = useRecordsStore()
const editing = ref(false)
const detailsOpen = ref(false)
const excerpt = computed(() => recordDraft.value?.finalContent || props.proposal.payload?.memoryDraft?.content || props.proposal.preview?.memoryDraft?.content || props.proposal.payload?.notes || '')
const categories = computed(() => [...new Set((recordDraft.value?.segments || []).map(s => typeMap[s.contentType] || s.contentType).filter(Boolean))])
const permissionNote = computed(() => recordDraft.value?.mode === 'AI_ASSISTED' ? '确认后保存，并加入 Mirror 记忆。' : props.proposal.kind?.startsWith('memory.') && !props.proposal.kind?.includes('forget') ? '确认后才会在之后的对话中使用。' : '')
const reviewWarning = computed(() => candidateNeedsRecheck.value ? '五维定义需重新核对，请打开详情处理。' : preparationFailureMessage.value)
function openDetails(edit = false) { editing.value = edit; detailsOpen.value = true }
function closeDetails() {
  if (busy.value) return
  if (editing.value && !window.confirm('尚未保存修改。关闭并放弃修改？')) return
  editing.value = false
  detailsOpen.value = false
}
watch(() => props.proposal.state, state => { if (state !== 'PENDING') editing.value = false })
const error = ref('')
const busy = computed(() => !!actions.busy[props.proposal.id])
const title = computed(() => props.proposal.payload?.title || props.proposal.payload?.content?.slice(0, 72) || props.proposal.payload?.memoryDraft?.content?.slice(0, 72) || props.proposal.preview?.memoryDraft?.content?.slice(0, 72) || props.proposal.payload?.recordDraft?.rawContent?.slice(0, 72) || props.proposal.preview?.recordDraft?.rawContent?.slice(0, 72) || props.proposal.preview?.dimension_name || props.proposal.preview?.dimensionName || props.proposal.preview?.after?.title || props.proposal.preview?.before?.title || (props.proposal.kind === 'record.memory.disable' ? '永久移除记忆' : props.proposal.kind?.startsWith('growth.') ? '成长贡献' : props.proposal.kind?.startsWith('memory.') ? '记忆候选' : '待办操作'))
const stateLabel = computed(() => ({ PENDING:'等待你确认', EXECUTING:'正在执行', SUCCEEDED:'已完成', FAILED:'执行失败', CANCELLED:'已取消', STALE:'目标已变化' }[props.proposal.state] || props.proposal.state || '状态未知'))
const canEdit = computed(() => actions.canEdit(props.proposal))
const hasGrowthSuggestions = computed(() => {
  const suggestions = recordDraft.value?.growthSuggestions ?? recordDraft.value?.growth_suggestions
  return Array.isArray(suggestions) && suggestions.length > 0
})
const candidateNeedsRecheck = computed(() => {
  if (!props.proposal.kind?.startsWith('record.') || !hasGrowthSuggestions.value) return false
  if (recordDraft.value?.mode === 'ONLY_SAVE') return false
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
const recheckingGrowth = ref(false)
const growthRecheckFailed = ref(false)
const recordFallback = computed(() => props.proposal.kind?.startsWith('record.') && recordDraft.value?.preparationStatus === 'SAVE_ONLY')
const preparationFailureMessage = computed(() => {
  if (!props.proposal.kind?.startsWith('record.') || preparationStatus.value !== 'FAILED') return ''
  return props.proposal.preview?.preparationError || recordDraft.value?.preparationError || '候选准备失败，尚未创建或修改记录。请取消后重新准备。'
})
watch(hasGrowthSuggestions, hasSuggestions => {
  if (hasSuggestions && !growth.axesDefinition) recheckGrowthDefinition()
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
    if (actions.busy[props.proposal.id]) return
    actions.refresh(props.proposal.id)
      .then(card => { if (card) emit('updated', card) })
      .catch(() => {})
  }, 1500)
}, { immediate: true })
onBeforeUnmount(stopPreparationPoll)
async function recheckGrowthDefinition() {
  recheckingGrowth.value = true
  growthRecheckFailed.value = false
  try {
    await growth.fetchAxes(true)
  } catch {
    growthRecheckFailed.value = true
  } finally {
    recheckingGrowth.value = false
  }
}
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
  try { const card = await actions.edit(props.proposal.id, payload); editing.value = false; emit('updated', card) }
  catch (e) { error.value = e?.message || '修改失败，请刷新状态后重试。' }
}
async function refreshStatus() {
  error.value = ''
  try { await actions.refresh(props.proposal.id) }
  catch (e) { error.value = e?.message || '暂时无法查询状态，请稍后重试。' }
}
</script>

<template>
  <section class="action-card" :class="{ 'action-danger': (proposal.preview?.afterMemoryState ?? proposal.preview?.after_memory_state) === 'DISABLED' || proposal.kind?.endsWith('.delete') || proposal.kind === 'memory.forget' }" :data-action-id="proposal.id" :data-action-version="proposal.version" aria-label="操作确认卡" :aria-busy="busy">
    <header class="action-card-header"><span class="action-kind"><i aria-hidden="true">✦</i>{{ actionLabel }}</span><span class="action-state" :class="'state-' + String(proposal.state || '').toLowerCase()">{{ candidateNeedsRecheck ? '需要核对' : isPreparingRecord ? '整理中…' : stateLabel }}</span></header>
    <strong class="action-title">{{ title }}</strong>
    <p v-if="excerpt && excerpt !== title" class="action-excerpt">{{ excerpt }}</p>
    <div v-if="categories.length" class="action-tags"><span v-for="category in categories.slice(0, 3)" :key="category">{{ category }}</span><span v-if="recordDraft?.segments?.length > 1">{{ recordDraft.segments.length }} 个片段</span></div>
    <p v-if="deleteImpact" class="action-notice action-warning" role="alert">{{ deleteImpact }}</p>
    <p v-else-if="proposal.kind === 'record.memory.disable' || proposal.kind === 'memory.forget'" class="action-notice action-warning">{{ description }}</p>
    <p v-else-if="permissionNote" class="action-notice">{{ permissionNote }}</p>
    <p v-if="recordFallback || isPreparingRecord" class="action-notice" role="status">{{ isPreparingRecord ? '正在整理，确认前不会保存。' : description }}</p>
    <p v-if="reviewWarning" class="action-error" role="alert">{{ reviewWarning }}</p>
    <p v-if="resultMessage" class="action-result" role="status">{{ resultMessage }}</p>
    <p v-if="error" class="action-error" role="alert">{{ error }}</p>
    <footer class="action-controls">
      <button type="button" class="action-detail-button" @click="openDetails()">查看详情 <span aria-hidden="true">↗</span></button>
      <div v-if="canCancel"><button type="button" :disabled="busy" @click="cancel">取消</button><button v-if="canConfirmAction" type="button" class="primary" :disabled="busy" @click="confirm">{{ busy ? '处理中…' : '确认执行' }}</button></div>
      <button v-else-if="proposal.state === 'EXECUTING'" type="button" :disabled="busy" @click="refreshStatus">刷新状态</button>
    </footer>
  </section>
  <DetailSheet :open="detailsOpen" :title="editing ? '修改' + actionLabel : actionLabel" :subtitle="stateLabel" @close="closeDetails">
    <div class="action-review">
      <p class="review-title">{{ title }}</p>
      <p v-if="description" class="review-description">{{ description }}</p>
      <p v-if="permissionNote" class="review-permission">{{ permissionNote }}<span v-if="recordDraft?.mode === 'AI_ASSISTED'"> 可在记忆管理中停止使用。</span></p>
      <p v-if="deleteImpact" class="action-warning" role="alert">{{ deleteImpact }}</p>
      <p v-if="candidateNeedsRecheck" class="action-error" role="alert">{{ growthRecheckFailed || !growth.axesDefinition ? '暂时无法核对五维定义版本；核对完成前不会确认这张卡。' : '当前五维定义与候选版本不一致。重新核对后若仍不一致，请取消并重新准备候选。' }} <button type="button" :disabled="recheckingGrowth" @click="recheckGrowthDefinition">{{ recheckingGrowth ? '正在核对…' : '重新核对' }}</button></p>
      <p v-if="preparationFailureMessage" class="action-error" role="alert">{{ preparationFailureMessage }}</p>
      <p v-if="isPreparingRecord" role="status">正在准备可编辑候选；确认前不会创建或修改记录。</p>
      <fieldset v-if="editing && canEditAction" class="action-edit-fields" :disabled="busy">
        <TodoActionForm v-if="proposal.kind?.startsWith('todo.')" :proposal="proposal" @save="save" @cancel="editing=false" />
        <RecordActionForm v-else-if="proposal.kind?.startsWith('record.')" :proposal="proposal" @save="save" @cancel="editing=false" />
        <GrowthActionForm v-else-if="isGrowthAction(proposal)" :proposal="proposal" @save="save" @cancel="editing=false" />
        <MemoryActionForm v-else-if="isMemoryAction(proposal)" :proposal="proposal" @save="save" @cancel="editing=false" />
      </fieldset>
      <ActionPreview v-else :proposal="proposal" />
      <p v-if="resultMessage" class="action-result" role="status">{{ resultMessage }}</p>
      <p v-if="proposal.error_code" class="action-notice">状态编号：{{ proposal.error_code }}</p>
      <p v-if="error" class="action-error" role="alert">{{ error }}</p>
    </div>
    <template #footer>
      <div class="action-controls review-controls">
        <button type="button" @click="closeDetails">{{ editing ? '放弃修改并关闭' : '返回' }}</button>
        <div v-if="!editing && canCancel">
          <button v-if="isPreparingRecord" type="button" :disabled="busy" @click="refreshStatus">刷新状态</button>
          <button v-if="canEditAction && !hideEdit" type="button" :disabled="busy" @click="editing=true">修改内容</button>
          <button type="button" :disabled="busy" @click="cancel">取消操作</button>
          <button v-if="canConfirmAction" type="button" class="primary" :disabled="busy" @click="confirm">{{ busy ? '处理中…' : '确认执行' }}</button>
        </div>
        <button v-else-if="proposal.state === 'EXECUTING'" type="button" :disabled="busy" @click="refreshStatus">刷新状态</button>
      </div>
    </template>
  </DetailSheet>
</template>

<style scoped>
.action-card{position:relative;min-width:0;margin:14px 0;padding:18px 20px 14px;border:1px solid #b4c9d6;border-left:4px solid #1b59d5;border-radius:0 10px 0 0;background:#edf3ef;color:#19364c;max-width:620px;text-align:left;white-space:normal;box-shadow:4px 5px 0 #163b6a12;overflow-wrap:anywhere}
.action-card:after{content:'';position:absolute;right:0;top:0;width:33px;height:5px;background:#83d7e0;transform:skew(-25deg);transform-origin:right}
.action-card.action-danger{border-left-color:#c62a64;background:#fff0f3}
.action-card-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.action-kind{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;color:#356684}.action-kind i{font-style:normal;font-size:19px;color:#1a61d6}.action-state{flex-shrink:0;font-size:10px;color:#395e7d;background:#dce8ec;padding:4px 7px}
.state-succeeded{color:#116143;background:#d6eadf}.state-failed,.state-stale{color:#a43b38;background:#f4dfe0}.state-cancelled{color:#667680}
.action-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:12px;font-size:16px;line-height:1.65;font-weight:800;white-space:pre-wrap}.action-excerpt{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:7px 0;font-size:13px;line-height:1.7;color:#3f5c70;white-space:pre-wrap}.action-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.action-tags span{padding:3px 7px;font-size:10px;background:#dde8e8;color:#41657a}
.action-notice{margin:10px 0 0;font-size:11px;line-height:1.7;color:#526c7d}.action-result{margin-top:10px;font-size:12px;line-height:1.7;color:#28614e}.action-error,.action-warning{font-size:12px;line-height:1.7;color:#a52e46;margin:10px 0}
.action-controls{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid #c9d9dc}.action-controls>div{display:flex;flex-wrap:wrap;gap:7px}.action-controls button,.action-review button{min-height:36px;padding:7px 12px;border:1px solid #adc3d0;border-radius:2px;background:transparent;color:#274e6c;font-size:12px;cursor:pointer;transition:background .2s,transform .2s}.action-controls button:hover{background:#dbe9ec}.action-controls .primary{background:#1854cc;color:#fff;border-color:#1854cc;box-shadow:2px 2px 0 #092b7a}.action-controls .primary:hover{background:#103e9e;transform:translateY(-2px)}.action-controls .action-detail-button{padding-left:0;border:0;color:#1751a3;font-weight:700}.action-detail-button span{margin-left:6px}.action-controls button:disabled{opacity:.5;cursor:wait}.action-controls button:focus-visible,.action-review button:focus-visible{outline:3px solid #d8407b;outline-offset:3px}
.review-title{font-size:18px;font-weight:800;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 12px}.review-description{font-size:13px;line-height:1.8;color:#49647a;margin:0 0 16px}.review-permission{margin-bottom:22px;padding:11px 14px;border-left:3px solid #1d73bb;background:#e3eef0;font-size:12px;line-height:1.75;color:#355e78}.action-edit-fields{border:0;padding:0;margin:0;min-width:0}.review-controls{margin:0;padding:0;border:0}
@media(max-width:599px){.action-card{padding:14px 14px 12px}.action-title{font-size:14px}.action-controls button{min-height:40px;padding:8px 10px}.review-controls>div{justify-content:flex-end;flex:1}.review-title{font-size:16px}}
@media(prefers-reduced-motion:reduce){.action-controls button{transition:none}}
</style>
