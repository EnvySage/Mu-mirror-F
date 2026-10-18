import request from './request'

// Action payloads are stored as JSON with a kind-specific camelCase schema; preserve its keys.
const rawJson = { transformRequest: [data => JSON.stringify(data)] }

export const listActions = (sessionId) => request.get('/assistant/actions', { params: { sessionId } })
export const getAction = (id) => request.get(`/assistant/actions/${id}`)
export const editAction = (id, body) => request.patch(`/assistant/actions/${id}`, body, rawJson)
export const confirmAction = (id, body) => request.post(`/assistant/actions/${id}/confirm`, body, rawJson)
export const cancelAction = (id, body) => request.post(`/assistant/actions/${id}/cancel`, body, rawJson)
