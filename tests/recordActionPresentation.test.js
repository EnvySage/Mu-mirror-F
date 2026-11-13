import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { CONTENT_TYPES, typeMap } from '../src/constants/tags.js'
import { recordWorkflowState } from '../src/utils/recordWorkflow.js'
import * as workflow from '../src/utils/recordWorkflow.js'
import * as Vue from 'vue'
import { compile } from '@vue/compiler-dom'
import { renderToString } from '@vue/server-renderer'

const indexing = await import('../src/utils/recordIndexing.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
  return {}
})

const source = await readFile(new URL('../src/components/organisms/ActionCard.vue', import.meta.url), 'utf8')
const expression = source.match(/const title = computed\(\(\) => (.*)\)/)[1]
const titleOf = proposal => Function('props', 'recordDraft', `return (${expression})`)({ proposal }, { value: proposal.payload?.recordDraft || proposal.preview?.recordDraft })

test('AI completion replaces the source excerpt with the generated title', () => {
  const proposal = { kind: 'record.create', payload: { recordDraft: { rawContent: '刚刚写一篇日记发现了好多 bug', segments: [] } } }
  assert.equal(titleOf(proposal), '刚刚写一篇日记发现了好多 bug')
  proposal.payload.recordDraft.segments = [{ title: '修复日记标题与分类问题' }]
  assert.equal(titleOf(proposal), '修复日记标题与分类问题')
  assert.equal(titleOf({ kind: 'record.organize', preview: { recordDraft: proposal.payload.recordDraft } }), '修复日记标题与分类问题')
})

test('record categories have a single todo option and legacy plans display as todos', () => {
  assert.equal(CONTENT_TYPES.filter(item => ['todo', 'plan'].includes(item.key)).length, 1)
  assert.equal(typeMap.plan, '待办')
})

test('a version one successful all-daily action is saved and queryable without indexing animation', () => {
  const state = recordWorkflowState({ state: 'SUCCEEDED', payload: { recordDraft: { indexPolicyVersion: 1, mode: 'AI_ASSISTED', segments: [{ memoryEnabled: true, embeddingEnabled: false }] } }, result: { recordId: 12 } })
  assert.equal(state.label, '已保存 · 可查询')
  assert.equal(Boolean(state.moving), false)
  assert.match(state.hint, /日常内容仍可在对话中按需查询/)
})

test('saved version one records show independent pending/failed/skipped index status', () => {
  assert.equal(typeof indexing.recordIndexingState, 'function')
  const record = { indexPolicyVersion: 1, status: 'done', memoryState: 'READY', userReviewed: true, aiProcessingAuthorized: true }
  const pending = indexing.recordIndexingState({ ...record, chunks: [{ segment: '具体经历', aiMemoryApproved: true, embeddingEnabled: true, embeddingStatus: 'pending' }] })
  assert.equal(pending.readable, true)
  assert.equal(pending.key, 'pending')
  const failed = indexing.recordIndexingState({ ...record, chunks: [{ segment: '具体经历', aiMemoryApproved: true, embeddingEnabled: true, embeddingStatus: 'failed' }] })
  assert.equal(failed.readable, true)
  assert.equal(failed.key, 'failed')
  const skipped = indexing.recordIndexingState({ ...record, chunks: [{ segment: '日常', aiMemoryApproved: true, embeddingEnabled: false, embeddingStatus: 'not_requested' }] })
  assert.equal(skipped.readable, true)
  assert.equal(skipped.key, 'skipped')
  assert.equal(skipped.moving, false)
})

test('unapproved segments are never described as readable and version zero retains prior semantics', () => {
  assert.equal(typeof indexing.recordIndexingState, 'function')
  const state = indexing.recordIndexingState({ index_policy_version: 1, status: 'done', memory_state: 'READY', user_reviewed: true, processing_consent: true, chunks: [{ ai_memory_approved: false, embedding_enabled: false, embedding_status: 'not_requested' }] })
  assert.equal(state.readable, false)
  assert.match(state.readabilityLabel, /未授权.*不可供 AI 查询/)
  const old = recordWorkflowState({ state: 'SUCCEEDED', payload: { recordDraft: { indexPolicyVersion: 0 } }, result: { outcome: 'SAVE_ONLY_FALLBACK' } })
  assert.equal(old.label, '已保存')
  assert.equal(old.hint, '已仅保存，没有加入记忆。')
})

test('workspace confirmation copy promises immediate queries only for version one authorized AI content', async () => {
  const workspace = await readFile(new URL('../src/components/organisms/RecordReviewWorkspace.vue', import.meta.url), 'utf8')
  const template = workspace.match(/<p class="workspace-state"[\s\S]*?<\/p>/)[0]
  const render = Function('Vue', compile(template, { mode: 'function', prefixIdentifiers: true }).code)(Vue)
  for (const [draft, queryable, expected] of [
    [{ indexPolicyVersion: 0, mode: 'AI_ASSISTED', segments: [{ memoryEnabled: true }] }, false, /后台加入记忆/],
    [{ indexPolicyVersion: 0, mode: 'ONLY_SAVE', segments: [] }, false, /仅保存/],
    [{ indexPolicyVersion: 1, mode: 'ONLY_SAVE', segments: [{ memoryEnabled: true }] }, false, /仅保存/],
    [{ indexPolicyVersion: 1, mode: 'AI_ASSISTED', segments: [{ memoryEnabled: false }] }, false, /未授权内容不可供 AI 查询/],
    [{ indexPolicyVersion: 1, mode: 'AI_ASSISTED', segments: [{ memoryEnabled: true }, { memoryEnabled: false }] }, true, /未授权片段不可供 AI 查询/],
  ]) {
    const html = await renderToString(Vue.createSSRApp({ render, setup: () => ({ editable: true, state: { label: '等你确认' }, confirmationCopy: workflow.recordConfirmationCopy?.(draft) }) }))
    assert.equal(/日常内容仍可在对话中按需查询/.test(html), queryable, JSON.stringify(draft))
    assert.match(html, expected)
  }
})

test('actual confirmation toast does not claim queryability for save-only or denied drafts', async () => {
  const workspace = await readFile(new URL('../src/components/organisms/RecordReviewWorkspace.vue', import.meta.url), 'utf8')
  const submit = workspace.slice(workspace.indexOf('async function submit(payload)'), workspace.indexOf('async function discard()'))
  for (const [draft, queryable] of [
    [{ indexPolicyVersion: 0, mode: 'AI_ASSISTED', segments: [{ memoryEnabled: true }] }, false],
    [{ indexPolicyVersion: 1, mode: 'ONLY_SAVE', segments: [] }, false],
    [{ indexPolicyVersion: 1, mode: 'AI_ASSISTED', segments: [{ memoryEnabled: false }] }, false],
    [{ indexPolicyVersion: 1, mode: 'AI_ASSISTED', segments: [{ memoryEnabled: true }] }, true],
  ]) {
    let toastText
    await Function('saving', 'editable', 'error', 'card', 'dirty', 'actions', 'indexPolicyVersionOf', 'recordConfirmationCopy', 'ui', 'router', 'toast', `${submit}; return submit({ recordDraft: ${JSON.stringify(draft)} })`)({ value: false }, { value: true }, { value: '' }, { value: { id: 'case' } }, { value: false }, { edit: async () => {}, submitRecord: async () => ({ state: 'SUCCEEDED' }), recordErrors: {} }, indexing.indexPolicyVersionOf, workflow.recordConfirmationCopy, {}, { push: async () => {} }, { info: value => { toastText = value } })
    assert.equal(/仍可在对话中按需查询/.test(toastText), queryable, JSON.stringify(draft))
  }
})

test('aggregate indexing status exposes failed counts while other chunks are still pending', () => {
  const state = indexing.recordIndexingState({ indexPolicyVersion: 1, status: 'done', memoryState: 'READY', userReviewed: true, aiProcessingAuthorized: true, chunks: [
    { segment: '处理中', aiMemoryApproved: true, embeddingEnabled: true, embeddingStatus: 'pending' },
    { segment: '失败', aiMemoryApproved: true, embeddingEnabled: true, embeddingStatus: 'failed' },
  ] })
  assert.equal(state.readable, true)
  assert.equal(state.moving, true)
  assert.match(state.label, /1 个处理中/)
  assert.match(state.label, /1 个失败/)
})
