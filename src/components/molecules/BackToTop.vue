<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { prefersReducedMotion } from '@/motion/core'

const props = defineProps({ target: { type: Object, default: null } })
const visible = ref(false)
let detach = () => {}
let frame = null

watch(() => props.target, target => {
  detach()
  detach = () => {}
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null
  visible.value = false
  if (!target) return

  const update = () => {
    frame = null
    visible.value = target.isConnected && target.scrollTop > Math.max(280, Math.min(target.clientHeight * .75, 560))
      && target.scrollHeight > target.clientHeight + 1
  }
  const schedule = () => { if (frame === null) frame = requestAnimationFrame(update) }
  target.addEventListener('scroll', schedule, { passive: true })
  const resize = new ResizeObserver(schedule)
  resize.observe(target)
  detach = () => { target.removeEventListener('scroll', schedule); resize.disconnect() }
  update()
}, { immediate: true, flush: 'post' })

function goToTop() {
  const target = props.target
  if (!target?.isConnected) return
  target.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'instant' : 'smooth' })
  // The button disappears near the top; keep keyboard focus in the main region.
  target.closest('main')?.focus({ preventScroll: true })
}

onBeforeUnmount(() => {
  detach()
  if (frame !== null) cancelAnimationFrame(frame)
})
</script>

<template>
  <Transition name="back-to-top">
    <button v-if="visible" type="button" class="back-to-top" aria-label="回到顶部" title="回到顶部" @click="goToTop">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5h14M7 13l5-5 5 5M12 9v11" /></svg>
      <span>顶部</span>
    </button>
  </Transition>
</template>

<style scoped>
.back-to-top { position: absolute; z-index: 18; right: 18px; bottom: 22px; isolation: isolate; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; width: 48px; min-height: 52px; color: #082741; filter: drop-shadow(3px 4px 0 #0317356b); }
.back-to-top::before { content: ''; position: absolute; z-index: -1; inset: 0; background: #a2eef0; clip-path: polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px); transition: background .16s; }
.back-to-top svg { width: 22px; height: 22px; stroke: currentColor; stroke-width: 1.8; stroke-linecap: square; stroke-linejoin: miter; }
.back-to-top span { font-size: 10px; font-weight: 800; letter-spacing: .06em; }
.back-to-top:focus-visible { outline: 2px solid white; outline-offset: 4px; }
.back-to-top:active { transform: translateY(2px); }
:global(.presentation-mode-mobile .back-to-top) { position: fixed; right: 12px; bottom: calc(var(--nav-height) + var(--safe-bottom) + 16px); }
:global(body:has([role='dialog'][aria-modal='true']) .back-to-top) { visibility: hidden; pointer-events: none; }
.back-to-top-enter-active,.back-to-top-leave-active { transition: opacity .16s ease,transform .2s ease; }
.back-to-top-enter-from,.back-to-top-leave-to { opacity: 0; transform: translateY(7px); }
@media (hover: hover) { .back-to-top:hover::before { background: #e0f49e; } }
@media (prefers-reduced-motion: reduce) { .back-to-top,.back-to-top::before { transition: none; }.back-to-top-enter-from,.back-to-top-leave-to { transform: none; } }
</style>
