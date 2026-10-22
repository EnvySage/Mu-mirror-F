import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import { createMotionScope, duration, gsap, motionTokens, prefersReducedMotion } from './core'

/** Header and grid always change at the same handoff; interrupted months never queue. */
export function useCalendarMotion(root, heading, grid) {
  let timeline
  let scope
  let operation = 0
  let pendingCommit

  function change(commit, direction) {
    const token = ++operation
    pendingCommit = commit
    timeline?.kill()
    const targets = [heading.value, grid.value].filter(Boolean)
    if (!targets.length || prefersReducedMotion()) {
      commit()
      pendingCommit = null
      gsap.set(targets, { clearProps: 'transform,opacity' })
      return
    }
    scope ||= createMotionScope(root.value)
    scope.run(() => {
      timeline = gsap.timeline({ onComplete: () => gsap.set(targets, { clearProps: 'transform,opacity' }) })
        .to(targets, { x: -direction * 12, opacity: .35, duration: duration(motionTokens.shift * .4), ease: 'power1.in' })
        .add(() => {
          timeline.pause()
          if (token !== operation) return
          commit()
          pendingCommit = null
          nextTick(() => {
            if (token !== operation) return
            gsap.set(targets, { x: direction * 18 })
            timeline.play()
          })
        })
        .to(targets, { x: 0, opacity: 1, duration: duration(motionTokens.shift * .6), ease: 'power2.out' })
    })
  }

  let media
  function settleReducedMotion() {
    if (!media.matches) return
    operation++
    timeline?.kill()
    pendingCommit?.()
    pendingCommit = null
    gsap.set([heading.value, grid.value].filter(Boolean), { clearProps: 'transform,opacity' })
  }
  onMounted(() => {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    media.addEventListener('change', settleReducedMotion)
  })

  onBeforeUnmount(() => { operation++; pendingCommit = null; timeline?.kill(); scope?.dispose(); media?.removeEventListener('change', settleReducedMotion) })
  return { change }
}
