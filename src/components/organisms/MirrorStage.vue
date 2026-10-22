<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { captureMirrorFace, beginMirrorShatter, scheduleMirrorWarm } from '@/composables/useMirrorShatter'
import { useMirrorCardMotion } from '@/motion/useMirrorCardMotion'

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
let cancelWarm
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
onBeforeUnmount(() => { cancelWarm?.(); revealEffect?.cancel() })
onMounted(() => { cancelWarm = scheduleMirrorWarm(surface.value) })
defineExpose({ surface, capture, reveal })
</script>

<template>
  <section class="mirror-composition" aria-label="镜面与历史画像">
    <div ref="surface" class="mirror-surface" :class="{ 'is-shattering': shattering }">
      <div class="surface-art" aria-hidden="true" />
      <div class="surface-copy">
        <span class="surface-date">{{ activeNode?.label || '属于你的生活切面' }}<i />{{ activeNode?.type === 'monthly' ? '月度画像' : '我的镜子' }}</span>
        <h2 v-if="profile">这一面，<br>是此刻的你。</h2>
        <h2 v-else>从一条记录，<br>看见自己。</h2>
        <p :key="currentId" class="surface-summary">{{ summary }}</p>
        <button v-if="!profile" class="surface-write" @click="emit('write')">留下第一条记录 <span aria-hidden="true">＋</span></button>
        <div v-else class="surface-signature"><span />每个阶段，都有自己的光。</div>
      </div>
      <div class="surface-edition" aria-hidden="true"><b>{{ month || 'M' }}</b><span>{{ activeNode?.type === 'monthly' ? '月的镜子' : '生活的切面' }}</span></div>
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
</style>
