<script setup>
import { useRoute } from 'vue-router'
import { useGlossaryStore } from '@/stores/glossary'

defineProps({
  title: { type: String, default: '' },
})
const emit = defineEmits(['write', 'summary', 'sessions'])

/** 历史会话入口仅对话页展示（桌面 header 会话按钮在 900px 以下隐藏，移动端靠这里） */
const route = useRoute()
const glossary = useGlossaryStore()
</script>

<template>
  <div class="mobile-header">
    <div class="page-title-sm">{{ title }}</div>
    <div class="header-actions">
      <button
        v-if="route.name === 'chat'"
        class="header-icon-btn"
        title="历史会话"
        @click="emit('sessions')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M3 12h18M3 18h12"/>
        </svg>
      </button>
      <button class="header-icon-btn" title="每日总结" @click="emit('summary')">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>
        </svg>
      </button>
      <button class="header-icon-btn" title="设置" @click="$router.push({ name: 'settings' })">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <!-- 词典 pending 角标（移动端设置入口，与桌面侧栏同一数据源） -->
        <span v-if="glossary.pendingCount" class="header-icon-badge">{{ glossary.pendingCount > 9 ? '9+' : glossary.pendingCount }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.mobile-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px 10px;
}
@media (min-width: 900px) { .mobile-header { display: none; } }
.page-title-sm { font-family: var(--font-display); font-size: 21px; font-weight: 600; }
.header-actions { display: flex; gap: 8px; }
.header-icon-btn {
  position: relative;
  width: 36px; height: 36px; border-radius: 12px;
  background: #FFFFFF; border: 1px solid var(--line);
  display: grid; place-items: center;
  transition: background .15s;
}
.header-icon-btn:active { transform: scale(.94); }
.header-icon-btn svg { width: 17px; height: 17px; stroke: var(--text-mid); fill: none; }
.header-icon-badge {
  position: absolute; top: -5px; right: -5px;
  min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: var(--radius-full);
  background: var(--danger); color: #FFFFFF;
  font-family: var(--font-mono); font-size: 9.5px; line-height: 16px; text-align: center;
  box-shadow: 0 0 0 2px var(--ink);
}
</style>
