<script setup>
defineProps({
  variant: { type: String, default: 'primary' }, // primary | secondary | ghost | icon
  size: { type: String, default: 'md' }, // sm | md | lg
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})

defineEmits(['click'])
</script>

<template>
  <button
    :class="['m-btn', `m-btn-${variant}`, `m-btn-${size}`, { disabled, loading }]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.m-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: var(--radius);
  font-family: var(--font);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

/* Sizes */
.m-btn-sm { padding: 8px 16px; font-size: 13px; }
.m-btn-md { padding: 14px 24px; font-size: 16px; }
.m-btn-lg { padding: 16px 32px; font-size: 18px; }

/* Variants */
.m-btn-primary {
  background: var(--accent);
  color: #fff;
  width: 100%;
}
.m-btn-primary:hover { background: var(--accent-hover); }
.m-btn-primary:active { transform: scale(0.97); }

.m-btn-secondary {
  background: var(--ink-2);
  color: var(--text-mid);
  width: 100%;
  margin-top: 12px;
}
.m-btn-secondary:hover { background: var(--line); }

.m-btn-ghost {
  background: transparent;
  color: var(--text-mid);
  padding: 6px 0;
}
.m-btn-ghost:hover { color: var(--text-hi); }

.m-btn-icon {
  background: none;
  color: var(--text-low);
  padding: 6px;
  border-radius: var(--radius-sm);
}
.m-btn-icon:hover { background: var(--ink-2); }

/* States */
.m-btn.disabled { opacity: 0.5; cursor: not-allowed; }
.m-btn.loading { opacity: 0.7; cursor: wait; }
</style>
