import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRecordsStore } from '@/stores/records'
import { listActions, listRecordWorkflows, getAction, editAction, confirmAction, cancelAction, prepareAction as apiPrepareAction } from '@/api/actions'

const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'STALE'])
const camelize = value => Array.isArray(value) ? value.map(camelize) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), camelize(child)]))
  : value

export const useActionsStore = defineStore('assistantActions', () => {
  const byId = ref({})
  const sessionIds = ref({})
  const busy = ref({})
  const recordErrors = ref({})
  const submittingRecords = ref({})
  const recordWorkflows = computed(() => Object.values(byId.value)
    .filter(card => ['record.create', 'record.organize'].includes(card.kind) && card.state !== 'CANCELLED')
    .sort((a, b) => String(b.created_at || b.createdAt || '').localeCompare(String(a.created_at || a.createdAt || ''))))

  async function loadRecordWorkflows({ isCurrent = () => true } = {}) {
    const response = await listRecordWorkflows()
    if (isCurrent()) (response.data || []).forEach(upsert)
    return response.data || []
  }
  function clear() { byId.value = {}; sessionIds.value = {}; busy.value = {}; recordErrors.value = {}; submittingRecords.value = {} }
  async function submitRecord(id) {
    if (submittingRecords.value[id]) return
    submittingRecords.value[id] = true
    delete recordErrors.value[id]
    try { return await confirm(id) }
    catch (error) {
      if (!['SUCCEEDED', 'EXECUTING'].includes(byId.value[id]?.state)) recordErrors.value[id] = error.message || '保存结果暂时无法确认，请打开记录查看。'
    }
    finally {
      const card = byId.value[id]
      const recordId = card?.result?.recordId ?? card?.result?.record_id
      if (recordId != null) await useRecordsStore().fetchRecord(recordId)
      delete submittingRecords.value[id]
    }
  }

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

  return { byId, busy, recordErrors, submittingRecords, recordWorkflows, loadRecordWorkflows, clear, submitRecord, upsert, prepare, loadForSession, inSession, edit, confirm, cancel, refresh, canEdit, canConfirm, canCancel, terminal }
})
