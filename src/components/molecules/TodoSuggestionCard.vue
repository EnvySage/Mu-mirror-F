<script setup>
/**
 * 待办状态建议卡（侧栏 · 只读导航版）
 *
 * 本轮交互重构（用户定稿）：移除一切直调交互（不再有状态 chip / 确认 / 删除按钮）；
 * 整卡点击 → 跳转"证据来源记录"的修改页（待审记录的编辑/审核界面）。
 *
 * 数据源：todoStore.pendingSuggestions（GET /todos/pending-suggestions）。
 * 字段口径（snake_case，见 stores/todo.js typedef）：
 * id / todo_id / title / current_status / suggested_status /
 * evidence_excerpt / evidence_record_id / created_at
 */
import { computed } from 'vue'
import { taskStatusMap } from '@/constants/tags'

const props = defineProps({
  suggestion: { type: Object, required: true },
})

const emit = defineEmits(['open-record'])

/** 证据所在记录 id（点击目标 = 该记录的修改/审核页） */
const evidenceRecordId = computed(() =>
  props.suggestion.evidence_record_id ?? props.suggestion.evidenceRecordId ?? null)

const headline = computed(() => {
  const s = props.suggestion
  return `检测到「${s.title}」可能${taskStatusMap[s.suggested_status] || s.suggested_status}`
})

/** 证据摘录截 40 字 */
function excerptShort(text) {
  const t = String(text || '')
  return t.length > 40 ? t.slice(0, 40) + '…' : t
}

/** 日期（x月x日） */
function shortDate(s) {
  const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${Number(m[2])}月${Number(m[3])}日` : ''
}

/** 整卡点击 → 证据来源记录的修改/审核页 */
function open() {
  if (evidenceRecordId.value) emit('open-record', evidenceRecordId.value)
}
</script>

<template>
  <div
    class="sug-card"
    role="button"
    tabindex="0"
    :title="evidenceRecordId ? '打开证据来源记录' : ''"
    @click="open"
    @keydown.enter="open"
  >
    <div class="sug-head">
      <svg class="sug-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z" />
      </svg>
      <span class="sug-title-line">{{ headline }}</span>
    </div>

    <!-- 证据行：excerpt 截 40 字 + 日期（只读展示，点击整卡跳来源记录） -->
    <div v-if="suggestion.evidence_excerpt" class="sug-evidence" :title="suggestion.evidence_excerpt">
      <span class="sug-evidence-text">"{{ excerptShort(suggestion.evidence_excerpt) }}"</span>
      <span class="sug-evidence-date">{{ shortDate(suggestion.created_at) }}</span>
    </div>

    <span class="sug-hint">点击查看来源记录 →</span>
  </div>
</template>

<style scoped>
.sug-card {
  display: block; width: 100%; text-align: left; cursor: pointer;
  border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--ink-2); padding: 10px 11px;
  transition: box-shadow .15s, border-color .15s;
}
.sug-card:hover { box-shadow: inset 0 0 0 1px var(--accent); }
.sug-head { display: flex; align-items: flex-start; gap: 6px; }
.sug-spark { width: 12px; height: 12px; flex-shrink: 0; margin-top: 3px; stroke: var(--accent); fill: none; }
.sug-title-line { font-size: 12.5px; line-height: 1.55; color: var(--text-hi); font-weight: 500; word-break: break-word; }

.sug-evidence {
  display: block; width: 100%; margin-top: 7px;
  padding: 6px 8px; border-radius: var(--radius-sm);
  background: var(--card); box-shadow: inset 0 0 0 1px var(--line);
}
.sug-evidence-text { display: block; font-size: 11.5px; line-height: 1.6; color: var(--text-mid); }
.sug-evidence-date { display: block; margin-top: 3px; font-family: var(--font-mono); font-size: 10px; color: var(--text-low); }

.sug-hint {
  display: block; margin-top: 7px;
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .02em;
  color: var(--text-low);
}
</style>
