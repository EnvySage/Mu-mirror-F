import { onBeforeUnmount, onMounted, watch } from 'vue'
import { createMotionScope, duration, gsap, motionTokens, prefersReducedMotion } from './core'

/** Geometry stays data-owned. Equivalent polling payloads share one signature. */
export function useChartMotion(root, signature) {
  let element
  let scope
  let animation
  function settle() {
    animation?.progress(1)
  }
  watch([root, signature], () => {
    if (element !== root.value) {
      scope?.dispose()
      element = root.value
      scope = element ? createMotionScope(element) : null
    }
    if (!element) return
    const rect = element.getBoundingClientRect()
    if (prefersReducedMotion() || rect.bottom <= 0 || rect.top >= window.innerHeight) {
      settle()
      return
    }
    scope.run(() => {
      // A second actual data change continues the in-flight fade.
      if (!animation?.isActive()) gsap.set(element, { opacity: .65 })
      animation?.kill()
      animation = gsap.to(element, { opacity: 1, duration: duration(motionTokens.shift), ease: 'power2.out', clearProps: 'opacity' })
    })
  }, { flush: 'post' })
  let preference
  function onPreference(event) { if (event.matches) settle() }
  onMounted(() => {
    preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    preference.addEventListener('change', onPreference)
    window.addEventListener('resize', settle)
  })
  onBeforeUnmount(() => {
    preference?.removeEventListener('change', onPreference)
    window.removeEventListener('resize', settle)
    scope?.dispose()
  })
}
