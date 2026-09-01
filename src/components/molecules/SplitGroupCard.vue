<script setup>
import { computed } from 'vue'
import { timeAgo } from '@/utils/time'
import { typeMap, moodMap, MOOD_COLOR_MAP } from '@/constants/tags'

const props = defineProps({
  records: { type: Array, required: true },
  active: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

const rootRecord = computed(() => props.records[0])
const timeText = computed(() => timeAgo(rootRecord.value.created_at))
const totalCount = computed(() => props.records.length)

// 从第一条记录的 chunks 获取所有标题
const chunkTitles = computed(() => {
  const record = rootRecord.value
  if (!record.chunks) return []
  return record.chunks.map(chunk => chunk.metadata?.title || '未生成标题')
})

// 显示所有 chunk 的类型标签（去重）
const allTypes = computed(() => {
  const types = new Set()
  const record = rootRecord.value
  if (record.chunks) {
    record.chunks.forEach(chunk => {
      if (chunk.metadata?.contentType) types.add(chunk.metadata.contentType)
    })
  }
  return Array.from(types)
})

// 显示所有 chunk 的情绪标签（去重）
const allMoods = computed(() => {
  const moods = new Set()
  const record = rootRecord.value
  if (record.chunks) {
    record.chunks.forEach(chunk => {
      (chunk.metadata?.mood || []).forEach(m => moods.add(m))
    })
  }
  return Array.from(moods)
})

// 检查是否有待审核的记录
const hasPendingReview = computed(() =>
  props.records.some(r => r.status === 'reviewing')
)

// 检查是否有处理中的记录
const hasProcessing = computed(() =>
  props.records.some(r => r.status === 'processing')
)
</script>

<template>
  <div :class="['split-card', { active, 'has-pending': hasPendingReview }]" @click="emit('click')">
    <!-- 头部信息 -->
    <div class="record-meta">
      <span class="record-time">{{ timeText }}</span>
      <div class="record-tags">
        <span v-if="hasProcessing" class="tag tag-processing">AI 整理中</span>
        <span v-if="hasPendingReview" class="tag tag-pending">待审核</span>
        <span class="tag tag-split">已拆分 {{ totalCount }} 条</span>
      </div>
    </div>

    <!-- 原始内容摘要 -->
    <div class="record-content">
      {{ rootRecord.segment?.[0]?.substring(0, 60) || rootRecord.content.substring(0, 60) }}{{ (rootRecord.segment?.[0] || rootRecord.content).length > 60 ? '...' : '' }}
    </div>

    <!-- 拆分后的标题预览 -->
    <div class="split-titles">
      <span v-for="(title, i) in chunkTitles" :key="i" class="split-title-item">
        <span class="split-index">{{ i + 1 }}</span>
        {{ title }}
      </span>
    </div>

    <!-- 标签汇总 -->
    <div class="record-keywords" v-if="allTypes.length > 0 || allMoods.length > 0">
      <span v-for="t in allTypes" :key="t" class="tag tag-type">{{ typeMap[t] || t }}</span>
      <span
        v-for="m in allMoods"
        :key="m"
        :class="['tag', 'tag-mood', MOOD_COLOR_MAP[m] || '']"
      >{{ moodMap[m] || m }}</span>
    </div>
  </div>
</template>

<style scoped>
.split-card {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 16px 18px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
  border: 0.5px solid var(--border);
  border-left: 4px solid var(--accent-light);
  cursor: pointer;
  transition: all 0.15s ease;
}

.split-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.split-card:active {
  transform: scale(0.98);
}

.split-card.active {
  border-color: var(--accent);
  background: var(--accent-light);
}

.split-card.has-pending {
  border-left-color: var(--warning);
}

/* Meta */
.record-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.record-time {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
  font-family: var(--font-mono);
}

.record-tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

/* 原始内容 */
.record-content {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 拆分标题预览 */
.split-titles {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  margin-bottom: 10px;
}

.split-title-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.split-index {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Tags */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 500;
}

.tag-type {
  background: var(--accent-light);
  color: var(--accent);
}

.tag-mood {
  background: var(--success-light);
  color: var(--success);
}

.tag-mood.anxious {
  background: var(--warning-light);
  color: var(--warning);
}

.tag-mood.sad {
  background: var(--danger-light);
  color: var(--danger);
}

.tag-mood.tired {
  background: #F3F0FF;
  color: #7C3AED;
}

.tag-split {
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}

.tag-processing {
  background: var(--processing-light);
  color: var(--processing);
  animation: tagPulse 2s ease-in-out infinite;
}

.tag-pending {
  background: var(--warning-light);
  color: var(--warning);
}

@keyframes tagPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Keywords */
.record-keywords {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
</style>
