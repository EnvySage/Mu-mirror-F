<script setup>
/**
 * MoodBand —— 30 天情绪堆叠色带（纯 SVG）
 *
 * 每天一根竖条，条内按当日各情绪 count 占比分色段（moodColor 13 色）。
 * viewBox 30×40：条宽 1 - gap 0.08，y 轴按总 count 等比切段（自上而下）。
 * hover 原生 <title>：整条显示日期+各情绪明细，单色段 title 显示当天单一情绪；
 * CSS transition 0.4s。图例行（实际出现过的情绪色点+中文名）由宿主页渲染。
 */
import { computed } from 'vue'
import { MOOD_COLOR } from '@/constants/moodColor'
import { moodMap } from '@/constants/tags'
import ChartEmpty from './ChartEmpty.vue'

const props = defineProps({
  /** [{ date: 'yyyy-MM-dd', moods: [{ mood, count }] }]，后端已按日期升序补零 */
  data: { type: Array, default: () => [] },
})

const GAP = 0.08
const VIEW_H = 40

/** 竖条几何：x 定位 + 分段 rect（y 自上而下，比例 = count/当日总数） */
const bars = computed(() => props.data.map((d, i) => {
  const total = d.moods.reduce((a, m) => a + (m.count || 0), 0)
  const title = total
    ? `${d.date}  共 ${total} 条：` + d.moods.map(m => `${moodMap[m.mood] || m.mood} ${m.count}`).join(' · ')
    : `${d.date}  无记录`
  let y = 0
  const segs = total
    ? d.moods
        .filter(m => m.count > 0)
        .map(m => {
          const h = (m.count / total) * VIEW_H
          const rect = { y, h, color: MOOD_COLOR[m.mood] || '#A8A8A0', mood: m.mood, count: m.count }
          y += h
          return rect
        })
    : []
  return { x: i + GAP / 2, w: 1 - GAP, title, segs, empty: !total }
}))
</script>

<template>
  <ChartEmpty v-if="!data.length" />
  <svg
    v-else
    class="mood-band"
    :viewBox="`0 0 ${data.length} ${VIEW_H}`"
    preserveAspectRatio="none"
    role="img"
    aria-label="近 30 天情绪分布"
  >
    <g v-for="(bar, i) in bars" :key="i">
      <title>{{ bar.title }}</title>
      <!-- 无记录天：次级底灰条占位，保持节奏 -->
      <rect
        v-if="bar.empty"
        :x="bar.x" y="0" :width="bar.w" :height="VIEW_H"
        rx="0.25" fill="var(--ink-2)"
      />
      <rect
        v-for="(seg, j) in bar.segs"
        :key="j"
        :x="bar.x" :y="seg.y" :width="bar.w" :height="seg.h"
        :fill="seg.color"
        style="transition: y .4s ease, height .4s ease"
      >
        <title>{{ `${bar.title.split('  ')[0]} · ${moodMap[seg.mood] || seg.mood} ${seg.count} 条` }}</title>
      </rect>
    </g>
  </svg>
</template>

<style scoped>
.mood-band { display: block; width: 100%; height: 52px; }
.mood-band rect { transition: y .4s ease, height .4s ease; }
</style>
