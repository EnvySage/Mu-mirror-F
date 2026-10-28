import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { CONTENT_TYPES, typeMap } from '../src/constants/tags.js'

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
