import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap, prefersReducedMotion } from './core'
import { createGrowthMeteor } from './growthMeteor'

/** One star travels between its banner slot and the expanded, real radar. */
export function useGrowthDock(canToggle) {
  const origin = ref(null), trigger = ref(null), panel = ref(null), inner = ref(null), closeButton = ref(null)
  const expanded = ref(false), mounted = ref(false), flying = ref(false), departed = ref(false)
  const geometryVisible = ref(false)
  let timeline, flight, meteor, disposed = false, media, finishFlight

  function cloneStar(svg) {
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const clone = svg.cloneNode(true)
    // SVG paint-server IDs must remain unique while both copies are mounted.
    clone.querySelectorAll('[id]').forEach(node => {
      const old = node.id, next = `${old}-flight`
      node.id = next
      clone.querySelectorAll('[fill],[stroke]').forEach(child => {
        for (const attr of ['fill', 'stroke']) if (child.getAttribute(attr) === `url(#${old})`) child.setAttribute(attr, `url(#${next})`)
      })
    })
    clone.setAttribute('aria-hidden', 'true')
    clone.removeAttribute('role'); clone.removeAttribute('aria-label')
    Object.assign(clone.style, { width: '100%', height: '100%', overflow: 'visible' })
    const shell = document.createElement('div')
    shell.className = 'growth-flight'
    shell.setAttribute('aria-hidden', 'true')
    Object.assign(shell.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, zIndex: '70', pointerEvents: 'none', transformOrigin: '50% 50%' })
    shell.append(clone); document.body.append(shell)
    return { shell, rect }
  }

  async function toggle() {
    if (flying.value || !canToggle() || disposed) return
    const opening = !expanded.value
    const source = opening ? origin.value?.querySelector('svg') : panel.value?.querySelector('.growth-radar')
    const reduced = prefersReducedMotion() || document.hidden
    const captured = reduced ? null : cloneStar(source)
    flight = captured?.shell || null
    flying.value = true
    departed.value = true
    mounted.value = true
    if (opening) expanded.value = true
    await nextTick()
    if (disposed) { flight?.remove(); flight = null; return }
    const wrapper = panel.value, content = inner.value
    const scroller = origin.value.closest('.page-content')
    const targetSvg = opening ? wrapper.querySelector('.growth-radar') : origin.value.querySelector('svg')
    const radar = wrapper.querySelector('.growth-radar-wrap')
    const originalVisibility = radar?.style.visibility || ''
    const pieces = [...wrapper.querySelectorAll('.growth-axis-list,.growth-manual-form')]
    try {
      if (opening) gsap.set(wrapper, { height: 0, opacity: 0, overflow: 'hidden' })
      const height = content.getBoundingClientRect().height
      const view = scroller?.getBoundingClientRect()
      const anchor = opening ? wrapper : origin.value.closest('.mirror-surface')
      const desired = scroller ? scroller.scrollTop + anchor.getBoundingClientRect().top - view.top - 16 : 0
      const scrollTarget = scroller ? Math.max(0, Math.min(desired, scroller.scrollHeight + (opening ? height : 0) - scroller.clientHeight)) : 0
      const scrollDelta = scroller ? scrollTarget - scroller.scrollTop : 0
      const destination = targetSvg?.getBoundingClientRect()
      if (radar) radar.style.visibility = 'hidden'
      if (reduced) {
        gsap.set(wrapper, { height: opening ? 'auto' : 0, opacity: opening ? 1 : 0 })
        if (scroller) scroller.scrollTop = scrollTarget
      } else {
        await new Promise(resolve => {
          finishFlight = resolve
          timeline = gsap.timeline({ onComplete: resolve, onInterrupt: resolve })
          // The replacement waits until the comet has cleared the hero; hide it before return impact.
          timeline.call(() => { geometryVisible.value = opening }, [], opening ? 1.04 : .7)
          // Make space for the landing while the comet crosses the screen; reveal on impact.
          timeline.to(wrapper, { height: opening ? height : 0, duration: .55, ease: 'power4.inOut' }, .3)
          if (opening) timeline.set(wrapper, { opacity: 1 }, 1.42)
          else timeline.to(wrapper, { opacity: 0, duration: .2 }, .15)
          if (scroller) timeline.to(scroller, { scrollTop: scrollTarget, duration: .65, ease: 'power3.inOut' }, .3)
          if (captured && destination) {
            meteor = createGrowthMeteor(flight, captured.rect, { left: destination.left, top: destination.top - scrollDelta, width: destination.width, height: destination.height }, opening)
            meteor.addTo(timeline, .24, () => {
              if (radar) radar.style.visibility = originalVisibility
              if (!opening) departed.value = false
            })
            if (opening) timeline.fromTo(radar, { scale: 1.32, rotation: -9 }, { scale: 1, rotation: 0, duration: .5, ease: 'elastic.out(1,.5)' }, 1.42)
          } else if (flight) timeline.to(flight, { y: opening ? 180 : -180, scale: .5, opacity: 0, duration: .7 }, 0)
          if (opening && pieces.length) timeline.fromTo(pieces, { opacity: 0, x: 100, y: 45, rotation: 7 }, { opacity: 1, x: 0, y: 0, rotation: 0, duration: .55, stagger: .1, ease: 'back.out(1.8)' }, 1.44)
          if (opening) timeline.fromTo(content, { x: 13, y: 7 }, { x: 0, y: 0, duration: .45, ease: 'elastic.out(1,.25)' }, 1.42)
        })
      }
    } finally {
      timeline?.kill(); timeline = null; finishFlight = null
      flight?.remove(); flight = null
      meteor?.remove(); meteor = null
      if (radar) radar.style.visibility = originalVisibility
      if (radar) gsap.set(radar, { clearProps: 'transform' })
      gsap.set(pieces, { clearProps: 'opacity,transform' })
      gsap.set(wrapper, { clearProps: 'height,opacity,overflow' })
      gsap.set(content, { clearProps: 'transform' })
      if (!disposed) {
        expanded.value = opening
        departed.value = opening
        geometryVisible.value = opening
        flying.value = false
        await nextTick()
        if (!document.querySelector('[role="dialog"][aria-modal="true"]')) (opening ? closeButton.value : trigger.value)?.focus({ preventScroll: true })
      }
    }
  }
  const finish = () => { timeline?.progress(1) }
  const onVisibility = () => { if (document.hidden) finish() }
  const onPreference = event => { if (event.matches) finish() }
  onMounted(() => {
    media = matchMedia('(prefers-reduced-motion: reduce)'); media.addEventListener('change', onPreference)
    window.addEventListener('resize', finish); document.addEventListener('visibilitychange', onVisibility)
  })
  onBeforeUnmount(() => {
    disposed = true; timeline?.kill(); finishFlight?.(); flight?.remove(); meteor?.remove()
    media?.removeEventListener('change', onPreference); window.removeEventListener('resize', finish); document.removeEventListener('visibilitychange', onVisibility)
  })
  return { origin, trigger, panel, inner, closeButton, expanded, mounted, flying, departed, geometryVisible, toggle }
}
