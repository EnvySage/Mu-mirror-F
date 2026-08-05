import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useUIStore = defineStore('ui', () => {
  /** @type {import('vue').Ref<'records' | 'calendar' | 'mirror' | 'settings'>} */
  const currentPage = ref('records')

  const isMobile = ref(window.innerWidth < 900)

  const showWriteModal = ref(false)

  /** @type {import('vue').Ref<string | null>} */
  const selectedRecordId = ref(null)

  /** @type {import('vue').Ref<'view' | 'review' | 'processing' | 'failed'>} */
  const detailMode = ref('view')

  const showDetail = ref(false)

  function switchPage(page) {
    currentPage.value = page
    showDetail.value = false
    selectedRecordId.value = null
  }

  function openWriteModal() {
    showWriteModal.value = true
  }

  function closeWriteModal() {
    showWriteModal.value = false
  }

  function updateMobile() {
    isMobile.value = window.innerWidth < 900
  }

  // Listen for resize
  window.addEventListener('resize', updateMobile)

  return {
    currentPage,
    isMobile,
    showWriteModal,
    selectedRecordId,
    detailMode,
    showDetail,
    switchPage,
    openWriteModal,
    closeWriteModal,
  }
})
