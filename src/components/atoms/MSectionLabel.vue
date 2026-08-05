<script setup>
defineProps({
  text: { type: String, required: true },
})
</script>

<template>
  <div class="section-label">{{ text }}</div>
</template>

<style scoped>
.section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
  padding-left: 4px;
}
</style>
