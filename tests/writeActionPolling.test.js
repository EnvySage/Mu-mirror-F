import test from 'node:test'
import assert from 'node:assert/strict'

const pollingModule = await import('../src/utils/writeActionPolling.js').catch(() => ({}))

function createScheduler() {
  const tasks = []
  return {
    schedule(callback, delay) {
      const task = { callback, delay, cancelled: false }
      tasks.push(task)
      return task
    },
    cancel(task) { if (task) task.cancelled = true },
    async runNext() {
      const task = tasks.find(item => !item.cancelled)
      assert.ok(task, 'an active polling callback should be scheduled')
      task.cancelled = true
      await task.callback()
      return task
    },
    tasks,
  }
}

test('an executing create action refreshes to success and notifies the modal parent', async () => {
  assert.equal(typeof pollingModule.createActionStatusPoller, 'function')
  assert.equal(typeof pollingModule.completeCreatedRecordAction, 'function')
  const scheduler = createScheduler()
  const responses = [
    { id: 'action-1', state: 'EXECUTING', result: { recordId: 42 } },
    { id: 'action-1', state: 'SUCCEEDED', result: { recordId: 42 } },
  ]
  const displayedStates = []
  const parentEvents = []
  const records = [{ id: 42, content: 'saved record' }]
  const complete = pollingModule.completeCreatedRecordAction
  const poller = pollingModule.createActionStatusPoller({
    refresh: async () => responses.shift(),
    onUpdate: async card => {
      displayedStates.push(card.state)
      await complete(card, {
        fetchRecords: async () => {},
        records,
        emit: (name, value) => parentEvents.push([name, value]),
      })
    },
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
  })

  poller.start('action-1', 'EXECUTING')
  await scheduler.runNext()
  await scheduler.runNext()

  assert.deepEqual(displayedStates, ['EXECUTING', 'SUCCEEDED'])
  assert.deepEqual(parentEvents, [['saved', records[0]], ['close', undefined]])
})

test('a transient status refresh failure retries slowly and stop cancels the retry', async () => {
  assert.equal(typeof pollingModule.createActionStatusPoller, 'function')
  const scheduler = createScheduler()
  const poller = pollingModule.createActionStatusPoller({
    refresh: async () => { throw new Error('offline') },
    onUpdate: () => {},
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
    intervalMs: 1500,
    retryIntervalMs: 5000,
  })

  poller.start('action-2', 'EXECUTING')
  const first = await scheduler.runNext()
  assert.equal(first.delay, 1500)
  const retry = scheduler.tasks.find(item => item.delay === 5000)
  assert.ok(retry, 'a network error should schedule the slower retry interval')
  poller.stop()
  assert.equal(retry.cancelled, true)
})
