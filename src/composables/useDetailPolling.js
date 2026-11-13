import { onBeforeUnmount } from 'vue'
import { shouldPollRecord } from '@/utils/recordIndexing'

export function useDetailPolling({ ui, recordsStore, todoStore, actionsStore, toast, record, preparedRecordAction, onRecordActionUpdated, getGeneration }) {
let pollTimer = null
let todoOverlayTimer = null
let recordActionPollTimer = null
let embeddingPollInFlight = false

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function stopTodoOverlayPolling() {
  if (todoOverlayTimer) clearTimeout(todoOverlayTimer)
  todoOverlayTimer = null
}

function stopRecordActionPolling() {
  if (recordActionPollTimer) clearTimeout(recordActionPollTimer)
  recordActionPollTimer = null
}

function pollRecordAction(actionId, generation = getGeneration()) {
  stopRecordActionPolling()
  const tick = async () => {
    if (generation !== getGeneration() || String(ui.selectedRecordId) === '') return
    try {
      const latest = await actionsStore.refresh(actionId)
      if (generation !== getGeneration() || preparedRecordAction.value?.id !== actionId) return
      preparedRecordAction.value = latest
      const stillPreparing = String(latest?.preparationStatus || latest?.preparation_status
        || latest?.payload?.recordDraft?.preparationStatus || '').toUpperCase() === 'RUNNING'
      if (latest?.state === 'SUCCEEDED') {
        await onRecordActionUpdated(latest)
      } else if (latest?.state === 'EXECUTING' || (latest?.state === 'PENDING' && stillPreparing)) {
        recordActionPollTimer = setTimeout(tick, 1800)
      } else {
        stopRecordActionPolling()
      }
    } catch {
      if (generation === getGeneration() && preparedRecordAction.value?.id === actionId) {
        recordActionPollTimer = setTimeout(tick, 5000)
      }
    }
  }
  recordActionPollTimer = setTimeout(tick, 1500)
}

function startTodoOverlayPolling(recordId) {
  stopTodoOverlayPolling()
  const tick = async () => {
    if (String(ui.selectedRecordId) !== String(recordId)) return
    if (document.visibilityState === 'visible') await todoStore.fetchRegistry(true)
    if (String(ui.selectedRecordId) === String(recordId)) todoOverlayTimer = setTimeout(tick, 15000)
  }
  todoOverlayTimer = setTimeout(tick, 15000)
}

function startPolling(recordId) {
  stopPolling()
  stopTodoOverlayPolling()
  const tick = async () => {
    if (ui.selectedRecordId !== recordId) return
    const generation = getGeneration()
    const r = await recordsStore.fetchRecord(recordId, { isCurrent: () => generation === getGeneration() && String(ui.selectedRecordId) === String(recordId) })
    if (generation !== getGeneration() || String(ui.selectedRecordId) !== String(recordId)) return
    if (!r) return
    if (r.status === 'processing') {
      pollTimer = setTimeout(tick, 2500)
    } else if (r.status === 'reviewing') {
      toast.success('AI 拆分完成，请审核')
    } else if (r.status === 'done') {
      toast.success('AI 整理完成')
    }
  }
  pollTimer = setTimeout(tick, 2500)
}

function startEmbeddingPolling(recordId) {
  if (pollTimer || embeddingPollInFlight) return
  stopPolling()
  const tick = async () => {
    pollTimer = null
    if (String(ui.selectedRecordId) !== String(recordId)) return
    const generation = getGeneration()
    embeddingPollInFlight = true
    const r = await recordsStore.fetchRecord(recordId, {
      isCurrent: () => generation === getGeneration() && String(ui.selectedRecordId) === String(recordId),
    })
    embeddingPollInFlight = false
    if (generation !== getGeneration() || String(ui.selectedRecordId) !== String(recordId)) {
      const current = record.value
      if (!pollTimer && shouldPollRecord(current)) {
        startEmbeddingPolling(current.id)
      }
      return
    }
    if (!r) return
    const pending = shouldPollRecord(r)
    if (pending) {
      if (!pollTimer) pollTimer = setTimeout(tick, 1800)
    } else stopPolling()
  }
  pollTimer = setTimeout(tick, 900)
}

onBeforeUnmount(stopPolling)
onBeforeUnmount(stopTodoOverlayPolling)
onBeforeUnmount(stopRecordActionPolling)
return { stopPolling, stopTodoOverlayPolling, stopRecordActionPolling, pollRecordAction, startTodoOverlayPolling, startPolling, startEmbeddingPolling, hasPolling: () => !!pollTimer, isEmbeddingPolling: () => embeddingPollInFlight }
}
