import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useUIStore = defineStore('ui', () => {
  const navigationGuards = new Map()
  let approvedNavigationPath = null
  function registerNavigationGuard(key, guard) {
    navigationGuards.set(key, guard)
    return () => { if (navigationGuards.get(key) === guard) navigationGuards.delete(key) }
  }
  function confirmNavigationDrafts() {
    for (const guard of navigationGuards.values()) if (guard() === false) return false
    return true
  }
  function approveNavigation(path) { approvedNavigationPath = path }
  function consumeNavigationApproval(path) {
    const approved = approvedNavigationPath === path
    approvedNavigationPath = null
    return approved
  }
  /** @type {import('vue').Ref<'records' | 'calendar' | 'mirror' | 'settings'>} */
  const currentPage = ref('records')

  const isMobile = ref(window.innerWidth < 900)

  const showWriteModal = ref(false)
  const correctionOfRecordId = ref(null)

  /** 每日总结 sheet（数据源 GET /api/summaries） */
  const showSummarySheet = ref(false)

  /** 侧边栏日历选中的日期（桌面端用） @type {import('vue').Ref<Date | null>} */
  const sidebarSelectedDate = ref(null)

  /** @type {import('vue').Ref<string | null>} */
  const selectedRecordId = ref(null)

  /** @type {import('vue').Ref<'view' | 'review' | 'processing' | 'failed'>} */
  const detailMode = ref('view')

  const showDetail = ref(false)
  /** 当前详情的视觉来源，仅保存可恢复来源所需的几何信息。 */
  const detailOrigin = ref(null)
  const highlightRecordId = ref(null)
  const detailDraftDirty = ref(false)

  function captureDetailOrigin(element, recordId) {
    const rect = element?.getBoundingClientRect?.()
    detailOrigin.value = rect && rect.width && rect.height
      ? { type: 'record', id: String(recordId), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
      : null
  }

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

  function switchPage(page, alreadyGuarded = false) {
    if (!alreadyGuarded && !confirmNavigationDrafts()) return false
    currentPage.value = page
    showDetail.value = false
    selectedRecordId.value = null
    detailOrigin.value = null
    return true
  }

  function openWriteModal(sourceRecordId = null) {
    correctionOfRecordId.value = sourceRecordId
    showWriteModal.value = true
  }

  function closeWriteModal() {
    showWriteModal.value = false
    correctionOfRecordId.value = null
  }

  function openSummarySheet() {
    showSummarySheet.value = true
  }

  function closeSummarySheet() {
    showSummarySheet.value = false
  }

  return {
    currentPage,
    registerNavigationGuard,
    confirmNavigationDrafts,
    approveNavigation,
    consumeNavigationApproval,
    isMobile,
    showWriteModal,
    correctionOfRecordId,
    showSummarySheet,
    sidebarSelectedDate,
    selectedRecordId,
    detailMode,
    showDetail,
    detailOrigin,
    highlightRecordId,
    detailDraftDirty,
    captureDetailOrigin,
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
