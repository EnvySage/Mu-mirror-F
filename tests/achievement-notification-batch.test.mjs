import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { computed, reactive, ref, watch } from 'vue'
import { createPinia, defineStore, disposePinia, setActivePinia } from 'pinia'
import * as notifications from '../src/utils/achievementNotifications.js'

const catalog = Array.from({ length: 6 }, (_, index) => ({ code: `R-${index + 1}`, name: `成就 ${index + 1}`, earned: true }))
const pending = catalog.map(item => ({ code: item.code, kind: 'earned' }))

test('five simultaneous awards form one complete batch instead of selecting the first', () => {
  assert.equal(typeof notifications.notificationBatch, 'function')
  const batch = notifications.notificationBatch(pending.slice(0, 5), catalog)
  assert.deepEqual(batch.map(item => item.medal.name), catalog.slice(0, 5).map(item => item.name))
})

test('batch keeps base and plating separate, suppresses duplicates and leaves unknown awards unacknowledged', () => {
  assert.equal(typeof notifications.notificationBatch, 'function')
  const batch = notifications.notificationBatch([
    pending[0], pending[0], { code: 'R-1', kind: 'plated' }, pending[1], { code: 'missing' },
  ], catalog, new Set(['earned:R-2']))
  assert.deepEqual(batch.map(item => notifications.notificationKey(item.notification)), ['earned:R-1', 'plated:R-1'])
  assert.deepEqual(batch.map(item => item.medal.plated), [false, true])
})

const source = (await readFile(new URL('../src/stores/achievements.js', import.meta.url), 'utf8'))
  .replace(/^import .* from .*$/gm, '').replace('export const useAchievementsStore', 'const useAchievementsStore')
function storeFixture(api) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = reactive({ user: { id: 'account-a' } })
  const makeStore = Function('computed', 'ref', 'watch', 'defineStore', 'useAuthStore', 'achievementApi',
    'IS_DEMO_PREVIEW', 'previewCatalog', 'achievementDesignCatalog', 'notificationKey',
    `${source}; return useAchievementsStore`)
  const store = makeStore(computed, ref, watch, defineStore, () => auth, api, false, [], [], notifications.notificationKey)()
  return { store, auth, dispose: () => disposePinia(pinia) }
}

test('closing a displayed batch sends one exact acknowledgement and preserves newly arrived awards', async () => {
  let finish
  const requests = []
  const f = storeFixture({ acknowledgeNotifications: payload => {
    requests.push(payload)
    return new Promise(resolve => { finish = resolve })
  } })
  try {
    assert.equal(typeof f.store.acknowledgeBatch, 'function')
    const displayed = [...pending.slice(0, 5), { code: 'R-1', kind: 'plated' }]
    f.store.pending = [...displayed]
    const task = f.store.acknowledgeBatch(displayed)
    f.store.pending.push(pending[5])
    finish()
    await task
    assert.deepEqual(requests, [displayed])
    assert.deepEqual(f.store.pending, [pending[5]])
  } finally { f.dispose() }
})

test('failed batch acknowledgement retains the server-pending awards', async () => {
  const f = storeFixture({ acknowledgeNotifications: async () => { throw new Error('offline') } })
  try {
    assert.equal(typeof f.store.acknowledgeBatch, 'function')
    f.store.pending = [...pending]
    await assert.rejects(f.store.acknowledgeBatch(pending.slice(0, 5)), /offline/)
    assert.deepEqual(f.store.pending, pending)
  } finally { f.dispose() }
})

test('a previous account batch acknowledgement cannot clear the next account notifications', async () => {
  let finish
  const f = storeFixture({ acknowledgeNotifications: () => new Promise(resolve => { finish = resolve }) })
  try {
    assert.equal(typeof f.store.acknowledgeBatch, 'function')
    f.store.pending = [pending[0]]
    const task = f.store.acknowledgeBatch([pending[0]])
    f.auth.user = { id: 'account-b' }
    f.store.pending = [pending[0]]
    finish()
    await task
    assert.deepEqual(f.store.pending, [pending[0]])
  } finally { f.dispose() }
})
