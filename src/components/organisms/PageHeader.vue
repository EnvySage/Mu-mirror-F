<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <div class="page-header">
    <div class="page-title">{{ title }}</div>
    <div v-if="subtitle" class="page-subtitle">{{ subtitle }}</div>
  </div>
</template>

<style scoped>
.page-header {
  position: sticky; top: 0; z-index: 10;
  background: rgba(245,245,247,0.88);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  padding: 20px 16px 12px; border-bottom: 0.5px solid var(--border);
}
.page-title { font-size: 24px; font-weight: 700; letter-spacing: -0.6px; }
.page-subtitle { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

@media (min-width: 900px) {
  .page-header { padding: 28px 36px 16px; }
  .page-title { font-size: 32px; }
}
</style>
