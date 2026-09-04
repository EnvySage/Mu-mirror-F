<script setup>
import { computed } from 'vue'
import { timeAgo } from '@/utils/time'
import { typeMap, moodMap } from '@/constants/tags'
import { MOOD_COLOR } from '@/constants/moodColor'

const props = defineProps({
  record: { type: Object, required: true },
  active: { type: Boolean, default: false },
})

const emit = defineEmits(['open', 'retry', 'delete'])

const status = computed(() => props.record.status)
const timeText = computed(() => timeAgo(props.record.created_at))

const chunks = computed(() => props.record.chunks || [])
const firstChunk = computed(() => chunks.value[0])
const isMulti = computed(() => chunks.value.length > 1)

/** done/reviewing 卡片标题：多片段 "A 等 N 件事" */
const title = computed(() => {
  const t = firstChunk.value?.metadata?.title
  if (!t) return '（待分类）'
  return isMulti.value ? `${t} 等 ${chunks.value.length} 件事` : t
})

const summary = computed(() => firstChunk.value?.metadata?.summary || '')

const types = computed(() =>
  [...new Set(chunks.value.map(c => c.metadata?.contentType).filter(Boolean))]
)

const moodChips = computed(() => (firstChunk.value?.metadata?.mood || []).slice(0, 2))

/** 处理中摘要截断 */
const processingPreview = computed(() => {
  const c = props.record.content || ''
  return c.length > 40 ? c.slice(0, 40) + '…' : c
})
</script>

<template>
  <!-- processing：转圈 + "AI 整理中" -->
  <div v-if="status === 'processing'" class="record-card card processing" @click="emit('open')">
    <div class="record-meta">
      <span class="record-time">{{ timeText }}</span>
      <span class="tag tag-processing"><span class="spinner" />AI 整理中</span>
    </div>
    <div class="record-summary">{{ processingPreview }}</div>
  </div>

  <!-- failed：红字原因 + 重试 + 删除 -->
  <div v-else-if="status === 'failed'" class="record-card card failed" @click="emit('open')">
    <div class="record-meta">
      <span class="record-time">{{ timeText }}</span>
      <span class="tag" style="color:var(--danger);box-shadow:inset 0 0 0 1px rgba(255,107,129,.35)">失败</span>
    </div>
    <div class="record-summary">{{ record.content }}</div>
    <div class="status-failed-row">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
      {{ record.fail_reason || '处理失败' }}
    </div>
    <div class="failed-ops">
      <button class="chip" style="color:var(--cyan)" @click.stop="emit('retry', record)">重试</button>
      <button class="chip" style="color:var(--danger)" @click.stop="emit('delete', record)">删除</button>
    </div>
  </div>

  <!-- reviewing / done -->
  <div
    v-else
    :class="['record-card', 'card', status, { active }]"
    @click="emit('open')"
  >
    <div class="record-meta">
      <span class="record-time">{{ timeText }}</span>
      <div class="record-tags">
        <span v-for="t in types" :key="t" class="tag tag-type">{{ typeMap[t] || t }}</span>
        <span v-if="status === 'reviewing'" class="tag tag-processing">待审核</span>
        <span v-for="m in moodChips" :key="m" class="tag">
          <span class="dot" :style="{ background: MOOD_COLOR[m] || '#999' }" />{{ moodMap[m] || m }}
        </span>
      </div>
    </div>
    <div class="record-title">{{ title }}</div>
    <div class="record-summary">{{ summary }}</div>
    <div v-if="(firstChunk?.metadata?.keywords || []).length" class="record-keywords">
      <span v-for="k in firstChunk.metadata.keywords" :key="k" class="keyword">{{ k }}</span>
    </div>
    <div v-if="isMulti" class="record-footer">
      <span class="chunk-count">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
        {{ chunks.length }} 个片段
      </span>
    </div>
  </div>
</template>

<style scoped>
.record-card {
  padding: 14px 16px; margin-bottom: 10px; cursor: pointer;
  transition: all .18s; position: relative; overflow: hidden;
}
/* 左缘渐变光条 */
.record-card::before {
  content: ""; position: absolute; left: 0; top: 12px; bottom: 12px;
  width: 2.5px; border-radius: 3px; background: var(--accent-grad);
  opacity: 0; transition: opacity .18s;
}
.record-card:hover { background: var(--glass-2); }
.record-card:active { transform: scale(.985); }
.record-card.active::before,
.record-card.reviewing::before { opacity: 1; }
.record-card.processing::before, .record-card.failed::before { background: none; }

.record-meta {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;
}
.record-time { font-family: var(--font-mono); font-size: 11px; color: var(--text-low); }
.record-tags { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.record-title { font-size: 15.5px; font-weight: 600; line-height: 1.45; }
.record-summary {
  font-size: 13px; color: var(--text-mid); margin-top: 2px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.record-keywords { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.record-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
.chunk-count {
  font-family: var(--font-mono); font-size: 11px; color: var(--violet);
  display: inline-flex; align-items: center; gap: 5px;
}
.chunk-count svg { width: 12px; height: 12px; stroke: var(--violet); fill: none; stroke-width: 2; }

.failed-ops { display: flex; gap: 8px; margin-top: 10px; }
.failed-ops .chip { cursor: pointer; }
</style>
