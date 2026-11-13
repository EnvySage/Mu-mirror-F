const field = (value, camel, snake) => value?.[camel] ?? value?.[snake]
const upper = value => String(value || '').toUpperCase()
const camelize = value => Array.isArray(value) ? value.map(camelize) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), camelize(child)]))
  : value

export const indexPolicyVersionOf = value => Number(field(value, 'indexPolicyVersion', 'index_policy_version') || 0)
export const embeddingEnabledOf = segment => field(segment, 'embeddingEnabled', 'embedding_enabled') !== false
const approved = chunk => field(chunk, 'aiMemoryApproved', 'ai_memory_approved') === true
const embeddingStatus = chunk => String(field(chunk, 'embeddingStatus', 'embedding_status') || (field(chunk, 'hasEmbedding', 'has_embedding') ? 'ready' : 'not_requested')).toLowerCase()

/** Submission preserves the user's independent authorization and indexing choices. */
export function buildRecordSubmission(payload) {
  const next = camelize(payload || {})
  if (next.recordDraft?.segments) {
    next.recordDraft.segments = next.recordDraft.segments.map(segment => ({ ...segment, embeddingEnabled: embeddingEnabledOf(segment) }))
  }
  return next
}

export function resetEmbeddingSuggestion(segment) {
  const next = { ...segment, embeddingEnabled: true, embeddingReason: '正文已修改，默认保留检索' }
  delete next.embedding_enabled
  delete next.embedding_reason
  return next
}

/** Confirmed AI source text stays frozen even when no segment was authorized. */
export function canEditRecordBody(record) {
  const status = upper(record?.status)
  const state = upper(field(record, 'memoryState', 'memory_state') || (['REVIEWING', 'RECORD_ONLY'].includes(status) ? 'NONE' : 'UNKNOWN'))
  const confirmedAI = indexPolicyVersionOf(record) === 1 && status !== 'RECORD_ONLY'
    && field(record, 'userReviewed', 'user_reviewed') === true
    && field(record, 'aiProcessingAuthorized', 'ai_processing_authorized') === true
  return state === 'NONE' && !confirmedAI
}

/** Version one READY means authorized text is readable, independently of vectors. */
export function recordIndexingState(record) {
  if (indexPolicyVersionOf(record) !== 1) return null
  const chunks = record?.chunks || []
  const authorized = chunks.filter(approved)
  const memoryState = upper(field(record, 'memoryState', 'memory_state'))
  const readable = upper(record?.status) === 'DONE' && memoryState === 'READY'
    && field(record, 'userReviewed', 'user_reviewed') === true
    && field(record, 'aiProcessingAuthorized', 'ai_processing_authorized') === true
    && authorized.some(chunk => String(chunk.segment || '').trim())
  const indexed = authorized.filter(embeddingEnabledOf)
  const pending = indexed.filter(chunk => embeddingStatus(chunk) === 'pending').length
  const failed = indexed.filter(chunk => embeddingStatus(chunk) === 'failed').length
  const ready = indexed.filter(chunk => embeddingStatus(chunk) === 'ready').length
  const key = pending ? 'pending' : failed ? 'failed' : !indexed.length ? 'skipped' : ready === indexed.length ? 'ready' : 'not_requested'
  const label = pending && failed ? `联想索引：${pending} 个处理中，${failed} 个失败` : ({ pending: '联想索引处理中', failed: '部分联想索引失败', skipped: '已跳过联想索引', ready: '联想索引已就绪', not_requested: '联想索引尚未请求' })[key]
  let readabilityLabel = '已保存 · 暂不可供 AI 查询'
  if (readable) readabilityLabel = authorized.length === chunks.length ? '已保存 · 可查询' : '已保存 · 已授权片段可查询'
  else if (memoryState === 'DISABLED') readabilityLabel = '已永久移出记忆 · 不可供 AI 查询'
  else if (!authorized.length || field(record, 'aiProcessingAuthorized', 'ai_processing_authorized') === false) readabilityLabel = '已保存 · 未授权，不可供 AI 查询'
  return { key, label, readable, readabilityLabel, pending, failed, ready, total: indexed.length, moving: pending > 0,
    hint: readable ? `${failed ? '联想索引未全部完成。' : ''}日常内容仍可在对话中按需查询。${authorized.length < chunks.length ? '未授权片段不可供 AI 查询。' : ''}` : readabilityLabel }
}

export function shouldPollRecord(record) {
  if (upper(record?.status) === 'PROCESSING') return true
  if (indexPolicyVersionOf(record) === 1) {
    if (upper(field(record, 'memoryState', 'memory_state')) === 'DISABLED') return false
    return (record?.chunks || []).some(chunk => approved(chunk) && embeddingEnabledOf(chunk) && embeddingStatus(chunk) === 'pending')
  }
  return upper(field(record, 'memoryState', 'memory_state')) === 'PENDING'
}

export function chunkIndexingState(chunk, policyVersion = 0, memoryState = 'NONE') {
  const selective = Number(policyVersion) === 1
  const enabled = embeddingEnabledOf(chunk)
  const status = embeddingStatus(chunk)
  if (!approved(chunk)) return { key: 'unapproved', label: '未授权 · 不可供 AI 查询', retry: false }
  if (!selective) {
    const rawStatus = field(chunk, 'embeddingStatus', 'embedding_status')
    const hasEmbedding = field(chunk, 'hasEmbedding', 'has_embedding')
    const retry = rawStatus === 'failed' || (!hasEmbedding && rawStatus === 'not_requested')
    if (rawStatus === 'pending' || (!rawStatus && !hasEmbedding)) return { key: 'pending', label: '◌ 向量重建中，完成后即可用于记忆检索', retry }
    if (rawStatus === 'failed') return { key: status, label: `向量重建失败：${field(chunk, 'embeddingError', 'embedding_error') || '暂时无法生成'}`, retry }
    if (rawStatus === 'ready' || hasEmbedding) return { key: 'ready', label: `✓ 片段向量已就绪${upper(memoryState) === 'PENDING' ? '；整条记录全部就绪后才可检索' : upper(memoryState) === 'DISABLED' ? '；已永久移出记忆' : ''}`, retry }
    return { key: status, label: '尚未生成向量', retry }
  }
  if (upper(memoryState) === 'DISABLED') return { key: 'disabled', label: '已永久移出记忆 · 不可供 AI 查询', retry: false }
  const queryHint = upper(memoryState) === 'READY' ? '；已授权内容仍可在对话中按需查询。' : '；当前不可供 AI 查询。'
  if (!enabled) return { key: 'skipped', label: `已跳过联想索引${selective && upper(memoryState) === 'READY' ? '；日常内容仍可在对话中按需查询。' : ''}`, retry: false }
  if (status === 'pending') return { key: status, label: `联想索引处理中${queryHint}`, retry: false }
  if (status === 'failed') return { key: status, label: `联想索引失败${queryHint}`, retry: true }
  if (status === 'ready') return { key: status, label: '片段联想索引已就绪', retry: false }
  return { key: status, label: '尚未生成联想索引', retry: true }
}
