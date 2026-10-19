import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  addGrowthContribution as apiAddGrowthContribution,
  getGrowth as apiGetGrowth,
  getGrowthAxes as apiGetGrowthAxes,
  getGrowthEntries as apiGetGrowthEntries,
  updateGrowthAxes as apiUpdateGrowthAxes,
} from '@/api/growth'

export const useGrowthStore = defineStore('growth', () => {
  const overview = ref(null)
  const axesDefinition = ref(null)
  const entries = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const axes = computed(() => overview.value?.axes || axesDefinition.value?.axes || [])
  const totalPoints = computed(() => Number(overview.value?.total_points ?? overview.value?.totalPoints ?? 0))
  const stage = computed(() => overview.value?.stage || null)
  const config = computed(() => axesDefinition.value?.config || axesDefinition.value?.growth_config || overview.value?.config || overview.value?.growth_config || null)

  async function fetchOverview() {
    const response = await apiGetGrowth()
    overview.value = response.data || null
    return overview.value
  }

  async function fetchAxes(force = false) {
    if (!force && axesDefinition.value) return axesDefinition.value
    const response = await apiGetGrowthAxes()
    axesDefinition.value = response.data || null
    return axesDefinition.value
  }

  async function fetchEntries() {
    const response = await apiGetGrowthEntries()
    entries.value = Array.isArray(response.data) ? response.data : (response.data?.items || [])
    return entries.value
  }

  async function refresh() {
    loading.value = true
    error.value = ''
    const results = await Promise.allSettled([fetchOverview(), fetchAxes(true), fetchEntries()])
    const failure = results.find(result => result.status === 'rejected')
    if (failure) error.value = failure.reason?.message || '成长数据暂时无法加载。'
    loading.value = false
    return results.every(result => result.status === 'fulfilled')
  }

  async function saveAxes(nextAxes) {
    const version = Number(axesDefinition.value?.version ?? overview.value?.axes_version ?? 0)
    saving.value = true
    error.value = ''
    try {
      const response = await apiUpdateGrowthAxes({ version, axes: nextAxes })
      axesDefinition.value = response.data || { version: version + 1, axes: nextAxes }
      await fetchOverview()
      return true
    } catch (err) {
      // A version conflict or lost response is resolved from server state before the user retries.
      await Promise.allSettled([fetchAxes(true), fetchOverview()])
      error.value = err.message || '五维定义没有保存，请核对最新定义后重试。'
      return false
    } finally {
      saving.value = false
    }
  }

  async function addContribution({ dimensionId, points, reason, requestId }) {
    saving.value = true
    error.value = ''
    try {
      const response = await apiAddGrowthContribution({ dimensionId, points, reason, requestId })
      if (response.data?.axes) overview.value = response.data
      await Promise.allSettled([fetchOverview(), fetchEntries()])
      return true
    } catch (err) {
      // Do not retry a contribution automatically; refresh first because the server may have committed it.
      await Promise.allSettled([fetchOverview(), fetchEntries()])
      error.value = err.message || '提交结果暂时无法确认；已刷新账本，请先检查最近记录。'
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    overview, axesDefinition, entries, axes, totalPoints, stage, config,
    loading, saving, error, refresh, fetchOverview, fetchAxes, fetchEntries,
    saveAxes, addContribution,
  }
})
