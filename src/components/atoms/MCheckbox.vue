<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="checkbox-group" @click="$emit('update:modelValue', !modelValue)">
    <div :class="['checkbox', { checked: modelValue }]">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
    <span v-if="label" class="checkbox-label">{{ label }}</span>
  </div>
</template>

<style scoped>
.checkbox-group {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 24px; cursor: pointer;
}
.checkbox {
  width: 20px; height: 20px; border: 1.5px solid var(--border);
  border-radius: 6px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease; flex-shrink: 0;
}
.checkbox.checked { background: var(--accent); border-color: var(--accent); }
.checkbox.checked svg { opacity: 1; }
.checkbox svg { width: 12px; height: 12px; stroke: #fff; opacity: 0; transition: opacity 0.2s; }
.checkbox-label { font-size: 14px; color: var(--text-secondary); }
</style>
