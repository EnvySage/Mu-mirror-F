<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({ proposal: { type: Object, required: true } })
const emit = defineEmits(['save', 'cancel'])
const payload = ref({})
watch(() => props.proposal, card => { payload.value = { ...(card?.payload || {}) } }, { immediate: true, deep: true })
const kind = computed(() => props.proposal.kind || '')
const isCreate = computed(() => kind.value === 'todo.create')
const statusOptions = [
  { value: 'not_started', label: '未开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
]
function dateInput(value) {
  if (!value) return ''
  return String(value).slice(0, 16)
}
function submit() {
  const next = { ...payload.value }
  if (next.dueAt) next.dueAt = new Date(next.dueAt).toISOString()
  emit('save', next)
}
</script>

<template>
  <form class="todo-action-form" @submit.prevent="submit">
    <label>待办内容<input v-model="payload.title" maxlength="200" required autocomplete="off"></label>
    <label>截止日期<input :value="dateInput(payload.dueAt)" type="datetime-local" @input="payload.dueAt = $event.target.value"></label>
    <label>备注<textarea v-model="payload.notes" rows="2" maxlength="2000" /></label>
    <label v-if="!isCreate">状态<select v-model="payload.currentStatus"><option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
    <div class="form-actions"><button type="button" @click="emit('cancel')">返回</button><button type="submit">保存修改</button></div>
  </form>
</template>

<style scoped>
.todo-action-form{display:grid;gap:10px;margin-top:14px;padding-top:13px;border-top:1px solid #8794ad33}.todo-action-form label{display:grid;gap:5px;color:var(--text-mid);font-size:12px}.todo-action-form input,.todo-action-form textarea,.todo-action-form select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #8794ad55;border-radius:7px;background:var(--surface,#fff);color:var(--text,#18213a);font:inherit}.form-actions{display:flex;justify-content:flex-end;gap:8px}.form-actions button{padding:7px 12px;border:0;border-radius:6px;cursor:pointer}.form-actions button:last-child{background:var(--accent,#4765db);color:#fff}
</style>
