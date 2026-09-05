<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const route = useRoute()
const ui = useUIStore()

/** 顺序对齐原型：记录 / 日历 / [写日记凸钮] / 镜子 / 对话 */
const NAV = [
  { page: 'records', label: '记录', icon: 'M4 6h16M4 12h16M4 18h10' },
  { page: 'calendar', label: '日历', icon: 'calendar' },
  { action: 'write', label: '写日记', icon: 'M12 5v14M5 12h14' },
  { page: 'mirror', label: '镜子', icon: 'clock' },
  { page: 'chat', label: '对话', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
]

const activePage = computed(() => route.name)

function handleNav(item) {
  if (item.action === 'write') {
    ui.openWriteModal()
  } else {
    if (item.page === 'records') ui.sidebarSelectedDate = null
    router.push({ name: item.page })
  }
}
</script>

<template>
  <nav class="bottom-nav">
    <button
      v-for="item in NAV"
      :key="item.page || item.action"
      :class="['nav-item', { active: activePage === item.page }]"
      @click="handleNav(item)"
    >
      <template v-if="item.action === 'write'">
        <div class="write-btn-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </div>
      </template>
      <template v-else>
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <template v-if="item.icon === 'calendar'">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </template>
          <template v-else-if="item.icon === 'clock'">
            <circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/>
          </template>
          <template v-else>
            <path :d="item.icon" />
          </template>
        </svg>
      </template>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 20;
  display: flex; justify-content: space-around; align-items: center;
  height: calc(var(--nav-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: #FFFFFF;
  border-top: 1px solid var(--line);
}
@media (min-width: 900px) { .bottom-nav { display: none; } }

.nav-item {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  color: var(--text-low); font-size: 10px; width: 56px; padding: 6px 0;
  transition: color .18s;
}
.nav-item svg { width: 21px; height: 21px; stroke: currentColor; fill: none; }
.nav-item:active { transform: scale(.94); }
.nav-item.active { color: var(--accent); font-weight: 500; }

.write-btn-circle {
  width: 46px; height: 46px; margin-top: -26px; border-radius: 50%;
  background: var(--accent); display: grid; place-items: center;
  box-shadow: 0 4px 12px rgba(44,95,232,.3), 0 0 0 5px var(--ink);
  transition: transform .15s;
}
.write-btn-circle:active { transform: scale(.92); }
.write-btn-circle svg { width: 20px; height: 20px; stroke: #FFFFFF; }
</style>
