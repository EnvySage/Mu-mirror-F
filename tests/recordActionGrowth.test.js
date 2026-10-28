import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, compileScript } from '@vue/compiler-sfc'
import { reactive, nextTick } from 'vue'

const source = await readFile(new URL('../src/components/organisms/action-forms/RecordActionForm.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const compiled = compileScript(descriptor, { id: 'record-growth-regression' }).content
  .replace(/from (['"])vue\1/g, `from ${JSON.stringify(import.meta.resolve('vue'))}`)
  .replace(/from '@\/constants\/tags'/g, `from ${JSON.stringify(new URL('../src/constants/tags.js', import.meta.url).href)}`)
  .replace("import { useGrowthStore } from '@/stores/growth'", 'const useGrowthStore = () => globalThis.__recordGrowthTestStore')
  .replace("import RecordTodoLinks from './RecordTodoLinks.vue'", 'const RecordTodoLinks = {}')
const { default: Form } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

function form({ mode = 'ONLY_SAVE', version = 0, suggestions = [] } = {}) {
  const axes = ['knowledge', 'action', 'care', 'courage', 'expression'].map(id => ({ id, name: id }))
  globalThis.__recordGrowthTestStore = reactive({ axesDefinition: { version: 5, axes }, config: {}, fetchAxes: async () => {} })
  const events = []
  const proposal = { id: 'card-1', payload: { recordDraft: {
    mode, axesVersion: version, growthSuggestions: suggestions,
    rawContent: '修 mirror 项目修了好久', finalContent: '修 mirror 项目修了好久', preparationStatus: 'READY', segments: [],
  } } }
  const props = reactive({ proposal })
  const state = Form.setup(props, { expose() {}, emit: (...args) => events.push(args) })
  return { state, events, props }
}

test('refreshing the same ready card preserves every local edit', async () => {
  const { state, props } = form()
  state.payload.value.recordDraft.segments = [{ text: '原文', contentType: 'note', tags: [] }]
  state.updateFinalContent('本地修改的正文')
  state.updateSegment(0, 'contentType', 'todo')
  state.setTags(0, '开发, bug修复')
  props.proposal = structuredClone(JSON.parse(JSON.stringify(props.proposal)))
  await nextTick()
  assert.equal(state.draft.value.finalContent, '本地修改的正文')
  assert.equal(state.draft.value.segments[0].contentType, 'todo')
  assert.deepEqual(state.draft.value.segments[0].tags, ['开发', 'bug修复'])
})

test('AI completion and switching cards still load the new server draft', async () => {
  const { state, props } = form()
  props.proposal.payload.recordDraft.preparationStatus = 'RUNNING'
  await nextTick()
  props.proposal.payload.recordDraft = { ...props.proposal.payload.recordDraft,
    preparationStatus: 'READY', finalContent: 'AI 整理后的正文', segments: [{ text: 'AI 整理后的正文', contentType: 'plan' }] }
  await nextTick()
  assert.equal(state.draft.value.finalContent, 'AI 整理后的正文')
  assert.equal(state.draft.value.segments[0].contentType, 'todo')
  state.updateFinalContent('这张卡的本地草稿')
  props.proposal = { ...props.proposal, id: 'card-2', payload: { recordDraft: { finalContent: '另一张卡', preparationStatus: 'READY' } } }
  await nextTick()
  assert.equal(state.draft.value.finalContent, '另一张卡')
})

test('editing a single segment keeps the final body in sync', () => {
  const { state } = form()
  state.payload.value.recordDraft.segments = [{ text: '原文' }]
  state.updateSegment(0, 'text', '修改后的片段')
  assert.equal(state.draft.value.finalContent, '修改后的片段')
})

test('typing a tag separator preserves the input until the next tag is entered', () => {
  const { state } = form()
  state.payload.value.recordDraft.segments = [{ text: '原文', tags: [] }]
  state.setTags(0, '开发, ')
  assert.equal(state.tagDrafts.value[0], '开发, ')
  assert.deepEqual(state.draft.value.segments[0].tags, ['开发'])
  state.setTags(0, '开发, 修复')
  assert.deepEqual(state.draft.value.segments[0].tags, ['开发', '修复'])
})

test('editing text on a save-only card must not manufacture five score suggestions', () => {
  const { state, events } = form()
  state.updateFinalContent('修改后的正文')
  state.submit()
  assert.deepEqual(events[0][1].recordDraft.growthSuggestions, [])
  assert.equal(events[0][1].recordDraft.axesVersion, 0)
})

test('save-only cards cannot enter score editing or falsely report changed definitions', () => {
  const { state } = form()
  state.updateGrowthSuggestion('knowledge', 'points', 2)
  assert.deepEqual(state.draft.value.growthSuggestions, [])
  assert.equal(state.growthDefinitionChanged.value, false)
})

test('an old save-only card with zero placeholders remains editable and drops the placeholders', () => {
  const { state, events } = form({ suggestions: [{ dimensionId: 'knowledge', points: 0, reason: '' }] })
  assert.equal(state.growthDefinitionChanged.value, false)
  state.submit()
  assert.deepEqual(events[0][1].recordDraft.growthSuggestions, [])
})

test('real AI suggestions retain their definition version and scores', () => {
  const { state, events } = form({ mode: 'AI_ASSISTED', version: 5, suggestions: [{ dimensionId: 'knowledge', points: 2, reason: '学习' }] })
  state.submit()
  assert.equal(events[0][1].recordDraft.axesVersion, 5)
  assert.equal(events[0][1].recordDraft.growthSuggestions.find(s => s.dimensionId === 'knowledge').points, 2)
})

test('a genuinely stale AI score cannot be submitted or silently rebased', () => {
  const { state, events } = form({ mode: 'AI_ASSISTED', version: 4, suggestions: [{ dimensionId: 'knowledge', points: 2, reason: '学习' }] })
  assert.equal(state.growthDefinitionChanged.value, true)
  state.submit()
  assert.deepEqual(events, [])
  assert.equal(state.draft.value.axesVersion, 4)
})

test('AI text edits with no scores do not manufacture score entries', () => {
  const { state, events } = form({ mode: 'AI_ASSISTED', version: 5 })
  state.submit()
  assert.deepEqual(events[0][1].recordDraft.growthSuggestions, [])
})

test('a new manually entered AI score binds the definitions used for that new score', () => {
  const { state } = form({ mode: 'AI_ASSISTED', version: 0 })
  state.updateGrowthSuggestion('knowledge', 'points', 2)
  assert.equal(state.draft.value.axesVersion, 5)
  assert.equal(state.growthDefinitionChanged.value, false)
})
