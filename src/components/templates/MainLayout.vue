<script setup>
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useRecordsStore } from '@/stores/records'
import { useSettingsStore } from '@/stores/settings'
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

/** 移动端 header 标题（对话页等也走这里） */
const mobileTitle = computed(() => {
  const names = { records: '记录', calendar: '日历', chat: '对话', mirror: '镜子', settings: '设置' }
  return names[route.name] || ''
})

onMounted(() => {
  settingsStore.fetchSettings()
  // 有记录数据才拉取（各 view 也会自行拉取，这里做导航条计数兜底）
  if (recordsStore.records.length === 0) recordsStore.fetchRecords()
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
