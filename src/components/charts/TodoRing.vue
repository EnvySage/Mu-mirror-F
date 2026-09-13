<script setup>
/**
 * TodoRing —— 待办完成度堆叠环（纯 SVG stroke-dasharray 分段）
 *
 * 环按三态堆叠：已完成（实心蓝）→ 进行中（淡蓝）→ 未开始（浅灰底环）。
 * 三态与图例一一对应。早期版本只画 completed 一段，图例却列了三态，
 * 结果"进行中"在环上没有任何对应视觉——图例与图形不同源，看着像统计错了。
 *
 * 中央 N/M 大数字 = completed/total。
 * 段几何：周长归一为 100，dasharray = [本段长, 剩余]，dashoffset = -前段累计长度
 * （把本段推到上一段末尾）。占比极小的段给 MIN_ARC 视觉保底，
 * 保底导致总长溢出时整组回退真实比例，保证不绕圈。
 */
import { computed } from 'vue'
import ChartEmpty from './ChartEmpty.vue'

const props = defineProps({
  /** { total, completed, notStarted|not_started, inProgress|in_progress, openItems } */
  todo: { type: Object, default: null },
})

const R = 15.9155 /* 周长 = 100 的半径，dasharray 直接用百分比 */
const C = 100
/** 单段视觉保底弧长（不参与数值口径） */
const MIN_ARC = 4

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

/** 堆叠段几何（已完成 / 进行中；未开始由底环表达） */
const segments = computed(() => {
  const { total, completed, inProgress } = norm.value
  if (!total) return []
  const raw = [(completed / total) * C, (inProgress / total) * C]
  const bumped = raw.map(v => (v > 0 && v < MIN_ARC ? MIN_ARC : v))
  const use = bumped[0] + bumped[1] <= C ? bumped : raw
  return [
    { key: 'done', len: use[0], offset: 0, count: completed },
    { key: 'doing', len: use[1], offset: -use[0], count: inProgress },
  ]
})

/** 单段悬浮：项数 + 占总数的百分比 */
function segTitle(seg) {
  const label = seg.key === 'done' ? '已完成' : '进行中'
  const share = norm.value.total ? Math.round((seg.count / norm.value.total) * 100) : 0
  return `${label} ${seg.count} 项 · 占 ${share}%`
}
</script>

<template>
  <ChartEmpty v-if="!norm.total" text="暂无待办数据" />
  <div
    v-else
    class="todo-ring"
    role="img"
    :aria-label="`待办完成 ${norm.completed}/${norm.total} · 进行中 ${norm.inProgress} · 未开始 ${norm.notStarted}`"
  >
    <div class="ring-wrap">
      <svg viewBox="0 0 40 40" role="presentation">
        <!-- 底环 = 未开始 -->
        <circle class="ring-track" cx="20" cy="20" :r="R" fill="none" stroke-width="4">
          <title>未开始 {{ norm.notStarted }}</title>
        </circle>
        <circle
          v-for="seg in segments"
          :key="seg.key"
          :class="['ring-seg', `seg-${seg.key}`]"
          cx="20" cy="20" :r="R" fill="none" stroke-width="4"
          :stroke-dasharray="`${seg.len} ${C - seg.len}`"
          :stroke-dashoffset="seg.offset"
          transform="rotate(-90 20 20)"
        >
          <title>{{ segTitle(seg) }}</title>
        </circle>
      </svg>
      <div class="ring-num">
        <span class="ring-n">{{ norm.completed }}</span>
        <span class="ring-d">/{{ norm.total }}</span>
      </div>
    </div>
    <div class="ring-legend">
      <span class="ring-legend-item"><i class="dot dot-solid" />已完成 {{ norm.completed }}</span>
      <span class="ring-legend-item"><i class="dot dot-half" />进行中 {{ norm.inProgress }}</span>
      <span class="ring-legend-item"><i class="dot dot-hollow" />未开始 {{ norm.notStarted }}</span>
    </div>
    <div class="ring-note">仅统计 todo / plan 类型片段</div>
  </div>
</template>

<style scoped>
.todo-ring { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ring-wrap { position: relative; width: 108px; height: 108px; }
.ring-wrap svg { display: block; width: 100%; height: 100%; }
/* 底环 = 未开始 */
.ring-track { stroke: var(--ink-2); }
/* 堆叠段：已完成实心、进行中淡蓝（与图例的"半蓝"呼应）
   注意：堆叠环不用 stroke-linecap: round——圆头会盖到相邻段的起点 */
.ring-seg { transition: stroke-dasharray .4s ease, stroke-dashoffset .4s ease; }
.seg-done { stroke: var(--accent); }
.seg-doing { stroke: var(--accent); opacity: .45; }
.ring-num {
  position: absolute; inset: 0;
  display: flex; align-items: baseline; justify-content: center;
  padding-top: 38px;
}
.ring-n { font-family: var(--font-display); font-size: 26px; font-weight: 600; color: var(--text-hi); }
.ring-d { font-size: 12px; color: var(--text-low); }

.ring-legend { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.ring-legend-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--text-mid); }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.dot-solid { background: var(--accent); }
.dot-hollow { box-shadow: inset 0 0 0 1.5px var(--text-low); }
/* 进行中：半圆（conic 硬切，无渐变） */
.dot-half { background: conic-gradient(var(--accent) 0 50%, transparent 50% 100%); box-shadow: inset 0 0 0 1.5px var(--accent); }

/* 口径注释（任务 B）：低重小字 */
.ring-note { font-size: 10.5px; color: var(--text-low); margin-top: -2px; }
</style>
