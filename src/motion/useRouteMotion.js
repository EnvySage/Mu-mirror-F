import { onBeforeUnmount } from 'vue'
import { gsap, duration, prefersReducedMotion } from './core'

/** Vue owns mounting; this timeline owns the full double diagonal handoff.
 * Leave completion is always deferred, so out-in never re-enters Vue's patch. */
export function useRouteMotion(wipe) {
  let operation = null
  let generation = 0
  let disposed = false
  const once = callback => {
    let called = false
    return () => { if (!called) { called = true; queueMicrotask(() => callback?.()) } }
  }
  function cleanPage(element) {
    if (element) gsap.set(element, { clearProps: 'opacity,transform,willChange,pointerEvents' })
  }
  function stop() {
    if (!operation) return
    operation.timeline.kill()
    cleanPage(operation.old)
    cleanPage(operation.page)
    operation.title?.forEach(cleanPage)
    operation.leaveDone?.()
    operation.enterDone?.()
    operation = null
  }
  function finish(current) {
    if (operation !== current) return
    cleanPage(current.page)
    current.title?.forEach(cleanPage)
    gsap.set(wipe.value, { visibility: 'hidden' })
    current.enterDone?.()
    operation = null
  }
  function leave(element, done) {
    stop()
    const current = { id: ++generation, old: element, leaveDone: once(done), timeline: gsap.timeline({ paused: true }) }
    operation = current
    if (disposed || prefersReducedMotion() || !wipe.value) { current.leaveDone(); return }
    const back = wipe.value.querySelector('.wipe-band-back'), front = wipe.value.querySelector('.wipe-band-front'), label = wipe.value.querySelector('span')
    gsap.set(wipe.value, { visibility: 'visible' })
    gsap.set([back, front], { xPercent: -120, skewX: -18 })
    gsap.set(label, { opacity: 0, x: -55 })
    gsap.set(element, { willChange: 'transform,opacity', pointerEvents: 'none' })
    current.timeline
      .to(element, { x: -18, opacity: .35, duration: duration(210), ease: 'power2.in' }, 0)
      .to(back, { xPercent: 0, duration: duration(220), ease: 'power2.inOut' }, 0)
      .to(front, { xPercent: 0, duration: duration(220), ease: 'power2.inOut' }, .035)
      .to(label, { opacity: 1, x: 0, duration: duration(140), ease: 'power2.out' }, .1)
      .call(() => {
        if (operation !== current) return
        current.timeline.pause()
        current.leaveDone()
      })
      .play()
  }
  function beforeEnter(element) {
    if (!prefersReducedMotion()) gsap.set(element, { opacity: 0, x: 24, willChange: 'transform,opacity' })
  }
  function enter(element, done) {
    let current = operation
    if (!current) {
      current = { id: ++generation, timeline: gsap.timeline({ paused: true }) }
      operation = current
    }
    current.page = element
    current.enterDone = once(done)
    if (disposed || prefersReducedMotion() || !wipe.value) { finish(current); return }
    const position = current.timeline.duration()
    current.title = [...element.querySelectorAll('.masthead-en, .record-intro-copy, .stage-copy')]
    const back = wipe.value.querySelector('.wipe-band-back'), front = wipe.value.querySelector('.wipe-band-front'), label = wipe.value.querySelector('span')
    current.timeline
      .to(element, { x: 0, opacity: 1, duration: duration(300), ease: 'power3.out' }, position)
      .to(label, { opacity: 0, x: 90, duration: duration(170), ease: 'power2.in' }, position + .015)
      .to(front, { xPercent: 120, duration: duration(285), ease: 'power2.inOut' }, position + .025)
      .to(back, { xPercent: 120, duration: duration(285), ease: 'power2.inOut' }, position + .06)
    if (current.title.length) current.timeline.fromTo(current.title,
      { x: -18, opacity: 0 },
      { x: 0, opacity: 1, duration: duration(230), ease: 'power3.out' }, position + .045)
    current.timeline.call(() => finish(current)).play(position)
  }
  function cancelEnter(element) {
    if (operation?.page !== element) return
    // Vue has already settled its callback; preserve the current wipe until
    // leave starts the next operation in the same patch.
    operation.timeline.kill()
    cleanPage(element)
    operation.title?.forEach(cleanPage)
    operation.enterDone?.()
    operation = null
  }
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const onPreference = event => {
    if (!event.matches || !operation) return
    const current = operation
    current.timeline.kill()
    cleanPage(current.old)
    current.leaveDone?.()
    if (current.page) finish(current)
    else gsap.set(wipe.value, { visibility: 'hidden' })
  }
  preference.addEventListener?.('change', onPreference)
  onBeforeUnmount(() => { disposed = true; stop(); preference.removeEventListener?.('change', onPreference) })
  return { onBeforeEnter: beforeEnter, onEnter: enter, onLeave: leave, onEnterCancelled: cancelEnter }
}
