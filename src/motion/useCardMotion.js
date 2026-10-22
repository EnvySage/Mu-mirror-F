import { gsap, createMotionScope, prefersReducedMotion } from './core.js'

export function cardPointer(bounds, clientX, clientY) {
  const x = Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(1, bounds.width)))
  const y = Math.max(0, Math.min(1, (clientY - bounds.top) / Math.max(1, bounds.height)))
  return { x: x * bounds.width, y: y * bounds.height, rotationX: (0.5 - y) * 3, rotationY: (x - 0.5) * 4 }
}

/** Layout belongs to the wrapper; only this surface and its existing glint move. */
export function bindCardMotion(surface) {
  const wrapper = surface.closest('[data-list-key]') || surface.parentElement || surface
  const list = surface.closest('.records-main,.page-content')
  const scope = createMotionScope(surface)
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const hover = window.matchMedia('(hover: hover) and (pointer: fine)')
  const glint = document.createElement('span')
  glint.className = 'card-pointer-glint'
  glint.setAttribute('aria-hidden', 'true')
  Object.assign(glint.style, {
    position: 'absolute', left: '0', top: '0', width: '320px', height: '220px',
    pointerEvents: 'none', opacity: '0', zIndex: '1',
    background: 'radial-gradient(ellipse at center,#b8fbff38 0%,#b8fbff12 32%,transparent 68%)',
  })
  surface.append(glint)
  let bounds
  let frame = 0
  let point
  let over = false
  let pressed = false
  let disposed = false
  let moveY, rotateX, rotateY, lightOpacity, lightX, lightY
  scope.run(() => {
    gsap.set(surface, { transformPerspective: 1100 })
    moveY = gsap.quickTo(surface, 'y', { duration: 0.16, ease: 'power2.out' })
    rotateX = gsap.quickTo(surface, 'rotationX', { duration: 0.14, ease: 'power2.out' })
    rotateY = gsap.quickTo(surface, 'rotationY', { duration: 0.14, ease: 'power2.out' })
    lightOpacity = gsap.quickTo(glint, 'opacity', { duration: 0.14, ease: 'power2.out' })
    lightX = gsap.quickSetter(glint, 'x', 'px')
    lightY = gsap.quickSetter(glint, 'y', 'px')
  })
  const disabled = () => surface.dataset.cardMotionDisabled === 'true'
  const canHover = event => !disabled() && event?.pointerType !== 'touch' && hover.matches && !prefersReducedMotion()
  const invalidate = () => { bounds = null }
  const tween = values => {
    if (prefersReducedMotion()) {
      moveY.tween.pause(); rotateX.tween.pause(); rotateY.tween.pause()
      gsap.set(surface, { y: 0, rotationX: 0, rotationY: 0 })
      return
    }
    if (values.y != null) moveY(values.y)
    if (values.rotationX != null) rotateX(values.rotationX)
    if (values.rotationY != null) rotateY(values.rotationY)
  }
  function reset() {
    cancelAnimationFrame(frame)
    frame = 0
    over = pressed = false
    bounds = null
    tween({ y: 0, rotationX: 0, rotationY: 0 })
    if (prefersReducedMotion()) { lightOpacity.tween.pause(); gsap.set(glint, { opacity: 0 }) }
    else lightOpacity(0)
  }
  function enter(event) {
    if (!canHover(event)) return
    over = true
    bounds = wrapper.getBoundingClientRect()
    tween({ y: -6, rotationX: 0, rotationY: 0 })
    lightOpacity(1)
    move(event)
  }
  function move(event) {
    if (!over || !canHover(event)) return
    point = { x: event.clientX, y: event.clientY }
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (!over || disposed) return
      bounds ||= wrapper.getBoundingClientRect()
      const value = cardPointer(bounds, point.x, point.y)
      lightX(value.x - 160)
      lightY(value.y - 110)
      if (!pressed) { rotateX(value.rotationX); rotateY(value.rotationY) }
    })
  }
  function down(event) {
    if (disabled() || event.target.closest('input,textarea,select,button,a') && event.target !== surface) return
    pressed = true
    tween({ y: -1, rotationX: 0, rotationY: 0 })
  }
  const up = () => { pressed = false; tween({ y: over ? -6 : 0 }) }
  const keydown = event => { if (event.target === surface && ['Enter', ' '].includes(event.key) && !event.repeat) down(event) }
  const keyup = event => { if (event.target === surface && ['Enter', ' '].includes(event.key)) up() }
  const preference = () => { if (media.matches || !hover.matches) reset() }
  const listeners = { pointerenter: enter, pointermove: move, pointerleave: reset, pointerdown: down, pointerup: up, pointercancel: reset, focusout: reset, keydown, keyup }
  Object.entries(listeners).forEach(([event, listener]) => surface.addEventListener(event, listener, { passive: true }))
  window.addEventListener('resize', invalidate, { passive: true })
  window.addEventListener('scroll', invalidate, { capture: true, passive: true })
  media.addEventListener('change', preference)
  hover.addEventListener('change', preference)
  list?.addEventListener('list-motion-start', reset)
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(invalidate)
  resize?.observe(wrapper)
  const dispose = () => {
    disposed = true
    cancelAnimationFrame(frame)
    Object.entries(listeners).forEach(([event, listener]) => surface.removeEventListener(event, listener))
    window.removeEventListener('resize', invalidate)
    window.removeEventListener('scroll', invalidate, true)
    media.removeEventListener('change', preference)
    hover.removeEventListener('change', preference)
    list?.removeEventListener('list-motion-start', reset)
    resize?.disconnect()
    scope.dispose()
    glint.remove()
  }
  dispose.reset = reset
  return dispose
}
