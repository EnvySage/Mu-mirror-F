<script setup>
import { computed } from 'vue'
import ActionCard from '@/components/organisms/ActionCard.vue'

const props = defineProps({
  summary: { type: Object, required: true },
  actions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['retry', 'open-session'])

const dateLabel = computed(() => props.summary.sourceDate || props.summary.source_date || props.summary.dayKey || props.summary.day_key || '')
const text = computed(() => props.summary.summary || props.summary.content || '')
const state = computed(() => String(props.summary.state || '').toUpperCase())
</script>

<template>
  <section class="day-summary-card" :aria-busy="loading">
    <header>
      <div>
        <p class="eyebrow">每日回看 <span v-if="dateLabel">· {{ dateLabel }}</span></p>
        <h3>那天聊到的事</h3>
      </div>
      <span v-if="['PENDING', 'RUNNING', 'PROCESSING'].includes(state)" class="summary-state">正在整理</span>
    </header>
    <p v-if="text" class="summary-text">{{ text }}</p>
    <p v-else-if="loading || ['RUNNING', 'PROCESSING'].includes(state)" class="summary-muted" role="status">正在整理这段有消息的对话，不影响今天继续聊天。</p>
    <p v-else-if="error || state === 'FAILED'" class="summary-error" role="alert">{{ error || '总结暂时没能生成，可以稍后重试。' }}</p>
    <p v-else class="summary-muted">这一天没有生成总结。</p>

    <div v-if="actions.length" class="memory-actions">
      <h4>待你确认的记忆候选</h4>
      <p>确认后才会在之后的对话中使用；暂时可以先放着。</p>
      <ActionCard v-for="action in actions" :key="action.id" :proposal="action" />
    </div>
    <footer>
      <button v-if="summary.sourceSessionId || summary.source_session_id" type="button" @click="emit('open-session', summary.sourceSessionId || summary.source_session_id)">查看原对话</button>
      <button v-if="state === 'FAILED' || error" type="button" :disabled="loading" @click="emit('retry', summary)">{{ loading ? '重试中…' : '重试总结' }}</button>
    </footer>
  </section>
</template>

<style scoped>
.day-summary-card{margin:14px 0;padding:16px 18px;border:1px solid #8593b54a;border-radius:12px;background:var(--surface,#f8f9ff);color:var(--text,#18213a)}
header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.eyebrow{margin:0;color:var(--text-low,#707d98);font-size:11px;letter-spacing:.04em}h3{margin:5px 0 0;font-size:16px}.summary-state{font-size:12px;color:var(--text-low,#707d98)}
.summary-text{margin:12px 0 0;line-height:1.7;white-space:pre-wrap}.summary-muted,.summary-error{margin:12px 0 0;font-size:13px;line-height:1.55;color:var(--text-mid,#59647c)}.summary-error{color:#ad3027}
.memory-actions{margin-top:15px;padding-top:12px;border-top:1px solid #8593b533}.memory-actions h4{margin:0;font-size:13px}.memory-actions>p{margin:5px 0;color:var(--text-low,#707d98);font-size:12px}.memory-actions :deep(.action-card){max-width:none}
footer{display:flex;justify-content:flex-end;gap:8px;margin-top:11px}footer button{padding:7px 10px;border:1px solid #8593b566;border-radius:7px;background:transparent;color:inherit;cursor:pointer}footer button:disabled{opacity:.55;cursor:wait}
</style>
