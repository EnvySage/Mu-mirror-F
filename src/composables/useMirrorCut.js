import { gsap, prefersReducedMotion } from '@/motion/core'
import '@/assets/styles/mirror-cut.css'

let active = null
export function captureMirrorCut(element) {
  if (!element?.isConnected) return null
  const { width, height } = element.getBoundingClientRect()
  return { rect: { width, height } }
}

/** Local graphic transition. No raster snapshot, GPU warm-up or cloned user content. */
export function beginMirrorCut(element, { captured } = {}) {
  active?.cancel()
  if (!element?.isConnected || prefersReducedMotion()) return null
  const bounds = element.getBoundingClientRect()
  if (captured && (Math.abs(captured.rect.width - bounds.width) > 2 || Math.abs(captured.rect.height - bounds.height) > 2)) return null
  const layer = document.createElement('div')
  layer.className = 'mirror-cut-layer'
  layer.dataset.phase = 'cut'
  layer.setAttribute('aria-hidden', 'true')
  layer.inert = true
  const shutter = document.createElement('div')
  shutter.className = 'mirror-cut-shutter'
  const word = document.createElement('span')
  word.className = 'mirror-cut-word'
  word.textContent = 'ANOTHER / ME'
  shutter.append(word)
  const slash = document.createElement('div')
  slash.className = 'mirror-cut-slash'
  const shards = Array.from({ length: 7 }, (_, i) => {
    const shard = document.createElement('div')
    shard.className = 'mirror-cut-fragment'
    shard.style.setProperty('--shard', i)
    layer.append(shard)
    return shard
  })
  layer.append(shutter, slash)
  element.append(layer)
  const preference = matchMedia('(prefers-reduced-motion: reduce)')
  let disposed = false, timeline, promise, settle
  const entry = gsap.timeline()
    .fromTo(shutter, { xPercent: -110 }, { xPercent: 0, duration: .18, ease: 'power4.out' }, 0)
    .fromTo(word, { x: -35, opacity: 0 }, { x: 0, opacity: 1, duration: .18 }, .04)
  const cleanup = () => {
    if (disposed) return
    disposed = true
    entry.kill(); timeline?.kill(); layer.remove()
    preference.removeEventListener('change', onPreference)
    window.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVisibility)
    if (active === handle) active = null
  }
  const onPreference = event => { if (event.matches) handle.cancel() }
  const onResize = () => handle.cancel()
  const onVisibility = () => { if (document.hidden) handle.cancel() }
  const handle = {
    element, layer,
    cancel() { cleanup(); settle?.(false) },
    reveal() {
      if (disposed) return Promise.resolve(false)
      promise ||= new Promise(resolve => {
        settle = resolve
        timeline = gsap.timeline({ onComplete: () => { cleanup(); resolve(true) } })
        const hold = Math.max(0, .24 - entry.time())
        timeline.call(() => { layer.dataset.phase = 'reveal' }, [], hold)
        timeline.to(word, { x: 40, opacity: 0, duration: .16 }, hold)
        timeline.fromTo(slash, { xPercent: -120, opacity: 1 }, { xPercent: 120, duration: .38, ease: 'power3.inOut' }, hold)
        timeline.to(shutter, { xPercent: 115, duration: .4, ease: 'power4.inOut' }, hold + .04)
        shards.forEach((shard, i) => {
          timeline.fromTo(shard, { x: 0, y: 0, rotation: -12, scale: .4, opacity: 0 }, {
            x: (i % 2 ? 1 : -1) * bounds.width * (.2 + i * .035),
            y: (i - 3) * 42, rotation: (i % 2 ? 1 : -1) * (15 + i * 7),
            scale: 1.2, opacity: .9, duration: .24, ease: 'power3.out',
          }, hold + .16)
          timeline.to(shard, { opacity: 0, scale: .6, duration: .26, ease: 'power2.in' }, hold + .4)
        })
      })
      return promise
    },
  }
  active = handle
  preference.addEventListener('change', onPreference)
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibility)
  return handle
}
