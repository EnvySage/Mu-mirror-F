import { onBeforeUnmount, onMounted, watch } from 'vue'
import { createMotionScope, duration, gsap, motionTokens, prefersReducedMotion } from './core'

/** Stable shells supply geometry; GSAP alone owns the interactive card transforms. */
export function useMirrorCardMotion(deck, currentId, nodeIds) {
  let scope
  let hovered = null
  let focused = null
  let rect = null
  let frame = null
  let pointer = null
  const trackers = new Map()
  const cards = () => [...(deck.value?.querySelectorAll('.memory-card') || [])]

  function releaseTracker(card) {
    const tracker = trackers.get(card)
    if (!tracker) return
    Object.values(tracker).forEach(update => update.tween.kill())
    trackers.delete(card)
  }

  function sync(immediate = false) {
    if (!deck.value) return
    scope ||= createMotionScope(deck.value)
    const reduced = prefersReducedMotion()
    const engaged = hovered || focused
    scope.run(() => cards().forEach(card => {
      const selected = card.dataset.nodeId === String(currentId())
      const active = card === engaged
      const tracking = card === hovered && !reduced
      // An overwrite removes quickTo's PropTween. Release its cached resetTo
      // functions before resetting tilt so a future hover builds fresh ones.
      if (!tracking) releaseTracker(card)
      gsap.to(card, {
        y: reduced ? 0 : active ? -20 : selected ? -16 : engaged ? 6 : 3,
        rotation: reduced || active || selected ? 0 : Number(card.dataset.fanAngle || 0),
        ...(!tracking ? { rotationX: 0, rotationY: 0 } : {}),
        opacity: engaged && !active && !selected ? .82 : 1,
        duration: immediate ? 0 : duration(motionTokens.shift), ease: 'power2.out', overwrite: 'auto',
      })
      if (!active) gsap.to(card.querySelector('.card-sheen'), { opacity: 0, duration: duration(motionTokens.feedback), overwrite: 'auto' })
    }))
  }

  function getTracker(card) {
    if (trackers.has(card)) return trackers.get(card)
    let tracker
    scope.run(() => {
      const sheen = card.querySelector('.card-sheen')
      tracker = {
        rx: gsap.quickTo(card, 'rotationX', { duration: duration(motionTokens.shift), ease: 'power2.out', overwrite: 'auto' }),
        ry: gsap.quickTo(card, 'rotationY', { duration: duration(motionTokens.shift), ease: 'power2.out', overwrite: 'auto' }),
        sx: gsap.quickTo(sheen, 'xPercent', { duration: duration(motionTokens.shift), ease: 'power2.out', overwrite: 'auto' }),
        sy: gsap.quickTo(sheen, 'yPercent', { duration: duration(motionTokens.shift), ease: 'power2.out', overwrite: 'auto' }),
      }
    })
    trackers.set(card, tracker)
    return tracker
  }

  function enter(event) {
    if (event.pointerType === 'touch' || event.currentTarget.disabled || prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    hovered = event.currentTarget
    // Read the untransformed shell once, never the moving card on pointermove.
    rect = hovered.closest('.memory-card-shell').getBoundingClientRect()
    sync()
    scope.run(() => gsap.fromTo(hovered.querySelector('.card-sheen'), { xPercent: -45, opacity: 0 }, { xPercent: 30, opacity: .8, duration: duration(motionTokens.shift), ease: 'power1.out', overwrite: 'auto' }))
  }
  function move(event) {
    if (hovered !== event.currentTarget || event.currentTarget.disabled || !rect || prefersReducedMotion()) return
    pointer = { x: event.clientX, y: event.clientY }
    if (frame !== null) return
    frame = window.requestAnimationFrame(() => {
      frame = null
      if (!hovered || !rect || prefersReducedMotion()) return
      const x = Math.max(-.5, Math.min(.5, (pointer.x - rect.left) / rect.width - .5))
      const y = Math.max(-.5, Math.min(.5, (pointer.y - rect.top) / rect.height - .5))
      const tracker = getTracker(hovered)
      tracker.rx(-y * 5); tracker.ry(x * 6)
      tracker.sx(x * 60); tracker.sy(y * 25)
    })
  }
  function leave() { hovered = null; rect = null; sync() }
  function focus(event) { focused = event.currentTarget; sync() }
  function blur() { focused = null; sync() }
  function resetGeometry() { hovered = null; rect = null; sync(true) }
  let media
  onMounted(() => {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    media.addEventListener('change', resetGeometry)
    window.addEventListener('resize', resetGeometry)
  })
  watch([deck, currentId, nodeIds], () => sync(!scope), { flush: 'post' })
  onBeforeUnmount(() => {
    if (frame !== null) window.cancelAnimationFrame(frame)
    media?.removeEventListener('change', resetGeometry)
    window.removeEventListener('resize', resetGeometry)
    for (const card of [...trackers.keys()]) releaseTracker(card)
    scope?.dispose()
  })
  return { enter, move, leave, focus, blur }
}
