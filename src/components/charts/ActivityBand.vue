<script setup>
import { computed, ref } from 'vue'
import { useChartMotion } from '@/motion/useChartMotion'
import { useSceneActivity } from '@/motion/useSceneActivity'
import { MOOD_COLOR } from '@/constants/moodColor'
import { moodMap } from '@/constants/tags'
import ChartEmpty from './ChartEmpty.vue'

const props = defineProps({ daily: { type: Array, default: () => [] }, moods: { type: Array, default: () => [] } })
const chart = ref(null), selected = ref(null)
const active = useSceneActivity(chart)
const total = computed(() => props.daily.reduce((sum, day) => sum + (day.count || 0), 0))
const peak = computed(() => Math.max(0, ...props.daily.map(day => day.count || 0)))
const bars = computed(() => props.daily.map(day => {
  const count = day.count || 0
  const moods = (props.moods.find(item => item.date === day.date)?.moods || []).filter(item => item.count > 0)
  const sum = moods.reduce((value, mood) => value + mood.count, 0)
  return { ...day, count, height: peak.value ? count / peak.value * 100 : 0,
    segments: sum ? moods.map(mood => ({ ...mood, color: MOOD_COLOR[mood.mood] || '#a6b8ca', share: mood.count / sum * 100 })) : [{ mood: '', color: '#a6b8ca', share: 100 }],
    detail: moods.map(mood => (moodMap[mood.mood] || mood.mood) + ' ' + mood.count).join(' · ') || (count ? '未标注情绪' : '这一天还没有记录'),
  }
}))
const chosen = computed(() => bars.value.find(bar => bar.date === selected.value))
const { replay } = useChartMotion(chart, () => JSON.stringify(bars.value))
defineExpose({ replay })
function stepDay(step) {
  const index = Math.max(0, bars.value.findIndex(bar => bar.date === selected.value))
  selected.value = bars.value[(index + step + bars.value.length) % bars.value.length]?.date
}
function move(event, index) {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!step) return
  event.preventDefault()
  const next = (index + step + bars.value.length) % bars.value.length
  selected.value = bars.value[next].date
  chart.value.querySelectorAll('.track-day')[next]?.focus()
}
</script>

<template>
  <div ref="chart" class="activity-track" :class="{ 'is-active': active }">
    <ChartEmpty v-if="!daily.length" text="暂无活动数据 · 写下今天，开始第一段音轨" />
    <template v-else>
      <div class="track-summary" data-chart-reveal>
        <div class="track-total"><strong>{{ total }}</strong><span>条记录<small>YOUR DAILY TRACK</small></span></div>
        <span class="track-peak">单日最高 <b>{{ peak }}</b></span>
      </div>
      <div class="track-plot" aria-label="每日记录音轨，柱高表示记录数，颜色表示情绪占比">
        <div class="track-grid" aria-hidden="true"><span /><span /><span /></div>
        <div class="track-scan" aria-hidden="true" />
        <button v-for="(bar, i) in bars" :key="bar.date" type="button" class="track-day" :class="{ selected: chosen?.date === bar.date, empty: !bar.count }"
          :aria-label="bar.date + '，' + bar.count + ' 条记录，' + bar.detail" :aria-pressed="chosen?.date === bar.date"
          :tabindex="(chosen?.date || bars[0]?.date) === bar.date ? 0 : -1"
          @pointerenter="selected = bar.date" @click="selected = bar.date" @focus="selected = bar.date" @keydown="move($event, i)">
          <span class="track-column" data-chart-mark :style="{ height: bar.height + '%' }">
            <i v-for="seg in bar.segments" :key="seg.mood" :style="{ flex: seg.share, background: seg.color }" />
          </span>
          <span class="track-foot" />
        </button>
      </div>
      <div class="track-axis" aria-hidden="true"><span>{{ daily[0]?.date?.slice(5) }}</span><span>30 DAY MIX</span><span>{{ daily.at(-1)?.date?.slice(5) }}</span></div>
      <div class="track-readout" aria-live="polite" data-chart-reveal>
        <b>{{ chosen ? chosen.date.slice(5) : 'SELECT A DAY' }}</b>
        <span>{{ chosen ? chosen.count + ' 条 · ' + chosen.detail : '点选音轨，听见那一天的情绪' }}</span>
        <span class="track-controls"><button type="button" aria-label="查看前一天" @click="stepDay(-1)">←</button><button type="button" aria-label="查看后一天" @click="stepDay(1)">→</button></span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.activity-track { color: #f3f7e9; }
.track-summary { display:flex; justify-content:space-between; align-items:center; gap:10px; margin:0 0 16px; }
.track-total { display:flex; gap:14px; align-items:center; }
.track-total strong { font:italic 950 clamp(54px,7vw,86px)/.85 var(--font-display); letter-spacing:-.07em; color:#dfff00; text-shadow:4px 3px 0 #fa3985; }
.track-total span { font-size:12px; font-weight:800; }
.track-total small { display:block; font:800 9px var(--font-display); color:#9cb6ce; margin-top:8px; letter-spacing:.15em; }
.track-peak { font-size:11px; transform:rotate(4deg); border-bottom:2px solid #48edfa; padding:8px; }
.track-peak b { font:italic 900 26px var(--font-display); color:#48edfa; }
.track-plot { display:flex; position:relative; isolation:isolate; align-items:stretch; height:170px; gap:4px; border-bottom:2px solid #d8f0ff; }
.track-grid { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:space-between; pointer-events:none; z-index:-1; }
.track-grid span { border-top:1px dashed #b1e2ff25; }
.track-day { flex:1; min-width:0; position:relative; display:flex; align-items:flex-end; padding:0; background:transparent; cursor:crosshair; }
.track-column { width:100%; display:flex; flex-direction:column; position:relative; transform:skew(-7deg); box-shadow:3px 0 #0005; transition:filter .2s; }
.track-column i { display:block; min-height:0; }
.track-column::after { content:''; position:absolute; inset:0; background:repeating-linear-gradient(0deg,transparent 0 13px,#080f28a0 13px 15px); pointer-events:none; }
.track-day.selected .track-column { filter:brightness(1.5); box-shadow:3px 0 #dfff00; }
.track-day:focus-visible { outline:2px solid #dfff00; outline-offset:3px; }
.track-foot { position:absolute; bottom:0; left:0; right:0; height:3px; background:#a9c6d3; }
.track-scan { position:absolute; z-index:2; width:2px; inset-block:0; background:#dfff00; opacity:.35; box-shadow:0 0 14px #dfff00; pointer-events:none; animation:track-scan 7s linear infinite; animation-play-state:paused; }
.is-active .track-scan { animation-play-state:running; }
.track-axis { display:flex; justify-content:space-between; margin:8px 0 16px; color:#afc9db; font:700 10px var(--font-mono); }
.track-axis span:nth-child(2) { letter-spacing:.3em; color:#48edfa; }
.track-readout { display:flex; align-items:center; gap:14px; min-height:47px; padding:8px 14px; background:#f1f5e5; color:#09162d; clip-path:polygon(10px 0,100% 0,calc(100% - 12px) 100%,0 100%); }
.track-readout b { font:900 14px var(--font-display); white-space:nowrap; }
.track-readout > span { font-size:11px; line-height:1.5; }
.track-controls { display:flex; flex:none; margin-left:auto; gap:3px; }
.track-controls button { display:grid; place-items:center; min-width:32px; min-height:32px; color:#9d1a52; font-size:21px; background:#e5e8d8; }
.track-controls button:hover { background:#dfff00; }
.track-controls button:focus-visible { outline:2px solid #9d1a52; outline-offset:1px; }
@keyframes track-scan { from { left:0; } to { left:100%; } }
@media(max-width:599px) { .track-plot { height:130px; gap:2px; } .track-readout { flex-wrap:wrap; gap:5px 9px; } .track-readout > span:nth-child(2) { flex-basis:100%; order:2; } .track-peak { font-size:10px; padding:4px; } .track-total { gap:9px; } .track-total small { font-size:8px; } }
@media(prefers-reduced-motion:reduce) { .track-scan { display:none; } .track-column { transition:none; } }
</style>
