import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as Vue from 'vue'
import { compile } from '@vue/compiler-dom'
import { renderToString } from '@vue/server-renderer'

const indexing = await import('../src/utils/recordIndexing.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
  return {}
})
const submission = payload => {
  assert.equal(typeof indexing.buildRecordSubmission, 'function', 'submission policy must exist')
  return indexing.buildRecordSubmission(payload)
}

test('submission preserves explicit skip and independent memory/todo authorization', () => {
  const payload = { recordDraft: { mode: 'AI_ASSISTED', segments: [
    { text: '中午吃饭', embeddingEnabled: false, memoryEnabled: true, todoEnabled: false },
    { text: '私密记录', embeddingEnabled: true, memoryEnabled: false, todoEnabled: true },
  ] } }
  const before = structuredClone(payload)
  const actual = submission(payload)
  assert.deepEqual(actual.recordDraft.segments.map(s => [s.embeddingEnabled, s.memoryEnabled, s.todoEnabled]), [[false, true, false], [true, false, true]])
  assert.deepEqual(payload, before, 'building a request must not mutate the editable draft')
})

test('legacy missing indexing selection defaults true and accepts snake case drafts', () => {
  assert.equal(submission({ recordDraft: { segments: [{ memoryEnabled: false, todoEnabled: false }] } }).recordDraft.segments[0].embeddingEnabled, true)
  const actual = submission({ record_draft: { mode: 'AI_ASSISTED', segments: [{ embedding_enabled: false, embedding_reason: '日常', memory_enabled: false, todo_enabled: true }] } })
  assert.deepEqual(actual.recordDraft.segments[0], { embeddingEnabled: false, embeddingReason: '日常', memoryEnabled: false, todoEnabled: true })
})

test('editing body resets stale recommendation, while a later manual skip wins on submit', () => {
  assert.equal(typeof indexing.resetEmbeddingSuggestion, 'function')
  const original = { text: '原文', embeddingEnabled: false, embeddingReason: '普通日常', memoryEnabled: false, todoEnabled: true }
  const edited = indexing.resetEmbeddingSuggestion({ ...original, text: '今天去陈记牛肉面' })
  assert.equal(edited.embeddingEnabled, true)
  assert.equal(edited.embeddingReason, '正文已修改，默认保留检索')
  assert.equal(edited.memoryEnabled, false)
  assert.equal(edited.todoEnabled, true)
  assert.equal(original.embeddingEnabled, false)
  edited.embeddingEnabled = false
  assert.equal(submission({ recordDraft: { segments: [edited] } }).recordDraft.segments[0].embeddingEnabled, false)
})

test('actual form submit respects explicit memory denial and an indexing skip', async () => {
  const source = await readFile(new URL('../src/components/organisms/action-forms/RecordActionForm.vue', import.meta.url), 'utf8')
  const submit = source.slice(source.indexOf('function submit()'), source.indexOf('defineExpose'))
  let saved
  const payload = { value: { recordDraft: { mode: 'AI_ASSISTED', segments: [{ memoryEnabled: false, todoEnabled: true, embeddingEnabled: false }] } } }
  Function('payload', 'running', 'growthDefinitionChanged', 'supportsGrowthReview', 'growthAxes', 'clone', 'buildRecordSubmission', 'emit', `${submit}; submit()`)(payload, { value: false }, { value: false }, { value: false }, { value: [] }, structuredClone, indexing.buildRecordSubmission, (event, value) => { if (event === 'save') saved = value })
  assert.equal(saved.recordDraft.segments[0].memoryEnabled, false)
  assert.equal(saved.recordDraft.segments[0].embeddingEnabled, false)
  assert.equal(saved.recordDraft.segments[0].todoEnabled, true)
})

test('version one READY keeps polling pending chunks and stops for skipped or failed chunks', () => {
  assert.equal(typeof indexing.shouldPollRecord, 'function')
  const record = { index_policy_version: 1, status: 'done', memory_state: 'READY', user_reviewed: true, ai_processing_authorized: true }
  assert.equal(indexing.shouldPollRecord({ ...record, chunks: [{ ai_memory_approved: true, embedding_enabled: true, embedding_status: 'pending' }] }), true)
  assert.equal(indexing.shouldPollRecord({ ...record, chunks: [{ ai_memory_approved: true, embedding_enabled: false, embedding_status: 'not_requested' }] }), false)
  assert.equal(indexing.shouldPollRecord({ ...record, chunks: [{ ai_memory_approved: true, embedding_enabled: true, embedding_status: 'failed' }] }), false)
  assert.equal(indexing.shouldPollRecord({ status: 'processing' }), true)
})

test('real body editor resets suggestions only on a body change, preserving a later manual selection', async () => {
  const source = await readFile(new URL('../src/components/organisms/action-forms/RecordActionForm.vue', import.meta.url), 'utf8')
  const functions = source.slice(source.indexOf('function updateSegment('), source.indexOf('function tagsText('))
  const payload = { value: { recordDraft: { finalContent: '原文', segments: [{ text: '原文', embeddingEnabled: false, memoryEnabled: true }] } } }
  const handlers = Function('payload', 'props', 'emit', 'clone', 'resetEmbeddingSuggestion', `${functions}; return { updateSegment, updateFinalContent }`)(payload, { expanded: true }, () => {}, structuredClone, indexing.resetEmbeddingSuggestion)
  handlers.updateFinalContent('改过的正文')
  assert.equal(payload.value.recordDraft.segments[0].embeddingEnabled, true)
  handlers.updateSegment(0, 'embeddingEnabled', false)
  handlers.updateSegment(0, 'title', '只改标题')
  assert.equal(payload.value.recordDraft.segments[0].embeddingEnabled, false)
  handlers.updateFinalContent('改过的正文')
  assert.equal(payload.value.recordDraft.segments[0].embeddingEnabled, false, 'an unchanged input event cannot erase the manual selection')
  handlers.updateSegment(0, 'text', '再次修改片段正文')
  assert.equal(payload.value.recordDraft.segments[0].embeddingEnabled, true)
})

test('actual detail polling follows version one chunk pending while retaining legacy PENDING', async () => {
  const source = await readFile(new URL('../src/composables/useDetailPolling.js', import.meta.url), 'utf8')
  const implementation = source.slice(source.indexOf('export function')).replace('export function', 'function')
  for (const [record, continues] of [
    [{ indexPolicyVersion: 1, memoryState: 'READY', chunks: [{ aiMemoryApproved: true, embeddingEnabled: true, embeddingStatus: 'pending' }] }, true],
    [{ indexPolicyVersion: 1, memoryState: 'READY', chunks: [{ aiMemoryApproved: true, embeddingEnabled: false, embeddingStatus: 'not_requested' }] }, false],
    [{ indexPolicyVersion: 1, memoryState: 'READY', chunks: [{ aiMemoryApproved: true, embeddingEnabled: true, embeddingStatus: 'failed' }] }, false],
    [{ indexPolicyVersion: 0, memoryState: 'PENDING', chunks: [] }, true],
  ]) {
    const scheduled = []
    const polling = Function('onBeforeUnmount', 'setTimeout', 'clearTimeout', 'shouldPollRecord', `${implementation}; return useDetailPolling`)(() => {}, fn => { scheduled.push(fn); return scheduled.length }, () => {}, indexing.shouldPollRecord)({ ui: { selectedRecordId: 8 }, recordsStore: { fetchRecord: async () => record }, record: { value: record }, getGeneration: () => 1 })
    polling.startEmbeddingPolling(8)
    await scheduled.shift()()
    assert.equal(scheduled.length > 0, continues, JSON.stringify(record))
  }
})

test('actual chunk status renders intentional skip without a failed/retry affordance', async () => {
  const source = await readFile(new URL('../src/components/organisms/ChunkCard.vue', import.meta.url), 'utf8')
  const start = source.indexOf('    <div v-if="chunk.ai_memory_approved')
  const end = source.indexOf('    <!-- 标题/摘要', start)
  const template = source.slice(start, end)
  const render = Function('Vue', compile(template, { mode: 'function', prefixIdentifiers: true }).code)(Vue)
  const chunk = { ai_memory_approved: true, embedding_enabled: false, embedding_status: 'not_requested' }
  const html = await renderToString(Vue.createSSRApp({ render, setup: () => ({ chunk, props: { memoryState: 'READY', indexPolicyVersion: 1 }, embeddingEnabled: Vue.computed(() => indexing.embeddingEnabledOf?.(chunk)), chunkIndexing: Vue.computed(() => indexing.chunkIndexingState?.(chunk, 1, 'READY')), saving: false, retryEmbedding: () => {} }) }))
  assert.match(html, /已跳过.*索引/)
  assert.match(html, /日常内容仍可在对话中按需查询/)
  assert.doesNotMatch(html, /重试生成|失败|重建中/)
})

test('legacy chunk states retain their original presentation including missing-status pending', () => {
  assert.equal(indexing.chunkIndexingState({ aiMemoryApproved: true }, 0, 'PENDING').label, '◌ 向量重建中，完成后即可用于记忆检索')
  assert.equal(indexing.chunkIndexingState({ aiMemoryApproved: true, embeddingStatus: 'failed', embeddingError: '临时错误' }, 0, 'NONE').label, '向量重建失败：临时错误')
  assert.equal(indexing.chunkIndexingState({ aiMemoryApproved: true, embeddingStatus: 'ready' }, 0, 'PENDING').label, '✓ 片段向量已就绪；整条记录全部就绪后才可检索')
})

test('version one chunk never promises readability before READY or after withdrawal', () => {
  const pending = indexing.chunkIndexingState({ aiMemoryApproved: true, embeddingStatus: 'pending' }, 1, 'NONE')
  assert.doesNotMatch(pending.label, /仍可.*查询/)
  const disabled = indexing.chunkIndexingState({ aiMemoryApproved: true, embeddingEnabled: false, embeddingStatus: 'not_requested' }, 1, 'DISABLED')
  assert.match(disabled.label, /不可供 AI 查询/)
})

test('reviewed version one AI text freezes even without approved chunks; legacy and ordinary saves stay editable', async () => {
  assert.equal(typeof indexing.canEditRecordBody, 'function')
  const confirmed = { indexPolicyVersion: 1, status: 'done', memoryState: 'NONE', userReviewed: true, aiProcessingAuthorized: true, chunks: [{ aiMemoryApproved: false }] }
  assert.equal(indexing.canEditRecordBody(confirmed), false)
  assert.equal(indexing.canEditRecordBody({ ...confirmed, indexPolicyVersion: 0 }), true)
  assert.equal(indexing.canEditRecordBody({ ...confirmed, status: 'record_only', aiProcessingAuthorized: false }), true)
  assert.equal(indexing.canEditRecordBody({ ...confirmed, userReviewed: false }), true)
  const source = await readFile(new URL('../src/components/organisms/ReviewPanel.vue', import.meta.url), 'utf8')
  const chunksExpression = source.match(/const chunksEditable = computed\(\(\) => (.*)\)/)[1]
  const authorizationExpression = source.match(/const editable = computed\(\(\) => (.*)\)/)[1]
  const bodyEditable = record => Function('props', 'memoryState', 'canEditRecordBody', `return (${chunksExpression})`)({ record }, { value: 'NONE' }, indexing.canEditRecordBody)
  assert.equal(bodyEditable(confirmed), false)
  assert.equal(bodyEditable({ ...confirmed, indexPolicyVersion: 0 }), true)
  assert.equal(bodyEditable({ ...confirmed, status: 'record_only', aiProcessingAuthorized: false }), true)
  assert.equal(Function('memoryState', `return (${authorizationExpression})`)({ value: 'NONE' }), true, 'text freeze leaves independent authorization and growth controls available')
})

test('a denied segment visibly states unreadability while index choices remain collapsed', async () => {
  const source = await readFile(new URL('../src/components/organisms/action-forms/RecordActionForm.vue', import.meta.url), 'utf8')
  const template = source.match(/<details v-if="draft.mode === 'AI_ASSISTED'" class="record-indexing-options">[\s\S]*?<\/details>/)[0]
  const render = Function('Vue', compile(template, { mode: 'function', prefixIdentifiers: true }).code)(Vue)
  const html = await renderToString(Vue.createSSRApp({ render, setup: () => ({ draft: { mode: 'AI_ASSISTED' }, segment: { memoryEnabled: false, embeddingEnabled: false }, embeddingEnabledOf: indexing.embeddingEnabledOf, running: false, index: 0, updateSegment: () => {} }) }))
  assert.doesNotMatch(html, /<details[^>]*\sopen[\s=>]/)
  const collapsedVisible = html.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)[1]
  assert.match(collapsedVisible, /未授权/)
  assert.match(collapsedVisible, /不可供 AI 查询/)
})

test('legacy AI segment index details do not promise immediate date-query access', async () => {
  const source = await readFile(new URL('../src/components/organisms/action-forms/RecordActionForm.vue', import.meta.url), 'utf8')
  const template = source.match(/<details v-if="draft.mode === 'AI_ASSISTED'" class="record-indexing-options">[\s\S]*?<\/details>/)[0]
  const render = Function('Vue', compile(template, { mode: 'function', prefixIdentifiers: true }).code)(Vue)
  const html = await renderToString(Vue.createSSRApp({ render, setup: () => ({ draft: { mode: 'AI_ASSISTED', indexPolicyVersion: 0 }, segment: { memoryEnabled: true }, embeddingEnabledOf: indexing.embeddingEnabledOf, indexPolicyVersionOf: indexing.indexPolicyVersionOf, running: false, index: 0, updateSegment: () => {} }) }))
  assert.doesNotMatch(html, /仍可在对话中按需查询/)
  assert.match(html, /后台加入记忆/)
})
