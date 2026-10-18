<script setup>
import { computed, ref } from 'vue'
import { useActionsStore } from '@/stores/actions'
import TodoActionForm from './action-forms/TodoActionForm.vue'
import RecordActionForm from './action-forms/RecordActionForm.vue'

const props = defineProps({ proposal: { type: Object, required: true }, hideEdit: { type: Boolean, default: false } })
const emit = defineEmits(['updated'])
const actions = useActionsStore()
const editing = ref(false)
const error = ref('')
const busy = computed(() => !!actions.busy[props.proposal.id])
const title = computed(() => props.proposal.payload?.title || props.proposal.payload?.recordDraft?.rawContent?.slice(0, 72) || props.proposal.preview?.recordDraft?.rawContent?.slice(0, 72) || props.proposal.preview?.after?.title || props.proposal.preview?.before?.title || '待办操作')
const stateLabel = computed(() => ({ PENDING:'等待你确认', EXECUTING:'正在执行', SUCCEEDED:'已完成', FAILED:'执行失败', CANCELLED:'已取消', STALE:'目标已变化' }[props.proposal.state] || props.proposal.state || '状态未知'))
const canEdit = computed(() => actions.canEdit(props.proposal))
const canCancel = computed(() => actions.canCancel(props.proposal))
const canEditAction = computed(() => canEdit.value && props.proposal.kind !== 'todo.delete' && props.proposal.payload?.recordDraft?.preparationStatus !== 'RUNNING' && props.proposal.preview?.recordDraft?.preparationStatus !== 'RUNNING')
const actionLabel = computed(() => ({ 'todo.create':'创建待办', 'todo.update':'修改待办', 'todo.complete':'完成待办', 'todo.delete':'删除待办', 'record.create':'新建记录', 'record.organize':'整理记录' }[props.proposal.kind] || '操作'))
const recordDraft = computed(() => props.proposal.payload?.recordDraft || props.proposal.preview?.recordDraft)
const recordFallback = computed(() => props.proposal.kind?.startsWith('record.') && recordDraft.value?.preparationStatus === 'SAVE_ONLY')
const description = computed(() => recordFallback.value
  ? `${recordDraft.value.preparationError || props.proposal.preview?.description || 'AI 整理未能完成'}。建议仅保存，仍待你确认；确认后不会加入记忆。`
  : props.proposal.preview?.description)
const resultMessage = computed(() => {
  const result = props.proposal.result || {}
  if (result.outcome === 'SAVED_ONLY_FALLBACK' || result.outcome === 'SAVE_ONLY_FALLBACK') return '已仅保存，未加入记忆。'
  if (props.proposal.state === 'SUCCEEDED') return result.message || '服务端已确认完成。'
  if (props.proposal.state === 'CANCELLED') return props.proposal.kind?.startsWith('record.') ? '这条记录没有创建或整理。' : '没有创建或修改待办。'
  if (props.proposal.state === 'STALE') return '目标数据已变化，请重新发起操作。'
  return result.message || ''
})
const isTodoAction = card => ['todo.create','todo.update','todo.complete','todo.delete'].includes(card?.kind)
async function refreshTodosIfSucceeded(card) {
  if (card?.state !== 'SUCCEEDED' || !isTodoAction(card)) return
  const { useTodoStore } = await import('@/stores/todo')
  await useTodoStore().refreshAfterAction()
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
    emit('updated', card)
  } catch (e) {
    error.value = e?.message || '确认结果未知，已尝试查询最新状态。'
    // The confirm response may be lost after the server committed the action.
    // actions.confirm attempts a GET recovery before rethrowing; refresh the
    // todo lists from that recovered state while keeping the original error.
    try { await refreshTodosIfSucceeded(actions.byId[props.proposal.id]) } catch { /* preserve confirm status and error */ }
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
    <header><span class="action-kind">{{ actionLabel }}</span><span class="action-state" :class="`state-${String(proposal.state || '').toLowerCase()}`">{{ stateLabel }}</span></header>
    <strong class="action-title">{{ title }}</strong>
    <p v-if="description" class="action-description">{{ description }}</p>
    <details v-if="proposal.preview"><summary>查看影响与预览</summary><pre>{{ previewText(proposal.preview) }}</pre></details>
    <p v-if="resultMessage" class="action-result" role="status">{{ resultMessage }}</p>
    <p v-if="proposal.error_code" class="action-error-code">状态编号：{{ proposal.error_code }}</p>
    <p v-if="error" class="action-error" role="alert">{{ error }}</p>
    <TodoActionForm v-if="editing && canEditAction && proposal.kind?.startsWith('todo.')" :proposal="proposal" @save="save" @cancel="editing=false" />
    <RecordActionForm v-else-if="editing && canEditAction && proposal.kind?.startsWith('record.')" :proposal="proposal" @save="save" @cancel="editing=false" />
    <footer v-else-if="canCancel"><button v-if="canEditAction && canEdit && !hideEdit" type="button" :disabled="busy" @click="editing=true">展开修改</button><button type="button" :disabled="busy" @click="cancel">取消</button><button v-if="canEdit" type="button" class="primary" :disabled="busy" @click="confirm">{{ busy ? '正在处理…' : '确认执行' }}</button></footer>
    <footer v-else-if="proposal.state === 'EXECUTING'"><button type="button" :disabled="busy" @click="refreshStatus">刷新状态</button></footer>
  </section>
</template>

<style scoped>
.action-card{margin:12px 0;padding:15px;border:1px solid #7186c966;border-left:4px solid var(--accent,#566bd8);border-radius:10px;background:var(--surface,#f8f9ff);color:var(--text,#18213a);max-width:620px}.action-card header,.action-card footer{display:flex;align-items:center;gap:8px}.action-card header{justify-content:space-between}.action-kind{font-size:11px;letter-spacing:.04em;color:var(--text-low,#6d7895)}.action-state{font-size:12px;font-weight:700}.state-succeeded{color:#14804a}.state-failed,.state-stale{color:#b34332}.state-cancelled{color:#697386}.action-title{display:block;margin-top:9px}.action-description,.action-result{margin:7px 0;font-size:13px;line-height:1.5}.action-card details{margin-top:9px;font-size:12px}.action-card pre{max-height:220px;overflow:auto;padding:9px;background:#68708012;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}.action-card footer{justify-content:flex-end;margin-top:12px}.action-card footer button{padding:7px 10px;border:1px solid #7186c966;border-radius:6px;background:transparent;color:inherit;cursor:pointer}.action-card footer .primary{border-color:var(--accent,#566bd8);background:var(--accent,#566bd8);color:white}.action-card button:disabled{opacity:.55;cursor:wait}.action-error{color:#ad3027;font-size:12px}.action-error-code{font-size:11px;color:#7b6470}
</style>
