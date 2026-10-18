import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listActions, getAction, editAction, confirmAction, cancelAction, prepareAction as apiPrepareAction } from '@/api/actions'

const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'STALE'])
const camelize = value => Array.isArray(value) ? value.map(camelize) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), camelize(child)]))
  : value

export const useActionsStore = defineStore('assistantActions', () => {
  const byId = ref({})
  const sessionIds = ref({})
  const busy = ref({})

  function upsert(proposal) {
    if (!proposal?.id) return false
    proposal = { ...proposal, payload: camelize(proposal.payload), preview: camelize(proposal.preview), result: camelize(proposal.result), targetVersions: camelize(proposal.target_versions || proposal.targetVersions) }
    const current = byId.value[proposal.id]
    const incomingVersion = Number(proposal.version ?? 0)
    if (current && incomingVersion < Number(current.version ?? 0)) return false
    byId.value[proposal.id] = { ...current, ...proposal }
    const sessionId = proposal.source_session_id || proposal.sourceSessionId
    if (sessionId) {
      sessionIds.value[proposal.id] = sessionId
      const key = `session:${sessionId}`
      const ids = sessionIds.value[key] || []
      if (!ids.includes(proposal.id)) sessionIds.value = { ...sessionIds.value, [key]: [...ids, proposal.id] }
    }
    return true
  }

  async function loadForSession(sessionId) {
    if (!sessionId) return []
    const response = await listActions(sessionId)
    const list = Array.isArray(response.data) ? response.data : []
    const found = new Set()
    list.forEach(item => { upsert(item); found.add(item.id) })
    sessionIds.value = { ...sessionIds.value, [`session:${sessionId}`]: [...found] }
    return list
  }

  async function prepare(kind, payload, prepareKey) {
    const response = await apiPrepareAction(kind, payload, prepareKey)
    upsert(response.data)
    return byId.value[response.data?.id] || response.data
  }

  function inSession(sessionId) {
    const ids = sessionIds.value[`session:${sessionId}`] || []
    return ids.map(id => byId.value[id]).filter(Boolean)
  }

  async function refresh(id) {
    const response = await getAction(id)
    upsert(response.data)
    return byId.value[id]
  }

  async function run(id, operation) {
    if (busy.value[id]) return byId.value[id]
    busy.value = { ...busy.value, [id]: true }
    try {
      const response = await operation(byId.value[id])
      upsert(response.data)
      return byId.value[id]
    } catch (error) {
      // Network failure or a stale-version conflict has an unknown outcome; server state wins.
      try { await refresh(id) } catch { /* keep last known state and expose the original error */ }
      throw error
    } finally {
      const next = { ...busy.value }
      delete next[id]
      busy.value = next
    }
  }

  function edit(id, payload) {
    return run(id, card => editAction(id, { expectedVersion: card.version, payload }))
  }
  function confirm(id) {
    return run(id, card => confirmAction(id, {
      expectedVersion: card.version,
      requestId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    }))
  }
  function cancel(id) {
    return run(id, card => cancelAction(id, { expectedVersion: card.version }))
  }

  function canEdit(card) {
    const preparationStatus = String(card?.preparation_status || card?.preparationStatus || card?.payload?.recordDraft?.preparationStatus || 'READY').toUpperCase()
    return card?.state === 'PENDING' && preparationStatus === 'READY'
  }
  function canConfirm(card) { return canEdit(card) }
  function canCancel(card) { return card?.state === 'PENDING' }

  return { byId, busy, upsert, prepare, loadForSession, inSession, edit, confirm, cancel, refresh, canEdit, canConfirm, canCancel, terminal }
})
