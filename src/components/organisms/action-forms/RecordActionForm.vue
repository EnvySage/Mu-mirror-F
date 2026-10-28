<script setup>
import { computed, ref, watch } from 'vue'
import { CONTENT_TYPES, ALL_MOODS, normalizeContentType } from '@/constants/tags'
import { useGrowthStore } from '@/stores/growth'
import RecordTodoLinks from './RecordTodoLinks.vue'

const props = defineProps({ proposal: { type: Object, required: true }, expanded: Boolean, hideActions: Boolean })
const emit = defineEmits(['save', 'cancel', 'dirty'])
const growth = useGrowthStore()
const payload = ref({})
const tagDrafts = ref([])
const rawContent = computed(() => payload.value.recordDraft?.rawContent || '')
const draft = computed(() => payload.value.recordDraft || {})
const segments = computed(() => draft.value.segments || [])
const todoResolutions = computed(() => payload.value.todoResolutions || draft.value.todoResolutions || [])
const preparationStatus = computed(() => String(draft.value.preparationStatus || '').toUpperCase())
const running = computed(() => preparationStatus.value === 'RUNNING')
const fallbackReason = computed(() => draft.value.preparationError || props.proposal.error_message || props.proposal.errorMessage || props.proposal.preview?.description || 'AI 整理未能完成')
const growthAxes = computed(() => growth.axesDefinition?.axes || draft.value.growthAxes || draft.value.growth_axes || [])
const supportsGrowthReview = computed(() => draft.value.mode === 'AI_ASSISTED' && growthAxes.value.length === 5 && !!growth.config)
const reviewMin = computed(() => Number(growth.config?.review_min ?? growth.config?.reviewMin ?? NaN))
const reviewMax = computed(() => Number(growth.config?.review_max ?? growth.config?.reviewMax ?? NaN))
const aiSuggestionMin = computed(() => Number(growth.config?.ai_suggestion_min ?? growth.config?.aiSuggestionMin ?? NaN))
const aiSuggestionMax = computed(() => Number(growth.config?.ai_suggestion_max ?? growth.config?.aiSuggestionMax ?? NaN))
const growthSuggestions = computed(() => {
  const existing = draft.value.growthSuggestions || draft.value.growth_suggestions || []
  const byId = new Map(existing.map(item => [item.dimensionId ?? item.dimension_id, item]))
  return growthAxes.value.map(axis => {
    const suggestion = byId.get(axis.id) || {}
    return {
      dimensionId: axis.id,
      name: axis.name,
      points: Number(suggestion.points ?? 0),
      reason: suggestion.reason || '',
    }
  })
})
const growthDefinitionChanged = computed(() => {
  if (draft.value.mode !== 'AI_ASSISTED') return false
  const suggestions = draft.value.growthSuggestions || draft.value.growth_suggestions || []
  if (!Array.isArray(suggestions) || suggestions.length === 0) return false
  const candidateVersion = Number(draft.value.axesVersion ?? draft.value.axes_version ?? -1)
  const currentVersion = Number(growth.axesDefinition?.version ?? -2)
  return candidateVersion < 0 || currentVersion < 0 || candidateVersion !== currentVersion
})

function clone(value) { return JSON.parse(JSON.stringify(value ?? {})) }
// 只在换卡或准备状态变化时重建本地草稿：准备轮询会用同一张卡的新对象刷新 proposal，
// 若按对象深度监听，会把用户刚勾选的记忆开关/改过的字段重置回服务端值。
watch(
  [
    () => props.proposal?.id,
    () => props.proposal?.preparationStatus,
    () => props.proposal?.preparation_status,
    () => props.proposal?.payload?.recordDraft?.preparationStatus,
    () => props.proposal?.preview?.recordDraft?.preparationStatus,
  ],
  () => {
    payload.value = clone(props.proposal?.payload)
    payload.value.recordDraft ||= clone(props.proposal?.preview?.recordDraft)
    for (const segment of payload.value.recordDraft?.segments || []) {
      segment.contentType = normalizeContentType(segment.contentType)
    }
    tagDrafts.value = (payload.value.recordDraft?.segments || []).map(segment => tagsText(segment.tags))
  },
  { immediate: true },
)

growth.fetchAxes().catch(() => {})

function updateSegment(index, key, value) {
  if (props.expanded) emit('dirty')
  const next = clone(payload.value)
  next.recordDraft.segments[index][key] = value
  if (key === 'contentType') next.recordDraft.segments[index].todoEnabled = value === 'todo'
  if (key === 'text') next.recordDraft.finalContent = next.recordDraft.segments.map(segment => segment.text).join('\n')
  payload.value = next
}
function updateFinalContent(value) {
  if (props.expanded) emit('dirty')
  const next = clone(payload.value)
  next.recordDraft.finalContent = value
  if (next.recordDraft.segments?.length === 1) next.recordDraft.segments[0].text = value
  payload.value = next
}
function tagsText(tags) { return Array.isArray(tags) ? tags.join(', ') : '' }
function setTodoLinks(resolutions) {
  const next = clone(payload.value)
  next.todoResolutions = resolutions
  if (resolutions.length) (next.recordDraft.segments || []).forEach(s => { s.todoEnabled = false })
  payload.value = next
  if (props.expanded) emit('dirty')
}
function setTags(index, value) {
  tagDrafts.value[index] = value
  updateSegment(index, 'tags', value.split(/[,，\n]/).map(tag => tag.trim()).filter(Boolean))
}
function updateGrowthSuggestion(dimensionId, key, value) {
  if (!supportsGrowthReview.value || running.value || growthDefinitionChanged.value) return
  if (props.expanded) emit('dirty')
  const next = clone(payload.value)
  const draft = next.recordDraft
  const current = draft.growthSuggestions || draft.growth_suggestions || []
  if (current.length === 0) {
    const version = Number(growth.axesDefinition?.version)
    if (!Number.isSafeInteger(version) || version < 0) return
    draft.axesVersion = version
    delete draft.axes_version
  }
  const byId = new Map(current.map(item => [item.dimensionId ?? item.dimension_id, { ...item }]))
  const existing = byId.get(dimensionId) || { dimensionId, points: 0, reason: '' }
  existing[key] = key === 'points' ? Number(value) : value
  byId.set(dimensionId, existing)
  draft.growthSuggestions = growthAxes.value.map(axis => byId.get(axis.id) || { dimensionId: axis.id, points: 0, reason: '' })
  delete draft.growth_suggestions
  payload.value = next
}
function submit() {
  if (running.value || growthDefinitionChanged.value) return
  const next = clone(payload.value)
  if (Array.isArray(next.todoResolutions)) next.todoResolutions = next.todoResolutions.map(({ todoId, suggestionId, action, status }) => ({ todoId, suggestionId, action, status }))
  if (next.recordDraft.mode === 'ONLY_SAVE') {
    next.recordDraft.growthSuggestions = []
    delete next.recordDraft.growth_suggestions
  } else if (supportsGrowthReview.value) {
    const existing = next.recordDraft.growthSuggestions || next.recordDraft.growth_suggestions || []
    const byId = new Map(existing.map(item => [item.dimensionId ?? item.dimension_id, item]))
    next.recordDraft.growthSuggestions = existing.length
      ? growthAxes.value.map(axis => byId.get(axis.id) || { dimensionId: axis.id, points: 0, reason: '' })
      : []
    delete next.recordDraft.growth_suggestions
  }
  // 选择 AI 整理即授权记忆；仅在记忆管理中停止，不再逐段勾选。
  if (next.recordDraft?.mode === 'AI_ASSISTED') {
    ;(next.recordDraft.segments || []).forEach(segment => { segment.memoryEnabled = true })
  }
  emit('save', next)
}
defineExpose({ submit })
</script>

<template>
  <form class="record-action-form" :class="{ 'record-editor-expanded': expanded }" @submit.prevent="submit">
    <details class="record-source"><summary>原始输入 · 保留为来源</summary><pre class="record-original">{{ rawContent }}</pre></details>
    <p v-if="running" class="record-preparing" role="status">正在准备整理结果…</p>
    <div v-else-if="preparationStatus === 'SAVE_ONLY'" class="record-preparing" role="status">{{ fallbackReason }}。本次建议仅保存，仍需你确认；确认后不会加入记忆。</div>
    <label v-if="segments.length <= 1" class="record-field record-body-field">最终正文<textarea :value="draft.finalContent" maxlength="2000" :rows="expanded ? 8 : 4" :disabled="running" @input="updateFinalContent($event.target.value)" /></label>
    <details v-if="segments.length" class="record-segments" :open="expanded"><summary>分类、标签与片段 <span>{{ segments.length }} 个片段</span></summary>
    <fieldset v-for="(segment, index) in segments" :key="segment.draftId || index" class="record-segment">
      <legend>片段 {{ index + 1 }}</legend>
      <label v-if="expanded" class="record-field">标题<input :value="segment.title" maxlength="100" :disabled="running" @input="updateSegment(index, 'title', $event.target.value)"></label>
      <label v-if="!expanded || segments.length > 1" class="record-field">片段文字<textarea :value="segment.text" maxlength="2000" rows="5" :disabled="running" @input="updateSegment(index, 'text', $event.target.value)" /></label>
      <label v-if="expanded" class="record-field">摘要<textarea :value="segment.summary" maxlength="500" rows="3" :disabled="running" @input="updateSegment(index, 'summary', $event.target.value)" /></label>
      <label class="record-field">分类<select :value="segment.contentType || 'note'" :disabled="running" @change="updateSegment(index, 'contentType', $event.target.value)"><option v-for="item in CONTENT_TYPES" :key="item.key" :value="item.key">{{ item.label }}</option></select></label>
      <label class="record-field">自由标签<input :value="tagDrafts[index]" maxlength="500" placeholder="用逗号分隔" :disabled="running" @input="setTags(index, $event.target.value)"></label>
      <label v-if="segment.contentType === 'todo' && draft.mode === 'AI_ASSISTED'" class="record-todo-consent"><input type="checkbox" :checked="!!segment.todoEnabled" :disabled="running" @change="updateSegment(index, 'todoEnabled', $event.target.checked)"><span><b>保存后加入侧栏待办</b><small>取消勾选则只保留记录，不登记为待办。</small></span></label>
      <div v-if="expanded" class="record-moods"><span>情绪</span><button v-for="mood in ALL_MOODS" :key="mood.key" type="button" :aria-pressed="(segment.moods || []).includes(mood.key)" @click="updateSegment(index, 'moods', (segment.moods || []).includes(mood.key) ? segment.moods.filter(m => m !== mood.key) : [...(segment.moods || []), mood.key])">{{ mood.label }}</button></div>
    </fieldset>
    </details>
    <fieldset v-if="supportsGrowthReview" class="record-growth">
      <legend>本条记录的成长贡献</legend>
      <p class="record-growth-note">AI 建议 {{ aiSuggestionMin }}–{{ aiSuggestionMax }} 分；你可按本次具体进展改为 {{ reviewMin }}–{{ reviewMax }} 分。没有证据时保持 {{ aiSuggestionMin }}。分数只在记录完整就绪后入账。</p>
      <p v-if="growthDefinitionChanged" class="record-growth-stale" role="alert">五维定义已变化。请取消并重新准备候选后再确认，避免把分数记到旧定义下。</p>
      <label v-for="item in growthSuggestions" :key="item.dimensionId" class="record-growth-row">
        <span><strong>{{ item.name }}</strong><small>{{ item.reason || '本条没有足够依据时记 0 分' }}</small></span>
        <input :value="item.points" type="number" :min="reviewMin" :max="reviewMax" step="1" :disabled="running || growthDefinitionChanged" :aria-label="`${item.name}成长分数`" @input="updateGrowthSuggestion(item.dimensionId, 'points', $event.target.value)">
        <textarea :value="item.reason" rows="2" maxlength="500" :disabled="running || growthDefinitionChanged" :aria-label="`${item.name}贡献原因`" placeholder="说明这条记录里的具体进展" @input="updateGrowthSuggestion(item.dimensionId, 'reason', $event.target.value)" />
      </label>
    </fieldset>
    <RecordTodoLinks v-if="expanded && draft.mode === 'AI_ASSISTED'" :suggestions="draft.todoSuggestions || []" :resolutions="todoResolutions" @change="setTodoLinks" />
    <div v-for="(resolution, index) in (expanded ? [] : todoResolutions)" :key="resolution.suggestionId || resolution.todoId || index" class="record-todo-resolution">
      <b>{{ resolution.todoTitle || resolution.title || '关联待办' }}</b>
      <span>{{ resolution.action === 'dismissed' ? '本次忽略' : `确认状态：${resolution.status || '维持当前状态'}` }}</span>
    </div>
    <div v-if="!hideActions" class="record-form-actions"><button type="button" @click="emit('cancel')">返回</button><button type="submit" :disabled="running || growthDefinitionChanged">保存修改并重新确认</button></div>
  </form>
</template>

<style scoped>
.record-todo-consent{grid-column:1/-1;display:flex;align-items:flex-start;gap:12px;padding:15px;background:#dfff4e35;border-left:3px solid #1757c9;color:#16395c;font-size:12px}.record-todo-consent input{accent-color:#1854cc;width:18px;height:18px;flex-shrink:0}.record-todo-consent span{display:grid;gap:6px}.record-todo-consent small{line-height:1.6}
.record-source summary,.record-segments summary{cursor:pointer;font-size:12px;color:#3b5e77;min-height:36px;padding:10px 0}.record-segments summary span{float:right;color:#627c8e}.record-segments .record-segment{margin-top:10px}.record-source summary:focus-visible,.record-segments summary:focus-visible{outline:2px solid #1854cc;outline-offset:3px}

.record-action-form{display:grid;gap:11px;margin-top:14px;padding-top:13px;border-top:1px solid #8794ad33}.record-form-label{margin:0;color:var(--text-mid);font-size:12px;font-weight:700}.record-original{max-height:140px;overflow:auto;margin:0;padding:10px;background:#68708012;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;font-size:12px;line-height:1.6;color:var(--text,#18213a)}.record-preparing{margin:0;color:var(--text-mid);font-size:12px}.record-field{display:grid;gap:5px;color:var(--text-mid);font-size:12px}.record-field input,.record-field textarea,.record-field select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #8794ad55;border-radius:7px;background:var(--surface,#fff);color:var(--text,#18213a);font:inherit}.record-segment,.record-growth{display:grid;gap:9px;margin:0;padding:10px;border:1px solid #8794ad55;border-radius:7px}.record-segment legend,.record-growth legend{padding:0 5px;color:var(--text-mid);font-size:12px}.record-memory{display:flex;gap:8px;align-items:center;color:var(--text-mid);font-size:12px}.record-form-actions{display:flex;justify-content:flex-end;gap:8px}.record-form-actions button{padding:7px 12px;border:0;border-radius:6px;cursor:pointer}.record-form-actions button:last-child{background:var(--accent,#4765db);color:#fff}.record-todo-resolution{display:flex;justify-content:space-between;gap:10px;padding:8px;background:#68708012;font-size:12px}.record-growth-note,.record-growth-stale{margin:0;color:var(--text-mid);font-size:12px;line-height:1.5}.record-growth-stale{color:#ad3027}.record-growth-row{display:grid;grid-template-columns:minmax(130px,1fr) 82px minmax(140px,1fr);align-items:center;gap:10px;padding:8px 0;border-top:1px solid #8794ad22}.record-growth-row span{display:grid;gap:3px}.record-growth-row strong{font-size:12px}.record-growth-row small{font-size:10px;color:var(--text-low)}.record-growth-row input,.record-growth-row textarea{box-sizing:border-box;width:100%;padding:7px;border:1px solid #8794ad55;border-radius:6px;background:var(--surface,#fff);color:var(--text,#18213a);font:inherit}.record-growth-row input{height:36px}.record-growth-row textarea{resize:vertical}@media(max-width:560px){.record-growth-row{grid-template-columns:minmax(90px,1fr) 70px}.record-growth-row textarea{grid-column:1/-1}}
</style>
