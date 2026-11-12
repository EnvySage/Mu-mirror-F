import test from 'node:test'
import assert from 'node:assert/strict'
import { createChatFrameHandler } from '../src/utils/chatFrames.js'
import { normalizeChatHistory } from '../src/utils/chatMessages.js'

test('SSE frames retain streamed text and trusted source identity through completion', () => {
  const sessionId = { value: null }, activeSessionId = { value: null }
  let savedSession
  const handle = createChatFrameHandler({ sessionId, activeSessionId, saveSessionId: value => { savedSession = value }, fallbackText: 'Unavailable' })
  const message = { content: '', typing: true }, user = {}
  const frame = (event, payload) => handle(`event: ${event}\ndata: ${JSON.stringify(payload)}`, message, user)
  assert.equal(frame('meta', { sessionId: 'session-1', sourceMessageId: 41, runId: 'run-1' }), false)
  frame('delta', { content: 'A first sentence. ' })
  frame('delta', { content: 'A second sentence.' })
  frame('sources', [{ n: 5, record_id: 18, quote: 'Evidence', date: '2026-11-11' }])
  assert.equal(frame('done', { sessionId: 'session-1', assistantMessageId: 42, status: 'completed' }), true)
  assert.equal(message.content, 'A first sentence. A second sentence.')
  assert.equal(message.serverMessageId, '42')
  assert.equal(user.serverMessageId, '41')
  assert.equal(message.actionSourceMessage, '41')
  assert.equal(message.sources[0].recordId, 18)
  assert.equal(message.sources[0].n, 5)
  assert.equal(message.typing, false)
  assert.equal(savedSession, 'session-1')
  assert.equal(activeSessionId.value, sessionId.value)
})

test('file references keep one strong source and failed replies preserve partial text', () => {
  const handle = createChatFrameHandler({ sessionId: { value: null }, activeSessionId: { value: null }, saveSessionId() {}, fallbackText: 'Unavailable' })
  const message = { content: 'Partial answer', typing: true }
  handle(`event: vault_refs\ndata: ${JSON.stringify([{ vault_item_id: 7, display_name: 'file' }, { vault_item_id: 7, quote: 'Original evidence' }])}`, message)
  assert.equal(message.vaultRefs.length, 1)
  assert.equal(message.vaultRefs[0].strength, 'strong')
  assert.equal(handle('event: error\ndata: {"code":"TIMEOUT"}', message), false)
  assert.equal(message.content, 'Partial answer')
  assert.equal(message.status, 'failed')
})

test('history replay keeps assistant and user identities attached to their own turn', () => {
  const messages = normalizeChatHistory([
    { id: 20, role: 'user', content: 'First question' },
    { id: 21, role: 'assistant', content: 'First answer', sources: [{ n: 2, record_id: 8 }] },
    { id: 22, role: 'user', content: 'Second question' },
    { id: 23, role: 'assistant', content: 'Second answer' },
  ], () => 100)
  assert.equal(messages[1].serverMessageId, '21')
  assert.equal(messages[1].actionSourceMessage, '20')
  assert.equal(messages[1].sources[0].recordId, 8)
  assert.equal(messages[3].serverMessageId, '23')
  assert.equal(messages[3].actionSourceMessage, '22')
})
