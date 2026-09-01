<script setup>
import { computed } from 'vue'
import { timeAgo } from '@/utils/time'
import { typeMap, moodMap, MOOD_COLOR_MAP } from '@/constants/tags'

const props = defineProps({
  record: { type: Object, required: true },
  active: { type: Boolean, default: false },
  splitIndex: { type: Number, default: 0 },
  isSplitChild: { type: Boolean, default: false },
})

defineEmits(['click'])

const isProcessing = computed(() => props.record.status === 'processing')
const isPendingReview = computed(() => props.record.status === 'reviewing')
const isFailed = computed(() => props.record.status === 'failed')
const isDone = computed(() => props.record.status === 'done')

const timeText = computed(() => timeAgo(props.record.created_at))

// 从第一个 chunk 获取元数据
const firstChunk = computed(() => props.record.chunks?.[0])
const typeLabel = computed(() => typeMap[firstChunk.value?.metadata?.contentType] || firstChunk.value?.metadata?.contentType || '')
const displayContent = computed(() => {
  if (props.record.segment && props.record.segment.length > 0) {
    return props.record.segment[0]
  }
  return props.record.content
})
</script>

<template>
  <div :class="['record-card', { active, 'is-failed': isFailed, 'is-pending': isPendingReview, 'is-split-child': isSplitChild }]" @click="$emit('click')">
    <!-- 拆分序号 -->
    <div v-if="isSplitChild" class="split-index">{{ splitIndex }}</div>
    <div class="record-meta">
      <span class="record-time">{{ timeText }}</span>
      <div class="record-tags">
        <!-- 状态标签 -->
        <span v-if="isProcessing" class="tag tag-processing">AI 整理中</span>
        <span v-else-if="isPendingReview" class="tag tag-pending">待审核</span>
        <span v-else-if="isFailed" class="tag tag-failed">处理失败</span>

        <!-- 内容标签（仅完成和待审核状态显示） -->
        <template v-if="isDone || isPendingReview">
          <span v-if="typeLabel" class="tag tag-type">{{ typeLabel }}</span>
          <span
            v-for="m in (firstChunk?.metadata?.mood || [])"
            :key="m"
            :class="['tag', 'tag-mood', MOOD_COLOR_MAP[m] || '']"
          >{{ moodMap[m] || m }}</span>
        </template>
      </div>
    </div>
    <div class="record-title">
      {{ isProcessing || isFailed ? displayContent.substring(0, 30) + '...' : firstChunk?.metadata?.title || '未生成标题' }}
    </div>
    <div v-if="isDone || isPendingReview" class="record-summary">
      {{ firstChunk?.metadata?.summary }}
    </div>
    <div v-if="(isDone || isPendingReview) && firstChunk?.metadata?.keywords?.length" class="record-keywords">
      <span v-for="k in firstChunk.metadata.keywords" :key="k" class="keyword">#{{ k }}</span>
    </div>
  </div>
</template>

<style scoped>
.record-card {
  background: var(--surface); border-radius: var(--radius-md);
  padding: 16px 18px; margin-bottom: 10px;
  box-shadow: var(--shadow-sm); border: 0.5px solid var(--border);
  cursor: pointer; transition: all 0.15s ease;
  position: relative;
}
.record-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.record-card.active { border-color: var(--accent); background: var(--accent-light); }
.record-card.is-failed { border-color: var(--danger); background: var(--danger-light); }
.record-card.is-pending { border-color: var(--warning); }
.record-card.is-split-child { margin-left: 8px; }
.record-card:active { transform: scale(0.98); }

/* 拆分序号 */
.split-index {
  position: absolute;
  top: 14px;
  left: -4px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(79, 70, 229, 0.3);
}
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
