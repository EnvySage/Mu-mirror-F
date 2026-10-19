<script setup>
import { computed, ref, watch } from 'vue'
import { CONTENT_TYPES } from '@/constants/tags'
import { useGrowthStore } from '@/stores/growth'

const props = defineProps({ proposal: { type: Object, required: true } })
const emit = defineEmits(['save', 'cancel'])
const growth = useGrowthStore()
const payload = ref({})
const rawContent = computed(() => payload.value.recordDraft?.rawContent || '')
const draft = computed(() => payload.value.recordDraft || {})
const segments = computed(() => draft.value.segments || [])
const todoResolutions = computed(() => payload.value.todoResolutions || draft.value.todoResolutions || [])
const preparationStatus = computed(() => String(draft.value.preparationStatus || '').toUpperCase())
const running = computed(() => preparationStatus.value === 'RUNNING')
const fallbackReason = computed(() => draft.value.preparationError || props.proposal.error_message || props.proposal.errorMessage || props.proposal.preview?.description || 'AI 整理未能完成')
const growthAxes = computed(() => growth.axesDefinition?.axes || draft.value.growthAxes || draft.value.growth_axes || [])
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
  const candidateVersion = Number(draft.value.axesVersion ?? draft.value.axes_version ?? -1)
  const currentVersion = Number(growth.axesDefinition?.version ?? -2)
  return candidateVersion >= 0 && currentVersion >= 0 && candidateVersion !== currentVersion
})

function clone(value) { return JSON.parse(JSON.stringify(value ?? {})) }
watch(() => props.proposal, card => {
  payload.value = clone(card?.payload)
  payload.value.recordDraft ||= clone(card?.preview?.recordDraft)
}, { immediate: true, deep: true })

growth.fetchAxes().catch(() => {})

function updateSegment(index, key, value) {
  const next = clone(payload.value)
  next.recordDraft.segments[index][key] = value
  payload.value = next
}
function updateFinalContent(value) {
  const next = clone(payload.value)
  next.recordDraft.finalContent = value
  if (next.recordDraft.segments?.length === 1) next.recordDraft.segments[0].text = value
  payload.value = next
}
function tagsText(tags) { return Array.isArray(tags) ? tags.join(', ') : '' }
function setTags(index, value) {
  updateSegment(index, 'tags', value.split(/[,，\n]/).map(tag => tag.trim()).filter(Boolean))
}
function updateGrowthSuggestion(dimensionId, key, value) {
  const next = clone(payload.value)
  const draft = next.recordDraft
  const current = draft.growthSuggestions || draft.growth_suggestions || []
  const byId = new Map(current.map(item => [item.dimensionId ?? item.dimension_id, { ...item }]))
  const existing = byId.get(dimensionId) || { dimensionId, points: 0, reason: '' }
  existing[key] = key === 'points' ? Number(value) : value
  byId.set(dimensionId, existing)
  draft.growthSuggestions = growthAxes.value.map(axis => byId.get(axis.id) || { dimensionId: axis.id, points: 0, reason: '' })
  delete draft.growth_suggestions
  payload.value = next
}
function submit() {
  const next = clone(payload.value)
  if (growthAxes.value.length === 5) {
    const existing = next.recordDraft.growthSuggestions || next.recordDraft.growth_suggestions || []
    const byId = new Map(existing.map(item => [item.dimensionId ?? item.dimension_id, item]))
    next.recordDraft.growthSuggestions = growthAxes.value.map(axis => byId.get(axis.id) || { dimensionId: axis.id, points: 0, reason: '' })
    delete next.recordDraft.growth_suggestions
  }
  emit('save', next)
}
</script>

<template>
  <form class="record-action-form" @submit.prevent="submit">
    <p class="record-form-label">原始输入 · 保留为来源</p>
    <pre class="record-original">{{ rawContent }}</pre>
    <p v-if="running" class="record-preparing" role="status">正在准备整理结果…</p>
    <div v-else-if="preparationStatus === 'SAVE_ONLY'" class="record-preparing" role="status">{{ fallbackReason }}。本次建议仅保存，仍需你确认；确认后不会加入记忆。</div>
    <label class="record-field">最终正文<textarea :value="draft.finalContent" maxlength="2000" rows="4" :disabled="running" @input="updateFinalContent($event.target.value)" /></label>
    <fieldset v-for="(segment, index) in segments" :key="segment.draftId || index" class="record-segment">
      <legend>片段 {{ index + 1 }}</legend>
      <label class="record-field">片段文字<textarea :value="segment.text" maxlength="2000" rows="3" :disabled="running" @input="updateSegment(index, 'text', $event.target.value)" /></label>
      <label class="record-field">分类<select :value="segment.contentType || 'note'" :disabled="running" @change="updateSegment(index, 'contentType', $event.target.value)"><option v-for="item in CONTENT_TYPES" :key="item.key" :value="item.key">{{ item.label }}</option></select></label>
      <label class="record-field">自由标签<input :value="tagsText(segment.tags)" maxlength="500" placeholder="用逗号分隔" :disabled="running" @input="setTags(index, $event.target.value)"></label>
      <label class="record-memory"><input :checked="Boolean(segment.memoryEnabled)" type="checkbox" :disabled="running" @change="updateSegment(index, 'memoryEnabled', $event.target.checked)"><span>确认后允许这个片段进入 Mirror 记忆</span></label>
    </fieldset>
    <fieldset v-if="growthAxes.length === 5 && growth.config" class="record-growth">
      <legend>本条记录的成长贡献</legend>
      <p class="record-growth-note">AI 建议 {{ aiSuggestionMin }}–{{ aiSuggestionMax }} 分；你可按本次具体进展改为 {{ reviewMin }}–{{ reviewMax }} 分。没有证据时保持 {{ aiSuggestionMin }}。分数只在记录完整就绪后入账。</p>
      <p v-if="growthDefinitionChanged" class="record-growth-stale" role="alert">五维定义已变化。请取消并重新准备候选后再确认，避免把分数记到旧定义下。</p>
      <label v-for="item in growthSuggestions" :key="item.dimensionId" class="record-growth-row">
        <span><strong>{{ item.name }}</strong><small>{{ item.reason || '本条没有足够依据时记 0 分' }}</small></span>
        <input :value="item.points" type="number" :min="reviewMin" :max="reviewMax" step="1" :disabled="running || growthDefinitionChanged" :aria-label="`${item.name}成长分数`" @input="updateGrowthSuggestion(item.dimensionId, 'points', $event.target.value)">
        <textarea :value="item.reason" rows="2" maxlength="500" :disabled="running || growthDefinitionChanged" :aria-label="`${item.name}贡献原因`" placeholder="说明这条记录里的具体进展" @input="updateGrowthSuggestion(item.dimensionId, 'reason', $event.target.value)" />
      </label>
    </fieldset>
    <div v-for="(resolution, index) in todoResolutions" :key="resolution.suggestionId || resolution.todoId || index" class="record-todo-resolution">
      <b>{{ resolution.todoTitle || resolution.title || '关联待办' }}</b>
      <span>{{ resolution.action === 'dismissed' ? '本次忽略' : `确认状态：${resolution.status || '维持当前状态'}` }}</span>
    </div>
    <div class="record-form-actions"><button type="button" @click="emit('cancel')">返回</button><button type="submit" :disabled="running || growthDefinitionChanged">保存修改并重新确认</button></div>
  </form>
</template>

<style scoped>
.record-action-form{display:grid;gap:11px;margin-top:14px;padding-top:13px;border-top:1px solid #8794ad33}.record-form-label{margin:0;color:var(--text-mid);font-size:12px;font-weight:700}.record-original{max-height:140px;overflow:auto;margin:0;padding:10px;background:#68708012;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;font-size:12px;line-height:1.6;color:var(--text,#18213a)}.record-preparing{margin:0;color:var(--text-mid);font-size:12px}.record-field{display:grid;gap:5px;color:var(--text-mid);font-size:12px}.record-field input,.record-field textarea,.record-field select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #8794ad55;border-radius:7px;background:var(--surface,#fff);color:var(--text,#18213a);font:inherit}.record-segment,.record-growth{display:grid;gap:9px;margin:0;padding:10px;border:1px solid #8794ad55;border-radius:7px}.record-segment legend,.record-growth legend{padding:0 5px;color:var(--text-mid);font-size:12px}.record-memory{display:flex;gap:8px;align-items:center;color:var(--text-mid);font-size:12px}.record-form-actions{display:flex;justify-content:flex-end;gap:8px}.record-form-actions button{padding:7px 12px;border:0;border-radius:6px;cursor:pointer}.record-form-actions button:last-child{background:var(--accent,#4765db);color:#fff}.record-todo-resolution{display:flex;justify-content:space-between;gap:10px;padding:8px;background:#68708012;font-size:12px}.record-growth-note,.record-growth-stale{margin:0;color:var(--text-mid);font-size:12px;line-height:1.5}.record-growth-stale{color:#ad3027}.record-growth-row{display:grid;grid-template-columns:minmax(130px,1fr) 82px minmax(140px,1fr);align-items:center;gap:10px;padding:8px 0;border-top:1px solid #8794ad22}.record-growth-row span{display:grid;gap:3px}.record-growth-row strong{font-size:12px}.record-growth-row small{font-size:10px;color:var(--text-low)}.record-growth-row input,.record-growth-row textarea{box-sizing:border-box;width:100%;padding:7px;border:1px solid #8794ad55;border-radius:6px;background:var(--surface,#fff);color:var(--text,#18213a);font:inherit}.record-growth-row input{height:36px}.record-growth-row textarea{resize:vertical}@media(max-width:560px){.record-growth-row{grid-template-columns:minmax(90px,1fr) 70px}.record-growth-row textarea{grid-column:1/-1}}
</style>
