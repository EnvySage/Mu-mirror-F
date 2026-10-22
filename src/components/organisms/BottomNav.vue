<script setup>
import { computed, ref } from 'vue'
import { useNavIndicatorMotion } from '@/motion/useNavIndicatorMotion'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const route = useRoute()
const ui = useUIStore()

// The middle slot is an action; the four destinations stay in a stable order.
const NAV = [
  { page: 'records', label: '记录', slot: 0, icon: 'M5 6h14M5 12h14M5 18h9' },
  { page: 'calendar', label: '日历', slot: 1, icon: 'M8 3v4M16 3v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z' },
  { slot: 2 },
  { page: 'mirror', label: '镜子', slot: 3, icon: 'M16.5 16.5 20 20M7.5 16.5 4 20M9 21h6M12 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM12 7v4l2 2' },
  { page: 'chat', label: '对话', slot: 4, icon: 'M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2ZM8 9h8M8 13h5' },
]
const activeSlot = computed(() => NAV.find(item => item.page === route.name)?.slot ?? -1)
const navEl = ref(null), selectionEl = ref(null)
useNavIndicatorMotion(navEl, selectionEl, activeSlot, '.nav-item.active .nav-icon', { skewX: -10 })

function handleNav(item) {
  if (!ui.confirmNavigationDrafts()) return
  ui.approveNavigation(router.resolve({ name: item.page }).fullPath)
  if (item.page === 'records') ui.sidebarSelectedDate = null
  ui.switchPage(item.page, true)
  router.push({ name: item.page })
}
</script>

<template>
  <nav class="bottom-nav" aria-label="主导航">
    <div ref="navEl" class="nav-items">
      <span ref="selectionEl" class="nav-selection" aria-hidden="true" />
      <template v-for="item in NAV" :key="item.slot">
        <button
          v-if="item.page"
          :class="['nav-item', { active: route.name === item.page }]"
          :style="{ gridColumn: item.slot + 1 }"
          :aria-current="route.name === item.page ? 'page' : undefined"
          @click="handleNav(item)"
        >
          <span class="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path :d="item.icon" /></svg>
          </span>
          <span class="nav-label">{{ item.label }}</span>
        </button>
        <button v-else class="nav-create" aria-label="新建记录" @click="ui.openWriteModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <span>新建</span>
        </button>
      </template>
    </div>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed; bottom: 0; left: 50%; z-index: 20;
  width: min(100%, 720px); height: calc(var(--nav-height) + var(--safe-bottom));
  transform: translateX(-50%);
  padding: 8px 12px calc(8px + var(--safe-bottom));
  background: #05113f; border-top: 1px solid #70c7ed4d;
  color: #a9c5f4;
}
.nav-items { position: relative; width: 100%; height: 100%; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); align-items: start; }
.nav-selection {
  position: absolute; top: 0; left: 0;
  width: 44px; height: 30px; opacity: 0;
  background: var(--cyan); pointer-events: none;
}
.nav-item {
  position: relative; grid-row: 1; min-width: 0; min-height: 54px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 2px 0 0; color: #a9c5f4;
  transition: color .18s ease, transform .18s ease;
}
.nav-icon { width: 44px; height: 30px; display: grid; place-items: center; }
.nav-icon svg { width: 21px; height: 21px; }
.nav-label { font-size: 11px; line-height: 16px; }
.nav-item.active { color: #f8fbff; }
.nav-item.active .nav-icon { color: #06123f; }
.nav-item.active .nav-label { font-weight: 700; }
.nav-item:focus-visible { outline-color: var(--cyan); outline-offset: -2px; }
.nav-create {
  position: relative; grid-column: 3; grid-row: 1; justify-self: center;
  width: 56px; height: 56px; margin-top: -1px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  background: var(--cyan); color: #06123f;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  transition: background .18s ease, transform .18s ease;
}
.nav-create svg { width: 23px; height: 23px; }
.nav-create span { font-size: 10px; line-height: 15px; font-weight: 800; }
.nav-create:focus-visible { outline: none; background: white; }
@media (hover: hover) { .nav-item:hover { color: white; } .nav-create:hover { background: white; } }
@media (min-width: 900px) { .bottom-nav { display: none; } }
@media (prefers-reduced-motion: reduce) { .nav-selection, .nav-item, .nav-create { transition: none; } }
</style>
