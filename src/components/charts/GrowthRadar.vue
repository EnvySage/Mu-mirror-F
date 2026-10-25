<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, useId, watch } from 'vue'
import { gsap, prefersReducedMotion } from '@/motion/core'
import { starPoint, growthStarPoints, pointsAttribute } from '@/utils/growthStar'
import { useSceneActivity } from '@/motion/useSceneActivity'
const props = defineProps({ axes: { type: Array, default: () => [] }, selectedId: { type: String, default: '' }, compact: Boolean })
const emit = defineEmits(['preview-axis'])
const hoveredId = ref('')
let hoverTimer, pendingAxis = ''
function previewAxis(event) {
  if (event.pointerType === 'touch' || props.axes.length !== 5) return
  const svg = event.currentTarget
  const matrix = svg.getScreenCTM()
  if (!matrix) return
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  if (Math.hypot(p.x - cx, p.y - cy) < 22) { clearTimeout(hoverTimer); pendingAxis = ''; return }
  const angle = (Math.atan2(p.y - cy, p.x - cx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)
  const id = props.axes[Math.round(angle / (Math.PI * 2 / 5)) % 5].id
  if (id === pendingAxis) return
  clearTimeout(hoverTimer)
  pendingAxis = id
  hoverTimer = setTimeout(() => { hoveredId.value = id; emit('preview-axis', id) }, 220)
}
function leavePreview() {
  clearTimeout(hoverTimer); pendingAxis = ''
  if (!props.compact) { hoveredId.value = ''; emit('preview-axis', '') }
}
const root = ref(null), visible = ref(false), changing = ref(false), previousShape = ref('')
const sceneActive = useSceneActivity(root)
const selectionBeat = ref(0)
const uid = useId().replace(/:/g, '')
const motion = reactive({ v0: 0, v1: 0, v2: 0, v3: 0, v4: 0, max: 30 })
let tween, observer, preference, entered = false
const cx = 210, cy = 185, radius = 122
const scoreOf = axis => Math.max(0, Number(axis?.total_points ?? axis?.totalPoints ?? 0) || 0)
const scores = computed(() => props.axes.map(scoreOf))
const chartMax = computed(() => {
  const top = Math.max(6, ...scores.value) * 1.2
  const magnitude = 10 ** Math.floor(Math.log10(top))
  return ([1, 2, 3, 5, 6, 9, 10].find(n => n * magnitude >= top) || 10) * magnitude
})
const point = (index, scale = 1) => starPoint(index, scale, { cx, cy, radius })
const polygon = scale => pointsAttribute(growthStarPoints(Array(5).fill(1), 1, { cx, cy, radius: radius * scale }))
const vertices = computed(() => props.axes.map((_, i) => point(i, Math.min(1, motion[`v${i}`] / motion.max))))
const shape = computed(() => pointsAttribute(growthStarPoints(Array.from({ length: 5 }, (_, i) => motion[`v${i}`]), motion.max, { cx, cy, radius })))
const selectedIndex = computed(() => props.axes.findIndex(a => a.id === (hoveredId.value || props.selectedId || (props.compact ? props.axes[0]?.id : ''))))
const activePoint = computed(() => vertices.value[selectedIndex.value])
const wedge = computed(() => {
  if (selectedIndex.value < 0) return ''
  const p = point(selectedIndex.value, 1.07), a = point(selectedIndex.value - .5, .38), b = point(selectedIndex.value + .5, .38)
  return `M${cx},${cy} L${a.x},${a.y} L${p.x},${p.y} L${b.x},${b.y} Z`
})
function animate() {
  if (props.axes.length !== 5) return
  tween?.kill()
  previousShape.value = entered ? shape.value : ''
  const target = { max: chartMax.value }
  scores.value.forEach((value, index) => { target[`v${index}`] = value })
  if (prefersReducedMotion() || !visible.value) { Object.assign(motion, target); changing.value = false; return }
  changing.value = true
  tween = gsap.timeline({ onComplete: () => { changing.value = false } })
  tween.to(motion, { max: target.max, duration: .9, ease: 'power3.out' }, 0)
  scores.value.forEach((value, index) => { tween.to(motion, { [`v${index}`]: value, duration: 1.05, ease: 'elastic.out(1,.65)' }, index * .065) })
}
watch(selectedIndex, () => { selectionBeat.value += 1 })
function replay() { entered = false; for (let i = 0; i < 5; i++) motion[`v${i}`] = 0; animate(); entered = true }
watch(() => JSON.stringify(props.axes.map(a => [a.id, scoreOf(a)])), () => { if (entered) animate() })
onMounted(() => {
  preference = matchMedia('(prefers-reduced-motion: reduce)')
  preference.addEventListener('change', animate)
  observer = new IntersectionObserver(([entry]) => {
    visible.value = entry.isIntersecting
    if (entry.isIntersecting && !entered) { animate(); entered = true }
    else if (!entry.isIntersecting && entered) animate()
  }, { threshold: .15 })
  observer.observe(root.value)
})
onBeforeUnmount(() => { clearTimeout(hoverTimer); tween?.kill(); observer?.disconnect(); preference?.removeEventListener('change', animate) })
</script>

<template>
  <div ref="root" class="growth-radar-wrap" :class="{ 'is-visible': visible, 'is-changing': changing, 'motion-active': sceneActive, 'is-compact': compact }">
    <div v-if="!compact" class="radar-index"><span aria-hidden="true">THE SHAPE OF YOU.</span><button type="button" class="radar-replay" aria-label="重播星图动效" @click="replay">↻ <span>REPLAY</span></button></div>
    <span v-if="!compact" class="radar-ghost-word" aria-hidden="true">UNFOLD!</span>
    <svg v-if="axes.length === 5" class="growth-radar" viewBox="0 0 420 370" role="img" :data-highlighted-axis="axes[selectedIndex]?.id" :aria-label="`五维成长星图：${axes.map(axis => `${axis.name} ${scoreOf(axis)} 分`).join('，')}`" @pointermove="previewAxis" @pointerleave="leavePreview">
      <defs><linearGradient :id="`${uid}-fill`" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#1766ff"/><stop offset=".6" stop-color="#62f4ff"/><stop offset="1" stop-color="#e4ff9b"/></linearGradient></defs>
      <g class="radar-orbit" aria-hidden="true"><circle :cx="cx" :cy="cy" r="135"/><circle :cx="cx" :cy="cy" r="145"/></g>
      <g class="radar-debris" aria-hidden="true"><path d="M55 75l20 14-23 5Z M341 63l9 24 12-31Z M89 296l-25 20 32-5Z M339 287l27 7-17 18Z"/><path d="M113 43h16m-8-8v16 M315 321h18m-9-9v18" class="radar-sparks"/></g>
      <polygon :points="polygon(1.07)" class="radar-shadow" transform="translate(8 10) rotate(-4 210 185)" />
      <polygon :points="polygon(1.07)" class="radar-outline" transform="rotate(-4 210 185)" />
      <polygon :points="polygon(1)" class="radar-field" />
      <polygon v-for="scale in [.25, .5, .75, 1]" :key="scale" :points="polygon(scale)" class="radar-ring" />
      <path :key="`wedge-${selectionBeat}`" :d="wedge" class="radar-wedge" />
      <line v-for="(_, i) in axes" :key="`line-${i}`" :x1="cx" :y1="cy" :x2="point(i).x" :y2="point(i).y" class="radar-spoke" :class="{ active: i === selectedIndex }" />
      <polygon v-if="changing && previousShape" :points="previousShape" class="radar-previous" />
      <polygon :points="shape" class="radar-area" :fill="`url(#${uid}-fill)`" />
      <g v-for="(p, i) in vertices" :key="axes[i].id" :class="{ active: i === selectedIndex }">
        <path :d="`M${p.x},${p.y-5}l4 5-4 5-4-5Z`" class="radar-point" />
        <g :transform="`translate(${point(i, compact ? .98 : 1.37).x},${point(i, compact ? .94 : 1.29).y}) rotate(${[-7,8,-6,6,-9][i]})`">
          <path d="M-37-17L40-12 34 15-40 10Z" class="radar-label-plate" />
          <text text-anchor="middle" y="4" class="radar-label" :font-size="axes[i].name.length > 4 ? 10 : 15">{{ axes[i].name.length > 8 ? axes[i].name.slice(0, 7) + '…' : axes[i].name }}</text>
          <text text-anchor="middle" y="39" class="radar-score">{{ Math.round(motion[`v${i}`]) }}<tspan class="radar-unit"> PT</tspan></text>
        </g>
      </g>
      <g v-if="activePoint" :key="`target-${selectionBeat}`" class="radar-target-group"><circle :cx="activePoint.x" :cy="activePoint.y" r="13" class="radar-target" /><circle :cx="activePoint.x" :cy="activePoint.y" r="27" class="radar-shockwave" /></g>
      <path :d="`M${cx-5},${cy}h10 M${cx},${cy-5}v10`" class="radar-center" />
    </svg>
    <svg v-else-if="compact" class="growth-radar" viewBox="0 0 420 370" aria-hidden="true"><polygon :points="polygon(1.07)" class="radar-shadow" transform="translate(8 10)" /><polygon :points="polygon(1.07)" class="radar-outline" /><polygon :points="polygon(1)" class="radar-field" /><path :d="`M${cx-5},${cy}h10 M${cx},${cy-5}v10`" class="radar-center" /></svg>
    <p v-else class="growth-radar-unavailable" role="status">五维定义暂不可用，成长分数仍保留在账本中。</p>
    <div v-if="!compact" class="radar-footer"><span><i /> 已确认的成长</span><span>刻度上限 {{ chartMax }}</span></div>
    <p v-if="!compact" class="growth-radar-caption">尖端对应真实分数 · 刻度自适应 · 分数不封顶</p>
  </div>
</template>

<style scoped src="@/assets/styles/growth-star.css"></style>

<style scoped>
.growth-radar-wrap.is-compact{width:100%;height:100%;max-width:none}.is-compact .growth-radar{height:100%;width:100%;filter:drop-shadow(10px 16px 0 #03173555)}
</style>
