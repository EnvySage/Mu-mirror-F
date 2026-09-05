<script setup>
/**
 * TodoRing —— 待办完成度环（纯 SVG stroke-dasharray）
 *
 * 中央 N/M 大数字，环 = completed/total；环下 not_started / in_progress 图例。
 * 环长 CSS transition 0.4s。total=0 时显示空环 + 暂无数据文案。
 */
import { computed } from 'vue'
import ChartEmpty from './ChartEmpty.vue'

const props = defineProps({
  /** { total, completed, notStarted|not_started, inProgress|in_progress, openItems } */
  todo: { type: Object, default: null },
})

const R = 15.9155 /* 周长 = 100 的半径，dasharray 直接用百分比 */
const C = 100

const norm = computed(() => {
  const t = props.todo || {}
  return {
    total: t.total || 0,
    completed: t.completed || 0,
    notStarted: t.not_started ?? t.notStarted ?? 0,
    inProgress: t.in_progress ?? t.inProgress ?? 0,
  }
})

const pct = computed(() => (norm.value.total ? Math.round((norm.value.completed / norm.value.total) * 100) : 0))

/** 完成段弧长（dasharray 前值），其余为底环 */
const dash = computed(() => `${pct.value} ${C - pct.value}`)
</script>

<template>
  <ChartEmpty v-if="!norm.total" />
  <div v-else class="todo-ring" role="img" :aria-label="`待办完成 ${norm.completed}/${norm.total}`">
    <div class="ring-wrap">
      <svg viewBox="0 0 40 40" role="presentation">
        <circle class="ring-track" cx="20" cy="20" :r="R" fill="none" stroke-width="4" />
        <circle
          class="ring-fill"
          cx="20" cy="20" :r="R" fill="none" stroke-width="4"
          stroke-linecap="round"
          :stroke-dasharray="dash"
          transform="rotate(-90 20 20)"
        >
          <title>{{ norm.completed }}/{{ norm.total }} · {{ pct }}%</title>
        </circle>
      </svg>
      <div class="ring-num">
        <span class="ring-n">{{ norm.completed }}</span>
        <span class="ring-d">/{{ norm.total }}</span>
      </div>
    </div>
    <div class="ring-legend">
      <span class="ring-legend-item"><i class="dot dot-hollow" />未开始 {{ norm.notStarted }}</span>
      <span class="ring-legend-item"><i class="dot dot-half" />进行中 {{ norm.inProgress }}</span>
    </div>
  </div>
</template>

<style scoped>
.todo-ring { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ring-wrap { position: relative; width: 108px; height: 108px; }
.ring-wrap svg { display: block; width: 100%; height: 100%; }
.ring-track { stroke: var(--ink-2); }
.ring-fill { stroke: var(--accent); transition: stroke-dasharray .4s ease; }
.ring-num {
  position: absolute; inset: 0;
  display: flex; align-items: baseline; justify-content: center;
  padding-top: 38px;
}
.ring-n { font-family: var(--font-display); font-size: 26px; font-weight: 600; color: var(--text-hi); }
.ring-d { font-size: 12px; color: var(--text-low); }

.ring-legend { display: flex; gap: 14px; }
.ring-legend-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--text-mid); }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.dot-hollow { box-shadow: inset 0 0 0 1.5px var(--text-low); }
/* 进行中：半圆（conic 硬切，无渐变） */
.dot-half { background: conic-gradient(var(--accent) 0 50%, transparent 50% 100%); box-shadow: inset 0 0 0 1.5px var(--accent); }
</style>
