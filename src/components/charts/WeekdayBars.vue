<script setup>
/**
 * WeekdayBars —— 一周节奏柱状（纯 SVG）
 *
 * 7 根小柱（周一~周日，bucket 周一=0），柱高 = count/max 占比，墨蓝填充。
 * hover 原生 <title> 数值；柱高 CSS transition 0.4s。
 */
import { computed } from 'vue'
import ChartEmpty from './ChartEmpty.vue'

const props = defineProps({
  /** [{ bucket: 0~6（周一=0）, count }]，后端已补零全量 */
  data: { type: Array, default: () => [] },
})

const LABELS = ['一', '二', '三', '四', '五', '六', '日']
const BAR_W = 10
const GAP = 8
const VIEW_H = 40
const LABEL_H = 12

/** 柱几何：按 bucket 排位补齐（缺失按 0），高度占比 */
const bars = computed(() => {
  const max = Math.max(0, ...props.data.map(d => d.count || 0))
  return LABELS.map((label, i) => {
    const d = props.data.find(x => x.bucket === i)
    const count = d?.count || 0
    const h = max ? (count / max) * (VIEW_H - 2) : 0
    return { label, count, h, x: i * (BAR_W + GAP) + GAP / 2, y: VIEW_H - h }
  })
})

const width = 7 * (BAR_W + GAP)
</script>

<template>
  <ChartEmpty v-if="!data.length" />
  <div v-else class="weekday-bars">
    <svg :viewBox="`0 0 ${width} ${VIEW_H}`" preserveAspectRatio="none" role="img" aria-label="一周记录节奏">
      <rect
        v-for="(b, i) in bars"
        :key="i"
        class="wd-bar"
        :x="b.x" :y="b.y" :width="BAR_W" :height="b.h" rx="2.5"
        fill="var(--accent)"
      >
        <title>周{{ b.label }} · {{ b.count }} 条</title>
      </rect>
    </svg>
    <div class="wd-labels" aria-hidden="true">
      <span v-for="b in bars" :key="b.label" class="wd-label">{{ b.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.weekday-bars { width: 100%; }
.weekday-bars svg { display: block; width: 100%; height: 56px; }
.wd-bar { transition: y .4s ease, height .4s ease; opacity: .82; }
.wd-bar:hover { opacity: 1; }
/* 7 等分网格对齐柱位（GAP 在 viewBox 内，故用 padding 对齐近似） */
.wd-labels { display: grid; grid-template-columns: repeat(7, 1fr); margin-top: 3px; }
.wd-label {
  text-align: center;
  font-family: var(--font-mono); font-size: 9.5px; color: var(--text-low);
}
</style>
