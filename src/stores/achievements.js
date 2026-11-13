import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { achievementApi } from '@/api/achievements'
import { achievements as previewCatalog } from '@/constants/achievements'
import { IS_DEMO_PREVIEW } from '@/preview/mode'
import { achievementDesignCatalog } from '@/preview/achievementSets'
import { notificationKey } from '@/utils/achievementNotifications'

export const useAchievementsStore = defineStore('achievements', () => {
  const auth = useAuthStore()
  const accountCatalog = ref(IS_DEMO_PREVIEW ? previewCatalog : [])
  const designMode = ref(IS_DEMO_PREVIEW)
  const artByCode = new Map(achievementDesignCatalog.map(item => [item.code, item]))
  const catalog = computed(() => designMode.value ? achievementDesignCatalog : accountCatalog.value.map(item => {
    const art = artByCode.get(item.code)
    return art && !item.image && (!item.hidden || item.earned)
      ? { ...item, atlas: art.atlas, atlasIndex: art.atlasIndex } : item
  }))
  const loading = ref(false)
  const error = ref('')
  const pending = ref([])
  let epoch = 0
  let activeRequest = null
  const groups = computed(() => [...new Map(catalog.value.map(medal => [medal.group.id, medal.group])).values()])
  watch(() => auth.user?.id, () => {
    epoch++
    activeRequest = null
    accountCatalog.value = IS_DEMO_PREVIEW ? previewCatalog : []
    pending.value = []
    loading.value = false
    error.value = ''
  }, { flush: 'sync' })

  function load() {
    if (IS_DEMO_PREVIEW || !auth.user?.id) return Promise.resolve()
    if (activeRequest) return activeRequest
    const token = epoch
    loading.value = true
    error.value = ''
    const task = achievementApi.collection().then(result => {
      if (token === epoch) accountCatalog.value = result.items
    }).catch(cause => {
      if (token === epoch) error.value = cause.message || '成就暂时无法读取'
    }).finally(() => {
      if (token === epoch) { loading.value = false; activeRequest = null }
    })
    activeRequest = task
    return task
  }
  async function poll() {
    if (IS_DEMO_PREVIEW || !auth.user?.id || document.hidden) return
    const token = epoch
    const result = await achievementApi.pending()
    if (token !== epoch) return
    if (result.length) await load()
    if (token === epoch) pending.value = result
  }
  async function acknowledgeBatch(notifications) {
    const batch = [...new Map(notifications.map(item => {
      const notification = { code: item.code, kind: item.kind || 'earned' }
      return [notificationKey(notification), notification]
    })).values()]
    if (!batch.length) return
    const token = epoch
    await achievementApi.acknowledgeNotifications(batch)
    const acknowledged = new Set(batch.map(notificationKey))
    if (token === epoch) pending.value = pending.value.filter(item => !acknowledged.has(notificationKey(item)))
  }
  return { catalog, groups, loading, error, pending, designMode, load, poll, acknowledgeBatch }
})
