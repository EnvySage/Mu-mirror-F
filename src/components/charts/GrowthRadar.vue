<script setup>
import { computed } from 'vue'

const props = defineProps({
  axes: { type: Array, default: () => [] },
  thresholds: { type: Array, default: () => [] },
})

const cx = 140
const cy = 132
const radius = 83
const scores = computed(() => props.axes.map(axis => Math.max(0, Number(axis.total_points ?? axis.totalPoints ?? 0))))
/** 不使用固定阶段上限：按当前最高分动态取整，低分时图形也有明显形状。 */
const chartMax = computed(() => {
  const top = Math.max(0, ...scores.value)
  if (top <= 0) return 6
  const raw = top * 1.25
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 3 ? 3
    : normalized <= 5 ? 5 : normalized <= 6 ? 6 : normalized <= 9 ? 9 : 10
  return Math.max(6, nice * magnitude)
})
const angleFor = index => (-Math.PI / 2) + (index * 2 * Math.PI / Math.max(props.axes.length, 1))
const pointAt = (index, scale) => {
  const angle = angleFor(index)
  return { x: cx + Math.cos(angle) * radius * scale, y: cy + Math.sin(angle) * radius * scale }
}
const pointsFor = scale => props.axes.map((_, index) => {
  const point = pointAt(index, scale)
  return `${point.x.toFixed(1)},${point.y.toFixed(1)}`
}).join(' ')
const rings = computed(() => [1 / 3, 2 / 3, 1].map(frac => ({
  value: Math.round(chartMax.value * frac),
  points: pointsFor(frac),
})))
const spokes = computed(() => props.axes.map((axis, index) => {
  const end = pointAt(index, 1)
  const label = pointAt(index, 1.3)
  const score = Math.max(0, Number(axis.total_points ?? axis.totalPoints ?? 0))
  return { axis, end, label, value: chartMax.value > 0 ? Math.min(score, chartMax.value) : 0, score }
}))
const shape = computed(() => props.axes.map((axis, index) => {
  const score = Math.max(0, Number(axis.total_points ?? axis.totalPoints ?? 0))
  return pointAt(index, chartMax.value > 0 ? Math.min(score / chartMax.value, 1) : 0)
}).map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '))
</script>

<template>
  <div class="growth-radar-wrap">
    <svg v-if="axes.length === 5" class="growth-radar" viewBox="0 0 280 264" role="img" :aria-label="`五维成长雷达：${axes.map(axis => `${axis.name} ${axis.total_points ?? axis.totalPoints ?? 0} 分`).join('，')}`">
      <polygon v-for="ring in rings" :key="ring.value" :points="ring.points" class="radar-ring" />
      <line v-for="(item, index) in spokes" :key="`spoke-${item.axis.id}`" :x1="cx" :y1="cy" :x2="item.end.x" :y2="item.end.y" class="radar-spoke" />
      <polygon :points="shape" class="radar-area" />
      <circle v-for="(item, index) in spokes" :key="`dot-${item.axis.id}`" :cx="pointAt(index, chartMax > 0 ? Math.min(item.score / chartMax, 1) : 0).x" :cy="pointAt(index, chartMax > 0 ? Math.min(item.score / chartMax, 1) : 0).y" r="3.5" class="radar-point" />
      <text v-for="(item, index) in spokes" :key="`label-${item.axis.id}`" :x="item.label.x" :y="item.label.y" text-anchor="middle" class="radar-label">{{ item.axis.name }}</text>
    </svg>
    <div v-else class="growth-radar-unavailable" role="status">五维定义暂不可用，成长分数仍保留在下方账本中。</div>
    <p class="growth-radar-caption">图形按当前最高分动态缩放；累计明细不会封顶。</p>
  </div>
</template>

<style scoped>
.growth-radar-wrap{width:min(100%,320px);margin:0 auto}.growth-radar{display:block;width:100%;height:auto;overflow:visible}.radar-ring{fill:none;stroke:color-mix(in srgb,var(--on-dark,#d8e6ff) 28%,transparent);stroke-width:1}.radar-spoke{stroke:color-mix(in srgb,var(--on-dark,#d8e6ff) 24%,transparent);stroke-width:1}.radar-area{fill:color-mix(in srgb,var(--cyan,#64d8ff) 24%,transparent);stroke:var(--cyan,#64d8ff);stroke-width:2}.radar-point{fill:var(--cyan,#64d8ff);stroke:var(--night,#071a43);stroke-width:2}.radar-label{fill:var(--on-dark,#eef4ff);font-size:11px;font-weight:700}.growth-radar-caption{margin:2px 0 0;text-align:center;color:var(--on-dark,#c8d9f2);font-size:11px;line-height:1.5}.growth-radar-unavailable{padding:32px 8px;color:var(--on-dark,#c8d9f2);font-size:12px;text-align:center}
</style>
