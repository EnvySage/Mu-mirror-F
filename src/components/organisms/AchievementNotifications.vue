<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useAchievementsStore } from '@/stores/achievements'
import { IS_DEMO_PREVIEW } from '@/preview/mode'
import AchievementDialog from './AchievementDialog.vue'
import AchievementBatchDialog from './AchievementBatchDialog.vue'
import { notificationBatch } from '@/utils/achievementNotifications'

const auth = useAuthStore()
const ui = useUIStore()
const achievements = useAchievementsStore()
const displayed = ref([])
const busy = ref(false)
const dismissed = new Set()
let timer
let alive = true
const available = computed(() => !ui.showDetail && !ui.showWriteModal && !ui.showSummarySheet)
async function check() {
  if (IS_DEMO_PREVIEW || achievements.designMode || busy.value || !available.value || document.hidden || displayed.value.length
      || document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]')) return
  busy.value = true
  try {
    await achievements.poll()
    const batch = notificationBatch(achievements.pending, achievements.catalog, dismissed)
    if (alive && available.value && !document.hidden && batch.length && !document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]')) {
      displayed.value = batch
    }
  } catch { /* Pending awards remain on the server until acknowledged. */ }
  finally { busy.value = false }
}
function close() {
  const batch = displayed.value
  displayed.value = []
  if (!batch.length) return
  batch.forEach(item => dismissed.add(item.key))
  achievements.acknowledgeBatch(batch.map(item => item.notification)).catch(() => {})
}
watch(() => auth.user?.id, () => { displayed.value = []; dismissed.clear() }, { flush: 'sync' })
onMounted(() => {
  if (IS_DEMO_PREVIEW) return
  timer = setInterval(check, 10000)
  document.addEventListener('visibilitychange', check)
})
onBeforeUnmount(() => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', check) })
</script>

<template>
  <AchievementDialog :medal="displayed.length === 1 ? displayed[0].medal : null" reveal :preview-mode="false" @close="close" />
  <AchievementBatchDialog :awards="displayed.length > 1 ? displayed : []" @close="close" />
</template>
