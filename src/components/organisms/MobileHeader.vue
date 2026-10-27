<script setup>
import { useRoute } from 'vue-router'
defineProps({ title: { type: String, default: '' } })
const emit = defineEmits(['summary', 'sessions'])
const route = useRoute()
</script>

<template>
  <header class="mobile-header">
    <div class="page-title-sm">{{ title }}</div>
    <div class="header-actions">
      <button v-if="route.name === 'chat'" class="header-icon-btn" title="历史会话" aria-label="历史会话" @click="emit('sessions')">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
      </button>
      <button class="header-icon-btn" title="每日总结" aria-label="每日总结" @click="emit('summary')">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v15h16V9ZM14 3v6h6M8 13h8M8 17h5" /></svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.mobile-header{flex:0 0 auto;min-height:64px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.mobile-header .page-title-sm{min-width:0;font-size:20px;line-height:1.3}
.header-actions{display:flex;gap:4px;flex-shrink:0}
.mobile-header .header-icon-btn{width:44px;height:44px;border-radius:3px;background:transparent;border:1px solid transparent;display:grid;place-items:center}
.mobile-header .header-icon-btn svg{width:21px;height:21px;stroke:#cce6ff;fill:none}
.mobile-header .header-icon-btn:focus-visible{outline-color:var(--cyan)}
@media(min-width:900px){.mobile-header{display:none}}
</style>
