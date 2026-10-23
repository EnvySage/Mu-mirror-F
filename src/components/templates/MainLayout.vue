<script setup>
import { computed, ref, shallowRef, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useRecordsStore } from '@/stores/records'
import { useSettingsStore } from '@/stores/settings'
import { useGlossaryStore } from '@/stores/glossary'
import { useStatsStore } from '@/stores/stats'
import { useTodoPolling } from '@/composables/useTodoPolling'
import { IS_DEMO_PREVIEW } from '@/preview/mode'
import AppSidebar from '@/components/organisms/AppSidebar.vue'
import BottomNav from '@/components/organisms/BottomNav.vue'
import PersonaBackdrop from '@/components/atoms/PersonaBackdrop.vue'
import MobileHeader from '@/components/organisms/MobileHeader.vue'
import WriteModal from '@/components/organisms/WriteModal.vue'
import SummarySheet from '@/components/organisms/SummarySheet.vue'
import DetailPanel from '@/components/organisms/DetailPanel.vue'
import ToastContainer from '@/components/organisms/ToastContainer.vue'
import { useRouteMotion } from '@/motion/useRouteMotion'
import { cancelMirrorShatter } from '@/composables/useMirrorShatter'
import { usePresentationMode } from '@/composables/usePresentationMode'
import PresentationLayout from '@/components/templates/PresentationLayout.vue'
import DesktopLayout from '@/components/templates/DesktopLayout.vue'
import MobileLayout from '@/components/templates/MobileLayout.vue'
import { resolvePresentationPage } from '@/router/presentationPages'

const router = useRouter()
const route = useRoute()
const ui = useUIStore()
const auth = useAuthStore()
const recordsStore = useRecordsStore()
const settingsStore = useSettingsStore()
const glossary = useGlossaryStore()
const statsStore = useStatsStore()
const presentation = usePresentationMode()
const pageComponent = shallowRef(null)
const renderedPage = ref(route.name)
const renderedDate = ref(route.params.date)
let pageGeneration = 0
// Resolve async views before passing them to Transition. An unresolved async
// placeholder has no stable parent for an interrupted out-in DOM handoff.
watch([() => route.name, () => presentation.mode.value], async ([name, mode]) => {
  const generation = ++pageGeneration
  const candidate = resolvePresentationPage(mode, name)
  const resolved = candidate?.__asyncLoader ? await candidate.__asyncLoader() : candidate
  if (generation !== pageGeneration) return
  renderedPage.value = name
  renderedDate.value = route.params.date
  pageComponent.value = resolved
}, { immediate: true })
watch(() => route.params.date, date => { if (renderedPage.value === 'records') renderedDate.value = date })
onBeforeUnmount(() => { pageGeneration += 1 })
const routeWipe = ref(null)
const routeMotion = useRouteMotion(routeWipe)

const removeDraftGuard = router.beforeEach((to, from) => {
  if (to.fullPath !== from.fullPath && !ui.consumeNavigationApproval(to.fullPath) && !ui.confirmNavigationDrafts()) return false
  return true
})

onBeforeUnmount(removeDraftGuard)

/**
 * 待办建议轮询（15s，全局）
 * 建议/待办登记在确认入库后才落库，时机不可观测，不用猜时机。
 * 条数变化说明后端有新增，顺带强制刷 stats —— 侧栏待办列表读 stats.todo.open_items，
 * 而 stats 有 30s 缓存，不强制就会停在旧数据上。
 */
useTodoPolling({
  onChange: () => statsStore.fetchStats(30, true),
})

/** 移动端 header 标题（对话页等也走这里） */
const mobileTitle = computed(() => {
  const names = { records: '记录', calendar: '日历', chat: '对话', vault: '我的资产', mirror: '镜子', settings: '设置' }
  return names[route.name] || ''
})

onMounted(() => {
  settingsStore.fetchSettings()
  // 有记录数据才拉取（各 view 也会自行拉取，这里做导航条计数兜底）
  if (recordsStore.records.length === 0) recordsStore.fetchRecords()
  // 词典三组：设置图标角标数据源（AppSidebar / MobileHeader 共用，失败静默不打断导航）
  glossary.fetch()
})

/**
 * 路由变化统一收起记录详情。
 *
 * DetailPanel 是 fixed 全屏层（z-index 30），盖在 RouterView 之上。侧栏/底栏点导航走
 * ui.switchPage 已会复位，但浏览器前进后退、页内 router.push 等路径没经过它——那些情况下
 * 详情层会继续压在新页面上。这里兜底：只要路由变了就收。
 */
watch(() => route.name, () => {
  cancelMirrorShatter()
  if (ui.showDetail) {
    ui.showDetail = false
    ui.selectedRecordId = null
  }
})

</script>

<template>
  <div class="app" :class="`presentation-mode-${presentation.mode.value}`">
    <div class="app-water" aria-hidden="true" />
    <PersonaBackdrop />
    <DesktopLayout><AppSidebar /></DesktopLayout>
    <main class="main">
      <div v-if="IS_DEMO_PREVIEW" class="preview-banner" role="note">
        <span>PUBLIC PREVIEW</span><i />演示环境 · 虚构样例数据，不会保存
      </div>
      <MobileLayout>
        <MobileHeader
          :title="mobileTitle"
          @summary="ui.openSummarySheet()"
          @sessions="ui.requestChatSessions()"
        />
      </MobileLayout>
      <PresentationLayout :mode="presentation.mode.value">
        <Transition :css="false" mode="out-in" v-bind="routeMotion">
          <component :is="pageComponent" :key="renderedPage" v-bind="renderedPage === 'records' ? { date: renderedDate } : {}" />
        </Transition>
      </PresentationLayout>
      <div ref="routeWipe" class="route-wipe" aria-hidden="true">
        <i class="wipe-band wipe-band-back" /><i class="wipe-band wipe-band-front" />
        <span>{{ ({ records: 'RECORDS', calendar: 'CALENDAR', mirror: 'REFLECT', chat: 'DIALOGUE', vault: 'ARCHIVE', settings: 'SYSTEM' })[route.name] }}</span>
      </div>
      <DetailPanel />
    </main>
    <BottomNav />
    <WriteModal :show="ui.showWriteModal" @close="ui.closeWriteModal()" @saved="(record) => ui.highlightRecordId = record?.id ?? null" />
    <SummarySheet :show="ui.showSummarySheet" @close="ui.closeSummarySheet()" />
    <ToastContainer />
  </div>
</template>

<style scoped>
.app { position: relative; isolation: isolate; z-index: 1; display: flex; height: 100dvh; background: #06123f; }
.app-water { position: absolute; inset: 0; z-index: -1; pointer-events: none; background: linear-gradient(155deg, #073e8588, #092d73c9 58%, #061746e3), url('/art/water-surface.webp') center top / cover; }
/* Let the mobile column shrink so each page can scroll within the viewport. */
.main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; position: relative; }
@media (min-width: 900px) {
  .presentation-mode-mobile { flex-direction: column; }
}
.presentation-mode-desktop :deep(.sidebar) { display: flex; }
.presentation-mode-desktop :deep(.mobile-chrome) { display:none; }
.presentation-mode-desktop :deep(.bottom-nav) { display: none; }
.presentation-mode-desktop :deep(.mobile-header) { display: none; }
.presentation-mode-mobile :deep(.desktop-chrome) { display:none; }
.presentation-mode-mobile :deep(.sidebar) { display: none; }
.presentation-mode-mobile :deep(.bottom-nav) { display: flex; }
.presentation-mode-mobile :deep(.mobile-header) { display: flex; }
.presentation-mode-mobile { display:flex; flex-direction:column; --nav-height:76px; --page-bottom-clearance:24px; }
/* Reserve navigation space once, also when mobile mode is selected on a wide
   screen. Scrollbars and the chat composer end above the fixed navigation. */
.presentation-mode-mobile :deep(.main) { width:100%; max-width:720px; margin:0 auto; padding-bottom:calc(var(--nav-height) + var(--safe-bottom)); }
.presentation-mode-mobile :deep(.page:not(.chat-page) > .page-content) { padding-bottom:var(--page-bottom-clearance); }
.presentation-mode-mobile :deep(.chat-page > .page-content) { padding-bottom:12px; }
@media (max-width: 600px) {
  .presentation-mode-desktop :deep(.sidebar) { flex:0 0 64px; width:64px; padding:12px 4px; }
  .presentation-mode-desktop :deep(.brand-name), .presentation-mode-desktop :deep(.sidebar-date), .presentation-mode-desktop :deep(.sidebar-write) { display:none; }
  .presentation-mode-desktop :deep(.sidebar-bottom) { display:block; margin-top:auto; padding:0; }
  .presentation-mode-desktop :deep(.sidebar-bottom .settings-row) { display:flex; justify-content:center; padding:12px 0; font-size:0; }
  .presentation-mode-desktop :deep(.sidebar-bottom .settings-row svg) { display:block; }
  .presentation-mode-desktop :deep(.sidebar-bottom .presentation-mode-button) { justify-content:center; padding:12px 0; font-size:0; }
  .presentation-mode-desktop :deep(.sidebar-bottom .presentation-mode-button svg) { display:block; }
  .presentation-mode-desktop :deep(.sidebar-bottom .pending) { display:none; }
  .presentation-mode-desktop :deep(.user-row), .presentation-mode-desktop :deep(.author), .presentation-mode-desktop :deep(.projects) { display:none; }
  .presentation-mode-desktop :deep(.brand) { justify-content:center; padding:0; }
  .presentation-mode-desktop :deep(.brand-mark) { font-size:32px; }
  .presentation-mode-desktop :deep(.nav-row) { justify-content:center; padding:8px; }
  .presentation-mode-desktop :deep(.nav-row span) { display:none; }
  .presentation-mode-desktop :deep(.nav-row svg) { width:22px; height:22px; }
}
.preview-banner { position: relative; z-index: 5; flex: 0 0 auto; min-height: 28px; display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 4px 18px; color: #ddfaff; background: #062f73e8; border-bottom: 1px solid #68e8f58c; font-size: 10px; letter-spacing: .04em; }
.preview-banner span { color: var(--cyan); font: italic 800 11px var(--font-display); letter-spacing: .08em; }
.preview-banner i { width: 1px; height: 12px; background: #82ddeb80; }
@media (max-width: 640px) { .preview-banner { justify-content: center; padding: 5px 8px; font-size: 9px; } }
@media (max-height:480px) and (max-width:899px) {
  .presentation-mode-mobile{--nav-height:52px}
  .presentation-mode-mobile :deep(.mobile-header){min-height:44px;padding-top:0;padding-bottom:0}
  .presentation-mode-mobile :deep(.bottom-nav){padding-top:4px;padding-bottom:4px}
  .presentation-mode-mobile :deep(.nav-item){min-height:44px;flex-direction:row;justify-content:center;gap:3px}
  .presentation-mode-mobile :deep(.nav-icon){width:34px;height:36px}
  .presentation-mode-mobile :deep(.nav-create){width:50px;height:44px;flex-direction:row;gap:2px}
  .presentation-mode-mobile :deep(.chat-page > .page-content){padding-bottom:8px}
}
</style>
