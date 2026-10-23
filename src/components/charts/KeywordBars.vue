<script setup>
import { computed, ref } from 'vue'
import { useChartMotion } from '@/motion/useChartMotion'
import ChartEmpty from './ChartEmpty.vue'
const props = defineProps({ data: { type: Array, default: () => [] } })
const chart = ref(null), selected = ref(null)
const items = computed(() => {
  const top = props.data.filter(item => String(item.keyword ?? '').trim().length >= 2).slice().sort((a,b) => (b.count || 0) - (a.count || 0)).slice(0,10)
  const max = Math.max(1,...top.map(item => item.count || 0))
  return top.map(item => ({ ...item, pct:(item.count || 0) / max * 100 }))
})
const chosen = computed(() => items.value.find(item => item.keyword === selected.value))
const { replay } = useChartMotion(chart, () => JSON.stringify(items.value))
defineExpose({ replay })
</script>

<template>
  <div ref="chart" class="word-remix">
    <ChartEmpty v-if="!items.length" text="关键词还没成形 · 多写一点，关注就会浮现" />
    <template v-else>
      <ol class="word-ranking">
        <li v-for="(item,i) in items" :key="item.keyword" data-chart-reveal :style="{ '--row-tilt': (i % 2 ? 1.1 : -1.1) + 'deg', '--row-offset': (i % 3) * 5 + 'px' }">
          <button type="button" :aria-pressed="selected === item.keyword" :aria-label="item.keyword + '，出现 ' + item.count + ' 次'" @click="selected = item.keyword">
            <span class="word-rank">{{ String(i+1).padStart(2,'0') }}</span>
            <span class="word-info"><span class="word-name">{{ item.keyword }}</span><span class="word-rail"><i :style="{ width:item.pct+'%' }" /></span></span>
            <b class="word-count">{{ item.count }}<small>次</small></b>
            <span class="word-star" aria-hidden="true">✦</span>
          </button>
        </li>
      </ol>
      <p class="word-readout" aria-live="polite"><span>ON YOUR MIND ↗</span>{{ chosen ? '「' + chosen.keyword + '」出现了 ' + chosen.count + ' 次' : '点选一个词，看看最近的自己' }}</p>
    </template>
  </div>
</template>

<style scoped>
.word-ranking { list-style:none; padding:0 14px 0 0; margin:6px 0 12px; display:flex; flex-direction:column; gap:9px; }
.word-ranking li { position:relative; margin-left:var(--row-offset); transform:rotate(var(--row-tilt)); }
.word-ranking button { position:relative; isolation:isolate; width:100%; display:flex; align-items:center; gap:12px; min-height:55px; padding:7px 18px 7px 10px; text-align:left; color:#f7f9e6; transition:transform .22s cubic-bezier(.2,.8,.2,1.5); }
.word-ranking button::before { content:''; position:absolute; inset:0; background:#0b1d3b; clip-path:polygon(5px 0,100% 0,calc(100% - 11px) 100%,0 100%); z-index:-1; }
.word-ranking li:nth-child(2n) button::before { background:#0749c1; }
.word-rank { font:italic 950 30px/1 var(--font-display); color:#59dbe9; flex:none; min-width:35px; }
.word-info { flex:1; min-width:0; }
.word-name { display:block; font-weight:850; font-size:17px; overflow-wrap:anywhere; line-height:1.3; }
.word-rail { display:block; height:3px; background:#ffffff28; margin-top:6px; }
.word-rail i { display:block; height:100%; background:#dfff00; }
.word-count { font:italic 900 28px/1 var(--font-display); color:#dfff00; flex:none; }
.word-count small { font:10px var(--font); margin-left:3px; }
.word-star { position:absolute; top:-9px; right:-10px; color:#e3267a; font-size:31px; transform:scale(0) rotate(-90deg); transition:transform .35s cubic-bezier(.2,.8,.2,1.5); text-shadow:2px 2px #fff; pointer-events:none; }
.word-ranking button:hover,.word-ranking button[aria-pressed=true] { transform:translateX(6px) rotate(-1deg); }
.word-ranking button:hover .word-star,.word-ranking button[aria-pressed=true] .word-star { transform:scale(1) rotate(15deg); }
.word-ranking button:focus-visible { outline:3px solid #e3267a; outline-offset:3px; }
.word-readout { color:#41526a; font-size:11px; line-height:1.5; overflow-wrap:anywhere; }
.word-readout span { display:block; margin-bottom:5px; color:#b51e60; font:900 11px var(--font-display); letter-spacing:.1em; }
@media(max-width:599px) { .word-name { font-size:15px; } .word-ranking button { gap:8px; padding-left:8px; } .word-rank { font-size:25px; min-width:28px; } .word-count { font-size:24px; } }
@media(prefers-reduced-motion:reduce) { .word-ranking button,.word-star { transition:none; } }
</style>
