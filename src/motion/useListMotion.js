import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { Flip, gsap, createMotionScope, duration, prefersReducedMotion } from './core.js'

/** One geometry capture per Vue update, regardless of how many items changed. */
export function useListMotion(root, signature, { selector = '[data-list-key]' } = {}) {
  let scope
  let batch = null
  let alive = true
  let animation
  const entering = new Set()
  const elements = () => [...(root.value?.querySelectorAll(selector) || [])]
  const visible = element => {
    const rect = element.getBoundingClientRect()
    const viewport = root.value?.closest('.page-content')?.getBoundingClientRect()
    return rect.bottom > (viewport?.top ?? 0) && rect.top < (viewport?.bottom ?? window.innerHeight)
  }

  function reveal(items, initial = false) {
    const targets = items.filter(visible)
    if (!targets.length || prefersReducedMotion()) return
    targets.forEach(element => entering.add(element))
    scope?.run(() => {
      gsap.fromTo(targets, { opacity: 0, y: initial ? 16 : 10 }, {
        opacity: 1, y: 0, duration: duration(240), stagger: initial ? 0.028 : 0,
        ease: 'power2.out', overwrite: 'auto',
        onComplete: () => {
          gsap.set(targets, { clearProps: 'opacity,transform' })
          targets.forEach(element => entering.delete(element))
        },
      })
    })
  }

  async function capture() {
    if (!alive || batch || !scope) return
    const old = elements()
    root.value?.dispatchEvent(new Event('list-motion-start'))
    const state = Flip.getState(old, { kill: false })
    const rects = new Map(old.map(element => [element.dataset.listKey, element.getBoundingClientRect()]))
    animation?.kill()
    if (entering.size) {
      gsap.killTweensOf([...entering])
      gsap.set([...entering], { clearProps: 'opacity,transform' })
      entering.clear()
    }
    if (old.length) gsap.set(old, { clearProps: 'transform,width,height' })
    const current = { state, rects, keys: new Set(old.map(el => el.dataset.listKey)) }
    batch = current
    await nextTick()
    if (!alive || batch !== current) return
    batch = null
    const next = elements()
    // Resizing an edit form must not stretch its text or images. Animate only
    // unchanged-size shells; neighboring cards still flow in the same batch.
    const retained = next.filter(element => {
      const previous = current.rects.get(element.dataset.listKey)
      if (!previous) return false
      const rect = element.getBoundingClientRect()
      return Math.abs(rect.width - previous.width) < 1 && Math.abs(rect.height - previous.height) < 1
    })
    const added = next.filter(el => !current.keys.has(el.dataset.listKey))
    if (!prefersReducedMotion() && retained.length) {
      scope.run(() => {
        animation = Flip.from(current.state, {
          targets: retained, duration: duration(260), ease: 'power2.out',
          scale: false, prune: true, absolute: false,
          onComplete: () => { animation = null },
        })
      })
    }
    reveal(added, !current.keys.size)
  }

  const stop = watch(signature, capture, { flush: 'pre' })
  const media = typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)')
  const settle = () => {
    if (!media?.matches) return
    animation?.progress(1)
    if (entering.size) {
      gsap.killTweensOf([...entering])
      gsap.set([...entering], { clearProps: 'opacity,transform' })
    }
    entering.clear()
    const targets = elements()
    if (targets.length) gsap.set(targets, { clearProps: 'transform,opacity,width,height' })
  }
  onMounted(() => {
    scope = createMotionScope(root.value)
    reveal(elements(), true)
    media?.addEventListener('change', settle)
  })
  onBeforeUnmount(() => {
    alive = false
    batch = null
    stop()
    media?.removeEventListener('change', settle)
    scope?.dispose()
    entering.clear()
  })
  return { capture }
}
