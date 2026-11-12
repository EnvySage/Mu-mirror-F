import test from 'node:test'
import assert from 'node:assert/strict'
import { createRecordListLoader } from '../src/utils/recordListLoader.js'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function state() { return { records: { value: [] }, loading: { value: false }, error: { value: null } } }

test('a slower unfiltered response cannot replace the newer filtered records', async () => {
  const all = deferred(), filtered = deferred(), current = state()
  const load = createRecordListLoader(params => params?.mood ? filtered.promise : all.promise, current)
  const initial = load()
  const chosenFilter = load({ mood: 'happy' })
  filtered.resolve({ data: [{ id: 2, mood: 'happy' }] })
  await chosenFilter
  all.resolve({ data: [{ id: 1, mood: 'sad' }, { id: 2, mood: 'happy' }] })
  await initial
  assert.deepEqual(current.records.value, [{ id: 2, mood: 'happy' }])
  assert.equal(current.loading.value, false)
})

test('an older failed request cannot clear the active filter loading state or show its error', async () => {
  const old = deferred(), latest = deferred(), current = state()
  let request = 0
  const load = createRecordListLoader(() => (++request === 1 ? old.promise : latest.promise), current)
  const first = load()
  const second = load({ contentType: 'work' })
  old.reject(new Error('Outdated request failed'))
  await first
  assert.equal(current.loading.value, true)
  assert.equal(current.error.value, null)
  latest.resolve({ data: [{ id: 3, type: 'work' }] })
  await second
  assert.deepEqual(current.records.value, [{ id: 3, type: 'work' }])
  assert.equal(current.loading.value, false)
})
