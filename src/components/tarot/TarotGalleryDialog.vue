<script setup>
import { computed, ref, watch } from 'vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
const props = defineProps({ card: Object, cards: { type: Array, default: () => [] } })
const emit = defineEmits(['close', 'select'])
const dialog = ref(null), viewport = ref(null), picture = ref(null)
const scale = ref(1), x = ref(0), y = ref(0)
const index = computed(() => props.cards.findIndex(c => c.id === props.card?.id))
const points = new Map()
let gesture
function reset() { scale.value = 1; x.value = y.value = 0; points.clear(); gesture = null }
watch(() => props.card?.id, reset)
useDialogFocus(() => !!props.card, dialog, '.gallery-close', () => emit('close'))
function step(delta) {
  if (props.cards.length < 2) return
  emit('select', props.cards[(index.value + delta + props.cards.length) % props.cards.length])
}
function constrain() {
  if (!picture.value || !viewport.value) return
  const maxX = Math.max(0, (picture.value.clientWidth * scale.value - viewport.value.clientWidth) / 2)
  const maxY = Math.max(0, (picture.value.clientHeight * scale.value - viewport.value.clientHeight) / 2)
  x.value = Math.min(maxX, Math.max(-maxX, x.value))
  y.value = Math.min(maxY, Math.max(-maxY, y.value))
}
function zoomAt(next, clientX, clientY) {
  const r = viewport.value.getBoundingClientRect(), previous = scale.value
  scale.value = Math.max(1, Math.min(5, next))
  const px = clientX - r.left - r.width / 2, py = clientY - r.top - r.height / 2
  x.value = px - (px - x.value) * scale.value / previous
  y.value = py - (py - y.value) * scale.value / previous
  constrain()
}
function wheel(e) { zoomAt(scale.value * Math.exp(-e.deltaY * .002), e.clientX, e.clientY) }
function doubleClick(e) { if (scale.value > 1) reset(); else zoomAt(2.5, e.clientX, e.clientY) }
function measureGesture() {
  const p = [...points.values()]
  if (!p.length) return null
  return p.length > 1 ? { cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2, distance: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) } : { cx: p[0].x, cy: p[0].y, distance: 0 }
}
function seed() { gesture = measureGesture() }
function down(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  viewport.value.setPointerCapture(e.pointerId)
  points.set(e.pointerId, { x: e.clientX, y: e.clientY }); seed()
}
function move(e) {
  if (!points.has(e.pointerId)) return
  points.set(e.pointerId, { x: e.clientX, y: e.clientY })
  const next = measureGesture()
  if (gesture && next) {
    x.value += next.cx - gesture.cx; y.value += next.cy - gesture.cy
    if (next.distance && gesture.distance) zoomAt(scale.value * next.distance / gesture.distance, next.cx, next.cy)
    else constrain()
  }
  gesture = next
}
function up(e) { points.delete(e.pointerId); seed() }
function key(e) {
  if (['+', '=', '-', '0'].includes(e.key)) {
    e.preventDefault()
    if (e.key === '0') reset()
    else { const r = viewport.value.getBoundingClientRect(); zoomAt(scale.value * (e.key === '-' ? .8 : 1.25), r.left + r.width / 2, r.top + r.height / 2) }
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    if (scale.value === 1) step(e.key === 'ArrowLeft' ? -1 : 1)
    else { x.value += e.key === 'ArrowLeft' ? 80 : -80; constrain() }
  }
}
</script>
<template>
  <Teleport to="body">
    <Transition name="gallery-fade">
      <section v-if="card" ref="dialog" class="tarot-gallery" role="dialog" aria-modal="true" :aria-label="`欣赏${card.name}`" tabindex="-1" @keydown="key">
        <div ref="viewport" class="gallery-canvas" :class="{ enlarged: scale > 1 }" tabindex="0" aria-label="卡面原图，可双指或滚轮缩放、拖动查看"
          @wheel.prevent="wheel" @dblclick="doubleClick" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up">
          <img ref="picture" :src="card.image_url" :alt="card.name" width="1024" height="1536" draggable="false" :style="{ transform: `translate(${x}px,${y}px) scale(${scale})` }" />
        </div>
        <button class="gallery-close" aria-label="关闭卡牌原图" @click="$emit('close')">×</button>
        <nav class="gallery-controls" aria-label="卡牌原图操作">
          <button v-if="cards.length > 1" aria-label="上一张" @click="step(-1)">←</button>
          <span v-if="cards.length > 1 && scale === 1" class="gallery-count">{{ index + 1 }} / {{ cards.length }}</span>
          <button v-if="scale > 1" class="gallery-reset" @click="reset">还原</button>
          <small v-else>双指或滚轮缩放</small>
          <button v-if="cards.length > 1" aria-label="下一张" @click="step(1)">→</button>
        </nav>
      </section>
    </Transition>
  </Teleport>
</template>
<style scoped>
.tarot-gallery{position:fixed;inset:0;z-index:1120;color:white;background:#052a4e9c;backdrop-filter:blur(20px);overflow:hidden;outline:none}
.gallery-canvas{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none;overscroll-behavior:contain;cursor:zoom-in;outline:none}
.gallery-canvas.enlarged{cursor:grab}.gallery-canvas.enlarged:active{cursor:grabbing}
.gallery-canvas img{display:block;flex:none;width:min(100vw,66.6667dvh);height:min(100dvh,150vw);max-width:none;object-fit:contain;user-select:none;-webkit-user-select:none;will-change:transform}
.gallery-close{position:absolute;right:max(14px,env(safe-area-inset-right));top:max(14px,env(safe-area-inset-top));width:48px;height:48px;background:#123b57b0;backdrop-filter:blur(10px);color:white;font-size:32px;clip-path:polygon(12% 0,100% 8%,88% 100%,0 88%);transform:rotate(5deg)}
.gallery-controls{position:absolute;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:12px;white-space:nowrap}
.gallery-controls button{min-width:44px;min-height:44px;background:#123b57b0;backdrop-filter:blur(10px);clip-path:polygon(8% 0,100% 9%,91% 100%,0 90%);padding:6px 14px;font-size:24px}
.gallery-controls .gallery-reset{font-size:12px}.gallery-count,.gallery-controls small{font-size:11px;color:#e5f3f6;text-shadow:0 1px 5px #00162c}.gallery-controls small{font-weight:400}
.gallery-fade-enter-active,.gallery-fade-leave-active{transition:opacity .18s ease}.gallery-fade-enter-from,.gallery-fade-leave-to{opacity:0}
@media(prefers-reduced-motion:reduce){.gallery-fade-enter-active,.gallery-fade-leave-active{transition:none}}
</style>
