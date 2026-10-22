import test from 'node:test'
import assert from 'node:assert/strict'
import { createFractures, polygonArea } from '../src/motion/mirror/fractures.js'

function inside(point, polygon) {
  let sign = 0
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length]
    const cross = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])
    if (Math.abs(cross) < 1e-7) continue
    if (sign && Math.sign(cross) !== sign) return false
    sign = Math.sign(cross)
  }
  return true
}

for (const [width, height, compact] of [[1328, 440, false], [350, 445, true], [280, 445, true], [2240, 440, false]]) {
  test(`${width}x${height}: fracture caps cover the source without gaps or overlapping shards`, () => {
    const pattern = createFractures(width, height, { compact })
    assert.equal(pattern.plates.length, compact ? 27 : 43)
    assert.ok(Math.abs(pattern.plates.reduce((n, p) => n + p.area, 0) - width * height) < .00001)
    for (const plate of pattern.plates) {
      assert.ok(plate.points.length >= 3 && polygonArea(plate.points) > 0)
      for (const [x, y] of plate.points) assert.ok(x >= -1e-5 && x <= width + 1e-5 && y >= -1e-5 && y <= height + 1e-5)
      assert.ok(inside([plate.x, plate.y], plate.points))
      assert.ok(plate.depth > 1 && plate.delay < .25 && plate.axis.every(Number.isFinite))
    }
    for (let y = .037; y < 1; y += .079) for (let x = .023; x < 1; x += .073) {
      assert.equal(pattern.plates.filter(p => inside([x * width, y * height], p.points)).length, 1)
    }
  })
}

test('irregular plates are deterministic across texture preparation and do not form an equal grid', () => {
  const a = createFractures(1328, 440), b = createFractures(1328, 440)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, createFractures(1328, 440, { seed: 51 }))
  const areas = a.plates.map(p => p.area)
  assert.ok(Math.max(...areas) / Math.min(...areas) > 10)
  assert.ok(new Set(a.plates.map(p => p.points.length)).size >= 3)
  assert.ok(a.plates.some(p => p.spin > 0) && a.plates.some(p => p.spin < 0))
  assert.ok(Math.max(...a.plates.map(p => p.depth)) - Math.min(...a.plates.map(p => p.depth)) > .3)
})
