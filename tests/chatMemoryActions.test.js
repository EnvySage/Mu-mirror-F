import test from 'node:test'
import assert from 'node:assert/strict'
import { memoryManagementLinks, memoryActionPayload } from '../src/utils/chatMemoryActions.js'

test('memory management prepares explicit edit and forget cards without mutating memory', () => {
  assert.deepEqual(memoryManagementLinks(42), { list: '/chat-memories', detail: '/chat-memories/42' })
  assert.deepEqual(memoryActionPayload('memory.edit', { memoryId: 42, expectedVersion: 2, content: 'updated', kind: 'fact' }), { memoryId: 42, expectedVersion: 2, content: 'updated', kind: 'fact' })
  assert.deepEqual(memoryActionPayload('memory.forget', { memoryId: 42, expectedVersion: 3 }), { memoryId: 42, expectedVersion: 3 })
  assert.throws(() => memoryActionPayload('memory.forget', { memoryId: 42, direct: true }), /unsupported/)
})
