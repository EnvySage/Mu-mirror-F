import test from 'node:test'
import assert from 'node:assert/strict'

const labelsModule = await import('../src/utils/actionLabel.js').catch(() => ({}))

test('the memory disable action has a clear confirmation-card label', () => {
  assert.equal(typeof labelsModule.getActionLabel, 'function')
  assert.equal(labelsModule.getActionLabel('record.memory.disable'), '永久移除记忆')
})
