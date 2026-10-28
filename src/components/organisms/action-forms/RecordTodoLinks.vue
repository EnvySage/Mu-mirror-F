<script setup>
import { ref, computed } from 'vue'
import { useTodoStore } from '@/stores/todo'
import { TASK_STATUSES, taskStatusMap } from '@/constants/tags'
const props = defineProps({ suggestions: { type: Array, default: () => [] }, resolutions: { type: Array, default: () => [] } })
const emit = defineEmits(['change'])
const todos = useTodoStore(), picker = ref(false), query = ref('')
const options = computed(() => todos.registry.filter(todo => !props.resolutions.some(r => String(r.todoId) === String(todo.id)) && todo.title?.includes(query.value)))
function add(todo, status) {
  const id = todo.todoId ?? todo.id
  emit('change', [...props.resolutions.filter(r => String(r.todoId) !== String(id)), { todoId: id, title: todo.title, action: 'confirmed', status: status || todo.current_status || todo.currentStatus || 'not_started' }])
  picker.value = false
}
function update(index, status) { emit('change', props.resolutions.map((r, i) => i === index ? { ...r, status } : r)) }
</script>
<template>
  <section class="record-todo-links"><header><div><h3>这条记录，推进了哪件事？</h3><p>关联已有待办，把日记作为进度证据。状态在你确认保存后更新。</p></div><button type="button" @click="picker=!picker; todos.fetchRegistry(true)">＋ 手动关联待办</button></header>
    <div v-for="item in suggestions.filter(s => !resolutions.some(r => String(r.todoId) === String(s.todoId)))" :key="item.todoId" class="todo-match"><span class="match-mark">AI 发现关联</span><strong>{{ item.title }}</strong><p>{{ taskStatusMap[item.currentStatus] || '未开始' }} → 建议{{ taskStatusMap[item.suggestedStatus] || '进行中' }}</p><button type="button" @click="add(item,item.suggestedStatus)">采纳关联与状态建议</button><small>不采纳就不会修改这件待办。</small></div>
    <div v-if="picker" class="todo-link-picker"><input v-model="query" aria-label="搜索已有待办" placeholder="搜索待办标题"><p v-if="todos.registryLoading" role="status">正在加载…</p><p v-else-if="todos.error" role="alert">{{ todos.error }}<button type="button" @click="todos.fetchRegistry(true)">重试</button></p><button v-for="todo in options" :key="todo.id" type="button" @click="add(todo)">{{ todo.title }} <small>{{ taskStatusMap[todo.current_status || todo.currentStatus] }}</small></button><p v-if="!todos.registryLoading && !options.length">没有可关联的待办。</p></div>
    <article v-for="(item,index) in resolutions" :key="item.todoId || item.suggestionId" class="todo-linked"><strong>{{ item.title || item.todoTitle || '关联待办' }}</strong><label>保存后状态<select :value="item.status" @change="update(index,$event.target.value)"><option v-for="state in TASK_STATUSES" :key="state.key" :value="state.key">{{ state.label }}</option></select></label><button type="button" @click="emit('change',resolutions.filter((_,i)=>i!==index))">移除关联</button></article>
  </section>
</template>
<style scoped>
.record-todo-links{padding:24px;background:#0b3068;border:1px solid #72c4db80;color:#eaf9ff}.record-todo-links header{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.record-todo-links h3{color:#e3ff52;font-size:18px;margin:0 0 12px}.record-todo-links p{font-size:12px;line-height:1.8;color:#b4cfe7}.record-todo-links button{background:#51e8ec;color:#123363;border:0;padding:10px 14px;font:inherit;font-size:12px;cursor:pointer}.todo-match,.todo-linked,.todo-link-picker{margin-top:20px;padding:18px;background:#143e78;border-left:3px solid #eeff58}.match-mark{display:block;color:#5af3ee;font-size:11px;margin-bottom:10px}.todo-match small{display:block;color:#b1cbe3;margin-top:10px;font-size:11px}.todo-link-picker{display:grid;gap:10px}.todo-link-picker input,.todo-linked select{padding:10px;font:inherit;min-width:0;max-width:100%;color:#16375a;background:#fbf9ec;border:1px solid #86b9cc}.todo-link-picker button{text-align:left;background:#eef7ec}.todo-linked{display:flex;gap:18px;align-items:center;flex-wrap:wrap}.todo-linked strong{flex:1}.todo-linked label{display:grid;gap:6px;font-size:11px}.todo-linked button{background:none;color:#ff9fc1;border-bottom:1px solid currentColor}.record-todo-links button:focus-visible{outline:3px solid #ff589d;outline-offset:3px}@media(max-width:650px){.record-todo-links{padding:18px}.todo-linked strong{flex-basis:100%}}
</style>
