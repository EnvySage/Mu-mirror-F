<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const route = useRoute()
const ui = useUIStore()

const navItems = [
  { page: 'records', icon: 'list', label: '记录' },
  { page: 'calendar', icon: 'calendar', label: '日历' },
  { action: 'write', icon: 'plus', label: '写日记' },
  { page: 'mirror', icon: 'mirror', label: '镜子' },
  { page: 'settings', icon: 'settings', label: '设置' },
]

const activePage = computed(() => route.name)

function handleNav(item) {
  if (item.action === 'write') {
    ui.openWriteModal()
  } else if (item.page) {
    router.push({ name: item.page })
  }
}
</script>

<template>
  <nav class="bottom-nav">
    <button
      v-for="item in navItems"
      :key="item.page || item.action"
      :class="['nav-item', { active: activePage === item.page, 'write-btn': item.action === 'write' }]"
      @click="handleNav(item)"
    >
      <template v-if="item.action === 'write'">
        <div class="write-btn-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </div>
      </template>
      <template v-else>
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path v-if="item.icon === 'list'" d="M4 6h16M4 12h16M4 18h10" />
          <template v-else-if="item.icon === 'calendar'">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </template>
          <template v-else-if="item.icon === 'mirror'">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2.5" />
          </template>
          <template v-else-if="item.icon === 'settings'">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </template>
        </svg>
      </template>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: calc(var(--nav-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-top: 0.5px solid var(--border);
  display: flex; align-items: center; justify-content: space-around;
  z-index: 100;
}

@media (min-width: 900px) {
  .bottom-nav { display: none !important; }
}

.nav-item {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 6px 16px; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  border: none; background: none; outline: none;
}
.nav-item svg { width: 22px; height: 22px; stroke: var(--text-tertiary); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; transition: stroke 0.2s; }
.nav-item span { font-size: 10px; font-weight: 500; color: var(--text-tertiary); transition: color 0.2s; }
.nav-item.active svg { stroke: var(--accent); }
.nav-item.active span { color: var(--accent); }
.nav-item.write-btn { position: relative; margin-top: -22px; }
.write-btn-circle { width: 50px; height: 50px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(79,70,229,0.3); transition: transform 0.15s ease; }
.write-btn-circle svg { stroke: #fff; width: 20px; height: 20px; }
.write-btn:active .write-btn-circle { transform: scale(0.9); }
</style>
