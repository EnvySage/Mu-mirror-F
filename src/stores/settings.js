import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getSettings as apiGetSettings,
  updateSettings as apiUpdateSettings,
  testAiConnection as apiTestAiConnection,
  testDbConnection as apiTestDbConnection,
} from '@/api/settings'

/**
 * @typedef {Object} Settings
 * @property {string} [id]
 * @property {string} [user_id]
 * @property {string} ai_provider - AI 提供商
 * @property {string} ai_api_key - API Key（脱敏）
 * @property {string} [ai_base_url] - API 地址
 * @property {string} ai_model - 模型名称
 * @property {string} embedding_source - Embedding 来源
 * @property {string} [embedding_api_key] - Embedding API Key（脱敏）
 * @property {string} embedding_model - Embedding 模型名
 * @property {string} review_mode - 审核模式
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

export const useSettingsStore = defineStore('settings', () => {
  /** @type {import('vue').Ref<Settings>} */
  const settings = ref({
    ai_provider: 'openai',
    ai_api_key: '',
    ai_base_url: '',
    ai_model: '',
    embedding_source: 'local',
    embedding_api_key: '',
    embedding_model: 'BAAI/bge-m3',
    review_mode: 'manual',
  })

  const loading = ref(false)
  const error = ref(null)
  const testLoading = ref(false)

  /**
   * 从后端获取配置
   */
  async function fetchSettings() {
    loading.value = true
    error.value = null
    try {
      const res = await apiGetSettings()
      if (res.data) {
        settings.value = res.data
      }
    } catch (err) {
      error.value = err.message || '获取配置失败'
      console.error('Failed to fetch settings:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新配置（部分更新）
   * @param {Object} data - 要更新的字段（snake_case）
   */
  async function updateSettings(data) {
    loading.value = true
    error.value = null
    try {
      // 将 snake_case 转换为 camelCase（后端接收 camelCase）
      const camelData = {}
      for (const [key, value] of Object.entries(data)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        camelData[camelKey] = value
      }
      const res = await apiUpdateSettings(camelData)
      if (res.data) {
        settings.value = res.data
      }
      return true
    } catch (err) {
      error.value = err.message || '更新配置失败'
      console.error('Failed to update settings:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 测试 AI 连接
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async function testAiConnection() {
    testLoading.value = true
    try {
      await apiTestAiConnection()
      return { success: true, message: 'AI 连接测试成功' }
    } catch (err) {
      return { success: false, message: err.message || 'AI 连接测试失败' }
    } finally {
      testLoading.value = false
    }
  }

  /**
   * 测试数据库连接
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async function testDbConnection() {
    testLoading.value = true
    try {
      await apiTestDbConnection()
      return { success: true, message: '数据库连接测试成功' }
    } catch (err) {
      return { success: false, message: err.message || '数据库连接测试失败' }
    } finally {
      testLoading.value = false
    }
  }

  return {
    settings,
    loading,
    error,
    testLoading,
    fetchSettings,
    updateSettings,
    testAiConnection,
    testDbConnection,
  }
})
