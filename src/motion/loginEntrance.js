export const loginEntranceKey = Symbol('mirror-login-entrance')

/** The farthest corner must fit inside a ripple originating near bottom-left. */
export function entranceGeometry(width, height) {
  const x = width * .08
  const y = height * .92
  return { x, y, radius: Math.hypot(width - x, y) + 48 }
}

/** Animate visible, independent pieces, never a parent and its child together. */
export function entranceLayers(scene, width, height) {
  const preferred = '.sidebar,.mobile-header,.masthead,.record-intro,.record-toolbar,.record-layout,.date-rail,.records-aside,.chat-wrap,.chat-rail,.bottom-nav'
  const visible = element => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width
  }
  const layers = [...scene.querySelectorAll(preferred)].filter(visible)
  const content = scene.querySelector('.page-content')
  if (content && !layers.some(layer => content.contains(layer)) && visible(content)) layers.push(content)
  return layers.filter(layer => !layers.some(other => other !== layer && other.contains(layer))).slice(0, 12)
}
