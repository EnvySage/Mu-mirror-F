import { onBeforeUnmount } from 'vue'
import { gsap, duration, prefersReducedMotion } from './core'

/** Vue owns mounting; this timeline owns the full double diagonal handoff.
 * Leave completion is always deferred, so out-in never re-enters Vue's patch. */
export function useRouteMotion(wipe) {
  let operation = null
  let generation = 0
  let disposed = false
  const idleWaiters = new Set()
  const notifyIdle = () => { idleWaiters.forEach(resolve => resolve()); idleWaiters.clear() }
  const waitForIdle = () => !operation ? Promise.resolve() : new Promise(resolve => idleWaiters.add(resolve))
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
    notifyIdle()
  }
  function finish(current) {
    if (operation !== current) return
    cleanPage(current.page)
    current.title?.forEach(cleanPage)
    gsap.set(wipe.value, { visibility: 'hidden' })
    current.enterDone?.()
    operation = null
    notifyIdle()
  }
  function leave(element, done) {
    stop()
    const current = { id: ++generation, old: element, leaveDone: once(done), timeline: gsap.timeline({ paused: true }) }
    operation = current
    if (disposed || prefersReducedMotion() || !wipe.value) { current.leaveDone(); return }
    const back = wipe.value.querySelector('.wipe-band-back'), front = wipe.value.querySelector('.wipe-band-front'), label = wipe.value.querySelector('span')
    gsap.set(wipe.value, { visibility: 'visible' })
    // CSS percentage transforms can be cached by GSAP as a pixel translation.
    // Reset x as well so the cover/reveal doesn't inherit a second full offset.
    gsap.set([back, front], { x: 0, xPercent: -120, skewX: -18 })
    gsap.set(label, { opacity: 0, x: 0 })
    gsap.set(element, { pointerEvents: 'none' })
    current.timeline
      .to(back, { xPercent: 0, duration: duration(420), ease: 'power2.inOut' }, 0)
      .to(front, { xPercent: 0, duration: duration(420), ease: 'power2.inOut' }, .055)
      .to(label, { opacity: 1, duration: duration(220), ease: 'power2.out' }, .22)
      .to({}, { duration: duration(75) })
      .call(() => {
        if (operation !== current) return
        current.timeline.pause()
        current.leaveDone()
      })
      .play()
  }
  function beforeEnter(element) {
    if (!prefersReducedMotion()) gsap.set(element, { opacity: 0, willChange: 'opacity' })
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
    const back = wipe.value.querySelector('.wipe-band-back'), front = wipe.value.querySelector('.wipe-band-front'), label = wipe.value.querySelector('span')
    current.timeline
      .set(element, { opacity: 1 }, position)
      .to(label, { opacity: 0, duration: duration(220), ease: 'power2.inOut' }, position)
      .to(front, { x: 0, xPercent: 120, duration: duration(460), ease: 'power2.inOut' }, position + .04)
      .to(back, { x: 0, xPercent: 120, duration: duration(460), ease: 'power2.inOut' }, position + .095)
    current.timeline.call(() => finish(current)).play(position)
  }
  function cancelEnter(element) {
    if (operation?.page !== element) return
    // Unmount or an external Transition cancellation must also release queued
    // destinations; normal navigation is serialized by MainLayout.
    operation.timeline.kill()
    cleanPage(element)
    operation.title?.forEach(cleanPage)
    operation.enterDone?.()
    operation = null
    gsap.set(wipe.value, { visibility: 'hidden' })
    notifyIdle()
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
  return { hooks: { onBeforeEnter: beforeEnter, onEnter: enter, onLeave: leave, onEnterCancelled: cancelEnter }, waitForIdle }
}
