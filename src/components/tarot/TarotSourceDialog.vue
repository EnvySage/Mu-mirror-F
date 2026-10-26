<script setup>
import { ref, watch } from 'vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { tarotApi } from '@/api/tarot'
import { getRecord } from '@/api/records'
import { getTodos } from '@/api/todo'
import { getSnapshot } from '@/api/mirror'
import { tarotDate } from '@/utils/tarotProtocol'
const props = defineProps({ source: Object, analysisId: String })
const emit = defineEmits(['close', 'refresh'])
const dialog = ref(null), text = ref(''), error = ref(''), loading = ref(false)
let epoch = 0
useDialogFocus(() => !!props.source, dialog, 'button', () => emit('close'))
watch(() => props.source, async source => {
  const token = ++epoch; text.value = error.value = ''
  if (!source) return
  loading.value = true
  try {
    const analysis = await tarotApi.analysis(props.analysisId)
    if (analysis.status !== 'completed' || !analysis.sources.some(s => s.ref === source.ref && s.version === source.version)) {
      emit('refresh'); throw new Error('资料已变更或撤回，这份解读已失效。')
    }
    let content = ''
    if (source.kind === 'diary') {
      const { data } = await getRecord(source.source_id)
      content = data.raw_content || data.content || source.excerpt
    } else if (source.kind === 'todo') {
      const { data } = await getTodos()
      const todo = (Array.isArray(data) ? data : data.todos || []).find(t => String(t.id) === source.source_id)
      if (!todo) throw new Error('这条待办已不可查看。')
      content = `${todo.title}\n${todo.notes || ''}\n状态：${({ not_started: '未开始', in_progress: '进行中', completed: '已完成' })[todo.current_status] || todo.current_status}`
    } else {
      const { data } = await getSnapshot(source.source_id)
      content = [data.overall_summary, data.mood_analysis, data.learning_analysis, data.todo_analysis, data.rhythm_analysis].filter(Boolean).join('\n\n') || source.excerpt
    }
    if (token === epoch) text.value = content
  } catch (e) { if (token === epoch) error.value = e.message }
  finally { if (token === epoch) loading.value = false }
})
</script>
<template>
  <Teleport to="body"><div v-if="source" class="source-overlay" @click.self="$emit('close')">
    <section ref="dialog" role="dialog" aria-modal="true" aria-labelledby="tarot-source-title" tabindex="-1">
      <header><h2 id="tarot-source-title">{{ source.title }}</h2><button @click="$emit('close')">关闭 ×</button></header>
      <small>{{ tarotDate(source.date) }} · {{ { diary: '日记原文', todo: '当前待办', mirror: '已有镜子总结' }[source.kind] }}</small>
      <p v-if="loading" role="status">正在读取原始资料…</p><p v-else-if="error" role="alert">{{ error }}</p><p v-else class="source-text">{{ text }}</p>
    </section>
  </div></Teleport>
</template>
<style scoped>
.source-overlay{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:20px;background:#030a29df;color:#f2f8ff}.source-overlay section{width:min(100%,640px);max-height:85dvh;overflow:auto;background:#092962;padding:24px;border-top:4px solid #50edfa}.source-overlay header{display:flex;align-items:center;gap:20px;justify-content:space-between}.source-overlay h2{font-size:20px;line-height:1.5;margin:0;overflow-wrap:anywhere}.source-overlay button{white-space:nowrap;min-height:44px;color:#50edfa}.source-overlay small{display:block;color:#acc8ef;margin-top:10px}.source-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.9}
</style>
