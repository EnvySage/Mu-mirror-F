import test from 'node:test'
import assert from 'node:assert/strict'
import { cardPointer } from '../src/motion/useCardMotion.js'
import { stableVariant } from '../src/motion/core.js'

test('pointer feedback uses cached wrapper geometry and has a neutral center', () => {
  assert.deepEqual(cardPointer({ left: 120, top: 40, width: 300, height: 200 }, 270, 140), {
    x: 150, y: 100, rotationX: 0, rotationY: 0,
  })
})

test('fast crossings clamp reflection and rotation at the wrapper edges', () => {
  const bounds = { left: 120, top: 40, width: 300, height: 200 }
  assert.deepEqual(cardPointer(bounds, -400, 900), { x: 0, y: 200, rotationX: -1.5, rotationY: -2 })
  assert.deepEqual(cardPointer(bounds, 900, -400), { x: 300, y: 0, rotationX: 1.5, rotationY: 2 })
})

test('a hidden or newly mounted wrapper never produces NaN feedback', () => {
  const feedback = cardPointer({ left: 0, top: 0, width: 0, height: 0 }, 0, 0)
  Object.values(feedback).forEach(value => assert.ok(Number.isFinite(value)))
})

test('record and asset variants survive front insertion, filtering and undo', () => {
  const original = ['record-81', 'record-92', 'record-103', 'asset-7', 'asset-18']
  const variants = new Map(original.map(id => [id, [stableVariant(id), stableVariant(id, 4), stableVariant(id, 7)]]))
  const changed = ['new-record', ...original].filter(id => id !== 'record-92')
  changed.push('record-92')
  for (const id of changed.filter(id => variants.has(id))) {
    assert.deepEqual([stableVariant(id), stableVariant(id, 4), stableVariant(id, 7)], variants.get(id))
  }
})
