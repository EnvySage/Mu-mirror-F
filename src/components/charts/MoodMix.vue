<script setup>
import { computed, ref } from 'vue'
import { useChartMotion } from '@/motion/useChartMotion'
import { useSceneActivity } from '@/motion/useSceneActivity'
import { MOOD_COLOR } from '@/constants/moodColor'
import { moodMap } from '@/constants/tags'
import { moodDistribution } from '@/utils/moodDistribution'
import ChartEmpty from './ChartEmpty.vue'
const props = defineProps({ daily: { type:Array, default:() => [] } })
const chart = ref(null), selected = ref(null)
const active = useSceneActivity(chart)
const segments = computed(() => moodDistribution(props.daily).map(item => ({ ...item, color:MOOD_COLOR[item.key] || '#8b9ab9', label:item.key === 'other' ? '其他情绪' : moodMap[item.key] || item.key })))
const chosen = computed(() => segments.value.find(item => item.key === selected.value) || segments.value[0])
const { replay } = useChartMotion(chart, () => JSON.stringify(segments.value))
defineExpose({ replay })
</script>

<template>
  <div ref="chart" class="mood-mix" :class="{ 'is-active':active }">
    <ChartEmpty v-if="!segments.length" text="还没有情绪数据 · 写几条带情绪的记录，调出自己的颜色" />
    <template v-else>
      <div class="mood-disc" data-chart-reveal>
        <span class="mood-ghost" aria-hidden="true">FEEL<br>EVERY<br>THING.</span>
        <svg viewBox="0 0 280 280" role="img" :aria-label="'情绪构成：' + segments.map(item => item.label + ' ' + item.pct + '%').join('，')">
          <circle cx="140" cy="140" r="125" class="disc-edge" />
          <circle cx="140" cy="140" r="112" class="disc-base" />
          <circle v-for="seg in segments" :key="seg.key" cx="140" cy="140" r="97" pathLength="100" fill="none" stroke-width="28" transform="rotate(-90 140 140)"
            :stroke="seg.color" :stroke-dasharray="seg.share + ' ' + (100-seg.share)" :stroke-dashoffset="seg.offset" data-chart-trace class="disc-segment" :class="{ dimmed:selected && selected !== seg.key }">
            <title>{{ seg.label }} · {{ seg.count }} 次 · {{ seg.pct }}%</title>
          </circle>
          <g class="disc-grooves" aria-hidden="true"><circle cx="140" cy="140" r="75" /><circle cx="140" cy="140" r="68" /><circle cx="140" cy="140" r="61" /></g>
          <path class="disc-spark" d="M238 13l5 19 19 5-19 5-5 19-5-19-19-5 19-5z" aria-hidden="true" />
        </svg>
        <div class="disc-label" :style="{ '--mood-color':chosen.color }" aria-live="polite">
          <span>{{ selected ? 'SELECTED MOOD' : 'TOP MOOD' }}</span><strong>{{ chosen.label }}</strong><b>{{ chosen.pct }}<small>%</small></b>
        </div>
      </div>
      <div class="mood-tracks" data-chart-reveal>
        <button v-for="seg in segments" :key="seg.key" type="button" :aria-pressed="selected === seg.key" :style="{ '--mood-color':seg.color }" @click="selected = selected === seg.key ? null : seg.key">
          <i /><span>{{ seg.label }}</span><small>{{ seg.count }} 次</small><b>{{ seg.pct }}%</b>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mood-disc { width:min(100%,280px); position:relative; margin:8px auto 12px; isolation:isolate; }
.mood-disc svg { width:100%; display:block; overflow:visible; }
.mood-ghost { position:absolute; z-index:-1; left:-6px; top:15%; font:italic 950 50px/.85 var(--font-display); color:#fc318340; letter-spacing:-.06em; transform:rotate(-13deg); }
.disc-base { fill:#0b1530; stroke:#f0f2e6; stroke-width:2; }
.disc-edge { fill:none; stroke:#e34b8c; stroke-width:1; stroke-dasharray:2 6; }
.disc-segment { transition:opacity .25s; }
.disc-segment.dimmed { opacity:.25; }
.disc-grooves { fill:none; stroke:#a3bfd045; stroke-width:1; stroke-dasharray:110 9 42 5; transform-origin:140px 140px; animation:disc-spin 16s linear infinite paused; }
.disc-spark { fill:#dfff00; transform-origin:238px 37px; animation:disc-spark 4s ease-in-out infinite paused; }
.is-active .disc-grooves,.is-active .disc-spark { animation-play-state:running; }
.disc-label { position:absolute; inset:31%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; text-align:center; transform:rotate(-8deg); }
.disc-label span { color:#b8c5da; font:800 7px var(--font-display); white-space:nowrap; letter-spacing:1px; }
.disc-label strong { font-size:18px; margin-top:5px; max-width:120px; overflow-wrap:anywhere; }
.disc-label b { font:italic 900 36px/1 var(--font-display); color:#dfff00; }
.disc-label small { font-size:16px; }
.mood-tracks { display:flex; flex-direction:column; gap:5px; }
.mood-tracks button { display:flex; align-items:center; gap:8px; color:#e3e9f1; min-height:34px; padding:4px 10px; border-bottom:1px solid #86b3d52a; text-align:left; font-size:11px; transition:background .2s,transform .2s; }
.mood-tracks button:nth-child(even) { margin-left:12px; }
.mood-tracks button i { width:10px; height:10px; background:var(--mood-color); transform:skew(-15deg); }
.mood-tracks button span { flex:1; overflow-wrap:anywhere; }
.mood-tracks button small { color:#abbacf; font-size:10px; }
.mood-tracks button b { min-width:36px; font:italic 900 17px var(--font-display); text-align:right; }
.mood-tracks button[aria-pressed=true],.mood-tracks button:hover { background:#ffffff14; transform:translateX(3px); }
.mood-tracks button:focus-visible { outline:2px solid #dfff00; outline-offset:2px; }
@keyframes disc-spin { to { transform:rotate(360deg); } }
@keyframes disc-spark { 50% { transform:rotate(90deg) scale(.6); } }
@media(prefers-reduced-motion:reduce) { .disc-grooves,.disc-spark { animation:none; } .disc-segment,.mood-tracks button { transition:none; } }
</style>
