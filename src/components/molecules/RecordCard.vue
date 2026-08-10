<script setup>
import { computed } from 'vue'
import { timeAgo } from '@/utils/time'
import { typeMap, moodMap, MOOD_COLOR_MAP } from '@/constants/tags'

const props = defineProps({
  record: { type: Object, required: true },
  active: { type: Boolean, default: false },
})

defineEmits(['click'])

const isProcessing = computed(() => props.record.status === 'processing')
const isPendingReview = computed(() => props.record.status === 'reviewing')
const isFailed = computed(() => props.record.status === 'failed')
const isDone = computed(() => props.record.status === 'done')

const timeText = computed(() => timeAgo(props.record.created_at))

const typeLabel = computed(() => typeMap[props.record.content_type] || props.record.content_type)
</script>

<template>
  <div :class="['record-card', { active, 'is-failed': isFailed, 'is-pending': isPendingReview }]" @click="$emit('click')">
    <div class="record-meta">
      <span class="record-time">{{ timeText }}</span>
      <div class="record-tags">
        <!-- 状态标签 -->
        <span v-if="isProcessing" class="tag tag-processing">AI 整理中</span>
        <span v-else-if="isPendingReview" class="tag tag-pending">待审核</span>
        <span v-else-if="isFailed" class="tag tag-failed">处理失败</span>

        <!-- 内容标签（仅完成和待审核状态显示） -->
        <template v-if="isDone || isPendingReview">
          <span class="tag tag-type">{{ typeLabel }}</span>
          <span
            v-for="m in (record.mood || [])"
            :key="m"
            :class="['tag', 'tag-mood', MOOD_COLOR_MAP[m] || '']"
          >{{ moodMap[m] || m }}</span>
        </template>
      </div>
    </div>
    <div class="record-title">
      {{ isProcessing || isFailed ? record.content.substring(0, 30) + '...' : record.title }}
    </div>
    <div v-if="isDone || isPendingReview" class="record-summary">
      {{ record.summary }}
    </div>
    <div v-if="(isDone || isPendingReview) && record.keywords && record.keywords.length" class="record-keywords">
      <span v-for="k in record.keywords" :key="k" class="keyword">#{{ k }}</span>
    </div>
  </div>
</template>

<style scoped>
.record-card {
  background: var(--surface); border-radius: var(--radius-md);
  padding: 16px 18px; margin-bottom: 10px;
  box-shadow: var(--shadow-sm); border: 0.5px solid var(--border);
  cursor: pointer; transition: all 0.15s ease;
}
.record-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.record-card.active { border-color: var(--accent); background: var(--accent-light); }
.record-card.is-failed { border-color: var(--danger); background: var(--danger-light); }
.record-card.is-pending { border-color: var(--warning); }
.record-card:active { transform: scale(0.98); }
.record-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.record-time { font-size: 12px; color: var(--text-tertiary); font-weight: 500; font-family: var(--font-mono); }
.record-tags { display: flex; gap: 5px; flex-wrap: wrap; }
.tag { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: var(--radius-full); font-size: 11px; font-weight: 500; }
.tag-type { background: var(--accent-light); color: var(--accent); }
.tag-mood { background: var(--success-light); color: var(--success); }
.tag-mood.anxious { background: var(--warning-light); color: var(--warning); }
.tag-mood.sad { background: var(--danger-light); color: var(--danger); }
.tag-mood.tired { background: #F3F0FF; color: #7C3AED; }
.tag-processing { background: var(--processing-light); color: var(--processing); animation: tagPulse 2s ease-in-out infinite; }
.tag-pending { background: var(--warning-light); color: var(--warning); }
.tag-failed { background: var(--danger-light); color: var(--danger); }
@keyframes tagPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.record-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.record-summary { font-size: 13px; color: var(--text-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.record-keywords { display: flex; gap: 5px; margin-top: 10px; flex-wrap: wrap; }
.keyword { font-size: 11px; color: var(--text-tertiary); background: var(--bg); padding: 2px 8px; border-radius: var(--radius-full); }
</style>
