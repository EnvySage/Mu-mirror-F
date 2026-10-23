export function starPoint(index, scale = 1, { cx = 210, cy = 185, radius = 122 } = {}) {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / 5
  return { x: cx + Math.cos(angle) * radius * scale, y: cy + Math.sin(angle) * radius * scale }
}

/** Every outer tip is the real normalized score; valleys cannot invent points. */
export function growthStarPoints(scores, maximum, geometry) {
  const values = Array.from({ length: 5 }, (_, i) => Math.max(0, Math.min(1, (Number(scores[i]) || 0) / Math.max(1, maximum))))
  return values.flatMap((value, i) => [
    starPoint(i, value, geometry),
    starPoint(i + .5, Math.min(value, values[(i + 1) % 5]) * .38, geometry),
  ])
}

export const pointsAttribute = points => points.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ')
