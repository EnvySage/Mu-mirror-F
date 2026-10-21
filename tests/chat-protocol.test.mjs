import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyChatError,
  applyTransportError,
  createChatRequest,
  normalizeChatDone,
  normalizeChatMeta,
  normalizeCreatedRecords,
  retryChatRequest,
} from '../src/utils/chatProtocol.js'

test('a reconnect reuses one request ID and a new send gets a fresh ID', () => {
  const ids = ['request-one', 'request-two']
  let next = 0
  const first = createChatRequest('  今天完成了记录  ', 'session-a', () => ids[next++])
  const reconnect = retryChatRequest(first)
  const nextSend = createChatRequest('再发一次相同正文', 'session-a', () => ids[next++])

  assert.equal(first.question, '今天完成了记录')
  assert.equal(reconnect.requestId, first.requestId)
  assert.deepEqual(reconnect, first)
  assert.notEqual(nextSend.requestId, first.requestId)
})

test('server failure keeps streamed partial content and stops typing', () => {
  const message = { content: '已经收到的部分正文', typing: true, status: null }

  applyChatError(message, { code: 'AGENT_ERROR', message: '本轮处理失败' })

  assert.equal(message.content, '已经收到的部分正文')
  assert.equal(message.typing, false)
  assert.equal(message.status, 'failed')
  assert.equal(message.errorCode, 'AGENT_ERROR')
})

test('transport failure keeps partial content and makes retry eligible', () => {
  const message = { content: '部分正文', typing: true }

  applyTransportError(message)

  assert.equal(message.content, '部分正文')
  assert.equal(message.typing, false)
  assert.equal(message.retryable, true)
})

test('legacy meta and done payloads tolerate unknown fields', () => {
  const meta = normalizeChatMeta({ sessionId: 'session-a', route: 'hybrid', future: { v: 2 } })
  const sourcedMeta = normalizeChatMeta({ source_message_id: 904 })
  const done = normalizeChatDone({ sessionId: 'session-a', fallback: false, newField: true })
  const uncertain = normalizeChatDone({ status: 'completed', outcome: 'action_unknown', runId: 'run-a' })

  assert.equal(meta.sessionId, 'session-a')
  assert.equal(meta.route, 'hybrid')
  assert.equal(meta.runId, null)
  assert.deepEqual(meta.toolsUsed, [])
  assert.equal(sourcedMeta.sourceMessageId, 904)
  assert.equal(done.status, 'completed')
  assert.equal(done.runId, null)
  assert.deepEqual(done.createdRecords, [])
  assert.equal(uncertain.status, 'completed')
  assert.equal(uncertain.outcome, 'action_unknown')
  assert.equal(uncertain.runId, 'run-a')
})

test('created-record receipts normalize identically from SSE and history payloads', () => {
  const fromSse = normalizeCreatedRecords([
    { record_id: 31, status: 'record_only', created_at: '2026-10-20 12:30:00' },
  ])
  const fromHistory = normalizeCreatedRecords([
    { recordId: 31, status: 'record_only', createdAt: '2026-10-20 12:30:00' },
  ])
  const done = normalizeChatDone({ created_records: [{ record_id: 31, status: 'record_only' }] })
  const repeatedReceipts = normalizeCreatedRecords([
    { record_id: 31, status: 'record_only' },
    { recordId: 31, status: 'record_only' },
  ])

  assert.deepEqual(fromSse, fromHistory)
  assert.deepEqual(done.createdRecords, [{ recordId: 31, status: 'record_only', createdAt: '' }])
  assert.deepEqual(repeatedReceipts, [{ recordId: 31, status: 'record_only', createdAt: '' }])
  assert.deepEqual(normalizeCreatedRecords([{ status: 'record_only' }, null]), [])
})
