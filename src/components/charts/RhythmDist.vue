<script setup>
import { computed, ref } from 'vue'
import { useChartMotion } from '@/motion/useChartMotion'
import { useSceneActivity } from '@/motion/useSceneActivity'
import ChartEmpty from './ChartEmpty.vue'
const props = defineProps({ hours: { type: Array, default: () => [] }, weekdays: { type: Array, default: () => [] } })
const chart = ref(null), selectedHour = ref(null), selectedWeek = ref(null)
const active = useSceneActivity(chart)
const weekLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const max = computed(() => Math.max(1, ...[...props.hours, ...props.weekdays].map(item => item.count || 0)))
const hours = computed(() => Array.from({ length: 24 }, (_, i) => ({ hour: i, count: props.hours.find(item => item.bucket === i)?.count || 0 })))
const weeks = computed(() => weekLabels.map((label, i) => ({ label, count: props.weekdays.find(item => item.bucket === i)?.count || 0 })))
const peakHour = computed(() => hours.value.reduce((best, item) => item.count > best.count ? item : best, hours.value[0]))
const chosen = computed(() => hours.value[selectedHour.value ?? peakHour.value.hour])
const hasRecords = computed(() => hours.value.some(item => item.count > 0))
const { replay } = useChartMotion(chart, () => JSON.stringify([props.hours, props.weekdays]))
defineExpose({ replay })
function point(hour, radius) {
  const angle = (hour * 15 - 90) * Math.PI / 180
  return { x: 140 + radius * Math.cos(angle), y: 140 + radius * Math.sin(angle) }
}
function moveHour(event, index) {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!step) return
  event.preventDefault()
  selectedHour.value = (index + step + 24) % 24
  chart.value.querySelectorAll('.clock-slot')[selectedHour.value]?.focus()
}
</script>

<template>
  <div ref="chart" class="rhythm-mix" :class="{ 'is-active': active }">
    <ChartEmpty v-if="!props.hours.length && !props.weekdays.length" text="暂无节律数据 · 记录会慢慢形成你的节奏" />
    <template v-else>
      <div class="clock-wrap">
        <span class="clock-tag" data-chart-reveal>24H / ON AIR</span>
        <svg class="rhythm-clock" viewBox="0 0 280 280" role="group" aria-label="24 小时记录分布，射线长度代表记录数">
          <circle cx="140" cy="140" r="127" class="clock-orbit" />
          <circle cx="140" cy="140" r="63" class="clock-inner" />
          <g v-for="(item, i) in hours" :key="i" class="clock-slot" :class="{ selected: chosen.hour === i }" role="button"
            :tabindex="chosen.hour === i ? 0 : -1" :aria-label="String(i).padStart(2, '0') + ':00，' + item.count + ' 条记录'" :aria-pressed="chosen.hour === i"
            @pointerenter="selectedHour = i" @focus="selectedHour = i" @click="selectedHour = i" @keydown.enter="selectedHour = i" @keydown.space.prevent="selectedHour = i" @keydown="moveHour($event, i)">
            <line :x1="point(i, 68).x" :y1="point(i, 68).y" :x2="point(i, 121).x" :y2="point(i, 121).y" class="clock-hit" />
            <line :x1="point(i, 69).x" :y1="point(i, 69).y" :x2="point(i, 69 + item.count / max * 49).x" :y2="point(i, 69 + item.count / max * 49).y" class="clock-spoke" :class="{ zero: !item.count }" data-chart-reveal />
            <circle v-if="!item.count" :cx="point(i, 69).x" :cy="point(i, 69).y" r="2" class="clock-zero" />
          </g>
          <g class="clock-needle" :style="{ transform: 'rotate(' + chosen.hour * 15 + 'deg)' }" aria-hidden="true"><path d="M136 84 L140 72 L144 84 Z" /></g>
          <g class="clock-copy" aria-hidden="true">
            <text x="140" y="125" class="clock-caption">{{ selectedHour === null ? (hasRecords ? 'PEAK HOUR' : 'NO RECORDS') : 'SELECTED' }}</text>
            <text x="140" y="153" class="clock-time">{{ String(chosen.hour).padStart(2, '0') }}:00</text>
            <text x="140" y="174" class="clock-count">{{ chosen.count }} 条记录</text>
          </g>
          <g class="clock-hours" aria-hidden="true"><text x="140" y="12">00</text><text x="269" y="144">06</text><text x="140" y="278">12</text><text x="11" y="144">18</text></g>
        </svg>
      </div>
      <div class="week-mix">
        <div class="week-caption" data-chart-reveal><strong>WEEK<br>BY WEEK.</strong><span>一周节奏</span></div>
        <div class="week-bars" role="group" aria-label="一周记录分布">
          <button v-for="(item, i) in weeks" :key="item.label" type="button" class="week-day" :class="{ selected: selectedWeek === i }" :aria-pressed="selectedWeek === i" :aria-label="item.label + '，' + item.count + ' 条记录'" @click="selectedWeek = i" @pointerenter="selectedWeek = i">
            <span>{{ item.label }}</span>
            <span class="week-rail"><i data-chart-mark :style="{ width: item.count / max * 100 + '%' }" /></span>
            <b>{{ item.count }}</b>
          </button>
        </div>
      </div>
      <p class="rhythm-foot" aria-live="polite">{{ String(chosen.hour).padStart(2, '0') }}:00 · {{ chosen.count }} 条<span v-if="selectedWeek !== null"> / {{ weeks[selectedWeek].label }} · {{ weeks[selectedWeek].count }} 条</span><small>射线与横条使用同一计数刻度</small></p>
    </template>
  </div>
</template>

<style scoped>
.rhythm-mix { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(105px,.8fr); gap:0 16px; color:#0b1c39; align-items:center; }
.clock-wrap { position:relative; min-width:0; padding-top:13px; }
.clock-tag { position:absolute; top:0; left:14px; z-index:1; padding:5px 9px; background:#ed3784; color:white; font:900 10px var(--font-display); letter-spacing:.1em; transform:rotate(-8deg); }
.rhythm-clock { width:100%; display:block; overflow:visible; }
.clock-orbit { fill:none; stroke:#0a275d; stroke-width:1; stroke-dasharray:23 8 3 8; transform-origin:140px 140px; animation:clock-orbit 32s linear infinite paused; }
.is-active .clock-orbit { animation-play-state:running; }
.clock-inner { fill:#101c35; stroke:#07bfcf; stroke-width:3; }
.clock-hit { stroke:transparent; stroke-width:17; }
.clock-spoke { stroke:#0b68e7; stroke-width:8; transition:stroke .2s; pointer-events:none; }
.clock-spoke.zero { stroke:none; }
.clock-zero { fill:#9fadb5; pointer-events:none; }
.clock-slot { cursor:pointer; outline:none; }
.clock-slot.selected .clock-spoke { stroke:#ed3784; }
.clock-slot:focus-visible .clock-hit { stroke:#d2b20a; stroke-opacity:.4; }
.clock-slot:focus-visible .clock-spoke { stroke:#96154e; }
.clock-needle { transform-origin:140px 140px; transition:transform .55s cubic-bezier(.2,.9,.2,1.2); fill:#dfff00; }
.clock-copy,.clock-hours { text-anchor:middle; pointer-events:none; }
.clock-caption { font:800 8px var(--font-display); fill:#99bcd1; letter-spacing:1px; }
.clock-time { font:italic 900 25px var(--font-display); fill:#efff53; }
.clock-count { font:700 10px var(--font); fill:#fff; }
.clock-hours { font:800 9px var(--font-mono); fill:#445366; }
.week-caption { margin:0 0 15px; transform:rotate(-5deg); }
.week-caption strong { display:block; font:italic 950 25px/.85 var(--font-display); letter-spacing:-.04em; color:#073fab; text-shadow:2px 2px #99efef; }
.week-caption span { display:block; margin-top:8px; font-size:10px; }
.week-day { width:100%; display:flex; align-items:center; gap:6px; min-height:30px; color:#162d4f; font-size:10px; text-align:left; }
.week-day > span:first-child { flex:none; }
.week-day b { font:900 13px var(--font-display); min-width:16px; text-align:right; }
.week-rail { flex:1; background:#d3dde3; height:11px; transform:skew(-18deg); }
.week-rail i { display:block; height:100%; background:#065be4; transition:background .2s; }
.week-day:nth-child(even) .week-rail i { background:#039caa; }
.week-day.selected .week-rail i { background:#e22578; }
.week-day.selected { color:#a51959; }
.week-day:focus-visible { outline:2px solid #bc2665; outline-offset:2px; }
.rhythm-foot { grid-column:1/-1; margin:12px 0 0; font:800 11px var(--font-mono); border-top:1px dashed #668392; padding-top:10px; }
.rhythm-foot small { display:block; margin-top:5px; color:#536778; font:10px var(--font); }
@keyframes clock-orbit { to { transform:rotate(360deg); } }
@media(max-width:599px) { .rhythm-mix { grid-template-columns:minmax(0,1fr); } .clock-wrap { max-width:280px; width:100%; margin:auto; } .week-mix { display:flex; align-items:center; gap:14px; margin-top:8px; } .week-caption { min-width:78px; } .week-caption strong { font-size:22px; } .week-bars { flex:1; } .week-day { min-height:28px; } }
@media(prefers-reduced-motion:reduce) { .clock-orbit { animation:none; } .clock-needle,.clock-spoke,.week-rail i { transition:none; } }
</style>
