import { gsap, prefersReducedMotion } from '@/motion/core'
import { prepareMirrorArt, captureMirrorTexture } from '@/motion/mirror/faceTexture'
import { prepareGlassAudio, playGlassCrack, playGlassBurst, stopGlassAudio } from '@/composables/useGlassAudio'

let active = null, rendererPromise = null
function getRenderer() {
  rendererPromise ||= import('@/motion/mirror/GlassRenderer').then(({ GlassRenderer }) => new GlassRenderer()).catch(error => {
    console.warn('Mirror GPU effect unavailable; using a local fade.', error.message)
    return null
  })
  return rendererPromise
}
function viewportOf(element) {
  const r = (element.closest('.presentation-layout') || element).getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
}
export async function warmMirrorShatter(element) {
  if (prefersReducedMotion() || !element?.isConnected) return false
  await Promise.all([prepareMirrorArt(), document.fonts?.ready, prepareGlassAudio()])
  if (!element.isConnected || prefersReducedMotion()) return false
  const engine = await getRenderer()
  if (!engine || !element.isConnected || active) return !!engine
  const rect = element.getBoundingClientRect()
  try {
    await engine.prepare(rect.width, rect.height, rect.width < 600, viewportOf(element))
    if (!engine.faceTexture && !active && element.isConnected) {
      const shot = captureMirrorTexture(element)
      if (shot) { engine.setFace(shot.canvas); engine.draw(0, 0, 0) }
    }
    return true
  }
  catch { return false }
}
/** Warm expensive GPU resources after the route sweep, in an idle window. */
export function scheduleMirrorWarm(element) {
  let observer, idle, frame, cancelled = false
  const cleanup = () => {
    cancelled = true; observer?.disconnect()
    if (idle !== undefined) window.cancelIdleCallback?.(idle)
    if (frame !== undefined) cancelAnimationFrame(frame)
  }
  const launch = () => {
    observer?.disconnect()
    const run = () => { if (!cancelled && element?.isConnected) warmMirrorShatter(element).catch(() => {}) }
    if (window.requestIdleCallback) idle = window.requestIdleCallback(run, { timeout: 1800 })
    else frame = requestAnimationFrame(() => { frame = requestAnimationFrame(run) })
  }
  const wipe = document.querySelector('.route-wipe')
  if (wipe && getComputedStyle(wipe).visibility !== 'hidden') {
    observer = new MutationObserver(() => { if (getComputedStyle(wipe).visibility === 'hidden') launch() })
    observer.observe(wipe, { attributes: true, attributeFilter: ['style'] })
  } else launch()
  return cleanup
}
export const captureMirrorFace = captureMirrorTexture
export function cancelMirrorShatter(element) { if (!element || active?.element === element) active?.cancel() }

/** One canvas, one shared texture, one GPU draw call. Only mirror portraits use it. */
export function beginMirrorShatter(element, { captured = null } = {}) {
  cancelMirrorShatter()
  if (!element?.isConnected || prefersReducedMotion()) return null
  const shot = captured || captureMirrorTexture(element)
  if (!shot) return null
  const bounds = element.getBoundingClientRect(), viewport = viewportOf(element)
  // A generation can take minutes. Never stretch an old desktop snapshot over
  // a new phone layout if the viewport changed while the request was pending.
  if (captured?.rect && (Math.abs(captured.rect.width - bounds.width) > 2 || Math.abs(captured.rect.height - bounds.height) > 2)) return null
  if (bounds.bottom <= viewport.y || bounds.top >= viewport.y + viewport.height) return null
  const layer = document.createElement('div'); layer.className = 'mirror-shatter-layer'
  layer.setAttribute('aria-hidden', 'true'); layer.inert = true; layer.dataset.phase = 'preparing'
  Object.assign(layer.style, { position: 'fixed', left: `${viewport.x}px`, top: `${viewport.y}px`, width: `${viewport.width}px`, height: `${viewport.height}px`, overflow: 'hidden', zIndex: '10010', pointerEvents: 'none' })
  const motion = { crack: 0, burst: 0, pulse: 0 }
  const timelines = new Set(), preference = matchMedia('(prefers-reduced-motion: reduce)')
  let cancelled = false, completed = false, revealPromise, engine, began = performance.now()
  const run = timeline => new Promise(resolve => {
    timelines.add(timeline)
    timeline.eventCallback('onComplete', () => { timelines.delete(timeline); resolve(true) })
    timeline.eventCallback('onInterrupt', () => { timelines.delete(timeline); resolve(false) })
  })
  const paint = () => engine?.draw(motion.crack, motion.burst, motion.pulse)
  const cleanup = () => {
    if (completed) return
    completed = true
    for (const timeline of [...timelines]) timeline.kill()
    timelines.clear(); preference.removeEventListener('change', onPreference)
    window.removeEventListener('resize', onLayoutChange)
    document.removeEventListener('scroll', onLayoutChange, true)
    document.removeEventListener('visibilitychange', onVisibility)
    engine?.canvas.removeEventListener('webglcontextlost', onContextLost)
    layer.remove()
    if (active === handle) active = null
  }
  const onPreference = event => { if (event.matches) handle.cancel() }
  const onLayoutChange = event => {
    // A programmatic focus scroll can deliver its final scroll event after the
    // snapshot was taken. Cancel only when the captured geometry actually moves.
    if (event.type === 'scroll' && element.isConnected) {
      const rect = element.getBoundingClientRect()
      if (Math.abs(rect.x - bounds.x) < 1 && Math.abs(rect.y - bounds.y) < 1) return
    }
    handle.cancel()
  }
  const onVisibility = () => { if (document.hidden) handle.cancel() }
  const onContextLost = () => handle.cancel()
  const showFallback = () => {
    if (cancelled || !element.isConnected) return false
    const canvas = shot.canvas
    Object.assign(canvas.style, { position: 'absolute', left: `${bounds.x - viewport.x}px`, top: `${bounds.y - viewport.y}px`, width: `${bounds.width}px`, height: `${bounds.height}px` })
    layer.replaceChildren(canvas); layer.dataset.phase = 'fade'
    document.body.append(layer)
    return false
  }
  const ready = (async () => {
    engine = await getRenderer()
    if (cancelled || !element.isConnected) return false
    if (!engine) return showFallback()
    try { await engine.prepare(bounds.width, bounds.height, bounds.width < 600, viewport) }
    catch { engine = null; return showFallback() }
    if (cancelled || prefersReducedMotion()) return false
    engine.place(bounds, viewport); engine.setFace(shot.canvas); paint()
    Object.assign(engine.canvas.style, { display: 'block', width: '100%', height: '100%' })
    layer.append(engine.canvas); layer.dataset.phase = 'crack'
    layer.dataset.plates = engine.statistics.plates; layer.dataset.drawCalls = engine.statistics.drawCalls
    document.body.append(layer); began = performance.now()
    engine.canvas.addEventListener('webglcontextlost', onContextLost)
    playGlassCrack()
    const crack = gsap.timeline({ onUpdate: paint })
      .to(motion, { crack: 1, duration: .19, ease: 'power3.out' }, 0)
      .to(motion, { pulse: 1, duration: .035 }, 0)
      .to(motion, { pulse: 0, duration: .17, ease: 'power2.out' }, .035)
    run(crack)
    return true
  })()
  const handle = {
    element, layer,
    cancel() { if (!completed) stopGlassAudio(); cancelled = true; cleanup() },
    reveal() {
      revealPromise ||= (async () => {
        const supported = await ready
        if (cancelled) return false
        if (!supported) {
          if (layer.isConnected) await run(gsap.timeline().to(layer, { opacity: 0, duration: .22, ease: 'power2.out' }))
          cleanup(); return false
        }
        const hold = Math.max(0, .29 - (performance.now() - began) / 1000)
        const timeline = gsap.timeline({ onUpdate: paint })
        timeline.to({}, { duration: hold })
        timeline.call(() => { if (!cancelled) { layer.dataset.phase = 'burst'; playGlassBurst() } })
        timeline.to(motion, { burst: 1, duration: bounds.width < 600 ? .61 : .7, ease: 'power1.in' })
        const finished = await run(timeline)
        cleanup()
        return finished && !cancelled
      })()
      return revealPromise
    },
  }
  active = handle; preference.addEventListener('change', onPreference)
  window.addEventListener('resize', onLayoutChange)
  document.addEventListener('scroll', onLayoutChange, true)
  document.addEventListener('visibilitychange', onVisibility)
  return handle
}

export async function playMirrorShatter(element, options) { return await beginMirrorShatter(element, options)?.reveal() || false }
