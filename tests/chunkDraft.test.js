import test from 'node:test'
import assert from 'node:assert/strict'
import { createChunkDraft, discardChunkDraft, hasChunkDraftChanges, updateChunkDraft } from '../src/utils/chunkDraft.js'

test('draft is dirty only while text differs from the committed text', () => {
  const original = createChunkDraft('一开始的内容')
  assert.equal(hasChunkDraftChanges(original), false)
  const edited = updateChunkDraft(original, '暂时改过')
  assert.equal(hasChunkDraftChanges(edited), true)
  const restored = updateChunkDraft(edited, '一开始的内容')
  assert.equal(hasChunkDraftChanges(restored), false)
})

test('cancel restores the last committed text without changing the original', () => {
  const edited = updateChunkDraft(createChunkDraft('旧向量对应的文本'), '还没保存的新草稿')
  const cancelled = discardChunkDraft(edited)
  assert.deepEqual(cancelled, { original: '旧向量对应的文本', value: '旧向量对应的文本' })
  assert.equal(hasChunkDraftChanges(cancelled), false)
})
