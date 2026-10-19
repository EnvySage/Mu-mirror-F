export function memoryManagementLinks(memoryId) {
  return { list: '/chat-memories', detail: `/chat-memories/${encodeURIComponent(memoryId)}` }
}

const allowed = {
  'memory.edit': new Set(['memoryId', 'expectedVersion', 'content', 'kind', 'eventDate', 'expiresAt', 'sourceSessionId', 'sourceMessageId']),
  'memory.forget': new Set(['memoryId', 'expectedVersion', 'sourceSessionId', 'sourceMessageId']),
}

export function memoryActionPayload(kind, payload) {
  const fields = allowed[kind]
  if (!fields || Object.keys(payload || {}).some(key => !fields.has(key))) throw new Error('unsupported memory action payload')
  return Object.fromEntries(Object.entries(payload || {}).filter(([key]) => fields.has(key)))
}
