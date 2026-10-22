import { onBeforeUnmount } from 'vue'
import { gsap, duration, prefersReducedMotion } from './core'

/** One local owner for each dialog's backdrop and panel. Interrupted moves keep
 * their current values, including when Vue reuses an element while reopening. */
export function useOverlayMotion(options = {}) {
  const operations = new Map()
  let disposed = false
  const geometry = () => typeof options === 'function' ? options() : options
  const once = callback => {
    let called = false
    return () => { if (!called) { called = true; queueMicrotask(() => callback?.()) } }
  }

  function stop(element) {
    const operation = operations.get(element)
    if (!operation) return
    operations.delete(element)
    operation.animation.kill()
    operation.resolve('cancelled')
    operation.done()
  }

  function prepare(element, kind) {
    if (prefersReducedMotion()) return
    // Inline opacity means a leave/enter was interrupted: continue from it.
    if (element.style.opacity !== '') return
    const config = geometry()
    gsap.set(element, kind === 'backdrop' ? { opacity: 0 } : {
      opacity: 0, xPercent: config.xPercent || 0, yPercent: config.yPercent || 0,
      x: config.direction === 'right' ? 34 : 0,
      y: config.direction === 'right' ? 0 : (config.distance || 30),
      scale: config.scale ?? 1,
    })
  }

  function animate(element, kind, entering, done) {
    if (!element || disposed) { once(done)(); return Promise.resolve('cancelled') }
    stop(element)
    const config = geometry()
    const finish = once(done)
    if (prefersReducedMotion()) {
      gsap.set(element, entering ? { clearProps: 'transform,opacity,willChange' } : { opacity: 0, clearProps: 'transform,willChange' })
      finish()
      return Promise.resolve('completed')
    }
    let resolve
    const result = new Promise(r => { resolve = r })
    const operation = { animation: null, resolve, done: finish }
    operations.set(element, operation)
    const destination = kind === 'backdrop' ? { opacity: entering ? 1 : 0 } : {
      opacity: entering ? 1 : 0,
      x: entering || config.direction !== 'right' ? 0 : 22,
      y: entering || config.direction === 'right' ? 0 : (config.distance || 30),
      scale: entering ? 1 : (config.scale ?? 1),
    }
    gsap.set(element, { willChange: kind === 'backdrop' ? 'opacity' : 'transform,opacity' })
    operation.animation = gsap.to(element, {
      ...destination, duration: duration(entering ? (kind === 'backdrop' ? 240 : 320) : 220),
      ease: entering ? 'power3.out' : 'power2.inOut', overwrite: 'auto',
      onComplete() {
        if (operations.get(element) !== operation) return
        operations.delete(element)
        if (entering) gsap.set(element, { clearProps: 'transform,opacity,willChange' })
        else gsap.set(element, { clearProps: 'willChange' })
        resolve('completed')
        finish()
      },
    })
    return result
  }

  function hooks(kind) {
    return {
      onBeforeEnter: element => prepare(element, kind),
      onEnter: (element, done) => animate(element, kind, true, done),
      onLeave: (element, done) => animate(element, kind, false, done),
      onEnterCancelled: stop,
      onLeaveCancelled: stop,
    }
  }

  function open(panel, backdrop) {
    if (panel) prepare(panel, 'panel')
    if (backdrop) prepare(backdrop, 'backdrop')
    return Promise.all([animate(panel, 'panel', true), backdrop ? animate(backdrop, 'backdrop', true) : 'completed'])
  }
  function close(panel, backdrop) {
    return Promise.all([animate(panel, 'panel', false), backdrop ? animate(backdrop, 'backdrop', false) : 'completed'])
  }
  function settle() { for (const operation of operations.values()) operation.animation.progress(1) }
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const onPreference = event => { if (event.matches) settle() }
  preference.addEventListener?.('change', onPreference)
  window.addEventListener('resize', settle)
  onBeforeUnmount(() => {
    disposed = true
    preference.removeEventListener?.('change', onPreference)
    window.removeEventListener('resize', settle)
    for (const element of [...operations.keys()]) stop(element)
  })
  return { panelHooks: hooks('panel'), backdropHooks: hooks('backdrop'), open, close, cancel: stop }
}
