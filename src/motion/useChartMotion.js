import { onBeforeUnmount, onMounted, watch } from 'vue'
import { createMotionScope, gsap, prefersReducedMotion } from './core'

/** Reveal on first intersection or actual data change; identical polls never replay. */
export function useChartMotion(root, signature) {
  let element, scope, observer, animation, preference
  let visible = false, pending = true
  const settle = () => animation?.progress(1)
  function replay() {
    pending = true
    if (!element || !visible || document.hidden || prefersReducedMotion()) {
      settle()
      return
    }
    pending = false
    settle()
    animation?.kill()
    scope.run(() => {
      const marks = element.querySelectorAll('[data-chart-mark]')
      const labels = element.querySelectorAll('[data-chart-reveal]')
      animation = gsap.timeline()
      element.querySelectorAll('[data-chart-trace]').forEach(mark => {
        animation.fromTo(mark, { strokeDasharray: '0 100' },
          { strokeDasharray: mark.getAttribute('stroke-dasharray'), duration: 1.2, ease: 'power3.out', clearProps: 'strokeDasharray' }, .15)
      })
      if (marks.length) animation.fromTo(marks,
        { scaleY: .06, opacity: .2, transformOrigin: '50% 100%' },
        { scaleY: 1, opacity: 1, duration: .85, stagger: { amount: .42 }, ease: 'back.out(1.8)', clearProps: 'transform,transformOrigin,opacity' }, 0)
      if (labels.length) animation.fromTo(labels,
        { x: -24, opacity: 0 },
        { x: 0, opacity: 1, duration: .55, stagger: .055, ease: 'power3.out', clearProps: 'transform,opacity' }, .1)
    })
  }
  watch([root, signature], () => {
    if (element !== root.value) {
      observer?.disconnect()
      scope?.dispose()
      element = root.value
      scope = element ? createMotionScope(element) : null
      visible = false
      if (element) {
        observer = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting
          if (visible && pending) replay()
          if (!visible) settle()
        }, { threshold: .12 })
        observer.observe(element)
      }
    }
    pending = true
    if (visible) replay()
  }, { flush: 'post' })
  function onVisibility() {
    if (document.hidden) settle()
    else if (pending && visible) replay()
  }
  function onPreference() { if (preference.matches) settle() }
  onMounted(() => {
    preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    preference.addEventListener('change', onPreference)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', settle)
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    preference?.removeEventListener('change', onPreference)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('resize', settle)
    scope?.dispose()
  })
  return { replay }
}
