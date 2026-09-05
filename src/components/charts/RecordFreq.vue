<script setup>
/**
 * RecordFreq —— 30 天记录频率迷你柱（纯 SVG）
 *
 * 每天 1 柱，高 = count/max 占比；无记录天 0 高但保留 1px 底座感。
 * hover 原生 <title>：日期 + 条数；柱高 CSS transition 0.4s。
 */
import { computed } from 'vue'
import ChartEmpty from './ChartEmpty.vue'

const props = defineProps({
  /** [{ date: 'yyyy-MM-dd', count }]，后端已按日期升序补零 */
  data: { type: Array, default: () => [] },
})

const GAP = 0.18
const VIEW_H = 30
const MIN_H = 0.6 /* 无记录天的底座感 */

const bars = computed(() => {
  const max = Math.max(0, ...props.data.map(d => d.count || 0))
  return props.data.map((d, i) => {
    const h = max ? Math.max((d.count / max) * (VIEW_H - 2), d.count ? MIN_H : MIN_H) : MIN_H
    return {
      x: i + GAP / 2,
      w: 1 - GAP,
      h,
      y: VIEW_H - h,
      count: d.count || 0,
      date: d.date,
    }
  })
})

/** title 日期短格式 MM-DD */
function shortDate(date) {
  return typeof date === 'string' ? date.slice(5) : date
}
</script>

<template>
  <ChartEmpty v-if="!data.length" />
  <svg
    v-else
    class="record-freq"
    :viewBox="`0 0 ${data.length} ${VIEW_H}`"
    preserveAspectRatio="none"
    role="img"
    aria-label="近 30 天记录频率"
  >
    <rect
      v-for="(b, i) in bars"
      :key="i"
      class="freq-bar"
      :class="{ zero: !b.count }"
      :x="b.x" :y="b.y" :width="b.w" :height="b.h"
      rx="0.3"
    >
      <title>{{ shortDate(b.date) }} · {{ b.count }} 条</title>
    </rect>
  </svg>
</template>

<style scoped>
.record-freq { display: block; width: 100%; height: 44px; }
.freq-bar { fill: var(--accent); opacity: .8; transition: y .4s ease, height .4s ease; }
.freq-bar:hover { opacity: 1; }
/* 无记录天：灰底座 */
.freq-bar.zero { fill: var(--line-strong); opacity: 1; }
</style>
