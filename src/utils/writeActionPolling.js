export function createActionStatusPoller({
  refresh,
  onUpdate,
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = timer => clearTimeout(timer),
  intervalMs = 1500,
  retryIntervalMs = 5000,
}) {
  let timer = null
  let generation = 0
  let active = false
  let actionId = null

  function stop() {
    active = false
    generation += 1
    if (timer != null) cancel(timer)
    timer = null
  }

  function start(id, state) {
    stop()
    if (!id || !['PENDING', 'EXECUTING'].includes(String(state || '').toUpperCase())) return
    actionId = id
    active = true
    const run = ++generation

    const tick = async () => {
      timer = null
      if (!active || run !== generation) return
      try {
        const card = await refresh(actionId)
        if (!active || run !== generation) return
        await onUpdate(card)
        if (!active || run !== generation) return
        if (['PENDING', 'EXECUTING'].includes(String(card?.state || '').toUpperCase())) {
          timer = schedule(tick, intervalMs)
        } else {
          stop()
        }
      } catch {
        if (active && run === generation) timer = schedule(tick, retryIntervalMs)
      }
    }

    timer = schedule(tick, intervalMs)
  }

  return { start, stop }
}

export async function completeCreatedRecordAction(card, { fetchRecords, records, emit }) {
  if (card?.state !== 'SUCCEEDED') return false
  await fetchRecords()
  const id = card.result?.recordId ?? card.result?.record_id ?? card.result?.id
  const saved = id == null ? records[0] : records.find(record => String(record.id) === String(id))
  emit('saved', saved || (id == null ? undefined : { id }))
  emit('close')
  return true
}
