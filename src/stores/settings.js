import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref({
    apiUrl: 'https://api.openai.com',
    apiKey: 'sk-****...****',
    model: 'gpt-4o',
    dbUrl: 'postgresql://localhost:5432/mirror',
    reviewMode: 'semi_auto',
  })

  const autoReview = ref(false)

  function toggleAutoReview() {
    autoReview.value = !autoReview.value
  }

  return {
    settings,
    autoReview,
    toggleAutoReview,
  }
})
