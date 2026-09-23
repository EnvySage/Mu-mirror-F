<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useRecordsStore } from '@/stores/records'
import { useSettingsStore } from '@/stores/settings'
import { useGlossaryStore } from '@/stores/glossary'
import { useStatsStore } from '@/stores/stats'
import { useTodoPolling } from '@/composables/useTodoPolling'
import AppSidebar from '@/components/organisms/AppSidebar.vue'
import BottomNav from '@/components/organisms/BottomNav.vue'
import MobileHeader from '@/components/organisms/MobileHeader.vue'
import WriteModal from '@/components/organisms/WriteModal.vue'
import SummarySheet from '@/components/organisms/SummarySheet.vue'
import DetailPanel from '@/components/organisms/DetailPanel.vue'
import ToastContainer from '@/components/organisms/ToastContainer.vue'

const router = useRouter()
const route = useRoute()
const ui = useUIStore()
const auth = useAuthStore()
const recordsStore = useRecordsStore()
const settingsStore = useSettingsStore()
const glossary = useGlossaryStore()
const statsStore = useStatsStore()

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
  if (ui.showDetail) {
    ui.showDetail = false
    ui.selectedRecordId = null
  }
})

function openWrite() {
  ui.openWriteModal()
}
</script>

<template>
  <div class="app">
    <AppSidebar />
    <main class="main">
      <MobileHeader
        :title="mobileTitle"
        @write="openWrite"
        @summary="ui.openSummarySheet()"
        @sessions="ui.requestChatSessions()"
      />
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="route.name" />
        </Transition>
      </RouterView>
      <DetailPanel />
    </main>
    <BottomNav />
    <WriteModal :show="ui.showWriteModal" @close="ui.closeWriteModal()" />
    <SummarySheet :show="ui.showSummarySheet" @close="ui.closeSummarySheet()" />
    <ToastContainer />
  </div>
</template>

<style scoped>
.app { position: relative; z-index: 1; display: flex; height: 100dvh; }
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative; }
</style>
