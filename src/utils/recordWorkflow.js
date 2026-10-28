export const recordDraftOf = card => card?.payload?.recordDraft || card?.preview?.recordDraft || {}
export const recordIdOf = card => card?.result?.recordId ?? card?.result?.record_id ?? card?.payload?.sourceRecordId ?? recordDraftOf(card).sourceRecordId
export function recordWorkflowState(card, submitting = false, error = '') {
  const prep = String(card?.preparation_status || card?.preparationStatus || recordDraftOf(card).preparationStatus || '').toUpperCase()
  if (submitting || card?.state === 'EXECUTING') return { key: 'indexing', label: '正在加入记忆', hint: '已经确认保存。你可以继续写，完成后这里会更新。', step: 2, moving: true }
  if (error || ['FAILED', 'STALE'].includes(card?.state) || prep === 'FAILED') return { key: 'failed', label: '需要处理', hint: error || '这次整理未完成，原始输入仍在。打开查看或重新整理。', step: 0 }
  if (card?.state === 'CANCELLED') return { key: 'cancelled', label: '已放弃', hint: '没有创建记录。', step: 0 }
  if (card?.state === 'SUCCEEDED') return { key: 'done', label: '已保存', hint: card.result?.outcome?.includes('FALLBACK') ? '已仅保存，没有加入记忆。' : '整理完成，已经收进你的记录。', step: 3 }
  if (prep === 'RUNNING') return { key: 'preparing', label: 'AI 正在整理', hint: '正在梳理标题、分类和成长贡献。尚未保存，整理好后由你确认。', step: 0, moving: true }
  return { key: 'review', label: '等你确认', hint: '整理好了。打开修改，确认后才保存。', step: 1 }
}
