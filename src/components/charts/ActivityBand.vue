<script setup>
/**
 * ActivityBand —— 30 天活动带（情绪 × 记录数 单轴融合图，纯 SVG）
 *
 * 一根柱子同时承载两个维度，从结构上消掉"两张各自成卡、各自留白"的老问题：
 *   · 高度 = 当日记录数 / 窗口峰值（口径 = record_daily）
 *   · 柱内按当日各情绪 count 占比自上而下分色（口径 = mood_daily）
 * 两者本来就共用同一根 30 天时间轴，融合后天然对齐，不需要再对两套坐标做额外同步。
 *
 * 稀疏场景：无记录天只留浅灰底座（不代表"空"，而是"这天没写"）；
 * 有记录但当天未标注情绪时整柱中性灰，不与情绪色混淆。
 * 柱下每 7 天一个日期刻度，首尾贴边对齐，避免末位日期被容器右缘裁切或与前一格挤叠。
 *
 * 高度：移动端 96px、≥900px 150px —— 全宽单卡按内容定高，不做拉伸。
 */
import { computed } from 'vue'
import { MOOD_COLOR } from '@/constants/moodColor'
import { moodMap } from '@/constants/tags'
import ChartEmpty from './ChartEmpty.vue'

const props = defineProps({
  /** [{ date, count }] 记录频率，后端已按日期升序补零 */
  daily: { type: Array, default: () => [] },
  /** [{ date, moods: [{ mood, count }] }] 情绪，与 daily 同一日历口径 */
  moods: { type: Array, default: () => [] },
})

const GAP = 0.1
/** 逻辑视高（preserveAspectRatio=none，由 CSS 高度决定实际尺寸） */
const VIEW_H = 100
/** 无记录天底座高度 */
const BASE_H = 6
/** 有记录柱的最小可见高度：1 条 / 峰值很大时别短到看不见 */
const MIN_H = 14
/** 有记录但无情绪标注时的中性色 */
const NEUTRAL = '#C9C6BD'

/** date → 当日情绪分段 */
const moodByDate = computed(() => {
  const map = new Map()
  for (const d of props.moods) {
    if (d && d.date) map.set(String(d.date), d.moods || [])
  }
  return map
})

const bars = computed(() => {
  const max = Math.max(0, ...props.daily.map(d => d.count || 0))
  const scale = max ? VIEW_H - BASE_H : 0
  return props.daily.map((d, i) => {
    const count = d.count || 0
    const h = count ? Math.max((count / max) * scale, MIN_H) : BASE_H
    const top = VIEW_H - h
    const list = (moodByDate.value.get(String(d.date)) || [])
      .filter(m => (m.count || 0) > 0)
      .sort((a, b) => (b.count || 0) - (a.count || 0))
    const totalMood = list.reduce((a, m) => a + (m.count || 0), 0)
    const segs = []
    if (count && !totalMood) {
      segs.push({ y: top, h, color: NEUTRAL, mood: '', count: 0 })
    } else if (count) {
      let y = top
      for (const m of list) {
        const sh = (m.count / totalMood) * h
        segs.push({ y, h: sh, color: MOOD_COLOR[m.mood] || '#A8A8A0', mood: m.mood, count: m.count })
        y += sh
      }
    }
    return { x: i + GAP / 2, w: 1 - GAP, y: top, h, segs, count, date: d.date, empty: !count }
  })
})

/** "2026-09-05" → "09-05" */
function shortDate(date) {
  return typeof date === 'string' ? date.slice(5) : date
}

/**
 * x 轴刻度：每 7 天一个 + 末位兜底。
 * 末位距上一刻度不足半格时直接改写而非追加——否则末两格日期会挤在一起。
 */
const axisTicks = computed(() => {
  const n = props.daily.length
  if (!n) return []
  const last = n - 1
  const idx = []
  for (let i = 0; i < n; i += 7) idx.push(i)
  const tail = idx[idx.length - 1]
  if (tail !== last) {
    if (last - tail < 5) idx[idx.length - 1] = last
    else idx.push(last)
  }
  return idx.map((i, k) => ({
    i,
    label: shortDate(props.daily[i].date),
    left: ((i + 0.5) / n) * 100,
    align: idx.length === 1 ? 'center' : (k === 0 ? 'start' : (i === last ? 'end' : 'center')),
  }))
})

/** 整柱悬浮说明：日期 + 条数 +（情绪明细） */
function barTitle(bar) {
  if (bar.empty) return `${shortDate(bar.date)} · 无记录`
  const detail = bar.segs
    .filter(s => s.mood)
    .map(s => `${moodMap[s.mood] || s.mood} ${s.count}`)
    .join(' · ')
  return `${shortDate(bar.date)} · ${bar.count} 条记录${detail ? `（${detail}）` : ' · 未标注情绪'}`
}
</script>

<template>
  <ChartEmpty v-if="!daily.length" text="暂无活动数据" />
  <template v-else>
    <svg
      class="act-band"
      :viewBox="`0 0 ${daily.length} ${VIEW_H}`"
      preserveAspectRatio="none"
      role="img"
      aria-label="近 30 天活动分布：柱高为当日记录数，柱内颜色为情绪占比"
    >
      <g v-for="(bar, i) in bars" :key="i" :style="{ '--d': i * 12 + 'ms' }">
        <rect
          v-if="bar.empty"
          class="act-base"
          :x="bar.x" :y="bar.y" :width="bar.w" :height="bar.h"
        >
          <title>{{ barTitle(bar) }}</title>
        </rect>
        <template v-else>
          <rect
            v-for="(seg, j) in bar.segs"
            :key="j"
            class="act-seg"
            :x="bar.x" :y="seg.y" :width="bar.w" :height="seg.h"
            :fill="seg.color"
          >
            <title>{{ barTitle(bar) }}</title>
          </rect>
        </template>
      </g>
    </svg>
    <div class="act-axis" aria-hidden="true">
      <span
        v-for="t in axisTicks"
        :key="t.i"
        :class="['act-tick', `tick-${t.align}`]"
        :style="{ left: t.left + '%' }"
      >{{ t.label }}</span>
    </div>
  </template>
</template>

<style scoped>
.act-band { display: block; width: 100%; height: 96px; }
.act-seg { transition: y .4s ease, height .4s ease; }
.act-base { fill: var(--line-strong); opacity: .45; }

/* 入场生长：每根柱自底部立起；--d 由模板按索引注入做错峰（30 根约 350ms 铺开）。
   fill-mode 用 backwards 而非 both——动画结束后交还 CSS 值，不抢占其它 transform 声明 */
.act-seg, .act-base {
  transform-box: fill-box;
  transform-origin: bottom;
  animation: actGrow .5s cubic-bezier(.22, .8, .3, 1) var(--d, 0ms) backwards;
}
@keyframes actGrow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

.act-axis { position: relative; height: 13px; margin-top: 5px; }
.act-tick {
  position: absolute;
  font-family: var(--font-mono); font-size: 9.5px; color: var(--text-low);
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
/* 首尾贴边、中间居中：末位日期不再被容器右缘裁切 */
.act-tick.tick-center { transform: translateX(-50%); }
.act-tick.tick-end { transform: translateX(-100%); }

@media (min-width: 900px) { .act-band { height: 150px; } }
</style>
