<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useAchievementsStore } from '@/stores/achievements'
import { IS_DEMO_PREVIEW } from '@/preview/mode'
import AchievementDialog from './AchievementDialog.vue'
import { notificationKey, notificationMedal } from '@/utils/achievementNotifications'

const auth = useAuthStore()
const ui = useUIStore()
const achievements = useAchievementsStore()
const displayed = ref(null)
const displayedNotification = ref(null)
const busy = ref(false)
const dismissed = new Set()
let timer
let alive = true
const available = computed(() => !ui.showDetail && !ui.showWriteModal && !ui.showSummarySheet)
async function check() {
  if (IS_DEMO_PREVIEW || achievements.designMode || busy.value || !available.value || document.hidden || displayed.value
      || document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]')) return
  busy.value = true
  try {
    await achievements.poll()
    const next = achievements.pending.find(item => !dismissed.has(notificationKey(item)))
    const medal = notificationMedal(next, achievements.catalog)
    if (alive && available.value && medal && !document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]')) {
      displayedNotification.value = next
      displayed.value = medal
    }
  } catch { /* Pending awards remain on the server until acknowledged. */ }
  finally { busy.value = false }
}
function close() {
  const notification = displayedNotification.value
  displayed.value = null
  displayedNotification.value = null
  if (!notification) return
  dismissed.add(notificationKey(notification))
  achievements.acknowledge(notification).catch(() => {})
}
watch(() => auth.user?.id, () => { displayed.value = null; displayedNotification.value = null; dismissed.clear() })
onMounted(() => {
  if (IS_DEMO_PREVIEW) return
  timer = setInterval(check, 10000)
  document.addEventListener('visibilitychange', check)
})
onBeforeUnmount(() => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', check) })
</script>

<template><AchievementDialog :medal="displayed" reveal :preview-mode="false" @close="close" /></template>
