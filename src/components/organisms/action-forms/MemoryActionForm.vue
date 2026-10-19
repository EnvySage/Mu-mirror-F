<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({ proposal: { type: Object, required: true } })
const emit = defineEmits(['save', 'cancel'])
const payload = ref({})
const draft = computed(() => payload.value.memoryDraft || payload.value.memory_draft || payload.value)

watch(() => props.proposal, card => {
  payload.value = JSON.parse(JSON.stringify(card?.payload || {}))
}, { immediate: true, deep: true })

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : ''
}

function submit() {
  const current = payload.value.memoryDraft || payload.value.memory_draft
  if (current) {
    const key = payload.value.memoryDraft ? 'memoryDraft' : 'memory_draft'
    payload.value[key] = { ...current, content: draft.value.content.trim() }
  } else {
    payload.value = { ...payload.value, content: draft.value.content.trim() }
  }
  emit('save', payload.value)
}
</script>

<template>
  <form class="memory-action-form" @submit.prevent="submit">
    <label>记忆内容<textarea v-model="draft.content" rows="3" maxlength="1200" required /></label>
    <label>类型<select v-model="draft.kind"><option value="fact">事实</option><option value="preference">偏好</option><option value="event">事件</option><option value="plan">计划</option></select></label>
    <label>事实日期（不确定可留空）<input :value="dateOnly(draft.eventDate)" type="date" @input="draft.eventDate = $event.target.value || null"></label>
    <label>有效至（可留空）<input :value="dateOnly(draft.expiresAt)" type="date" @input="draft.expiresAt = $event.target.value || null"></label>
    <div class="form-actions"><button type="button" @click="emit('cancel')">返回</button><button type="submit">保存修改</button></div>
  </form>
</template>

<style scoped>
.memory-action-form{display:grid;gap:10px;margin-top:14px;padding-top:13px;border-top:1px solid #8794ad33}.memory-action-form label{display:grid;gap:5px;color:var(--text-mid);font-size:12px}.memory-action-form input,.memory-action-form textarea,.memory-action-form select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #8794ad55;border-radius:7px;background:var(--surface,#fff);color:var(--text,#18213a);font:inherit}.form-actions{display:flex;justify-content:flex-end;gap:8px}.form-actions button{padding:7px 12px;border:0;border-radius:6px;cursor:pointer}.form-actions button:last-child{background:var(--accent,#4765db);color:#fff}
</style>
