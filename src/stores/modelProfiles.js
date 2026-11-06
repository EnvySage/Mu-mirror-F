import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/modelProfiles'
import { useAuthStore } from '@/stores/auth'

export const useModelProfilesStore = defineStore('modelProfiles', () => {
  const profiles = ref([])
  const loading = ref(false)
  const error = ref('')
  const activeProfile = computed(() => profiles.value.find(profile => profile.active))
  const auth = useAuthStore()
  let accountEpoch = 0
  let fetchGeneration = 0
  watch(() => auth.user?.id, () => {
    accountEpoch += 1
    profiles.value = []
    error.value = ''
    loading.value = false
  }, { flush: 'sync' })

  async function fetchProfiles() {
    const epoch = accountEpoch
    const generation = ++fetchGeneration
    const isCurrent = () => epoch === accountEpoch && generation === fetchGeneration
    loading.value = true
    error.value = ''
    try {
      const response = await api.getModelProfiles()
      if (isCurrent()) profiles.value = response.data || []
    }
    catch (err) { if (isCurrent()) error.value = err.message || '模型配置加载失败' }
    finally { if (isCurrent()) loading.value = false }
  }
  async function saveProfile(id, data) {
    const saved = (await (id ? api.updateModelProfile(id, data) : api.createModelProfile(data))).data
    await fetchProfiles()
    return saved
  }
  async function activate(id) {
    await api.activateModelProfile(id)
    await fetchProfiles()
  }
  async function remove(id) {
    await api.deleteModelProfile(id)
    profiles.value = profiles.value.filter(profile => profile.id !== id)
  }
  return { profiles, loading, error, activeProfile, fetchProfiles, saveProfile, activate, remove }
})
