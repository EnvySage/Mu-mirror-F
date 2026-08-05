<script setup>
defineProps({
  date: { type: String, required: true },
})
</script>

<template>
  <div class="date-separator">{{ date }}</div>
</template>

<style scoped>
.date-separator { font-size: 13px; font-weight: 600; color: var(--text-tertiary); padding: 14px 0 6px; }
</style>
