<script setup>
import { onBeforeUnmount, ref, useId } from 'vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { prefersReducedMotion } from '@/motion/core'

const props = defineProps({ open: Boolean, busy: Boolean, title: String, subtitle: String, anchor: Object })
const emit = defineEmits(['close'])
const panel = ref(null), titleId = useId()
const animations = new Set()
const close = () => { if (!props.busy) emit('close') }
useDialogFocus(() => props.open, panel, '.growth-entry-close', close)

function animate(node, frames, options) {
  const animation = node.animate(frames, options)
  animations.add(animation)
  animation.finished.catch(() => {}).finally(() => { animations.delete(animation); animation.cancel() })
  return animation
}
function originTransform(node) {
  const from = props.anchor?.isConnected ? props.anchor.getBoundingClientRect() : null
  if (!from || !from.width || from.bottom < 0 || from.top > innerHeight) return 'translateY(30px) scale(.9)'
  const to = node.getBoundingClientRect()
  return `translate(${from.left + from.width / 2 - to.left - to.width / 2}px,${from.top + from.height / 2 - to.top - to.height / 2}px) rotate(-4deg) scale(${from.width / to.width},${from.height / to.height})`
}
function enter(element, done) {
  if (prefersReducedMotion()) { done(); return }
  const sheet = element.querySelector('.growth-entry-dialog')
  animate(element, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 })
  animate(sheet, [{ transform: originTransform(sheet), borderColor: '#e7ff9f' }, { transform: 'none', borderColor: '#75dce6' }], { duration: 540, easing: 'cubic-bezier(.16,1,.3,1)' }).finished.then(done, done)
  animate(element.querySelector('.growth-entry-body'), [{ opacity: 0 }, { opacity: 1 }], { duration: 230, delay: 130, fill: 'backwards' })
}
function leave(element, done) {
  if (prefersReducedMotion()) { done(); return }
  animate(element.querySelector('.growth-entry-dialog'), [{ transform: 'none' }, { transform: originTransform(element.querySelector('.growth-entry-dialog')) }], { duration: 230, easing: 'cubic-bezier(.5,0,1,1)' })
  animate(element, [{ opacity: 1 }, { opacity: 0 }], { duration: 230 }).finished.then(done, done)
}
onBeforeUnmount(() => { for (const animation of animations) animation.cancel(); animations.clear() })
</script>

<template>
  <Teleport to="body">
    <Transition :css="false" @enter="enter" @leave="leave">
      <div v-if="open" class="growth-entry-backdrop" @click.self="close">
        <section ref="panel" class="growth-entry-dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId" :aria-busy="busy" tabindex="-1">
          <header class="growth-entry-head">
            <div><p>{{ subtitle }}</p><h3 :id="titleId">{{ title }}</h3></div>
            <button type="button" class="growth-entry-close" aria-label="关闭加分面板" :disabled="busy" @click="close">×</button>
          </header>
          <div class="growth-entry-body"><slot /></div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.growth-entry-backdrop{position:fixed;inset:0;z-index:150;display:grid;place-items:center;padding:20px;background:#020c21bd;backdrop-filter:blur(7px);overscroll-behavior:contain}
.growth-entry-dialog{width:min(500px,100%);max-height:calc(100dvh - 40px);overflow:auto;overscroll-behavior:contain;border:1px solid #75dce6;background:#091d36;color:#e3efff;box-shadow:8px 9px 0 #ed408b,15px 16px 0 #020c2180;transform-origin:center;scrollbar-width:thin}
.growth-entry-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;background:#e7ff9f;color:#10243a;clip-path:polygon(0 0,100% 0,100% 88%,0 100%)}
.growth-entry-head p{margin:0 0 4px;font-size:11px;color:#466248}.growth-entry-head h3{margin:0;font-size:22px;font-weight:900;overflow-wrap:anywhere}
.growth-entry-close{flex-shrink:0;width:36px;height:36px;border:1px solid #35584270;font-size:26px;color:#10243a;background:transparent;cursor:pointer}.growth-entry-close:disabled{opacity:.5;cursor:wait}.growth-entry-close:focus-visible{outline:3px solid #d83177;outline-offset:3px}
.growth-entry-body{padding:19px 22px 22px}
@media(max-width:500px){.growth-entry-backdrop{padding:18px 14px}.growth-entry-head{padding:16px}.growth-entry-head h3{font-size:20px}.growth-entry-body{padding:16px}.growth-entry-dialog{box-shadow:5px 6px 0 #ed408b}}
</style>
