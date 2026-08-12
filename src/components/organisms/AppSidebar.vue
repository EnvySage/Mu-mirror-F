<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useRecordsStore } from '@/stores/records'
import CalendarWidget from '@/components/molecules/CalendarWidget.vue'

const router = useRouter()
const route = useRoute()
const ui = useUIStore()
const records = useRecordsStore()

const navItems = [
  { page: 'records', icon: 'list', label: '记录' },
  { page: 'calendar', icon: 'calendar', label: '日历' },
  { page: 'mirror', icon: 'mirror', label: '镜子' },
  { page: 'settings', icon: 'settings', label: '设置' },
]

const activePage = computed(() => route.name)

function switchPage(page) {
  // 点"记录"时清除侧边栏日期筛选，回到全部记录
  if (page === 'records') {
    ui.sidebarSelectedDate = null
  }
  router.push({ name: page })
}

/** 侧边栏 mini 日历点击日期 → 联动记录页 */
function onSidebarDateSelect(date) {
  ui.sidebarSelectedDate = date
  if (route.name !== 'records') {
    router.push({ name: 'records' })
  }
}

function openWrite() {
  ui.openWriteModal()
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>
        </div>
        <div class="sidebar-logo-text">Mirror</div>
      </div>
    </div>

    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.page"
        :class="['sidebar-nav-item', { active: activePage === item.page }]"
        @click="switchPage(item.page)"
      >
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
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div class="sidebar-stats">
      <div class="sidebar-stats-title">数据概览</div>
      <div class="sidebar-stats-grid">
        <div class="sidebar-stat"><div class="sidebar-stat-num">{{ records.totalCount }}</div><div class="sidebar-stat-label">总记录</div></div>
        <div class="sidebar-stat"><div class="sidebar-stat-num">3</div><div class="sidebar-stat-label">天数</div></div>
        <div class="sidebar-stat"><div class="sidebar-stat-num">1.7</div><div class="sidebar-stat-label">日均</div></div>
        <div class="sidebar-stat"><div class="sidebar-stat-num">80%</div><div class="sidebar-stat-label">完成率</div></div>
      </div>
    </div>

    <div class="sidebar-calendar">
      <CalendarWidget
        mode="mini"
        :model-value="ui.sidebarSelectedDate"
        @select-date="onSidebarDateSelect"
      />
    </div>

    <button class="sidebar-write" @click="openWrite">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
      写日记
    </button>

    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-avatar">U</div>
        <div class="sidebar-user-name">用户</div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: none;
  width: var(--sidebar-width);
  height: 100%;
  background: var(--surface);
  border-right: 0.5px solid var(--border);
  flex-direction: column;
  flex-shrink: 0;
}

@media (min-width: 900px) {
  .sidebar { display: flex; }
}

.sidebar-header { padding: 28px 24px 20px; }
.sidebar-logo { display: flex; align-items: center; gap: 10px; }
.sidebar-logo-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, #4F46E5, #7C3AED);
  display: flex; align-items: center; justify-content: center;
}
.sidebar-logo-icon svg { width: 18px; height: 18px; stroke: #fff; }
.sidebar-logo-text { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }

.sidebar-nav { flex: 1; padding: 8px 12px; overflow-y: auto; }
.sidebar-nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: var(--radius-sm);
  cursor: pointer; transition: all 0.15s ease;
  border: none; background: none; width: 100%; text-align: left;
  font-family: var(--font);
}
.sidebar-nav-item:hover { background: var(--bg); }
.sidebar-nav-item.active { background: var(--accent-light); }
.sidebar-nav-item svg { width: 20px; height: 20px; stroke: var(--text-tertiary); flex-shrink: 0; }
.sidebar-nav-item.active svg { stroke: var(--accent); }
.sidebar-nav-item span { font-size: 14px; font-weight: 500; color: var(--text-secondary); }
.sidebar-nav-item.active span { color: var(--accent); font-weight: 600; }

.sidebar-stats {
  padding: 16px 20px; margin: 0 12px 12px;
  background: var(--bg); border-radius: var(--radius-md);
}
.sidebar-stats-title { font-size: 11px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
.sidebar-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.sidebar-stat { text-align: center; }
.sidebar-stat-num { font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--text-primary); }
.sidebar-stat-label { font-size: 11px; color: var(--text-tertiary); }

.sidebar-calendar {
  margin: 0 12px 12px;
}

.sidebar-write {
  margin: 8px 12px 16px; padding: 12px 14px;
  border-radius: var(--radius-sm); background: var(--accent);
  color: #fff; font-size: 14px; font-weight: 600;
  border: none; cursor: pointer; display: flex; align-items: center; gap: 10px;
  width: calc(100% - 24px); font-family: var(--font); transition: background 0.15s;
}
.sidebar-write:hover { background: var(--accent-hover); }
.sidebar-write svg { width: 18px; height: 18px; stroke: #fff; }

.sidebar-footer { padding: 16px 20px; border-top: 0.5px solid var(--border); }
.sidebar-user { display: flex; align-items: center; gap: 10px; }
.sidebar-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--accent-light); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; color: var(--accent); }
.sidebar-user-name { font-size: 13px; font-weight: 500; }
</style>
