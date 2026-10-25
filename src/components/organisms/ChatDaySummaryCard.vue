<script setup>
import { computed, ref } from 'vue'
import DetailSheet from './DetailSheet.vue'
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
const detailsOpen = ref(false)
const pendingCount = computed(() => props.actions.filter(action => action.state === 'PENDING').length)
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

    <footer>
      <button type="button" class="summary-open" @click="detailsOpen = true">{{ pendingCount ? pendingCount + ' 条记忆待确认' : '展开回看' }} <span aria-hidden="true">↗</span></button>
      <button v-if="summary.sourceSessionId || summary.source_session_id" type="button" @click="emit('open-session', summary.sourceSessionId || summary.source_session_id)">查看原对话</button>
      <button v-if="state === 'FAILED' || error" type="button" :disabled="loading" @click="emit('retry', summary)">{{ loading ? '重试中…' : '重试总结' }}</button>
    </footer>
  </section>
  <DetailSheet :open="detailsOpen" title="那天聊到的事" :subtitle="dateLabel ? dateLabel + ' / 每日回看' : '每日回看'" @close="detailsOpen=false">
    <p v-if="text" class="summary-full">{{ text }}</p>
    <p v-else class="summary-muted">{{ error || (loading ? '正在整理这段对话…' : '这一天暂时没有总结。') }}</p>
    <div v-if="actions.length" class="memory-actions">
      <h4>{{ pendingCount ? '待你确认的记忆' : '这次回看的记忆' }}</h4>
      <p>确认后才会在之后的对话中使用。</p>
      <ActionCard v-for="action in actions" :key="action.id" :proposal="action" />
    </div>
    <template #footer><div class="summary-dialog-actions">
      <button type="button" @click="detailsOpen=false">返回聊天</button>
      <button v-if="state === 'FAILED' || error" type="button" :disabled="loading" @click="emit('retry', summary)">{{ loading ? '重试中…' : '重试总结' }}</button>
      <button v-if="summary.sourceSessionId || summary.source_session_id" type="button" @click="detailsOpen=false; emit('open-session', summary.sourceSessionId || summary.source_session_id)">查看原对话</button>
    </div></template>
  </DetailSheet>
</template>

<style scoped>
.day-summary-card{position:relative;flex-shrink:0;align-self:stretch;min-width:0;margin:10px 0;padding:16px 18px;border:1px solid #7aa1b855;border-left:3px solid #7edbe7;border-radius:0;background:#19324a;color:#edf6f4;text-align:left;white-space:normal}
header{display:flex;justify-content:space-between;gap:12px}.eyebrow{margin:0;color:#a9cddc;font-size:10px;letter-spacing:.04em}h3{margin:6px 0 0;font-size:14px}.summary-state{font-size:11px;color:#abcfdb;flex-shrink:0}
.summary-text{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:9px 0 0;font-size:12px;line-height:1.8;white-space:pre-wrap;color:#c5d8e1;overflow-wrap:anywhere}
.summary-muted,.summary-error{margin:10px 0 0;font-size:12px;line-height:1.7;color:#9cb9cc}.summary-error{color:#f8a6c5}
footer{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:12px}footer button,.summary-dialog-actions button{padding:6px 9px;min-height:34px;border:1px solid #79a3b455;border-radius:2px;background:transparent;color:inherit;font-size:11px;cursor:pointer}.summary-open{color:#a2edf0;font-weight:700}.summary-open span{margin-left:8px}button:disabled{opacity:.55;cursor:wait}button:focus-visible{outline:3px solid #f383b2;outline-offset:3px}
.summary-full{margin:0;font-size:15px;line-height:1.9;white-space:pre-wrap;overflow-wrap:anywhere}.memory-actions{margin-top:25px;padding-top:20px;border-top:1px dashed #a4bec9}.memory-actions h4{margin:0;font-size:14px}.memory-actions>p{margin:7px 0 16px;color:#526b80;font-size:12px}.memory-actions :deep(.action-card){max-width:none}.summary-dialog-actions{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.summary-dialog-actions button{font-size:12px;min-height:38px}
</style>
