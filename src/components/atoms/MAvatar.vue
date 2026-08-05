<script setup>
defineProps({
  initial: { type: String, default: 'U' },
  size: { type: String, default: 'md' }, // sm | md | lg
})
</script>

<template>
  <div :class="['m-avatar', `m-avatar-${size}`]">
    {{ initial }}
  </div>
</template>

<style scoped>
.m-avatar {
  border-radius: 50%;
  background: var(--accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--accent);
  flex-shrink: 0;
}
.m-avatar-sm { width: 32px; height: 32px; font-size: 14px; }
.m-avatar-md { width: 48px; height: 48px; font-size: 18px; }
.m-avatar-lg { width: 80px; height: 80px; font-size: 32px; }
</style>
