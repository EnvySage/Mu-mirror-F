let artPromise
export function preloadMirrorArt() {
  artPromise ||= new Promise(resolve => {
    const image = new Image()
    image.onload = () => resolve(image); image.onerror = () => resolve(null)
    image.src = '/art/mirror/glass-face.svg'
  })
  return artPromise
}
let loadedArt
export async function prepareMirrorArt() { loadedArt = await preloadMirrorArt(); return loadedArt }

/** Controlled hero raster: one art image and glyph positions, no DOM cloning. */
export function captureMirrorTexture(element) {
  if (!element?.isConnected) return null
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const ratio = Math.min(window.devicePixelRatio || 1, rect.width < 600 ? 1 : 1.25)
  const canvas = document.createElement('canvas'); canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio)
  const context = canvas.getContext('2d'); context.scale(ratio, ratio)
  context.fillStyle = getComputedStyle(element).backgroundColor || '#071f4d'; context.fillRect(0, 0, rect.width, rect.height)
  const art = element.querySelector('.surface-art')
  if (loadedArt && art) {
    const style = getComputedStyle(art), scale = Math.max(rect.width / loadedArt.width, rect.height / loadedArt.height)
    const width = loadedArt.width * scale, height = loadedArt.height * scale
    const position = style.backgroundPosition.split(' ').map(v => parseFloat(v) / 100)
    context.globalAlpha = Number(style.opacity)
    context.drawImage(loadedArt, (rect.width - width) * (position[0] || .5), (rect.height - height) * (position[1] || .5), width, height)
    context.globalAlpha = 1
  }
  for (const selector of ['.surface-metrics', '.surface-write', '.surface-date i', '.surface-signature > span']) {
    for (const box of element.querySelectorAll(selector)) {
      const r = box.getBoundingClientRect(), style = getComputedStyle(box)
      context.fillStyle = style.backgroundColor; context.fillRect(r.x - rect.x, r.y - rect.y, r.width, r.height)
      if (parseFloat(style.borderTopWidth)) { context.fillStyle = style.borderTopColor; context.fillRect(r.x - rect.x, r.y - rect.y, r.width, parseFloat(style.borderTopWidth)) }
    }
  }
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const styles = new Map(), range = document.createRange()
  while (walker.nextNode()) {
    const node = walker.currentNode, parent = node.parentElement
    if (!node.textContent.trim() || !parent || parent.closest('[aria-hidden=true]')) continue
    let style = styles.get(parent)
    if (!style) { style = getComputedStyle(parent); styles.set(parent, style) }
    if (style.display === 'none' || style.visibility === 'hidden') continue
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    context.fillStyle = style.color; context.textBaseline = 'alphabetic'
    const metrics = context.measureText('Hg汉'), ascent = metrics.fontBoundingBoxAscent || parseFloat(style.fontSize) * .9
    const clip = parent.getBoundingClientRect()
    context.save(); context.beginPath(); context.rect(clip.x - rect.x - 1, clip.y - rect.y - 1, clip.width + 2, clip.height + 2); context.clip()
    for (let i = 0; i < node.length; i++) {
      range.setStart(node, i); range.setEnd(node, i + 1)
      const r = range.getBoundingClientRect()
      // CSS line-clamp hides later lines but Range can still measure them.
      // Once below the visible text box, stop rasterising the hidden remainder.
      if (r.top >= clip.bottom || r.top >= rect.bottom) break
      if (!r.width || r.bottom < rect.top || r.top > rect.bottom) continue
      const char = style.textTransform === 'uppercase' ? node.textContent[i].toUpperCase() : node.textContent[i]
      context.fillText(char, r.x - rect.x, r.y - rect.y + ascent)
    }
    context.restore()
  }
  range.detach()
  return { canvas, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
}
