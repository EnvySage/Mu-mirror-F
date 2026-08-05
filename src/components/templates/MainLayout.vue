<script setup>
import AppSidebar from '@/components/organisms/AppSidebar.vue'
import BottomNav from '@/components/organisms/BottomNav.vue'
import WriteModal from '@/components/organisms/WriteModal.vue'
import DetailPanel from '@/components/organisms/DetailPanel.vue'
</script>

<template>
  <div class="app">
    <AppSidebar />
    <main class="main-content">
      <router-view />
      <DetailPanel />
    </main>
    <BottomNav />
    <WriteModal />
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
