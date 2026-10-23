<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { captureMirrorCut as captureMirrorFace, beginMirrorCut as beginMirrorShatter } from '@/composables/useMirrorCut'
import { useMirrorCardMotion } from '@/motion/useMirrorCardMotion'
import { gsap, prefersReducedMotion } from '@/motion/core'

const props = defineProps({
  profile: { type: Object, default: null },
  nodes: { type: Array, default: () => [] },
  currentId: { type: [Number, String], default: null },
  busy: { type: Boolean, default: false },
  metrics: { type: Array, default: () => [] },
})
const emit = defineEmits(['select', 'write'])
const surface = ref(null)
const deck = ref(null)
const cardMotion = useMirrorCardMotion(deck, () => props.currentId, () => props.nodes.map(node => node.id).join(','))
const shattering = ref(false)
let revealEffect = null
const mirrorArt = ref(null)
const inView = ref(false)
let artTween, observer, motionPreference
function onMotionPreference(event) { if (event.matches) resetArt() }
function moveArt(event) {
  if (prefersReducedMotion() || event.pointerType !== 'mouse' || props.busy) return
  const bounds = surface.value.getBoundingClientRect()
  artTween?.kill()
  artTween = gsap.to(mirrorArt.value, { x: (event.clientX - bounds.x - bounds.width / 2) * .025, y: (event.clientY - bounds.y - bounds.height / 2) * .025, rotation: (event.clientX - bounds.x - bounds.width / 2) * .008, duration: .6, ease: 'power3.out' })
}
function resetArt() { artTween?.kill(); artTween = gsap.to(mirrorArt.value, { x: 0, y: 0, rotation: 0, duration: prefersReducedMotion() ? 0 : .65, ease: 'power3.out' }) }
const activeNode = computed(() => props.nodes.find(n => n.id === props.currentId))
const month = computed(() => (activeNode.value?.periodMonth || props.profile?.created_at || '').slice(5, 7))
const summary = computed(() => props.profile?.overall_summary || '每一条认真留下的记录，都会让这一面更清晰。')

function capture() { return captureMirrorFace(surface.value) }
async function reveal(captured = null) {
  if (shattering.value) return false
  shattering.value = true
  revealEffect = beginMirrorShatter(surface.value, { captured })
  try { return await revealEffect?.reveal() || false }
  finally { revealEffect = null; shattering.value = false }
}
function select(node, event) {
  if (props.busy || shattering.value || node.id === props.currentId) return
  emit('select', node, event.currentTarget)
}
function moveFocus(event, index) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()
  const cards = [...deck.value.querySelectorAll('[role="tab"]')]
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length
  cards[next]?.focus({ preventScroll: true })
  cards[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
}
onBeforeUnmount(() => { artTween?.kill(); observer?.disconnect(); revealEffect?.cancel(); motionPreference?.removeEventListener('change', onMotionPreference) })
onMounted(() => {
  observer = new IntersectionObserver(([entry]) => { inView.value = entry.isIntersecting }); observer.observe(surface.value)
  motionPreference = matchMedia('(prefers-reduced-motion: reduce)'); motionPreference.addEventListener('change', onMotionPreference)
})
defineExpose({ surface, capture, reveal })
</script>

<template>
  <section class="mirror-composition" aria-label="镜面与历史画像">
    <div ref="surface" class="mirror-surface" :class="{ 'is-shattering': shattering, 'in-view': inView }" @pointermove="moveArt" @pointerleave="resetArt">
      <div class="surface-art" aria-hidden="true" />
      <span class="surface-watermark" aria-hidden="true">REFLECT<br>YOURSELF.</span>
      <div ref="mirrorArt" class="kinetic-mirror" aria-hidden="true">
        <svg class="mirror-facets" viewBox="0 0 380 420" fill="none">
          <path class="mirror-orbit" d="M42 240C-40 54 294-34 342 127S154 443 55 324" stroke="#6ddcff" stroke-dasharray="80 12 3 12"/>
          <path d="M96 73L266 25L342 276L149 385L42 231Z" fill="#6af2ff"/>
          <path d="M107 83L260 41L325 268L154 367L56 231Z" fill="#051731" stroke="#eaffff" stroke-width="2"/>
          <path d="M120 96L250 61L307 260L161 344L75 228Z" fill="#2362d8"/>
          <path d="M120 96L250 61L198 204L75 228Z" fill="#69ddfa"/>
          <path d="M250 61L307 260L198 204Z" fill="#1448a7"/>
          <path d="M75 228L198 204L161 344Z" fill="#0e347d"/>
          <path d="M198 204L307 260L161 344Z" fill="#4ac6ee"/>
          <path d="M120 96L198 204L161 344M250 61L198 204L75 228M198 204L307 260" stroke="#c4faff" stroke-opacity=".7"/>
          <path class="mirror-glint" d="M111 116L244 80L253 113L100 155Z" fill="#e4ffff" fill-opacity=".6"/>
          <path d="M96 278L290 198L296 220L111 300Z" fill="#a9ffff" fill-opacity=".8"/>
          <path class="mirror-float mirror-float-a" d="M51 78L80 90L46 126Z" fill="#e1ffff"/>
          <path class="mirror-float mirror-float-b" d="M303 328L351 301L337 359Z" fill="#ef4b92"/>
          <path class="mirror-float mirror-float-c" d="M82 344L107 374L62 388Z" fill="#61edff"/>
          <path d="M332 100V121M322 110H343M36 285V304M27 295H46" stroke="#a4eaff" stroke-width="2"/>
        </svg>
        <span class="mirror-sticker">BE / YOU</span>
      </div>
      <div class="surface-copy">
        <span class="surface-date">{{ activeNode?.label || '属于你的生活切面' }}<i />{{ activeNode?.type === 'monthly' ? '月度画像' : '我的镜子' }}</span>
        <h2 v-if="profile"><span>这一面，</span><br><em>是此刻的你。</em></h2>
        <h2 v-else>从一条记录，<br>看见自己。</h2>
        <p :key="currentId" class="surface-summary">{{ summary }}</p>
        <button v-if="!profile" class="surface-write" @click="emit('write')">留下第一条记录 <span aria-hidden="true">＋</span></button>
        <div v-else class="surface-signature"><span />每个阶段，都有自己的光。</div>
      </div>
      <div class="surface-edition" aria-hidden="true"><b>{{ month || 'M' }}</b><span>{{ activeNode?.type === 'monthly' ? '月的镜子' : '生活的切面' }}</span></div>
      <button type="button" class="surface-replay" :disabled="busy || shattering" @click="reveal()" aria-label="重播镜面动效">↗ <span>重播动效</span></button>
      <div class="surface-metrics" aria-label="近 30 天统计">
        <div v-for="metric in metrics" :key="metric.label"><b>{{ metric.value }}</b><span>{{ metric.label }}</span></div>
        <small>近 30 天</small>
      </div>
    </div>

    <div v-if="nodes.length" class="deck-section">
      <div class="deck-heading"><div><h3>挑选一个时刻</h3><p>翻开记录里的另一面自己</p></div><span>{{ nodes.length }} 份画像</span></div>
      <div ref="deck" class="memory-deck" role="tablist" aria-label="挑选历史画像">
        <div v-for="(node, index) in nodes" :key="node.id" class="memory-card-shell">
        <button type="button" role="tab"
          :class="['memory-card', { selected: currentId === node.id, 'archive-only': node.contextStatus !== 'usable' }]"
          :data-node-id="node.id" :data-fan-angle="(index % 3 - 1) * 4"
          :aria-selected="currentId === node.id" :aria-label="`${node.label}，${node.type === 'monthly' ? '月度画像' : '手动画像'}，第 ${node.version} 版，${node.contextStatus === 'usable' ? '可续写' : '仅归档'}${node.archiveDiscontinuity ? '，累计历史有断点' : ''}`"
          :title="`${node.label} · V${node.version}${node.deletedSourceCount ? ` · ${node.deletedSourceCount} 条来源已移除` : ''}${node.archiveDiscontinuity ? ' · 累计历史有断点' : ''}`"
          :tabindex="currentId === node.id || (!nodes.some(n => n.id === currentId) && index === 0) ? 0 : -1"
          :disabled="busy || shattering" @click="select(node, $event)" @pointerenter="cardMotion.enter" @pointermove="cardMotion.move" @pointerleave="cardMotion.leave" @focus="cardMotion.focus" @blur="cardMotion.blur" @keydown="moveFocus($event, index)"
        >
          <span class="card-etching" aria-hidden="true" />
          <span class="card-topline"><span>{{ node.periodMonth?.slice(0, 4) }} {{ node.type === 'monthly' ? '月度画像' : '手动画像' }}</span><small>V{{ node.version }}</small></span>
          <strong class="card-date">{{ node.type === 'monthly' && node.periodMonth ? `${Number(node.periodMonth.slice(5, 7))}月` : node.label }}</strong>
          <span v-if="node.archiveDiscontinuity" class="card-history-warning">历史断点</span>
          <span class="card-story">{{ node.summary || '打开画像，回看当时的记录与总结。' }}</span>
          <span class="card-bottomline"><span>{{ node.contextStatus === 'usable' ? '可续写' : '仅归档' }}</span><b>{{ currentId === node.id ? '已翻开' : '翻开' }} <i aria-hidden="true">{{ currentId === node.id ? '✓' : '↗' }}</i></b></span>
          <span class="card-light-mask" aria-hidden="true"><span class="card-sheen" /></span>
        </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mirror-composition { --mirror-edge:#8fdcf057; color:#eaf7ff; background:#06152e; border:1px solid var(--mirror-edge); }
.mirror-surface { position:relative; isolation:isolate; height:440px; overflow:hidden; background:#071f4d; }
.surface-art { position:absolute; inset:0; z-index:-1; background:url('/art/mirror/glass-face.svg') center / cover; }
.surface-copy { position:relative; z-index:1; width:56%; padding:38px 0 92px clamp(22px,3.4vw,48px); }
.surface-date { display:flex; align-items:center; gap:12px; color:#a2d4ed; font-size:11px; }
.surface-date i { width:22px; height:1px; background:#7ae9ff; }
.surface-copy h2 { margin:26px 0 20px; font-size:clamp(32px,3.6vw,52px); line-height:1.27; letter-spacing:-.045em; font-weight:800; color:#f1fbff; }
.surface-summary { max-width:43ch; color:#c5daeb; font-size:13px; line-height:1.95; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; }
.surface-signature { margin-top:22px; display:flex; align-items:center; gap:9px; color:#9ec4d9; font-size:10px; }
.surface-signature > span { width:5px; height:5px; background:#87efff; transform:rotate(45deg); box-shadow:0 0 12px #71edff; }
.surface-edition { position:absolute; top:32px; right:30px; display:grid; justify-items:end; color:#c6efff; }
.surface-edition b { font:italic 800 54px/.9 var(--font-display); letter-spacing:-.04em; }
.surface-edition span { margin-top:7px; font-size:10px; letter-spacing:.05em; }
.surface-metrics { position:absolute; left:0; bottom:0; right:0; display:flex; gap:clamp(18px,3vw,44px); align-items:center; min-height:70px; padding:12px clamp(22px,3.4vw,48px); border-top:1px solid #b1eaff30; background:#04132dcd; }
.surface-metrics > div { display:flex; align-items:baseline; gap:9px; }
.surface-metrics b { font:700 27px/1 var(--font-display); color:#b0f5ff; }
.surface-metrics span { font-size:11px; color:#adc9dd; }
.surface-metrics small { margin-left:auto; font-size:10px; color:#7899b6; }
.surface-write { display:inline-flex; gap:20px; align-items:center; margin-top:20px; padding:9px 14px; background:var(--cyan); color:#041732; font-size:12px; font-weight:700; }
.deck-section { background:linear-gradient(150deg,#0c294e88,#030e24); border-top:1px solid var(--mirror-edge); }
.deck-heading { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:24px 28px 0; }
.deck-heading h3 { margin:0; font-size:16px; font-weight:600; color:#d9f5ff; }
.deck-heading p { margin:4px 0 0; font-size:11px; color:#86a8c5; }
.deck-heading > span { font-size:10px; color:#86a8c5; white-space:nowrap; }
.memory-deck { display:flex; align-items:flex-end; justify-content:safe center; gap:16px; padding:42px 30px 26px; overflow-x:auto; overflow-y:hidden; perspective:1100px; scroll-snap-type:x proximity; scrollbar-width:thin; }
.memory-card-shell { flex:0 0 176px; width:176px; height:232px; scroll-snap-align:center; }
.memory-card { position:relative; width:100%; height:100%; display:flex; flex-direction:column; align-items:stretch; padding:17px 16px 13px; text-align:left; color:#b4d1e7; border:1px solid #6393b15c; background:#091d3b; transform-origin:50% 90%; transition:border-color .2s,box-shadow .2s; isolation:isolate; border-radius:3px; box-shadow:0 12px 20px #01081c80; }
.card-etching { position:absolute; inset:0; z-index:-1; opacity:.48; background:url('/art/mirror/card-back.svg') center/cover; border-radius:inherit; }
.memory-card-shell:nth-child(3n + 2) .card-etching { filter:hue-rotate(17deg); }
.memory-card-shell:nth-child(3n) .card-etching { filter:hue-rotate(-17deg); }
.memory-card::before { content:''; position:absolute; inset:7px; border:1px solid #bbf5ff20; pointer-events:none; }
.card-topline { display:flex; justify-content:space-between; align-items:center; font-size:9px; color:#b3ccdf; }
.card-topline small { font:700 11px var(--font-display); }
.card-date { display:block; margin-top:16px; font-family:var(--font-display); font-size:26px; line-height:1.1; font-weight:700; color:#e9fbff; }
.card-history-warning { align-self:flex-start; margin-top:7px; padding:1px 5px; border:1px solid #e7b58966; color:#f5d2aa; font-size:9px; line-height:1.5; }
.card-story { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; margin-top:auto; font-size:10px; line-height:1.7; color:#c2d6e5; text-shadow:0 1px 4px #010717; }
.card-bottomline { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:14px; padding-top:10px; border-top:1px solid #90c9e83d; font-size:9px; color:#8faec7; }
.card-bottomline b { font-weight:500; color:#c1edff; }
.card-bottomline i { margin-left:3px; font-style:normal; }
.card-light-mask { position:absolute; inset:0; border-radius:inherit; overflow:hidden; pointer-events:none; }
.card-sheen { position:absolute; inset:-60%; opacity:0; pointer-events:none; background:linear-gradient(115deg,transparent 36%,#d6faff40 50%,transparent 64%); }
.memory-card.selected { border-color:#9ef2ff; color:white; box-shadow:0 0 0 1px #78e7ff3d,0 0 30px #36b9ff1f,0 20px 30px #01081c99; z-index:2; }
.memory-card.selected .card-etching { opacity:.8; }
.memory-card.selected .card-bottomline b { color:var(--cyan); }
.memory-card.archive-only .card-topline { color:#c2b5d9; }
.memory-card:focus-visible { outline:2px solid var(--cyan); outline-offset:4px; }
.memory-card:disabled { cursor:wait; }
@media(hover:hover) {
 .memory-card:not(:disabled):hover { border-color:#b4f6ff; z-index:3; }
}
@media(max-width:699px) {
 .mirror-surface { height:445px; }
 .surface-art { background-position:63% center; opacity:.85; }
 .surface-copy { width:75%; padding:30px 0 120px 22px; }
 .surface-copy h2 { margin:25px 0 18px; font-size:33px; }
 .surface-summary { font-size:12px; -webkit-line-clamp:3; }
 .surface-signature { font-size:9px; max-width:180px; line-height:1.6; }
 .surface-edition { right:18px; top:24px; }
 .surface-edition b { font-size:42px; }
 .surface-edition span { font-size:9px; }
 .surface-metrics { padding:14px 20px; gap:22px; }
 .surface-metrics > div { flex-direction:column; gap:7px; }
 .surface-metrics b { font-size:25px; }
 .surface-metrics span { font-size:10px; }
 .surface-metrics small { display:none; }
 .deck-heading { padding:22px 20px 0; }
 .deck-heading h3 { font-size:15px; }
 .deck-heading p { font-size:10px; }
 .memory-deck { justify-content:flex-start; gap:12px; padding:36px 24px 22px; }
 .memory-card-shell { flex-basis:154px; width:154px; height:214px; }
 .memory-card { padding:16px 13px 12px; }
 .card-date { font-size:24px; }
}
@media(prefers-reduced-motion:reduce) {
 .memory-card { transition:none; }
 .card-sheen { display:none; }
}
/* A live, faceted mirror rather than a flat illustration. */
.mirror-composition{border-color:#6acbfa66;background:#05132c}
.mirror-surface{height:430px;background:#082653;container-type:inline-size}
.surface-art{background:linear-gradient(118deg,#031733 8%,#0b397d 57%,#1355c2 100%)}
.surface-art::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(115deg,transparent 0 56px,#79c4ff16 57px 58px)}
.surface-watermark{position:absolute;top:21px;right:-8px;font:italic 900 clamp(64px,11cqw,140px)/.79 var(--font-display);letter-spacing:-.04em;color:#5c9ded25;pointer-events:none;transform:rotate(-8deg)}
.kinetic-mirror{position:absolute;right:0;top:12px;width:50%;height:calc(100% - 80px);pointer-events:none;will-change:transform}
.mirror-facets{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(12px 18px 0 #020d2d66)}
.mirror-orbit{transform-origin:190px 210px;animation:mirror-orbit 24s linear infinite;animation-play-state:paused}
.mirror-float{animation:mirror-drift 5s ease-in-out infinite alternate;animation-play-state:paused}.mirror-float-b{animation-delay:-2s}.mirror-float-c{animation-delay:-3s}
.mirror-glint{animation:mirror-light 6s ease-in-out infinite;animation-play-state:paused}.in-view .mirror-orbit,.in-view .mirror-float,.in-view .mirror-glint{animation-play-state:running}
.mirror-sticker{position:absolute;bottom:17%;right:14%;font:italic 900 25px/1 var(--font-display);background:#f2fcff;color:#071c3b;padding:5px 12px;transform:rotate(-12deg);box-shadow:4px 4px 0 #ed4082}
.surface-copy{width:58%;padding:35px 0 0 clamp(20px,3.2vw,40px)}
.surface-date{gap:8px;font-size:10px;flex-wrap:wrap;color:#b5e9ff}.surface-date i{width:15px}
.surface-copy h2{font-size:clamp(26px,4.6cqw,47px);line-height:1.55;margin:25px 0 18px;letter-spacing:-.045em;transform:rotate(-4deg);transform-origin:left center}
.surface-copy h2 span{display:inline-block;background:#eefdff;color:#071832;padding:0 10px;box-shadow:5px 5px 0 #02132c}
.surface-copy h2 em{display:inline-block;background:#68edff;color:#041a35;font-style:normal;padding:0 10px;margin-top:8px;white-space:nowrap;box-shadow:5px 5px 0 #02132c}
.surface-summary{font-size:12px;max-width:36ch;line-height:1.8;margin-top:25px;-webkit-line-clamp:3;color:#d3e8ff}
.surface-signature{margin-top:14px;font-size:10px}.surface-edition{top:23px;right:22px}.surface-edition b{font-size:45px}.surface-edition span{font-size:9px}
.surface-metrics{min-height:72px;background:#03132df2;padding:14px clamp(20px,3.2vw,40px);gap:24px}.surface-metrics b{font:italic 800 32px/1 var(--font-display);color:#6defff}.surface-metrics>div{gap:8px}.surface-metrics span{font-size:10px}
.surface-replay{position:absolute;bottom:90px;right:22px;z-index:2;display:flex;align-items:center;gap:7px;min-height:40px;padding:8px 12px;border:1px solid #8fd8ff88;background:#041c42bd;color:#cdf6ff;font-size:14px;cursor:pointer}.surface-replay span{font-size:10px}.surface-replay:hover{background:#76edff;color:#03172e}.surface-replay:focus-visible{outline:3px solid #ff8abb;outline-offset:3px}.surface-replay:disabled{opacity:.5;cursor:wait}
.deck-heading h3{font-weight:800}.deck-heading h3::before{content:'REWIND / ';font:italic 800 19px var(--font-display);color:#72eaff;margin-right:6px}.deck-heading{padding-top:22px}.deck-section{background:#06162f}.memory-card.selected{border-color:#c0faff;box-shadow:4px 5px 0 #49dcec,0 15px 24px #01081c99}.memory-card.selected .card-topline{color:#b8f8ff}.memory-card.selected .card-bottomline b{background:#70efff;color:#051632;padding:3px 6px}
@keyframes mirror-orbit{to{transform:rotate(360deg)}}@keyframes mirror-drift{to{transform:translate(5px,-10px) rotate(4deg)}}@keyframes mirror-light{0%,100%{opacity:.25;transform:translateY(-6px)}50%{opacity:.85;transform:translateY(8px)}}
@container(max-width:500px){.surface-copy{width:76%;padding-top:25px}.surface-copy h2{font-size:clamp(23px,7cqw,33px);margin-top:28px}.surface-summary{max-width:27ch;font-size:11px}.kinetic-mirror{width:65%;right:-21%;top:45px;opacity:.75}.surface-edition{top:20px;right:15px}.surface-edition b{font-size:34px}.surface-signature{max-width:200px}.surface-replay{right:12px;bottom:88px;padding:8px}.surface-watermark{top:54px;font-size:75px}.mirror-sticker{display:none}.surface-metrics{gap:22px}.surface-metrics>div{flex-direction:column;gap:5px}.surface-metrics small{display:none}.surface-metrics b{font-size:27px}}
@container(max-width:350px){.surface-summary{max-width:75%}.surface-signature{max-width:78%;line-height:1.6}.kinetic-mirror{right:-24%}}
@media(max-width:699px){.mirror-surface{height:430px}.surface-art{opacity:1}.deck-heading{flex-wrap:wrap}.deck-heading h3::before{font-size:17px}}
@media(prefers-reduced-motion:reduce){.mirror-orbit,.mirror-float,.mirror-glint{animation:none}.kinetic-mirror{will-change:auto}}
</style>
