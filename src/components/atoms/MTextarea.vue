<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  maxlength: { type: Number, default: 500 },
  autoResize: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue'])

function onInput(e) {
  emit('update:modelValue', e.target.value)
  if (props.autoResize) {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }
}
</script>

<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :maxlength="maxlength"
    class="m-textarea"
    @input="onInput"
  />
</template>

<style scoped>
.m-textarea {
  flex: 1;
  border: none;
  outline: none;
  font-size: 17px;
  line-height: 1.8;
  color: var(--text-primary);
  resize: none;
  font-family: var(--font);
  background: transparent;
}
.m-textarea::placeholder { color: var(--text-tertiary); }
</style>
