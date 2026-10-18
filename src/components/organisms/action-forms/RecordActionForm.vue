<script setup>
import { computed, ref, watch } from 'vue'
import { CONTENT_TYPES } from '@/constants/tags'

const props = defineProps({ proposal: { type: Object, required: true } })
const emit = defineEmits(['save', 'cancel'])
const payload = ref({})
const rawContent = computed(() => payload.value.recordDraft?.rawContent || '')
const draft = computed(() => payload.value.recordDraft || {})
const segments = computed(() => draft.value.segments || [])
const todoResolutions = computed(() => payload.value.todoResolutions || draft.value.todoResolutions || [])
const preparationStatus = computed(() => String(draft.value.preparationStatus || '').toUpperCase())
const running = computed(() => preparationStatus.value === 'RUNNING')
const fallbackReason = computed(() => draft.value.preparationError || props.proposal.error_message || props.proposal.errorMessage || props.proposal.preview?.description || 'AI 整理未能完成')

function clone(value) { return JSON.parse(JSON.stringify(value ?? {})) }
watch(() => props.proposal, card => {
  payload.value = clone(card?.payload)
  payload.value.recordDraft ||= clone(card?.preview?.recordDraft)
}, { immediate: true, deep: true })

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
function submit() { emit('save', clone(payload.value)) }
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
    <div v-for="(resolution, index) in todoResolutions" :key="resolution.suggestionId || resolution.todoId || index" class="record-todo-resolution">
      <b>{{ resolution.todoTitle || resolution.title || '关联待办' }}</b>
      <span>{{ resolution.action === 'dismissed' ? '本次忽略' : `确认状态：${resolution.status || '维持当前状态'}` }}</span>
    </div>
    <div class="record-form-actions"><button type="button" @click="emit('cancel')">返回</button><button type="submit" :disabled="running">保存修改并重新确认</button></div>
  </form>
</template>

<style scoped>
.record-action-form{display:grid;gap:11px;margin-top:14px;padding-top:13px;border-top:1px solid #8794ad33}.record-form-label{margin:0;color:var(--text-mid);font-size:12px;font-weight:700}.record-original{max-height:140px;overflow:auto;margin:0;padding:10px;background:#68708012;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;font-size:12px;line-height:1.6;color:var(--text,#18213a)}.record-preparing{margin:0;color:var(--text-mid);font-size:12px}.record-field{display:grid;gap:5px;color:var(--text-mid);font-size:12px}.record-field input,.record-field textarea,.record-field select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #8794ad55;border-radius:7px;background:var(--surface,#fff);color:var(--text,#18213a);font:inherit}.record-segment{display:grid;gap:9px;margin:0;padding:10px;border:1px solid #8794ad55;border-radius:7px}.record-segment legend{padding:0 5px;color:var(--text-mid);font-size:12px}.record-memory{display:flex;gap:8px;align-items:center;color:var(--text-mid);font-size:12px}.record-form-actions{display:flex;justify-content:flex-end;gap:8px}.record-form-actions button{padding:7px 12px;border:0;border-radius:6px;cursor:pointer}.record-form-actions button:last-child{background:var(--accent,#4765db);color:#fff}.record-todo-resolution{display:flex;justify-content:space-between;gap:10px;padding:8px;background:#68708012;font-size:12px}
</style>
