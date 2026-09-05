<script setup>
/**
 * HourHeat —— 24 小时活跃热力条（纯 SVG）
 *
 * 24 格一行，颜色深浅 = count / max（墨蓝 alpha 0.08 → 1）。
 * 格下 0 / 6 / 12 / 18 / 23 刻度；hover 原生 <title> 显示时段+计数。
 */
import { computed } from 'vue'
import ChartEmpty from './ChartEmpty.vue'

const props = defineProps({
  /** [{ bucket: 0~23, count }]，后端已补零全量 */
  data: { type: Array, default: () => [] },
})

const CELL = 10
const GAP = 2
const CELL_H = 10

/** 24 格补齐（后端缺失时按 0 兜底），归一 alpha 0.08~1 */
const cells = computed(() => {
  const max = Math.max(0, ...props.data.map(d => d.count || 0))
  return Array.from({ length: 24 }, (_, b) => {
    const d = props.data.find(x => x.bucket === b)
    const count = d?.count || 0
    const alpha = max ? 0.08 + (count / max) * 0.92 : 0.08
    return { x: b * (CELL + GAP), count, alpha }
  })
})

/** 刻度：0 / 6 / 12 / 18 / 23 */
const ticks = [0, 6, 12, 18, 23]
const width = 24 * (CELL + GAP) - GAP
const tickX = b => b * (CELL + GAP) + (b === 23 ? CELL : CELL / 2)
</script>

<template>
  <ChartEmpty v-if="!data.length" />
  <div v-else class="hour-heat">
    <svg :viewBox="`0 0 ${width} ${CELL_H}`" preserveAspectRatio="none" role="img" aria-label="24 小时活跃分布">
      <title>按小时统计记录数（颜色越深越活跃）</title>
      <rect
        v-for="(c, i) in cells"
        :key="i"
        class="heat-cell"
        :x="c.x" y="0" :width="CELL" :height="CELL_H" rx="2"
        :fill="`rgba(44, 95, 232, ${c.alpha})`"
      >
        <title>{{ `${String(i).padStart(2, '0')}:00 时段 · ${c.count} 条记录` }}</title>
      </rect>
    </svg>
    <div class="hour-ticks" aria-hidden="true">
      <span
        v-for="t in ticks"
        :key="t"
        class="hour-tick"
        :style="{ left: (tickX(t) / width) * 100 + '%' }"
      >{{ t }}</span>
    </div>
  </div>
</template>

<style scoped>
.hour-heat { width: 100%; }
.hour-heat svg { display: block; width: 100%; height: 20px; }
/* preserveAspectRatio=none 会拉伸圆角，限制 rx 视觉 */
.heat-cell { transition: fill .4s ease; }
.hour-ticks { position: relative; height: 14px; margin-top: 3px; }
.hour-tick {
  position: absolute; transform: translateX(-50%);
  font-family: var(--font-mono); font-size: 9.5px; color: var(--text-low);
}
</style>
