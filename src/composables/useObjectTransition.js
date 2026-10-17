const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const activeAnimations = new Set()
const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
motionPreference?.addEventListener?.('change', (event) => { if (event.matches) cancelObjectTransitions() })

export function findObjectSource(type, id) {
  return [...document.querySelectorAll('[data-object-source]')]
    .find((node) => node.dataset.objectSource === type && node.dataset.objectId === String(id)) || null
}

export function cancelObjectTransitions() {
  for (const animation of activeAnimations) animation.cancel()
  activeAnimations.clear()
  document.querySelectorAll('.object-flight').forEach((node) => node.remove())
}

export function playElementExit(element, { duration = 360, reduced = reducedMotion() } = {}) {
  if (!element || reduced || !element.animate) return Promise.resolve(false)
  const animation = element.animate([
    { opacity: 1, transform: 'translateX(0) scale(1)' },
    { opacity: 0, transform: 'translateX(14px) scale(.985)' },
  ], { duration, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' })
  activeAnimations.add(animation)
  return animation.finished.catch(() => {}).then(() => {
    activeAnimations.delete(animation)
    return true
  }, () => {
    activeAnimations.delete(animation)
    return false
  })
}

/** Draw a temporary paper shape between rectangles without cloning interactive content. */
export function playObjectTransition(fromRect, toRect, { duration = 540, title = '', reverse = false } = {}) {
  if (!fromRect || !toRect || reducedMotion() || !document.body.animate) return Promise.resolve(false)
  const width = Math.max(1, fromRect.width)
  const height = Math.max(1, fromRect.height)
  const overlay = document.createElement('div')
  overlay.className = 'object-flight'
  overlay.setAttribute('aria-hidden', 'true')
  Object.assign(overlay.style, {
    position: 'fixed', left: `${fromRect.x}px`, top: `${fromRect.y}px`, width: `${width}px`, height: `${height}px`,
    zIndex: '10001', pointerEvents: 'none', transformOrigin: 'top left', overflow: 'hidden',
    background: 'linear-gradient(132deg,#f8fbff 0 68%,#d8faff 68% 83%,#f8fbff 83%)',
    borderLeft: '5px solid #50edfa', borderRight: '3px solid #ee246a', boxShadow: '10px 13px 0 #020c3438,-6px 5px 0 #ee246a70',
    clipPath: 'polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,14px 100%,0 calc(100% - 14px))',
  })
  const label = document.createElement('div')
  label.className = 'object-flight-title'
  label.textContent = title
  Object.assign(label.style, {
    position: 'fixed', left: `${fromRect.x + 16}px`, top: `${fromRect.y + 14}px`, zIndex: '10002',
    maxWidth: `${Math.max(120, fromRect.width - 32)}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    color: '#11244b', font: '700 14px/1.4 sans-serif', pointerEvents: 'none',
  })
  document.body.append(label)
  document.body.append(overlay)
  const dx = toRect.x - fromRect.x
  const dy = toRect.y - fromRect.y
  const sx = toRect.width / width
  const sy = toRect.height / height
  const animation = overlay.animate([
    { transform: 'translate(0,0) scale(1,1)', clipPath: 'polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,14px 100%,0 calc(100% - 14px))', opacity: reverse ? .96 : 1, offset: 0 },
    { transform: `translate(${dx * .48}px,${dy * .48}px) scale(${1 + (sx - 1) * .58},${1 + (sy - 1) * .58})`, clipPath: 'polygon(0 0,calc(100% - 50px) 0,100% 50px,100% 100%,24px 100%,0 calc(100% - 24px))', opacity: .98, offset: .58 },
    { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, clipPath: reverse ? 'polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,14px 100%,0 calc(100% - 14px))' : 'polygon(0 0,calc(100% - 42px) 0,100% 42px,100% 100%,20px 100%,0 calc(100% - 20px))', opacity: reverse ? 0 : .96, offset: 1 },
  ], { duration, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' })
  const titleAnimation = label.animate([
    { transform: 'translate(0,0)', opacity: reverse ? 1 : .9 },
    { transform: `translate(${dx}px,${dy}px)`, opacity: reverse ? 0 : 1 },
  ], { duration, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' })
  activeAnimations.add(animation)
  activeAnimations.add(titleAnimation)
  return Promise.all([animation.finished.catch(() => {}), titleAnimation.finished.catch(() => {})]).then(() => {
    overlay.remove()
    label.remove()
    activeAnimations.delete(animation)
    activeAnimations.delete(titleAnimation)
    return true
  }, () => {
    overlay.remove()
    label.remove()
    activeAnimations.delete(animation)
    activeAnimations.delete(titleAnimation)
    return false
  })
}
