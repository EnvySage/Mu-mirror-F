export function seededRandom(seed = 17) {
  let state = seed >>> 0
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
export function polygonArea(points) {
  return Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - p[1] * q[0] }, 0)) * .5
}
function clip(points, origin, normal, sign) {
  const result = []
  const distance = p => ((p[0] - origin[0]) * normal[0] + (p[1] - origin[1]) * normal[1]) * sign
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], da = distance(a), db = distance(b)
    if (da >= -1e-7) result.push(a)
    if ((da > 1e-7 && db < -1e-7) || (da < -1e-7 && db > 1e-7)) {
      const t = da / (da - db)
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return result.filter((point, i, list) => i === 0 || Math.hypot(point[0] - list[i - 1][0], point[1] - list[i - 1][1]) > 1e-5)
}

/** Nonconcentric, seeded fracture plates; dense damage near the impact. */
export function createFractures(width, height, { compact = false, seed = 29 } = {}) {
  const random = seededRandom(seed), impact = [width * (.43 + random() * .12), height * (.37 + random() * .16)]
  let cells = [[[0, 0], [width, 0], [width, height], [0, height]]]
  const target = compact ? 27 : 43, minArea = width * height * .00013
  for (let attempt = 0; attempt < target * 30 && cells.length < target; attempt++) {
    const weighted = cells.map((points, index) => {
      const x = points.reduce((n, p) => n + p[0], 0) / points.length, y = points.reduce((n, p) => n + p[1], 0) / points.length
      const distance = Math.hypot((x - impact[0]) / width, (y - impact[1]) / height)
      return { points, index, x, y, score: polygonArea(points) / (.12 + distance ** 1.55) * (.8 + random() * .4) }
    }).sort((a, b) => b.score - a.score)
    const chosen = weighted[Math.floor(random() * Math.min(3, weighted.length))]
    const first = cells.length < 7
    const origin = first ? [impact[0] + (random() - .5) * width * .095, impact[1] + (random() - .5) * height * .13]
      : [chosen.x + (random() - .5) * width * .08, chosen.y + (random() - .5) * height * .08]
    const radial = Math.atan2(chosen.y - impact[1], chosen.x - impact[0])
    const angle = first ? cells.length * 2.399 + random() * .3 : radial + (random() < .6 ? Math.PI / 2 : 0) + (random() - .5) * 1.1
    const normal = [Math.cos(angle), Math.sin(angle)]
    const a = clip(chosen.points, origin, normal, 1), b = clip(chosen.points, origin, normal, -1)
    if (a.length < 3 || b.length < 3 || polygonArea(a) < minArea || polygonArea(b) < minArea) continue
    cells.splice(chosen.index, 1, a, b)
  }
  return { impact, plates: cells.map((points, i) => {
    const area = polygonArea(points), x = points.reduce((n, p) => n + p[0], 0) / points.length, y = points.reduce((n, p) => n + p[1], 0) / points.length
    const mass = Math.sqrt(area / (width * height))
    return { points, x, y, area, delay: Math.min(.16, mass * .55) + random() * .035,
      axis: [random() - .5, random() - .5, (random() - .5) * .4], spin: (random() < .5 ? -1 : 1) * (1 + random() * 1.6),
      dx: (x - impact[0]) * (.65 + random() * .9) + (random() - .5) * width * .14,
      dy: (y - impact[1]) * (.7 + random()) + random() * height * .12,
      depth: 1.15 + random() * .5 + (mass < .05 ? .35 : 0), index: i }
  }) }
}
