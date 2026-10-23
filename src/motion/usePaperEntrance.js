import { watch, onMounted, onBeforeUnmount } from 'vue'
import { gsap, prefersReducedMotion } from './core'

/** Reveal each paper once on arrival; never hide content while waiting to scroll. */
export function usePaperEntrance(root, signature, selector) {
  let observer, media
  const animations = new Map()
  const settle = () => animations.forEach(animation => animation.progress(1))
  function reset() {
    observer?.disconnect()
    animations.forEach(animation => { animation.progress(1); animation.kill() })
    animations.clear()
  }
  watch([root, signature], () => {
    reset()
    if (!root.value) return
    observer = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) { animations.get(target)?.progress(1); return }
        if (animations.has(target) || prefersReducedMotion() || document.hidden) return
        animations.set(target, gsap.fromTo(target,
          { x: 38, opacity: .15 },
          { x: 0, opacity: 1, duration: .65, ease: 'back.out(1.25)', clearProps: 'transform,opacity' }))
      })
    }, { threshold: 0, root: root.value })
    root.value.querySelectorAll(selector).forEach(element => observer.observe(element))
  }, { flush: 'post' })
  const preference = () => { if (media.matches) settle() }
  const visibility = () => { if (document.hidden) settle() }
  onMounted(() => {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    media.addEventListener('change', preference)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('resize', settle)
  })
  onBeforeUnmount(() => {
    reset()
    media?.removeEventListener('change', preference)
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('resize', settle)
  })
}
