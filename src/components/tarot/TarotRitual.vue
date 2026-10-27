<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { gsap, prefersReducedMotion } from '@/motion/core'
import { useDialogFocus } from '@/composables/useDialogFocus'
import TarotClock from './TarotClock.vue'
import TarotSpotlight from './TarotSpotlight.vue'

const props = defineProps({ mode: String, result: Object, error: String })
const emit = defineEmits(['confirm', 'close', 'inspect'])
const dialog = ref(null), phase = ref('waiting'), ready = ref(false)
const variant = computed(() => props.result?.newlyCollected ? 'new' : props.mode === 'question' ? 'reading' : 'daily')
let context, intro, alive = true
useDialogFocus(() => true, dialog, '.ritual-confirm', () => emit('close'))

function settle() {
  if (!alive || phase.value !== 'drawing') return
  if (props.result?.card) phase.value = 'revealed'
  else if (props.error) phase.value = 'failed'
}
watch(() => [props.result, props.error], settle)

async function confirm() {
  if (!['waiting', 'failed'].includes(phase.value)) return
  const retry = phase.value === 'failed'
  phase.value = 'closing'
  intro?.kill()
  emit('confirm')
  await nextTick()
  if (!alive) return
  const complete = () => { if (alive) { phase.value = 'drawing'; settle() } }
  if (prefersReducedMotion() || retry) { complete(); return }
  context.add(() => {
    const timeline = gsap.timeline({ onComplete: complete })
    if (props.mode === 'question') {
      timeline.to('.ritual-question', { scale: .6, opacity: 0, duration: .25 }, 0)
        .to('.question-clock', { scale: .06, rotation: -125, opacity: 0, duration: .8, ease: 'power4.in' }, .02)
        .to('.ritual-clock-layer', { opacity: 0, duration: .18 }, .65)
    } else timeline.from('.ritual-deck img', { x: i => (i - 1) * 160, rotation: i => (i - 1) * 45, opacity: 0, stagger: .07, duration: .65, ease: 'power3.out' })
    timeline.fromTo('.ritual-iris', { scaleX: 0, rotation: -30 }, { scaleX: 1.7, rotation: -12, duration: .4, ease: 'power3.in' }, .45)
      .to('.ritual-iris', { xPercent: 140, duration: .35, ease: 'power3.out' }, .83)
  })
}
onMounted(() => {
  context = gsap.context(() => {}, dialog.value)
  if (props.mode === 'daily') { confirm(); return }
  if (!prefersReducedMotion()) context.add(() => {
    intro = gsap.timeline()
      .from('.question-clock', { scale: .12, rotation: 55, opacity: 0, duration: .95, ease: 'expo.out' })
      .from('.ritual-question', { y: 25, scale: .8, opacity: 0, duration: .55, ease: 'power3.out' }, .35)
  })
})
onBeforeUnmount(() => { alive = false; context?.revert() })
</script>

<template>
  <Teleport to="body">
    <section ref="dialog" class="tarot-ritual" :class="[`phase-${phase}`, `ritual-mode-${mode}`]" role="dialog" aria-modal="true" :aria-label="phase === 'waiting' ? '默念你的问题' : '抽牌展示'" tabindex="-1">
      <div class="ritual-backdrop" aria-hidden="true" />
      <div v-if="phase !== 'revealed'" class="ritual-deck" aria-hidden="true"><img v-for="n in 3" :key="n" src="/art/tarot/v1/back.png" alt="" :style="{ '--fan': `${(n - 2) * 14}deg` }" /></div>
      <div v-if="mode === 'question' && ['waiting', 'closing'].includes(phase)" class="ritual-clock-layer">
        <TarotClock />
        <button class="ritual-clock-trigger ritual-confirm" :disabled="phase !== 'waiting'" aria-label="默念好了，揭开这张牌" @click="confirm">
          <span class="ritual-question">
          <span>你有什么</span><strong>疑问呢？</strong><small>把问题放在心里。<br />准备好了，点击这里。</small>
          <i aria-hidden="true">✦</i>
          </span>
        </button>
        <span class="ritual-pause-note">不必急着回答，时间留给你。</span>
      </div>
      <div class="ritual-iris" aria-hidden="true" />
      <div v-if="phase === 'revealed' && result?.card" class="ritual-result">
        <TarotSpotlight :card="result.card" :variant="variant" @ready="ready = true" @zoom="$emit('inspect', result.card)" />
      </div>
      <header class="ritual-header"><span>{{ phase === 'revealed' && result?.newlyCollected ? '一张新牌，加入你的故事。' : mode === 'question' ? '问一问' : '今日牌签' }}</span><button class="ritual-close" @click="$emit('close')">{{ phase === 'waiting' ? '稍后再抽' : '返回牌桌' }} ×</button></header>
      <div v-if="phase === 'drawing'" class="ritual-progress" role="status">正在揭开这次相遇…</div>
      <div v-if="phase === 'failed'" class="ritual-failure" role="alert"><p>{{ error }}</p><button class="ritual-confirm" @click="confirm">重新找回这张牌</button></div>
      <footer v-if="phase === 'revealed'" class="ritual-footer"><small>{{ result?.drawDate || '此刻' }}<template v-if="result?.newlyCollected"> · 首次获得</template></small><button :disabled="!ready" @click="$emit('close')">{{ result?.newlyCollected ? '收下这张牌' : mode === 'question' ? '查看这张牌的启发' : '回到今日牌' }} <span aria-hidden="true">↗</span></button></footer>
    </section>
  </Teleport>
</template>

<style scoped>
.tarot-ritual{position:fixed;inset:0;z-index:1100;isolation:isolate;overflow:hidden;background:#03091de6;color:white;outline:none;backdrop-filter:blur(10px)}
.ritual-clock-trigger{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:pointer}.ritual-clock-trigger:focus-visible{outline:2px solid #72edff;outline-offset:-8px}.ritual-pause-note{pointer-events:none}
.ritual-backdrop{position:absolute;inset:0;z-index:-2;background:linear-gradient(135deg,#05265766,#040917d9),url('/art/water-surface.webp') center/cover;opacity:.75}.ritual-clock-layer{position:absolute;inset:0;overflow:hidden;background:radial-gradient(ellipse at center,#1045cbaa,#041021bb 72%);z-index:2}
.ritual-question{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-9deg);text-align:left;color:white;width:max-content;max-width:90vw;padding:30px;background:transparent;border:0;text-shadow:4px 5px 0 #020d4680}
.ritual-question>span,.ritual-question>strong{display:block;font-size:clamp(40px,6.8vw,94px);line-height:1.25;font-weight:950;letter-spacing:-.04em}.ritual-question>strong{margin-left:1.3em}.ritual-question small{display:block;font-size:14px;line-height:1.9;font-weight:400;text-align:center;margin-top:30px;letter-spacing:.12em;color:#c2dcff;transform:rotate(9deg);text-shadow:0 2px 10px #000}.ritual-question>i{position:absolute;left:-10px;top:32%;font-size:24px;color:#50edfa;font-style:normal}.ritual-question:focus-visible{outline:2px solid #72edff;outline-offset:10px}.ritual-pause-note{position:absolute;bottom:7%;left:0;right:0;text-align:center;font-size:12px;color:#a1b7d7;letter-spacing:.14em}
.ritual-header{position:absolute;top:0;left:0;right:0;padding:22px 32px;display:flex;align-items:center;justify-content:space-between;gap:20px;z-index:5}.ritual-header>span{font-size:13px;font-weight:700;letter-spacing:.1em}.ritual-header>button{color:#d0e4ff;font-size:13px;min-height:44px;padding:8px 13px;border:1px solid #9cc7ff40;background:#020c2799}.ritual-iris{position:absolute;inset:-20% -30%;background:#1d4cde;transform:scaleX(0);z-index:3;pointer-events:none;clip-path:polygon(28% 0,100% 0,72% 100%,0 100%)}
.ritual-deck{position:absolute;inset:18% 0 20%;display:grid;place-items:center;perspective:1000px}.ritual-deck img{position:absolute;max-height:90%;width:min(32vw,260px);aspect-ratio:2/3;object-fit:contain;transform:rotate(var(--fan));box-shadow:12px 15px 0 #0004}.ritual-progress{position:absolute;bottom:10%;left:0;right:0;text-align:center;font-size:14px;letter-spacing:.1em;color:#b9e4ff}
.ritual-result{position:absolute;inset:65px 0 90px}.ritual-footer{position:absolute;bottom:25px;left:7%;right:7%;display:flex;align-items:center;justify-content:space-between;gap:20px;z-index:5}.ritual-footer>small{font-size:12px;color:#a7c7ec}.ritual-footer>button,.ritual-failure button{background:#50edfa;color:#031638;font-weight:900;padding:16px 28px;transform:skew(-8deg);box-shadow:5px 5px 0 #1238be;font-size:16px;min-height:48px}.ritual-footer>button:disabled{opacity:.5}.ritual-footer button span{margin-left:22px}.ritual-failure{position:absolute;left:50%;top:58%;transform:translate(-50%,-50%);z-index:4;width:min(90vw,550px);padding:25px;background:#051336ed;border-left:4px solid #f3a6c8}.ritual-failure p{font-size:15px;line-height:1.8}.ritual-failure button{font-size:14px;padding:12px 18px}
@media(max-width:700px){.ritual-header{padding:12px 16px}.ritual-header>span{font-size:11px;letter-spacing:0}.ritual-result{inset:65px 0 95px}.ritual-footer{bottom:max(22px,env(safe-area-inset-bottom));left:7%;right:7%;gap:8px}.ritual-footer>button{font-size:14px;padding:14px 17px}.ritual-footer>small{font-size:10px;max-width:100px}.ritual-question{padding:18px}.ritual-question>span,.ritual-question>strong{font-size:42px}.ritual-question small{font-size:12px;margin-top:30px}.ritual-pause-note{bottom:9%;font-size:10px}.ritual-deck img{width:45vw}}
@media(max-height:550px){.ritual-header{padding:6px 18px}.ritual-result{inset:45px 0 65px}.ritual-footer{bottom:12px}.ritual-footer>button{padding:10px 18px;min-height:40px}.ritual-question>span,.ritual-question>strong{font-size:40px}.ritual-question small{margin-top:12px}.ritual-pause-note{bottom:4%}}
</style>
