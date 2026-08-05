<script setup>
defineProps({
  icon: { type: String, default: 'plus' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
})
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <path v-if="icon === 'plus'" d="M12 5v14M5 12h14" />
        <path v-else-if="icon === 'calendar'" d="M12 5v14M5 12h14" />
      </svg>
    </div>
    <div class="empty-title">{{ title }}</div>
    <div v-if="description" class="empty-desc">{{ description }}</div>
  </div>
</template>

<style scoped>
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 80px 20px; text-align: center; }
.empty-icon { width: 56px; height: 56px; border-radius: 50%; background: var(--accent-light); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.empty-icon svg { width: 24px; height: 24px; stroke: var(--accent); }
.empty-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.empty-desc { font-size: 13px; color: var(--text-secondary); max-width: 220px; }
</style>
