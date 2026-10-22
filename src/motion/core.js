import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'

gsap.registerPlugin(Flip)
export { gsap, Flip }

export const motionTokens = Object.freeze({ feedback: 140, shift: 240, panel: 320, close: 220, route: 560, stagger: 28 })
export function prefersReducedMotion() {
  return typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
export function duration(milliseconds) { return prefersReducedMotion() ? 0 : milliseconds / 1000 }

/** Each component owns its animations. Killing one scope never clears another. */
export function createMotionScope(root) {
  const context = gsap.context(() => {}, root)
  let disposed = false
  return {
    run(fn) { if (!disposed) context.add(fn) },
    dispose() { if (!disposed) { disposed = true; context.revert() } },
  }
}

export function stableVariant(id, count = 3) {
  let hash = 2166136261
  for (const char of String(id ?? '')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0) % count
}
