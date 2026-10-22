import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { gsap, duration } from './core'

export function useNavIndicatorMotion(container, indicator, active, selector, options = {}) {
  let tween = null
  let observer = null
  let frame = 0
  let initialized = false
  function measure(immediate = false) {
    const root = container.value, marker = indicator.value
    const target = root?.querySelector(selector)
    if (!root || !marker) return
    tween?.kill()
    if (!target || !root.getClientRects().length) {
      gsap.set(marker, { opacity: 0 })
      initialized = false
      return
    }
    // Offset geometry excludes the row's own hover transform, so the selected
    // plate cannot inherit a stale 3px hover displacement after pointer leave.
    let x = 0, y = 0, node = target
    while (node && node !== root) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent }
    gsap.set(marker, { width: target.offsetWidth, height: target.offsetHeight, skewX: options.skewX || 0, skewY: options.skewY || 0 })
    const destination = { x, y, opacity: 1 }
    if (!initialized || immediate) gsap.set(marker, destination)
    else tween = gsap.to(marker, { ...destination, duration: duration(240), ease: 'power3.out', overwrite: 'auto' })
    initialized = true
  }
  function schedule(immediate = false) {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => { frame = 0; measure(immediate) })
  }
  watch(active, async () => { await nextTick(); schedule() }, { flush: 'post' })
  const resize = () => schedule(true)
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  onMounted(() => {
    observer = new ResizeObserver(resize)
    if (container.value) observer.observe(container.value)
    window.addEventListener('resize', resize)
    preference.addEventListener?.('change', resize)
    schedule(true)
  })
  onBeforeUnmount(() => { cancelAnimationFrame(frame); tween?.kill(); observer?.disconnect(); window.removeEventListener('resize', resize); preference.removeEventListener?.('change', resize) })
}
