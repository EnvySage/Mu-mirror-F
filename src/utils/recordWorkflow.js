import { indexPolicyVersionOf } from './recordIndexing.js'

export const recordDraftOf = card => card?.payload?.recordDraft || card?.payload?.record_draft || card?.preview?.recordDraft || card?.preview?.record_draft || {}
export const recordIdOf = card => card?.result?.recordId ?? card?.result?.record_id ?? card?.payload?.sourceRecordId ?? recordDraftOf(card).sourceRecordId
export function recordConfirmationCopy(draft = {}) {
  const selective = indexPolicyVersionOf(draft) === 1
  if (draft.mode === 'ONLY_SAVE') return {
    before: '尚未保存。确认后仅保存这条记录，不加入记忆；内容不可供 AI 查询。',
    after: selective ? '已保存，仅保存这条记录；未授权内容不可供 AI 查询。' : '已提交，仅保存这条记录',
  }
  const authorized = draft.mode === 'AI_ASSISTED' && (draft.segments || []).some(segment => (segment.memoryEnabled ?? segment.memory_enabled) === true)
  if (selective && authorized) return {
    before: '尚未保存。一次确认后保存；日常内容仍可在对话中按需查询，未授权片段不可供 AI 查询。',
    after: '已保存。已授权的日常内容仍可在对话中按需查询。',
  }
  if (selective) return { before: '尚未保存。确认后保存；未授权内容不可供 AI 查询。', after: '已保存。未授权内容不可供 AI 查询。' }
  return { before: '尚未保存。确认后才创建记录，并在后台加入记忆。', after: '已提交，正在后台加入记忆' }
}
export function recordWorkflowState(card, submitting = false, error = '') {
  const prep = String(card?.preparation_status || card?.preparationStatus || recordDraftOf(card).preparationStatus || '').toUpperCase()
  const draft = recordDraftOf(card)
  const selective = indexPolicyVersionOf(draft) === 1
  if (selective && card?.state === 'SUCCEEDED') {
    const authorized = draft.mode === 'AI_ASSISTED' && (draft.segments || []).some(segment => (segment.memoryEnabled ?? segment.memory_enabled) === true)
    const denied = (draft.segments || []).some(segment => (segment.memoryEnabled ?? segment.memory_enabled) === false)
    return { key: 'done', label: authorized ? '已保存 · 可查询' : '已保存 · 未授权', hint: authorized ? `日常内容仍可在对话中按需查询。${denied ? '未授权片段不可供 AI 查询。' : ''}` : '未授权内容不可供 AI 查询。', step: 3 }
  }
  if (selective && (submitting || card?.state === 'EXECUTING')) return { key: 'saving', label: '正在确认保存', hint: '确认完成后即可查询已授权内容；联想索引状态另行展示。', step: 2, moving: true }
  if (submitting || card?.state === 'EXECUTING') return { key: 'indexing', label: '正在加入记忆', hint: '已经确认保存。你可以继续写，完成后这里会更新。', step: 2, moving: true }
  if (error || ['FAILED', 'STALE'].includes(card?.state) || prep === 'FAILED') return { key: 'failed', label: '需要处理', hint: error || '这次整理未完成，原始输入仍在。打开查看或重新整理。', step: 0 }
  if (card?.state === 'CANCELLED') return { key: 'cancelled', label: '已放弃', hint: '没有创建记录。', step: 0 }
  if (card?.state === 'SUCCEEDED') return { key: 'done', label: '已保存', hint: card.result?.outcome?.includes('FALLBACK') ? '已仅保存，没有加入记忆。' : '整理完成，已经收进你的记录。', step: 3 }
  if (prep === 'RUNNING') return { key: 'preparing', label: 'AI 正在整理', hint: '正在梳理标题、分类和成长贡献。尚未保存，整理好后由你确认。', step: 0, moving: true }
  return { key: 'review', label: '等你确认', hint: '整理好了。打开修改，确认后才保存。', step: 1 }
}
