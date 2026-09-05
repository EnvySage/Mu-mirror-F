import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useUIStore = defineStore('ui', () => {
  /** @type {import('vue').Ref<'records' | 'calendar' | 'mirror' | 'settings'>} */
  const currentPage = ref('records')

  const isMobile = ref(window.innerWidth < 900)

  const showWriteModal = ref(false)

  /** 每日总结 sheet（数据源 GET /api/summaries） */
  const showSummarySheet = ref(false)

  /** 侧边栏日历选中的日期（桌面端用） @type {import('vue').Ref<Date | null>} */
  const sidebarSelectedDate = ref(null)

  /** @type {import('vue').Ref<string | null>} */
  const selectedRecordId = ref(null)

  /** @type {import('vue').Ref<'view' | 'review' | 'processing' | 'failed'>} */
  const detailMode = ref('view')

  const showDetail = ref(false)

  /** 请求对话页打开历史会话抽屉（MobileHeader → ChatView 的跨层通知，ChatView 消费后复位） */
  const chatSessionsRequested = ref(false)

  /** MobileHeader 历史按钮：置位请求标志（MainLayout 中转 emit，也供直接调用） */
  function requestChatSessions() {
    chatSessionsRequested.value = true
  }

  /** ChatView 消费后复位 */
  function consumeChatSessionsRequest() {
    chatSessionsRequested.value = false
  }

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

  function openSummarySheet() {
    showSummarySheet.value = true
  }

  function closeSummarySheet() {
    showSummarySheet.value = false
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
    showSummarySheet,
    sidebarSelectedDate,
    selectedRecordId,
    detailMode,
    showDetail,
    chatSessionsRequested,
    switchPage,
    openWriteModal,
    closeWriteModal,
    openSummarySheet,
    closeSummarySheet,
    requestChatSessions,
    consumeChatSessionsRequest,
  }
})
