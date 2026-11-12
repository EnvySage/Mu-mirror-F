import { normalizeCreatedRecords } from './chatProtocol.js'

export function normalizeVaultRefs(refs) {
  const seen = new Map()
  for (const r of refs) {
    if (!r || (r.vault_item_id == null && !r.vague)) continue
    const key = r.vague ? `vague:${r.display_name || r.query || ''}` : String(r.vault_item_id)
    const item = {
      id: key,
      n: r.n ?? null,
      vaultItemId: r.vault_item_id ?? null,
      displayName: r.display_name || r.original_name || '未命名文件',
      category: r.category || null,
      fileType: r.file_type || r.fileType || '',
      sizeBytes: r.size_bytes ?? r.sizeBytes ?? null,
      digestStatus: r.digest_status || r.digestStatus || 'confirmed',
      quote: r.quote || '',
      createdAt: r.created_at || '',
      deleted: !!r.deleted,
      vague: !!r.vague,
      strength: r.quote ? 'strong' : (r.vague ? 'vague' : 'weak'),
    }
    // 同 vault_item_id 多引用同气泡单卡：强引用优先保留
    const prev = seen.get(key)
    if (!prev || (prev.strength !== 'strong' && item.strength === 'strong')) seen.set(key, item)
  }
  return [...seen.values()]
}

export function normalizeToolsUsed(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((t, i) => {
      if (typeof t === 'string') {
        const idx = t.indexOf(':')
        return idx > -1
          ? { id: `t${i}`, tool: t.slice(0, idx), summary: t.slice(idx + 1) }
          : { id: `t${i}`, tool: t, summary: '' }
      }
      if (t && typeof t === 'object') {
        return { id: `t${i}`, tool: t.tool || t.name || '', summary: t.summary || t.result_summary || '' }
      }
      return null
    })
    .filter(Boolean)
}

export function normalizeChatHistory(messages, nextId) {
  let lastUserMessageId = null
  return (messages || []).map(m => {
  const role = m.role === 'assistant' ? 'ai' : 'user'
  if (role === 'user') lastUserMessageId = String(m.id ?? '')
  return {
  id: String(m.id ?? nextId()),
  serverMessageId: String(m.id ?? ''),
  role,
  actionSourceMessage: role === 'ai' ? lastUserMessageId : null,
  content: m.content || '',
  createdAt: m.created_at || m.createdAt || '',
  route: null,
  typing: false,
  sources: (m.sources || [])
    .filter(s => s && s.record_id > 0)
    .map(s => ({ n: s.n ?? null, recordId: s.record_id, quote: s.quote || '', date: s.date || '' })),
  // 历史回放：B 在消息 VO 带出 tools_used / vault_refs 才有值，缺省空数组不渲染
  toolsUsed: normalizeToolsUsed(m.tools_used || []),
  vaultRefs: normalizeVaultRefs(m.vault_refs || []),
  createdRecords: normalizeCreatedRecords(m.created_records || []),
  status: 'completed',
  outcome: null,
  requestId: null,
  runId: null,
  retryable: false,
  checkingRun: false,
  // thinking 不落 conversation_history——历史消息永远没有思考面板（契约）
  thinking: '',
  }
})
}
