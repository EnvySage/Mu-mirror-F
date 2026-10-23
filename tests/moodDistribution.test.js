import test from 'node:test'
import assert from 'node:assert/strict'
import { moodDistribution } from '../src/utils/moodDistribution.js'

test('compact mood chart retains all counts and uses unrounded arc shares', () => {
  const result = moodDistribution([{ moods: ['a','b','c','d','e','f','g'].map((mood, i) => ({ mood, count: i + 1 })) }])
  assert.equal(result.length, 6)
  assert.equal(result.at(-1).key, 'other')
  assert.equal(result.at(-1).count, 3)
  assert.equal(result.reduce((sum, item) => sum + item.count, 0), 28)
  assert.ok(Math.abs(result.reduce((sum, item) => sum + item.share, 0) - 100) < 1e-10)
  assert.ok(Math.abs(result.at(-1).offset - result.at(-1).share + 100) < 1e-10)
})

test('zero mood counts do not create invented proportions', () => {
  assert.deepEqual(moodDistribution([{ moods: [{ mood:'calm', count:0 }] }]), [])
  assert.deepEqual(moodDistribution([]), [])
})
