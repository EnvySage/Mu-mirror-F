<script setup>
/**
 * RhythmDist —— 活跃节律分布（24 小时 + 一周，纯 SVG，两组共用同一高度基准）
 *
 * 左 24 根（小时桶）、右 7 根（周一=0），同一张卡内并排。
 * 关键点：两组共用 max 归一化 —— 柱高可跨组直接比较，
 * "最活跃的时段"与"最活跃的一天"放在一起才有意义（原先是两张各自归一化的独立卡）。
 *
 * 窄屏（<900px）改为上下堆叠，避免 24 根柱被压成发丝。
 */
import { computed } from 'vue'
import ChartEmpty from './ChartEmpty.vue'

const props = defineProps({
  /** [{ bucket: 0~23, count }]，后端已补零全量 */
  hours: { type: Array, default: () => [] },
  /** [{ bucket: 0~6（周一=0）, count }]，后端已补零全量 */
  weekdays: { type: Array, default: () => [] },
})

const VIEW_H = 100
/** 无记录桶的最小底座高度（保持"刻度尺"感） */
const MIN_H = 3
const HOUR_TICKS = [0, 6, 12, 18, 23]
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const WEEK_FULL = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const hasData = computed(() => props.hours.length > 0 || props.weekdays.length > 0)

/** 跨组共用峰值 */
const max = computed(() => Math.max(0, ...[...props.hours, ...props.weekdays].map(d => d.count || 0)))

/** 通用柱几何：按 bucket 补位，高度按共用 max 归一 */
function build(list, slots, gap) {
  return Array.from({ length: slots }, (_, i) => {
    const count = list.find(x => x.bucket === i)?.count || 0
    const h = count && max.value ? Math.max((count / max.value) * (VIEW_H - MIN_H), MIN_H) : MIN_H
    return { x: i + gap / 2, w: 1 - gap, y: VIEW_H - h, h, count }
  })
}

const hourBars = computed(() => build(props.hours, 24, 0.28))
const weekBars = computed(() => build(props.weekdays, 7, 0.4))
</script>

<template>
  <ChartEmpty v-if="!hasData" text="暂无节律数据" />
  <div v-else class="rhythm">
    <div class="rhythm-block">
      <div class="rhythm-cap">24 小时时段</div>
      <svg
        class="rhythm-svg"
        :viewBox="`0 0 24 ${VIEW_H}`"
        preserveAspectRatio="none"
        role="img"
        aria-label="24 小时活跃分布"
      >
        <rect
          v-for="(b, i) in hourBars"
          :key="i"
          class="rhythm-bar"
          :x="b.x" :y="b.y" :width="b.w" :height="b.h"
          :style="{ '--d': i * 18 + 'ms' }"
        >
          <title>{{ `${String(i).padStart(2, '0')}:00 时段 · ${b.count} 条记录` }}</title>
        </rect>
      </svg>
      <div class="rhythm-ticks" aria-hidden="true">
        <span
          v-for="t in HOUR_TICKS"
          :key="t"
          class="rhythm-tick"
          :style="{ left: ((t + 0.5) / 24) * 100 + '%' }"
        >{{ t }}</span>
      </div>
    </div>

    <div class="rhythm-block narrow">
      <div class="rhythm-cap">一周节奏</div>
      <svg
        class="rhythm-svg"
        :viewBox="`0 0 7 ${VIEW_H}`"
        preserveAspectRatio="none"
        role="img"
        aria-label="一周记录节奏"
      >
        <rect
          v-for="(b, i) in weekBars"
          :key="i"
          class="rhythm-bar"
          :x="b.x" :y="b.y" :width="b.w" :height="b.h"
          :style="{ '--d': i * 40 + 'ms' }"
        >
          <title>{{ `${WEEK_FULL[i]} · ${b.count} 条记录` }}</title>
        </rect>
      </svg>
      <div class="rhythm-week" aria-hidden="true">
        <span v-for="l in WEEK_LABELS" :key="l" class="rhythm-tick">{{ l }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rhythm { display: flex; gap: 26px; align-items: flex-start; }
.rhythm-block { flex: 1 1 auto; min-width: 0; }
/* 24 槽 : 7 槽 ≈ 3.4 : 1，按槽数量分配宽度，柱宽观感一致 */
.rhythm-block.narrow { flex: 0 0 24%; }

.rhythm-cap {
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em;
  color: var(--text-low); margin-bottom: 8px;
}
.rhythm-svg { display: block; width: 100%; height: 108px; }
/* 入场生长：两组柱各自从底部立起；fill-mode=backwards 保证动画结束后不抢占 hover 的 transform */
.rhythm-bar {
  fill: var(--accent); opacity: .85;
  transition: y .4s ease, height .4s ease, opacity .15s ease;
  transform-box: fill-box;
  transform-origin: bottom;
  animation: rhythmGrow .45s cubic-bezier(.22, .8, .3, 1) var(--d, 0ms) backwards;
}
.rhythm-bar:hover { opacity: 1; }
@keyframes rhythmGrow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

.rhythm-ticks { position: relative; height: 13px; margin-top: 4px; }
.rhythm-tick {
  font-family: var(--font-mono); font-size: 9.5px; color: var(--text-low);
}
.rhythm-ticks .rhythm-tick { position: absolute; transform: translateX(-50%); }
.rhythm-week { display: grid; grid-template-columns: repeat(7, 1fr); height: 13px; margin-top: 4px; }
.rhythm-week .rhythm-tick { text-align: center; }

@media (min-width: 900px) { .rhythm-svg { height: 132px; } }
/* 窄屏上下堆叠：24 根柱挤在一行会变成发丝。
   注意 column 方向下 align-items 管的是横向——flex-start 会让子块收缩成内容宽
   （桌面 row 方向它只管纵向，所以这个坑只在移动端炸），必须显式恢复横向拉伸 */
@media (max-width: 899px) {
  .rhythm { flex-direction: column; gap: 16px; }
  .rhythm-block { align-self: stretch; }
  .rhythm-block.narrow { flex: 1 1 auto; }
}
</style>
