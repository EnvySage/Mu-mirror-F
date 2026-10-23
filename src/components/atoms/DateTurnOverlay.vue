<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap, prefersReducedMotion } from '@/motion/core'
const props = defineProps({ from:Date, to:{ type:Date, required:true } })
const emit = defineEmits(['done'])
const root = ref(null)
const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']
let animation
onMounted(() => {
  if (prefersReducedMotion()) { emit('done'); return }
  const el = root.value
  animation = gsap.timeline({ onComplete:() => emit('done') })
    .fromTo(el,{opacity:0},{opacity:1,duration:.12})
    .fromTo(el.querySelector('.date-cut-band'),{xPercent:110,skewX:-16},{xPercent:0,skewX:-16,duration:.38,ease:'power4.out'},0)
    .fromTo(el.querySelectorAll('.date-cut-clock'),{scale:.45,rotation:-110,opacity:0},{scale:1,rotation:20,opacity:1,duration:.65,stagger:.05,ease:'power3.out'},.04)
    .fromTo(el.querySelector('.date-cut-new'),{y:80,rotation:12,opacity:0},{y:0,rotation:-7,opacity:1,duration:.48,ease:'back.out(1.4)'},.16)
    .fromTo(el.querySelector('.date-cut-old'),{y:0,opacity:.7},{y:-90,opacity:0,duration:.5,ease:'power2.in'},.12)
    .to(el,{opacity:0,duration:.23},.95)
})
onBeforeUnmount(() => animation?.kill())
</script>

<template>
  <div ref="root" class="date-cut" aria-hidden="true">
    <div class="date-cut-band" />
    <svg v-for="n in 5" :key="n" class="date-cut-clock" :style="{ '--clock':n }" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r="65" /><circle cx="80" cy="80" r="56" class="clock-marks" /><path d="M80 39V80L110 96M23 18L9 34M137 18L151 34M40 138L30 153M120 138L130 153" /><path class="clock-hand" d="M80 80L122 44" />
    </svg>
    <span class="date-cut-word">ANOTHER DAY, ANOTHER YOU.</span>
    <div v-if="from" class="date-cut-old">{{ String(from.getMonth()+1).padStart(2,'0') }} / {{ String(from.getDate()).padStart(2,'0') }}</div>
    <div class="date-cut-new"><span>{{ to.getFullYear() }} / {{ days[to.getDay()] }}</span><strong>{{ String(to.getMonth()+1).padStart(2,'0') }}<i>/</i>{{ String(to.getDate()).padStart(2,'0') }}</strong><b>DAY SELECTED ↗</b></div>
  </div>
</template>

<style scoped>
.date-cut { position:fixed; inset:0; pointer-events:none; z-index:45; overflow:hidden; display:grid; place-items:center; isolation:isolate; }
.date-cut-band { position:absolute; inset:21% -20%; background:#052c8df5; border-block:5px solid #55f1f3; box-shadow:0 22px #ed358b; z-index:-1; }
.date-cut-clock { position:absolute; width:clamp(120px,19vw,260px); left:calc(var(--clock) * 21% - 18%); top:calc(16% + var(--clock) * 5%); fill:none; stroke:#57e9ed; stroke-width:3; opacity:.4; }
.date-cut-clock:nth-of-type(even) { top:49%; stroke:#dfff00; }
.clock-marks { stroke-dasharray:1 12; stroke-width:7; }.clock-hand { transform-origin:80px 80px; animation:date-hand .9s linear infinite; stroke:#fff; }
.date-cut-word { position:absolute; top:24%; left:-4%; font:italic 950 clamp(28px,7vw,100px)/1 var(--font-display); color:#87e8ff26; white-space:nowrap; transform:rotate(-8deg); }
.date-cut-old { position:absolute; font:italic 900 clamp(60px,14vw,190px) var(--font-display); -webkit-text-stroke:1px #91e9f7; color:transparent; }
.date-cut-new { display:flex; flex-direction:column; align-items:center; transform:rotate(-7deg); color:#f7f5e8; text-shadow:6px 6px #07142e; }
.date-cut-new span { font:800 clamp(11px,2vw,20px) var(--font-display); letter-spacing:.2em; }
.date-cut-new strong { font:italic 950 clamp(76px,17vw,220px)/1 var(--font-display); letter-spacing:-.06em; }
.date-cut-new i { font-size:.6em; color:#52edfa; margin-inline:10px; }
.date-cut-new b { background:#dfff00; color:#091d43; text-shadow:none; font:900 12px var(--font-display); padding:6px 18px; transform:rotate(3deg); }
@keyframes date-hand { to { transform:rotate(360deg); } }
@media(prefers-reduced-motion:reduce) { .date-cut { display:none; }.clock-hand { animation:none; } }
</style>
