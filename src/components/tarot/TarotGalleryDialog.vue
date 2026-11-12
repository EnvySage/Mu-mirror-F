<script setup>
import { computed, ref, watch } from 'vue'
import { tarotDate } from '@/utils/tarotProtocol'
import { tarotPerspective, tarotCategory, orientationLabel } from '@/utils/tarotPresentation'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { reportAchievementActivity } from '@/api/achievements'
import { vReadEnd } from '@/composables/useReadingEnd'
const props = defineProps({ card: Object, orientation: String, locked: Boolean, entry: Object, cards: { type: Array, default: () => [] } })
const meaningOrientation = ref('upright')
const activeOrientation = computed(() => props.entry ? meaningOrientation.value : props.orientation || 'upright')
const perspective = computed(() => tarotPerspective(props.card, activeOrientation.value))
watch([() => props.card?.id, () => props.orientation], () => { meaningOrientation.value = props.orientation === 'reversed' ? 'reversed' : 'upright' }, { immediate: true })
function readMeaning() {
  if (props.entry && !props.locked) reportAchievementActivity('tarot.meaning_opened', props.card.id, null, activeOrientation.value)
}
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
          <img ref="picture" :src="card.image_url" :alt="card.name" width="1024" height="1536" draggable="false" :style="{ transform: `translate(${x}px,${y}px) scale(${scale}) rotate(${activeOrientation === 'reversed' ? 180 : 0}deg)` }" />
        </div>
        <aside class="gallery-info">
          <div v-if="entry && !locked" class="meaning-controls" role="group" aria-label="选择卡牌释义"><button type="button" :aria-pressed="activeOrientation === 'upright'" @click="meaningOrientation = 'upright'">正位释义</button><button type="button" :aria-pressed="activeOrientation === 'reversed'" @click="meaningOrientation = 'reversed'">逆位释义</button></div>
          <div :key="`${card.id}:${activeOrientation}`" v-read-end="{ key: `${card.id}:${activeOrientation}`, onRead: readMeaning }">
          <span>{{ tarotCategory(card).name }} · {{ orientationLabel(activeOrientation) }}<template v-if="locked"> · 尚未收藏</template></span>
          <h2>{{ card.name }} <small>{{ card.en }}</small></h2>
          <b>{{ perspective.keyword }}</b><p>{{ perspective.meaning }}</p><p class="gallery-action">小尝试 / {{ perspective.action }}</p>
          <small v-if="entry">{{ tarotDate(entry.first_obtained_at) }} 首次获得 · 每日抽中 {{ entry.daily_draw_count }} 次</small>
          </div>
        </aside>
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
.meaning-controls{display:flex;gap:9px;margin-bottom:13px}.meaning-controls button{min-height:40px;padding:7px 10px;border:1px solid #97bac5;color:#e9f7f3;font-size:12px}.meaning-controls button[aria-pressed=true]{background:#d4eee6;color:#153b51}
.tarot-gallery{position:fixed;inset:0;z-index:1120;color:white;background:#052a4e9c;backdrop-filter:blur(20px);overflow:hidden;outline:none}
.gallery-canvas{position:absolute;inset:0 42% 0 0;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none;overscroll-behavior:contain;cursor:zoom-in;outline:none}
.gallery-canvas.enlarged{cursor:grab}.gallery-canvas.enlarged:active{cursor:grabbing}
.gallery-canvas img{display:block;flex:none;width:min(54vw,55dvh);height:min(82dvh,81vw);max-width:none;object-fit:contain;user-select:none;-webkit-user-select:none;will-change:transform}
.gallery-close{position:absolute;right:max(14px,env(safe-area-inset-right));top:max(14px,env(safe-area-inset-top));width:48px;height:48px;background:#123b57b0;backdrop-filter:blur(10px);color:white;font-size:32px;clip-path:polygon(12% 0,100% 8%,88% 100%,0 88%);transform:rotate(5deg)}
.gallery-controls{position:absolute;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:12px;white-space:nowrap}
.gallery-controls button{min-width:44px;min-height:44px;background:#123b57b0;backdrop-filter:blur(10px);clip-path:polygon(8% 0,100% 9%,91% 100%,0 90%);padding:6px 14px;font-size:24px}
.gallery-controls .gallery-reset{font-size:12px}.gallery-count,.gallery-controls small{font-size:11px;color:#e5f3f6;text-shadow:0 1px 5px #00162c}.gallery-controls small{font-weight:400}
.gallery-fade-enter-active,.gallery-fade-leave-active{transition:opacity .18s ease}.gallery-fade-enter-from,.gallery-fade-leave-to{opacity:0}
@media(prefers-reduced-motion:reduce){.gallery-fade-enter-active,.gallery-fade-leave-active{transition:none}}
.gallery-info{position:absolute;left:60%;right:5%;top:50%;transform:translateY(-50%);max-height:75dvh;overflow-y:auto;padding:18px 0;line-height:1.9;overflow-wrap:anywhere}.gallery-info>span,.gallery-info>small{color:#b4dbe6;font-size:12px}.gallery-info h2{font-size:30px;margin:12px 0}.gallery-info h2 small{display:block;font:12px var(--font);letter-spacing:.08em;color:#b4dbe6}.gallery-info b{color:#d4eee6}.gallery-info p{font-size:15px}.gallery-action{border-left:2px solid #a8dcca;padding-left:12px}.gallery-info{user-select:text}
@media(max-width:700px){.gallery-canvas{inset:55px 0 44%}.gallery-canvas img{width:min(65vw,31dvh);height:min(46dvh,97.5vw)}.gallery-info{top:57%;bottom:76px;left:7%;right:7%;transform:none;max-height:none;padding:0}.gallery-info h2{font-size:23px;margin:4px 0}.gallery-info h2 small{display:none}.gallery-info p{font-size:13px;margin:8px 0}.gallery-info>span,.gallery-info>small{font-size:11px}}
</style>
