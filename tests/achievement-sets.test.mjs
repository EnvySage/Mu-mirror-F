import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { achievementDesignCatalog, achievementSets } from '../src/preview/achievementSets.js'
import accountCatalog from '../src/preview/achievementCatalog.json' with { type: 'json' }

test('each function has one complete eight-medal set with distinct names and stable existing codes', () => {
  assert.equal(achievementSets.length, 12)
  assert.equal(achievementDesignCatalog.length, 96)
  assert.equal(new Set(achievementDesignCatalog.map(item => item.code)).size, 96)
  assert.equal(new Set(achievementDesignCatalog.map(item => item.english)).size, 96)
  for (const set of achievementSets) {
    const medals = achievementDesignCatalog.filter(item => item.group.id === set.id)
    assert.equal(medals.length, 8, set.name)
    assert.deepEqual(medals.map(item => item.atlasIndex), [0, 1, 2, 3, 4, 5, 6, 7])
    assert.ok(medals.every(item => item.name && item.condition && item.difficulty >= 1 && item.difficulty <= 3))
  }
  for (const item of accountCatalog) assert.ok(achievementDesignCatalog.some(medal => medal.code === item.code))
})

test('plating eligibility is public while challenge conditions stay outside the client catalog', () => {
  const medals = achievementDesignCatalog.filter(item => item.plating)
  assert.equal(medals.length, 24)
  assert.ok(medals.some(item => item.code === 'R-04'))
  for (const item of achievementDesignCatalog) {
    assert.equal(typeof item.plating, 'boolean')
    assert.ok(!('platingCondition' in item))
    assert.ok(!('platingRule' in item))
    assert.ok(!item.plated || (item.earned && item.plating))
  }
})

test('every medal resolves to a real RGBA atlas with eight square cells', () => {
  const atlases = new Set(achievementDesignCatalog.map(item => item.atlas))
  assert.equal(atlases.size, 12)
  for (const asset of atlases) {
    const bytes = readFileSync(new URL(`../public${asset}`, import.meta.url))
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG', asset)
    assert.equal(bytes.readUInt32BE(16), bytes.readUInt32BE(20) * 2, asset)
    assert.equal(bytes[25], 6, `${asset} must retain its alpha channel`)
  }
})
