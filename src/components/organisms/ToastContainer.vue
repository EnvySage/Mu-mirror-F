<script setup>
import { useToastStore } from '@/stores/toast'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { createMotionScope, duration, Flip, gsap, motionTokens, prefersReducedMotion } from '@/motion/core'

const toast = useToastStore()
const container = ref(null)
const motions = new Map()
let moveScope

function cancelMotion(el) {
  const state = motions.get(el)
  if (!state) return
  motions.delete(el)
  state.scope.dispose()
  state.done()
}
function animateToast(el, done, entering) {
  cancelMotion(el)
  const surface = el.querySelector('.toast')
  const scope = createMotionScope(el)
  const state = { scope, done }
  motions.set(el, state)
  scope.run(() => {
    if (entering) gsap.set(surface, { opacity: 0, y: prefersReducedMotion() ? 0 : -8 })
    else {
      // Hold the leaving toast out of flow; Flip closes the stack underneath it.
      el.style.width = `${el.offsetWidth}px`
      el.style.top = `${el.offsetTop}px`
      el.style.position = 'absolute'
    }
    gsap.to(surface, { opacity: entering ? 1 : 0, y: entering || prefersReducedMotion() ? 0 : -6, duration: duration(motionTokens.feedback), ease: 'power2.out', overwrite: true, onComplete: () => {
      if (motions.get(el) !== state) return
      motions.delete(el)
      scope.dispose()
      done()
    } })
  })
}
const enterToast = (el, done) => animateToast(el, done, true)
const leaveToast = (el, done) => animateToast(el, done, false)
watch(() => toast.toasts.map(item => item.id).join(','), async () => {
  if (!container.value) return
  const state = Flip.getState(container.value.querySelectorAll('.toast-shell'))
  await nextTick()
  if (!container.value) return
  moveScope ||= createMotionScope(container.value)
  moveScope.run(() => Flip.from(state, { targets: [...container.value.querySelectorAll('.toast-shell')].filter(el => el.style.position !== 'absolute'), duration: duration(motionTokens.feedback), ease: 'power2.out', scale: false }))
})
onBeforeUnmount(() => {
  for (const el of [...motions.keys()]) cancelMotion(el)
  moveScope?.dispose()
})

/** 类型 → SVG path（无 emoji，纯线性图标） */
const icons = {
  info: { d: 'M12 16v-4M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', stroke: 'var(--accent)' },
  success: { d: 'M20 6L9 17l-5-5', stroke: 'var(--success)' },
  warning: { d: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', stroke: 'var(--warn)' },
  error: { d: 'M18 6L6 18M6 6l12 12', stroke: 'var(--danger)' },
  undo: { d: 'M3 7v6h6M3.5 13a9 9 0 1 0 2.1-9.4L3 7', stroke: 'var(--danger)' },
}
</script>

<template>
  <Teleport to="body">
    <div ref="container" class="toast-container" role="status" aria-live="polite" aria-atomic="false">
      <TransitionGroup :css="false" @enter="enterToast" @leave="leaveToast" @enter-cancelled="cancelMotion" @leave-cancelled="cancelMotion">
        <div v-for="t in toast.toasts" :key="t.id" class="toast-shell">
        <div
          :class="['toast', t.undoable ? 'toast-undo' : `toast-${t.type}`]"
          @click="toast.remove(t.id)"
        >
          <svg
            v-if="!t.undoable"
            class="toast-icon"
            viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"
            :style="{ stroke: icons[t.type]?.stroke || 'var(--accent)' }"
          >
            <path :d="icons[t.type]?.d || icons.info.d" />
          </svg>
          <span class="toast-message">{{ t.message }}</span>
          <!-- 撤销按钮（Q2 删除撤销窗） -->
          <button v-if="t.undoable" class="toast-undo-btn" @click.stop="toast.undo(t.id)">撤销</button>
          <!-- 5 秒倒计时条 -->
          <span v-if="t.undoable" class="toast-timer" :style="{ animationDuration: t.duration + 'ms' }" />
        </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.toast-shell { max-width:100%; }

.toast {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px 12px 15px;
  border-radius: var(--radius);
  background: #FFFFFF;
  border: 1px solid var(--line);
  border-left: 3px solid var(--line-strong);
  box-shadow: var(--shadow-float);
  pointer-events: auto;
  cursor: pointer;
  max-width: 360px;
  overflow: hidden;
}

.toast-success { border-left-color: var(--success); }
.toast-error { border-left-color: var(--danger); }
.toast-warning { border-left-color: var(--warn); }
.toast-info { border-left-color: var(--accent); }
.toast-undo { border-left-color: var(--danger); padding-right: 12px; }

.toast-icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke-width: 2.2;
  flex-shrink: 0;
}

.toast-message {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-hi);
  line-height: 1.4;
}

.toast-undo-btn {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: var(--accent-soft);
  transition: background .15s;
}
.toast-undo-btn:hover { background: #E2E9FD; }

/* The real undo deadline remains store-owned; the visual bar only scales. */
.toast-timer {
  position: absolute;
  left: 0; bottom: 0;
  height: 2px;
  width: 100%;
  background: var(--danger);
  opacity: .5;
  transform-origin:left;
  animation-name: toast-timer-run;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
@keyframes toast-timer-run {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

/* 移动端适配 */
@media (max-width: 480px) {
  .toast-container {
    top: 12px;
    left: 16px;
    right: 16px;
    transform: none;
  }

  .toast-shell, .toast {
    max-width: 100%;
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) { .toast-timer { animation:none; } }
</style>
