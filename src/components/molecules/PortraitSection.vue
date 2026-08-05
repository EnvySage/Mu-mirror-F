<script setup>
defineProps({
  icon: { type: String, required: true },
  iconBg: { type: String, default: 'var(--accent)' },
  title: { type: String, required: true },
})
</script>

<template>
  <div class="portrait-section">
    <div class="portrait-section-header">
      <div class="portrait-section-icon" :style="{ background: iconBg }">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
          <path v-if="icon === 'book'" d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <template v-else-if="icon === 'book2'">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </template>
          <template v-else-if="icon === 'smile'">
            <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
          </template>
          <template v-else-if="icon === 'checkSquare'">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </template>
          <template v-else-if="icon === 'tag'">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
          </template>
        </svg>
      </div>
      <div class="portrait-section-title">{{ title }}</div>
    </div>
    <div class="portrait-card">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.portrait-section { margin-bottom: 0; }
.portrait-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.portrait-section-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.portrait-section-icon svg { width: 14px; height: 14px; }
.portrait-section-title { font-size: 14px; font-weight: 600; }
.portrait-card { background: var(--surface); border-radius: var(--radius-md); padding: 16px; border: 0.5px solid var(--border); }

@media (min-width: 900px) {
  .portrait-section-header { margin-bottom: 12px; }
  .portrait-section-icon { width: 30px; height: 30px; border-radius: 9px; }
  .portrait-section-icon svg { width: 16px; height: 16px; }
  .portrait-section-title { font-size: 15px; }
  .portrait-card { padding: 18px; }
}
</style>
