<script setup>
import { computed, onMounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import AppSidebar from '@/components/organisms/AppSidebar.vue'
import BottomNav from '@/components/organisms/BottomNav.vue'
import RecordFormModal from '@/components/organisms/RecordFormModal.vue'
import DetailPanel from '@/components/organisms/DetailPanel.vue'
import ToastContainer from '@/components/organisms/ToastContainer.vue'

const ui = useUIStore()
const settingsStore = useSettingsStore()
const showWriteModal = computed(() => ui.showWriteModal)

onMounted(() => {
  settingsStore.fetchSettings()
})

function closeWriteModal() {
  ui.closeWriteModal()
}

function onRecordCreated(record) {
  // 记录创建成功后的回调
  console.log('Record created:', record)
}
</script>

<template>
  <div class="app">
    <AppSidebar />
    <main class="main-content">
      <router-view />
      <DetailPanel />
    </main>
    <BottomNav />
    <RecordFormModal
      :show="showWriteModal"
      @close="closeWriteModal"
      @created="onRecordCreated"
    />
    <ToastContainer />
  </div>
</template>

<style scoped>
.app {
  width: 100%;
  height: 100dvh;
  display: flex;
  overflow: hidden;
}

.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--bg);
}
</style>
