<script setup>
defineProps({
  icon: { type: String, default: 'info' },
  iconBg: { type: String, default: 'var(--accent)' },
  label: { type: String, required: true },
  description: { type: String, default: '' },
  action: { type: String, default: 'chevron' }, // chevron | toggle | none
  toggleValue: { type: Boolean, default: false },
})

defineEmits(['click', 'toggle'])
</script>

<template>
  <div class="settings-item" @click="action === 'chevron' ? $emit('click') : null">
    <div class="settings-item-left">
      <div class="settings-item-icon" :style="{ background: iconBg }">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
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
    <template v-else-if="action === 'toggle'">
      <div :class="['toggle', { on: toggleValue }]" @click.stop="$emit('toggle')" />
    </template>
  </div>
</template>

<style scoped>
.settings-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 0.5px solid var(--border);
  cursor: pointer; transition: background 0.15s;
  gap: 12px;
}
.settings-item:last-child { border-bottom: none; }
.settings-item:hover { background: var(--bg); }
.settings-item-left {
  display: flex; align-items: center; gap: 12px;
  min-width: 0; flex: 1;
}
.settings-item-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.settings-item-icon svg { width: 16px; height: 16px; }
.settings-item-text { display: flex; flex-direction: column; min-width: 0; }
.settings-item-label { font-size: 14px; font-weight: 500; white-space: nowrap; }
.settings-item-desc {
  font-size: 12px; color: var(--text-tertiary); margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.settings-chevron { width: 16px; height: 16px; stroke: var(--text-tertiary); flex-shrink: 0; }

.toggle { width: 44px; height: 26px; border-radius: 13px; background: var(--border); position: relative; cursor: pointer; transition: background 0.2s; flex-shrink: 0; }
.toggle.on { background: var(--accent); }
.toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.12); transition: transform 0.2s; }
.toggle.on::after { transform: translateX(18px); }

@media (min-width: 900px) {
  .settings-item { padding: 16px 18px; }
}
</style>
