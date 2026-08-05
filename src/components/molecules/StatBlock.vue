<script setup>
defineProps({
  num: { type: [String, Number], required: true },
  label: { type: String, required: true },
})
</script>

<template>
  <div class="stat-block">
    <div class="stat-num">{{ num }}</div>
    <div class="stat-label">{{ label }}</div>
  </div>
</template>

<style scoped>
.stat-block { text-align: center; }
.stat-num { font-size: 22px; font-weight: 700; font-family: var(--font-mono); display: block; }
.stat-label { font-size: 11px; opacity: 0.65; }

@media (min-width: 900px) {
  .stat-num { font-size: 32px; }
  .stat-label { font-size: 12px; }
}
</style>
