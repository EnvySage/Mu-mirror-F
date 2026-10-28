import { watch, onBeforeUnmount } from 'vue'
import { useActionsStore } from '@/stores/actions'
import { useAuthStore } from '@/stores/auth'
import { useRecordsStore } from '@/stores/records'
import { useStatsStore } from '@/stores/stats'
import { useGrowthStore } from '@/stores/growth'
import { useToastStore } from '@/stores/toast'
import { useUIStore } from '@/stores/ui'
import { useTodoStore } from '@/stores/todo'
import { recordWorkflowState, recordIdOf } from '@/utils/recordWorkflow'

export function useRecordWorkflows() {
  const actions = useActionsStore(), auth = useAuthStore(), records = useRecordsStore()
  const toast = useToastStore(), stats = useStatsStore(), growth = useGrowthStore()
  const ui = useUIStore()
  let timer, alive = true, generation = 0, fetching = false
  const announced = new Map()
  async function refresh() {
    if (!alive || !auth.user?.id || fetching || document.hidden) return
    fetching = true
    const owner = auth.user.id, epoch = generation
    try {
      const isCurrent = () => alive && owner === auth.user?.id && epoch === generation
      const list = await actions.loadRecordWorkflows({ isCurrent })
      if (!isCurrent()) return
      for (const card of list) {
        const previous = announced.get(card.id)
        announced.set(card.id, card.state)
        if (card.state === 'SUCCEEDED') {
          const id = recordIdOf(card)
          if (id != null && previous && previous !== 'SUCCEEDED') await records.fetchRecord(id, { isCurrent })
          if (previous && previous !== 'SUCCEEDED') {
            toast.success('记录已保存，后台整理完成')
            useTodoStore().refreshAfterAction().catch(() => {})
            stats.fetchStats(30, true).catch(() => {})
            growth.refresh().catch(() => {})
          }
        }
      }
    } catch { /* Keep the existing cards and retry; network errors never erase drafts. */ }
    finally { fetching = false }
  }
  function schedule() {
    clearTimeout(timer)
    if (!alive || !auth.user?.id) return
    const active = actions.recordWorkflows.some(card => recordWorkflowState(card).moving)
    timer = setTimeout(async () => { await refresh(); schedule() }, active ? 1500 : 15000)
  }
  watch(() => auth.user?.id, () => {
    generation++; actions.clear(); announced.clear()
    ui.selectedRecordActionId = null
    refresh().finally(schedule)
  }, { immediate: true })
  watch(() => actions.recordWorkflows.map(card => `${card.id}:${card.state}:${card.preparation_status}`).join('|'), schedule)
  const resume = () => { if (!document.hidden) refresh().finally(schedule) }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('focus', resume)
  onBeforeUnmount(() => { alive = false; clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume) })
}
