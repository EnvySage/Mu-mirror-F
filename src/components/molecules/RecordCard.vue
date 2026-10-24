<script setup>
import { computed } from 'vue'
import { timeAgo } from '@/utils/time'
import { typeMap, moodMap } from '@/constants/tags'
import { MOOD_COLOR } from '@/constants/moodColor'
import { vCardLift } from '@/composables/useCardLift'

const props = defineProps({
  record: { type: Object, required: true },
  active: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },
  arrival: { type: Boolean, default: false },
  layoutVariant: { type: Number, default: 0 },
  editorial: { type: Boolean, default: false },
})

const emit = defineEmits(['open', 'retry', 'delete'])

const status = computed(() => props.record.status)
const memoryDisabled = computed(() => String(props.record.memory_state ?? props.record.memoryState ?? '').toUpperCase() === 'DISABLED')
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
const userTags = computed(() => {
  const values = new Set()
  for (const chunk of chunks.value) {
    const tags = chunk.metadata?.userTags ?? chunk.metadata?.user_tags ?? chunk.metadata?.tags ?? []
    if (Array.isArray(tags)) tags.forEach(tag => { if (tag) values.add(String(tag)) })
  }
  return [...values]
})

/** 处理中摘要截断 */
const processingPreview = computed(() => {
  const c = props.record.content || ''
  return c.length > 40 ? c.slice(0, 40) + '…' : c
})
</script>

<template>
  <div :class="['record-layout', `layout-${layoutVariant}`, { featured, editorial }]" :data-list-key="`record-${record.id}`">
  <span v-if="editorial" class="record-paper-label" aria-hidden="true">{{ status === 'record_only' ? 'JUST A MOMENT' : status === 'reviewing' ? 'TO BE CONTINUED' : status === 'processing' ? 'IN THE MAKING' : status === 'failed' ? 'TRY AGAIN' : 'LIFE IN PROGRESS' }}</span>
  <!-- processing：转圈 + "AI 整理中" -->
  <div v-card-lift v-if="status === 'processing'" :class="['record-card', 'card', 'processing', `layout-${layoutVariant}`, { active, featured, arrival }]" :data-object-source="'record'" :data-object-id="record.id" role="button" tabindex="0" aria-label="查看处理中的记录" @keydown.enter.self="emit('open', $event)" @keydown.space.self.prevent="emit('open', $event)" @click="emit('open', $event)">
    <div class="record-meta">
      <span class="record-time">{{ timeText }}</span>
      <span class="tag tag-processing"><span class="spinner" />AI 整理中</span>
    </div>
    <div class="record-summary">{{ processingPreview }}</div>
  </div>

  <!-- failed：红字原因 + 重试 + 删除 -->
  <div v-card-lift v-else-if="status === 'failed'" :class="['record-card', 'card', 'failed', `layout-${layoutVariant}`, { active, featured, arrival }]" :data-object-source="'record'" :data-object-id="record.id" role="button" tabindex="0" @keydown.enter.self="emit('open', $event)" @keydown.space.self.prevent="emit('open', $event)" @click="emit('open', $event)">
    <div class="record-meta">
      <span class="record-time">{{ timeText }}</span>
      <span class="tag" style="color:var(--danger);background:var(--danger-bg)">失败</span>
    </div>
    <div class="record-summary">{{ record.content }}</div>
    <div class="status-failed-row">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
      {{ record.fail_reason || '处理失败' }}
    </div>
    <div class="failed-ops">
      <button class="chip chip-accent" @click.stop="emit('retry', record)">重试</button>
      <button class="chip chip-danger" @click.stop="emit('delete', record)">删除</button>
    </div>
  </div>

  <div v-card-lift v-else-if="status === 'record_only'"
    :class="['record-card', 'card', status, `layout-${layoutVariant}`, { active, featured, arrival }]"
    data-object-source="record"
    :data-object-id="record.id"
    role="button" tabindex="0" :aria-label="record.content || '仅记录'"
    @keydown.enter.self="emit('open', $event)" @keydown.space.self.prevent="emit('open', $event)"
    @click="emit('open', $event)"
  >
    <div class="record-meta">
      <span class="record-time">{{ timeText }}</span>
      <span class="tag tag-record-only">仅记录 · 尚未交给 AI</span>
    </div>
    <div class="record-summary record-raw-preview">{{ record.content || '（空记录）' }}</div>
  </div>

  <!-- reviewing / done -->
  <div v-card-lift
    v-else
    :class="['record-card', 'card', status, `layout-${layoutVariant}`, { active, featured, arrival }]"
    data-object-source="record"
    :data-object-id="record.id"
    role="button" tabindex="0" :aria-label="title"
    @keydown.enter.self="emit('open', $event)" @keydown.space.self.prevent="emit('open', $event)"
    @click="emit('open', $event)"
  >
    <div class="record-meta">
      <span class="record-time">{{ timeText }}</span>
      <div class="record-tags">
        <span v-for="t in types" :key="t" class="tag tag-type">{{ typeMap[t] || t }}</span>
        <span v-if="status === 'reviewing'" class="tag tag-processing">待审核</span>
        <span v-if="memoryDisabled" class="tag tag-memory-removed">已永久移出记忆</span>
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
    <div v-if="userTags.length" class="record-user-tags" aria-label="自由标签">
      <span v-for="tag in userTags" :key="tag">{{ tag }}</span>
    </div>
    <div v-if="isMulti" class="record-footer">
      <span class="chunk-count">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
        {{ chunks.length }} 个片段
      </span>
    </div>
  </div>
  </div>
</template>

<style scoped>
.record-card {
  padding: 14px 16px; margin-bottom: 10px; cursor: pointer; transition: box-shadow .18s ease, border-color .18s ease;
  position: relative; overflow: hidden;
}
.record-user-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.record-user-tags span{padding:2px 7px;border:1px solid #65d9ff65;border-radius:3px;color:var(--cyan,#65d9ff);font-size:10px;line-height:1.4}
/* 左缘墨蓝条 */
.record-card::before {
  content: ""; position: absolute; left: 0; top: 12px; bottom: 12px;
  width: 3px; border-radius: 2px; background: var(--accent);
  opacity: 0; transition: opacity .18s;
}
.record-card.active::before,
.record-card.reviewing::before { opacity: 1; }
.record-card.processing::before, .record-card.failed::before { background: none; }
.record-card.processing { border-color: var(--processing); }
.record-card.failed { border-color: var(--danger); }
.record-card.record_only::before { opacity: 1; background: var(--cyan); }
.tag-record-only { color: var(--cyan); background: #00d9ff16; }
.tag-memory-removed { color: #ffb3c0; background: #ff4b6e1f; border: 1px solid #ff8fa366; }
.record-raw-preview { white-space: pre-line; }

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
  font-family: var(--font-mono); font-size: 11px; color: var(--accent);
  display: inline-flex; align-items: center; gap: 5px;
}
.chunk-count svg { width: 12px; height: 12px; stroke: var(--accent); fill: none; stroke-width: 2; }

.failed-ops { display: flex; gap: 8px; margin-top: 10px; }
.failed-ops .chip { cursor: pointer; }
.chip-accent { color: var(--accent); }
.chip-danger { color: var(--danger); }

.record-card { padding:20px 22px; border-radius:2px; border:1px solid #d9e6ff; box-shadow:4px 5px 0 #020c3425; animation:none; }
.record-card.arrival { animation:record-arrival 1.4s ease both; }
@keyframes record-arrival { 0%,100%{box-shadow:4px 5px 0 #020c3425} 25%,65%{box-shadow:0 0 0 3px var(--cyan),0 0 24px #50edfa60} }
.record-card::before { top:0; bottom:0; width:4px; border-radius:0; }
.record-card:hover, .record-card:focus-visible { border-color:var(--cyan); box-shadow:5px 6px 0 #020c3445; }
.record-title { font-family:var(--font); font-size:16px; font-weight:800; line-height:1.6; }
.record-summary { line-height:1.9; font-size:12px; }
.record-time { font-family:var(--font); font-size:10px; }
.record-card :deep(.tag) { border-radius:2px; font-size:10px; padding:2px 6px; }
@media(max-width:599px){.record-card{padding:17px 18px}.record-meta{flex-wrap:wrap;gap:7px}.record-title{font-size:15px}}
/* Picking a record feels like lifting it off the stack. */
.record-layout { min-width:0; width:100%; }
.record-card { width:100%; transform-origin:50% 75%; transition:box-shadow .2s,border-color .2s; }
.record-card.active { border-color:var(--cyan); box-shadow:0 0 0 1px #50edfa50,8px 14px 0 #020c3440; }
@media(hover:hover) {
 .record-card:hover { z-index:3; box-shadow:0 13px 28px #01092340,0 0 0 1px #50edfa70; }
}
@media(prefers-reduced-motion:reduce) { .record-card { transition:none; } .record-card.arrival { animation:none; border-color:var(--cyan); } }
</style>
