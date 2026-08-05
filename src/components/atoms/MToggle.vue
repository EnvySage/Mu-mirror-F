<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div
    :class="['toggle', { on: modelValue }]"
    @click="$emit('update:modelValue', !modelValue)"
  />
</template>

<style scoped>
.toggle {
  width: 44px; height: 26px; border-radius: 13px;
  background: var(--border); position: relative;
  cursor: pointer; transition: background 0.2s; flex-shrink: 0;
}
.toggle.on { background: var(--accent); }
.toggle::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 22px; height: 22px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  transition: transform 0.2s;
}
.toggle.on::after { transform: translateX(18px); }
</style>
