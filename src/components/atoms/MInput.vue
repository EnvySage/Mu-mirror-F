<script setup>
const props = defineProps({
  type: { type: String, default: 'text' },
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  error: { type: String, default: null },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

function onInput(e) {
  emit('update:modelValue', e.target.value)
}
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="['m-input', { error: !!error }]"
    @input="onInput"
  />
</template>

<style scoped>
.m-input {
  width: 100%;
  padding: 14px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 16px;
  font-family: var(--font);
  color: var(--text-primary);
  outline: none;
  transition: all 0.2s ease;
  background: var(--surface);
}
.m-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
.m-input.error { border-color: var(--error); }
.m-input::placeholder { color: var(--text-tertiary); }
.m-input:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
