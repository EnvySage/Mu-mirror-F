import request from './request'

// Action payloads are stored as JSON with a kind-specific camelCase schema; preserve its keys.
const rawJson = { transformRequest: [data => JSON.stringify(data)] }

export function createPrepareKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16)
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

export const listActions = (sessionId) => request.get('/assistant/actions', { params: { sessionId } })
export const listRecordWorkflows = () => request.get('/assistant/actions/records')
export const prepareAction = (kind, payload, prepareKey) => request.post('/assistant/actions/prepare', { kind, payload, prepareKey }, rawJson)
export const getAction = (id) => request.get(`/assistant/actions/${id}`)
export const editAction = (id, body) => request.patch(`/assistant/actions/${id}`, body, rawJson)
export const confirmAction = (id, body) => request.post(`/assistant/actions/${id}/confirm`, body, rawJson)
export const cancelAction = (id, body) => request.post(`/assistant/actions/${id}/cancel`, body, rawJson)
