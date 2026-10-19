import test from 'node:test'
import assert from 'node:assert/strict'

const summaryModule = await import('../src/utils/chatDaySummaryActions.js').catch(() => ({}))

test('does not repeat candidate cards when their source session is open', () => {
  assert.equal(typeof summaryModule.resolveDaySummaryActions, 'function')
  if (typeof summaryModule.resolveDaySummaryActions !== 'function') return

  const action = { id: 'memory-1', kind: 'memory.accept' }
  assert.deepEqual(summaryModule.resolveDaySummaryActions({
    summary: { sourceSessionId: 'day-1', actions: [action] },
    activeSessionId: 'day-1',
    actionsById: { 'memory-1': action },
    getSessionActions: () => [action],
  }), [])
})

test('shows ended-day candidate cards once with the latest action state', () => {
  assert.equal(typeof summaryModule.resolveDaySummaryActions, 'function')
  if (typeof summaryModule.resolveDaySummaryActions !== 'function') return

  const stale = { id: 'memory-1', kind: 'memory.accept', state: 'PENDING', version: 1 }
  const latest = { id: 'memory-1', kind: 'memory.accept', state: 'SUCCEEDED', version: 2 }
  assert.deepEqual(summaryModule.resolveDaySummaryActions({
    summary: { sourceSessionId: 'day-2', actions: [stale] },
    activeSessionId: 'day-1',
    actionsById: { 'memory-1': latest },
    getSessionActions: () => [stale],
  }), [latest])
})

test('does not borrow candidate actions from the current session without a source id', () => {
  assert.equal(typeof summaryModule.resolveDaySummaryActions, 'function')
  if (typeof summaryModule.resolveDaySummaryActions !== 'function') return

  const unrelated = { id: 'memory-1', kind: 'memory.accept' }
  assert.deepEqual(summaryModule.resolveDaySummaryActions({
    summary: { actions: [] },
    activeSessionId: 'day-1',
    actionsById: { 'memory-1': unrelated },
    getSessionActions: () => [unrelated],
  }), [])
})
