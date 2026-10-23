import test from 'node:test'
import assert from 'node:assert/strict'
import { growthStarPoints, starPoint } from '../src/utils/growthStar.js'

test('five star tips represent the original scores on a shared scale', () => {
  const values = [18, 9, 14, 11, 7]
  const points = growthStarPoints(values, 30)
  assert.equal(points.length, 10)
  values.forEach((score, i) => assert.deepEqual(points[i * 2], starPoint(i, score / 30)))
})

test('valleys stay inside both neighboring scores and zero stays at the center', () => {
  const values = [0, 30, 3, 15, 6]
  const points = growthStarPoints(values, 30)
  const radius = p => Math.hypot(p.x - 210, p.y - 185)
  assert.deepEqual(points[0], { x: 210, y: 185 })
  for (let i = 0; i < 5; i++) {
    assert.ok(radius(points[i * 2 + 1]) <= Math.min(radius(points[i * 2]), radius(points[((i + 1) % 5) * 2])) + 1e-6)
  }
  assert.ok(growthStarPoints([0, 0, 0, 0, 0], 0).every(p => p.x === 210 && p.y === 185))
})
