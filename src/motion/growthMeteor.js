import { gsap } from './core'

const NS = 'http://www.w3.org/2000/svg'
function element(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag)
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value))
  parent.append(node)
  return node
}

/** One owned overlay: curved comet wake, ink streaks and a local impact burst. */
export function createGrowthMeteor(shell, source, destination, opening) {
  const overlay = document.createElementNS(NS, 'svg')
  overlay.classList.add('growth-meteor')
  overlay.setAttribute('aria-hidden', 'true')
  Object.assign(overlay.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', zIndex: '69' })
  document.body.append(overlay)
  const start = { x: source.left + source.width / 2, y: source.top + source.height / 2 }
  const end = { x: destination.left + destination.width / 2, y: destination.top + destination.height / 2 }
  const width = innerWidth, height = innerHeight
  const bend = { x: Math.max(75, Math.min(start.x - width * .32, width * .4)), y: Math.min(height * .48, start.y + 65) }
  const swing = { x: Math.min(width - 50, Math.max(end.x, start.x) + width * .1), y: Math.min(height - 90, Math.max(start.y, end.y) + 140) }
  // Curl away from the destination, sweep across the screen, then hook back into it.
  const path = element('path', { d: `M${start.x},${start.y} C${start.x - 70},${start.y - 170} ${bend.x - 100},${bend.y - 140} ${bend.x},${bend.y} C${bend.x + 85},${bend.y + 210} ${swing.x + 20},${swing.y + 90} ${swing.x},${swing.y} C${swing.x - 25},${swing.y - 160} ${end.x + 70},${end.y - 90} ${end.x},${end.y}`, fill: 'none', stroke: 'none' }, overlay)
  const length = path.getTotalLength()
  const trails = [
    element('polygon', { fill: '#ed408c', opacity: .7 }, overlay),
    element('polygon', { fill: '#72efff' }, overlay),
    element('polygon', { fill: '#f3ffcb' }, overlay),
  ]
  const impact = element('g', { transform: `translate(${end.x} ${end.y})`, opacity: 0 }, overlay)
  const ring = element('circle', { r: 20, fill: 'none', stroke: '#8ef5ff', 'stroke-width': 20 }, impact)
  const burst = element('polygon', { points: Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12, r = i % 2 ? 30 : 115; return `${Math.cos(a) * r},${Math.sin(a) * r}` }).join(' '), fill: '#edffae' }, impact)
  const shapes = ['M-15 -22L100 0 -28 30Z', 'M-12 -16L68 -30 45 26 -30 13Z', 'M-35 -14L35 -14 65 15 -5 15Z', 'M0 -25L43 0 0 25 -43 0Z']
  const shards = Array.from({ length: opening ? 28 : 16 }, (_, i) => {
    const angle = i * Math.PI * 2 / (opening ? 28 : 16), distance = (260 + i % 4 * 80) * (width < 600 ? .6 : 1)
    const node = element('path', { d: shapes[i % 4], fill: ['#ecff9b', '#67edff', '#f64794', '#eaf9ff'][i % 4], transform: `rotate(${angle * 180 / Math.PI})` }, impact)
    return { node, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, angle: angle * 180 / Math.PI }
  })
  const ribbons = Array.from({ length: opening ? 9 : 4 }, (_, i) => {
    const angle = i * 360 / (opening ? 9 : 4) + 12
    const node = element('path', { d: 'M0 0C45 -65 85 58 135 -10S205 -60 235 0', fill: 'none', stroke: ['#f64794', '#80f6ff', '#edff9e'][i % 3], 'stroke-width': i % 2 ? 10 : 17, transform: `rotate(${angle})` }, impact)
    const length = node.getTotalLength()
    node.setAttribute('stroke-dasharray', length); node.setAttribute('stroke-dashoffset', length)
    return { node, angle, length }
  })
  const head = { progress: 0 }
  function draw() {
    const t = head.progress, point = path.getPointAtLength(t * length)
    const arriving = Math.max(0, (t - .76) / .24)
    const scale = .24 + .76 * arriving * arriving
    const w = source.width + (destination.width - source.width) * arriving
    const h = source.height + (destination.height - source.height) * arriving
    gsap.set(shell, { x: point.x - start.x + (source.width - w) / 2, y: point.y - start.y + (source.height - h) / 2, width: w, height: h, scale, rotation: (opening ? 1 : -1) * (t * 430 - 430) * (1 - arriving) })
    const tail = Math.max(0, t - .24)
    const points = Array.from({ length: 30 }, (_, i) => path.getPointAtLength((tail + (t - tail) * i / 29) * length))
    trails.forEach((trail, layer) => {
      const left = [], right = []
      points.forEach((p, i) => {
        const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)]
        const dx = after.x - before.x, dy = after.y - before.y, distance = Math.hypot(dx, dy) || 1
        const radius = [24, 12, 3][layer] * Math.pow(i / (points.length - 1), .8) * (1 - arriving * .6)
        left.push(`${p.x - dy / distance * radius},${p.y + dx / distance * radius}`)
        right.push(`${p.x + dy / distance * radius},${p.y - dx / distance * radius}`)
      })
      trail.setAttribute('points', [...left, ...right.reverse()].join(' '))
    })
  }
  function addTo(timeline, at, onImpact) {
    timeline.to(shell, { scale: 1.13, rotation: -16, duration: .18, ease: 'power2.in' }, 0)
      .to(shell, { scale: .24, duration: .12, ease: 'power4.in' }, .18)
      .to(head, { progress: 1, duration: 1.18, ease: 'power2.in', onUpdate: draw }, at)
      .set(shell, { opacity: 0 }, at + 1.18)
      .call(onImpact, [], at + 1.18)
      .set(impact, { attr: { opacity: 1 } }, at + 1.18)
      .to(ring, { attr: { r: opening ? 330 : 190, 'stroke-width': 0 }, opacity: 0, duration: .65, ease: 'power3.out' }, at + 1.18)
      .fromTo(burst, { attr: { transform: 'scale(.2)' }, opacity: .8 }, { attr: { transform: 'scale(2.3) rotate(18)' }, opacity: 0, duration: .4, ease: 'power3.out' }, at + 1.18)
      .to(trails, { opacity: 0, duration: .24 }, at + 1.18)
    shards.forEach(({ node, x, y, angle }, i) => {
      timeline.fromTo(node, { attr: { transform: `translate(0 0) rotate(${angle}) scale(.15)` }, opacity: 1 }, { attr: { transform: `translate(${x} ${y}) rotate(${angle + (i % 2 ? 135 : -100)}) scale(${i % 3 ? .8 : 1.4})` }, duration: .85 + (i % 3) * .12, ease: 'power3.out' }, at + 1.18)
        .to(node, { opacity: 0, duration: .55 }, at + 1.5 + (i % 3) * .1)
    })
    ribbons.forEach(({ node, angle, length }, i) => {
      const scale = width < 600 ? .8 : 1.5
      timeline.fromTo(node, { attr: { transform: `rotate(${angle}) scale(.2)` } }, { attr: { transform: `rotate(${angle + 28}) scale(${scale})`, 'stroke-dashoffset': 0 }, duration: .5, ease: 'power3.out' }, at + 1.2 + i % 3 * .025)
        .to(node, { attr: { 'stroke-dashoffset': -length }, opacity: 0, duration: .65, ease: 'power2.in' }, at + 1.6)
    })
  }
  return { addTo, remove: () => overlay.remove() }
}
