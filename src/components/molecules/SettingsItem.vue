<script setup>
defineProps({
  icon: { type: String, default: 'info' },
  iconBg: { type: String, default: 'var(--accent)' },
  label: { type: String, required: true },
  description: { type: String, default: '' },
  action: { type: String, default: 'chevron' }, // chevron | toggle | edit | none
  toggleValue: { type: Boolean, default: false },
})

defineEmits(['click', 'toggle'])
</script>

<template>
  <div class="settings-item" @click="(action === 'chevron' || action === 'edit') ? $emit('click') : null">
    <div class="settings-item-left">
      <div class="settings-item-icon" :style="{ background: iconBg }">
        <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path v-if="icon === 'chat'" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <template v-else-if="icon === 'lock'">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </template>
          <template v-else-if="icon === 'zap'">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </template>
          <template v-else-if="icon === 'database'">
            <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </template>
          <template v-else-if="icon === 'eye'">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </template>
          <template v-else-if="icon === 'info'">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </template>
          <template v-else-if="icon === 'link'">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </template>
          <template v-else-if="icon === 'download'">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </template>
          <template v-else-if="icon === 'logout'">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </template>
          <template v-else-if="icon === 'user'">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </template>
          <template v-else-if="icon === 'sparkle'">
            <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4" />
          </template>
          <template v-else-if="icon === 'layers'">
            <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </template>
          <template v-else-if="icon === 'file'">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
          </template>
        </svg>
      </div>
      <div class="settings-item-text">
        <div class="settings-item-label">{{ label }}</div>
        <div v-if="description" class="settings-item-desc">{{ description }}</div>
      </div>
    </div>
    <template v-if="action === 'chevron'">
      <svg class="settings-chevron" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </template>
    <template v-else-if="action === 'edit'">
      <svg class="settings-chevron" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </template>
    <template v-else-if="action === 'toggle'">
      <div :class="['toggle', { on: toggleValue }]" @click.stop="$emit('toggle')" />
    </template>
    <slot name="append" />
  </div>
</template>

<style scoped>
.settings-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 16px; border-bottom: 1px solid var(--line);
  cursor: pointer; transition: background .15s;
  gap: 12px;
}
.settings-item:last-child { border-bottom: none; }
.settings-item:hover { background: var(--ink-2); }
.settings-item-left {
  display: flex; align-items: center; gap: 12px;
  min-width: 0; flex: 1;
}
.settings-item-icon {
  width: 32px; height: 32px; border-radius: 10px;
  display: grid; place-items: center; flex-shrink: 0;
}
.settings-item-icon svg { width: 15px; height: 15px; }
.settings-item-text { display: flex; flex-direction: column; min-width: 0; }
.settings-item-label { font-size: 14px; white-space: nowrap; color: var(--text-hi); }
.settings-item-desc {
  font-size: 12px; color: var(--text-low); margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 46vw;
}
.settings-chevron { width: 15px; height: 15px; stroke: var(--text-low); flex-shrink: 0; }
</style>
