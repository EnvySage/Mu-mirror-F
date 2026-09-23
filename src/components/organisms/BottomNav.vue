<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const route = useRoute()
const ui = useUIStore()

/**
 * 底栏只放 5 个页面入口（等分即对称）；「写日记」移出条外成为右下悬浮 FAB。
 * 原来 6 项挤一条、凸钮占第 3 槽，中心落在 41.7% 而非 50%，整条永远向左歪——
 * 这不是间距没调好：偶数等分根本不存在正中槽，凸钮必须离开条内才可能对称。
 */
const NAV = [
  { page: 'records', label: '记录', icon: 'M4 6h16M4 12h16M4 18h10' },
  { page: 'calendar', label: '日历', icon: 'calendar' },
  { page: 'vault', label: '资产', icon: 'archive' },
  { page: 'mirror', label: '镜子', icon: 'clock' },
  { page: 'chat', label: '对话', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
]

const activePage = computed(() => route.name)
/** 对话页不挂 FAB：底部是输入条，FAB 会紧贴甚至压住输入框（该页写日记走顶部 header 入口） */
const isChat = computed(() => route.name === 'chat')

/**
 * 切页：走 ui store 的 switchPage（会同时复位 showDetail / selectedRecordId）。
 * DetailPanel 是 fixed 全屏层，只 push 路由不复位的话记录详情会盖住新页面。
 */
function handleNav(item) {
  if (item.page === 'records') ui.sidebarSelectedDate = null
  ui.switchPage(item.page)
  router.push({ name: item.page })
}
</script>

<template>
  <nav class="bottom-nav">
    <button
      v-for="item in NAV"
      :key="item.page"
      :class="['nav-item', { active: activePage === item.page }]"
      @click="handleNav(item)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <template v-if="item.icon === 'calendar'">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </template>
        <template v-else-if="item.icon === 'archive'">
          <rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>
        </template>
        <template v-else-if="item.icon === 'clock'">
          <circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/>
        </template>
        <template v-else>
          <path :d="item.icon" />
        </template>
      </svg>
      <span>{{ item.label }}</span>
    </button>
  </nav>

  <!-- 写日记：右下悬浮 FAB（与底栏 5 项脱钩，桌面端有侧栏入口故隐藏） -->
  <button v-if="!isChat" class="write-fab" aria-label="写日记" @click="ui.openWriteModal()">
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
  </button>
</template>

<style scoped>
.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 20;
  display: flex; justify-content: space-around; align-items: center;
  height: calc(var(--nav-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: var(--card);
  border-top: 1px solid var(--line);
}
/* 桌面隐藏底栏（write-fab 的隐藏规则必须放在其主规则之后，否则 display:grid 会反杀） */
@media (min-width: 900px) { .bottom-nav { display: none; } }

.nav-item {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  color: var(--text-low); font-size: 10px; width: 56px; padding: 6px 0;
  transition: color .18s;
}
.nav-item svg { width: 21px; height: 21px; stroke: currentColor; fill: none; }
.nav-item:active { transform: scale(.94); }
.nav-item.active { color: var(--accent); font-weight: 500; }

/* 写日记 FAB：悬在底栏上方右侧；52px 直径保证 44px+ 的可点区 */
.write-fab {
  position: fixed; z-index: 21;
  right: 16px; bottom: calc(var(--nav-height) + var(--safe-bottom) + 14px);
  width: 52px; height: 52px; border-radius: 50%;
  background: var(--accent); display: grid; place-items: center;
  box-shadow: 0 6px 16px rgba(44, 95, 232, .35), 0 2px 4px rgba(20, 20, 15, .12);
  transition: transform .15s;
}
.write-fab:active { transform: scale(.92); }
.write-fab svg { width: 22px; height: 22px; stroke: #FFFFFF; }
/* 必须置于 .write-fab 主规则之后：同特异性下靠源码顺序压过 display:grid */
@media (min-width: 900px) { .write-fab { display: none; } }
</style>
