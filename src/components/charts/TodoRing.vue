<script setup>
import { computed, ref } from 'vue'
import { useChartMotion } from '@/motion/useChartMotion'
import { useSceneActivity } from '@/motion/useSceneActivity'
import ChartEmpty from './ChartEmpty.vue'
const props = defineProps({ todo: { type: Object, default: null } })
const chart = ref(null), selected = ref(null)
const active = useSceneActivity(chart)
const norm = computed(() => {
  const t = props.todo || {}
  return { total: t.total || 0, completed: t.completed || 0, doing: t.in_progress ?? t.inProgress ?? 0, waiting: t.not_started ?? t.notStarted ?? 0 }
})
const pct = computed(() => norm.value.total ? Math.round(norm.value.completed / norm.value.total * 100) : 0)
const segments = computed(() => {
  let offset = 0
  return [
    { key:'done', label:'已完成', count:norm.value.completed, color:'#dfff00' },
    { key:'doing', label:'进行中', count:norm.value.doing, color:'#4bebf6' },
    { key:'waiting', label:'未开始', count:norm.value.waiting, color:'#8295b4' },
  ].map(seg => { const len = norm.value.total ? seg.count / norm.value.total * 100 : 0; const result = { ...seg, len, offset }; offset -= len; return result })
})
const chosen = computed(() => segments.value.find(seg => seg.key === selected.value))
const path = 'M140 42 L207 60 L242 128 L218 204 L140 238 L62 204 L38 128 L73 60 Z'
const { replay } = useChartMotion(chart, () => JSON.stringify(norm.value))
defineExpose({ replay })
</script>

<template>
  <div ref="chart" class="mission-core" :class="{ 'is-active': active }">
    <ChartEmpty v-if="!norm.total" text="还没有待办 · 写下一个小计划，点亮这条轨道" />
    <template v-else>
      <div class="mission-dial" data-chart-reveal>
        <svg viewBox="0 0 280 280" role="img" :aria-label="'待办完成 ' + norm.completed + '/' + norm.total + '，进行中 ' + norm.doing + '，未开始 ' + norm.waiting">
          <g class="mission-gear" aria-hidden="true"><circle cx="140" cy="140" r="132" /><path d="M132 0h16v17h-16zM132 263h16v17h-16zM0 132h17v16H0zM263 132h17v16h-17z" /></g>
          <path :d="path" class="mission-shadow" transform="translate(5 6)" />
          <path :d="path" class="mission-track" />
          <path v-for="seg in segments" :key="seg.key" :d="path" pathLength="100" class="mission-segment" :class="{ dimmed: selected && selected !== seg.key }"
            :stroke="seg.color" :stroke-dasharray="seg.len + ' ' + (100 - seg.len)" :stroke-dashoffset="seg.offset" data-chart-trace>
            <title>{{ seg.label }} {{ seg.count }} 项</title>
          </path>
          <path d="M140 69L194 84L213 134L194 188L140 211L86 188L67 134L86 84Z" class="mission-inside" />
        </svg>
        <div class="mission-number" aria-live="polite">
          <span>{{ chosen ? chosen.label : 'COMPLETED' }}</span>
          <strong :key="selected">{{ chosen ? chosen.count : pct }}<small>{{ chosen ? '项' : '%' }}</small></strong>
          <b>{{ norm.completed }} / {{ norm.total }} 已完成</b>
        </div>
        <span class="mission-sticker" aria-hidden="true">KEEP<br>GOING ↗</span>
      </div>
      <div class="mission-legend" data-chart-reveal>
        <button v-for="seg in segments" :key="seg.key" type="button" :style="{ '--state-color':seg.color }" :aria-pressed="selected === seg.key" @click="selected = selected === seg.key ? null : seg.key">
          <i /><span>{{ seg.label }}</span><b>{{ seg.count }}</b>
        </button>
      </div>
      <p class="mission-note">仅统计待办 / 计划片段</p>
    </template>
  </div>
</template>

<style scoped>
.mission-core { color:#eef8ff; }
.mission-dial { position:relative; width:min(100%,280px); margin:0 auto; }
.mission-dial svg { display:block; width:100%; overflow:visible; }
.mission-gear { transform-origin:140px 140px; animation:gear-turn 45s linear infinite paused; }
.is-active .mission-gear { animation-play-state:running; }
.mission-gear circle { fill:none; stroke:#62b4d8; stroke-width:1; stroke-dasharray:1 6; }
.mission-gear path { fill:#4bebf6; }
.mission-track { fill:#071a38; stroke:#314663; stroke-width:14; }
.mission-shadow { fill:#e93485; stroke:#e93485; stroke-width:15; }
.mission-segment { fill:none; stroke-width:14; stroke-linejoin:miter; transition:opacity .2s; }
.mission-segment.dimmed { opacity:.22; }
.mission-inside { fill:none; stroke:#86c6e840; stroke-width:1; }
.mission-number { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; align-items:center; pointer-events:none; transform:rotate(-5deg); }
.mission-number > span { color:#b6d4e4; font:900 10px var(--font-display); letter-spacing:.15em; }
.mission-number strong { font:italic 950 clamp(46px,5vw,65px)/1.1 var(--font-display); color:#dfff00; letter-spacing:-.07em; text-shadow:3px 3px #142d78; animation:mission-pop .4s cubic-bezier(.2,.8,.2,1.5); }
.mission-number small { font-size:21px; letter-spacing:0; }
.mission-number b { font-size:11px; }
.mission-sticker { position:absolute; right:-2px; bottom:12px; background:#ed3784; color:white; padding:9px 13px; transform:rotate(10deg); clip-path:polygon(0 9%,90% 0,100% 90%,8% 100%); font:italic 900 15px/.9 var(--font-display); }
.mission-legend { display:flex; flex-wrap:wrap; justify-content:center; gap:4px; margin:10px 0 0; }
.mission-legend button { display:flex; align-items:center; gap:6px; min-height:36px; padding:5px 7px; border-bottom:2px solid transparent; color:#cfdeed; font-size:10px; }
.mission-legend i { width:8px; height:8px; background:var(--state-color); transform:rotate(45deg); }
.mission-legend b { font:900 16px var(--font-display); color:var(--state-color); }
.mission-legend button[aria-pressed=true] { border-color:var(--state-color); background:#ffffff12; }
.mission-legend button:focus-visible { outline:2px solid #fff; outline-offset:2px; }
.mission-note { margin:10px 0 0; color:#a1b4cd; font-size:10px; text-align:center; }
@keyframes gear-turn { to { transform:rotate(360deg); } }
@keyframes mission-pop { from { transform:scale(.6) rotate(12deg); } to { transform:scale(1) rotate(0); } }
@media(prefers-reduced-motion:reduce) { .mission-gear,.mission-number strong { animation:none; } .mission-segment { transition:none; } }
</style>
