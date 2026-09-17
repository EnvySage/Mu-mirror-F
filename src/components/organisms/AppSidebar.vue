<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useGlossaryStore } from '@/stores/glossary'

const props = defineProps({
  /** 移动端 bottom-nav 无需重复事件，桌面写日记按钮也走全局 ui store */
  useStoreAction: { type: Boolean, default: true },
})

const router = useRouter()
const route = useRoute()
const ui = useUIStore()
const auth = useAuthStore()
const glossary = useGlossaryStore()

const NAV = [
  { page: 'records', label: '记录', icon: 'M4 6h16M4 12h16M4 18h10' },
  { page: 'calendar', label: '日历', icon: 'calendar' },
  { page: 'chat', label: '对话', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { page: 'vault', label: '资产', icon: 'archive' },
  { page: 'mirror', label: '镜子', icon: 'clock' },
  { page: 'settings', label: '设置', icon: 'gear' },
]

const activePage = computed(() => route.name)

/** Token 有效期提示（小时粒度，<1h 显示分钟） */
const tokenHint = computed(() => {
  if (!auth.tokenExpires) return '长期有效'
  const ms = parseInt(auth.tokenExpires) - Date.now()
  if (ms <= 0) return '已过期'
  const h = Math.floor(ms / 3600000)
  if (h >= 1) return `${h}h 后过期`
  return `${Math.max(1, Math.floor(ms / 60000))}m 后过期`
})

function switchPage(page) {
  if (page === 'records') ui.sidebarSelectedDate = null
  router.push({ name: page })
}

function openWrite() {
  ui.openWriteModal()
}

/** 作者 GitHub（侧栏底部署名入口，新窗口打开） */
const GITHUB_URL = 'https://github.com/EnvySage'
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>
      </div>
      <div>
        <div class="sidebar-logo-text">Mirror</div>
        <div class="sidebar-logo-sub">AI 日记</div>
      </div>
    </div>

    <nav class="sidebar-nav">
      <button
        v-for="item in NAV"
        :key="item.page"
        :class="['sidebar-nav-item', { active: activePage === item.page }]"
        @click="switchPage(item.page)"
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
          <template v-else-if="item.icon === 'gear'">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </template>
          <template v-else>
            <path :d="item.icon" />
          </template>
        </svg>
        <span>{{ item.label }}</span>
        <!-- 词典 pending 角标：有候选才显示（lexicon-design.md 5b 入口角标，不弹窗不打断） -->
        <span
          v-if="item.page === 'settings' && glossary.pendingCount"
          class="sidebar-nav-badge"
          :title="`${glossary.pendingCount} 条词典候选待确认`"
        >{{ glossary.pendingCount > 9 ? '9+' : glossary.pendingCount }}</span>
      </button>
    </nav>

    <div class="sidebar-spacer" />

    <button class="sidebar-write" @click="openWrite">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      写日记
    </button>

    <div class="sidebar-user">
      <div class="sidebar-avatar">{{ (auth.user?.username || 'U').slice(0, 1).toUpperCase() }}</div>
      <div>
        <div class="sidebar-user-name">{{ auth.user?.username || '未登录' }}</div>
        <div class="sidebar-user-hint">Token {{ tokenHint }}</div>
      </div>
    </div>

    <!-- 作者署名：Mirror is built by EnvySage -->
    <a
      class="sidebar-github"
      :href="GITHUB_URL"
      target="_blank"
      rel="noopener noreferrer"
      title="Mirror · built by EnvySage"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
      </svg>
      <span class="sidebar-github-id">EnvySage</span>
      <span class="sidebar-github-note">on GitHub</span>
    </a>
  </aside>
</template>

<style scoped>
.sidebar {
  display: none;
  width: var(--sidebar-width);
  flex-shrink: 0;
  flex-direction: column;
  border-right: 1px solid var(--line);
  background: #FFFFFF;
  padding: 22px 16px;
  overflow-y: auto;
}
@media (min-width: 900px) { .sidebar { display: flex; } }

.sidebar-logo { display: flex; align-items: center; gap: 10px; padding: 2px 8px 20px; }
.sidebar-logo-icon {
  width: 34px; height: 34px; border-radius: 11px;
  background: var(--accent); display: grid; place-items: center;
}
.sidebar-logo-icon svg { width: 18px; height: 18px; stroke: #FFFFFF; }
.sidebar-logo-text { font-family: var(--font-display); font-size: 20px; font-weight: 600; letter-spacing: .04em; }
.sidebar-logo-sub { font-size: 11px; color: var(--text-low); letter-spacing: .18em; margin-top: -2px; }

.sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
.sidebar-nav-item {
  position: relative;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  color: var(--text-mid); font-size: 14.5px; transition: background .15s, color .15s; text-align: left;
}
.sidebar-nav-item svg { width: 18px; height: 18px; stroke: currentColor; fill: none; }
.sidebar-nav-item:hover { background: var(--ink-2); color: var(--text-hi); }
.sidebar-nav-item.active { background: var(--accent-soft); color: var(--accent); font-weight: 500; }
.sidebar-nav-item.active::before {
  content: ""; position: absolute; left: 0; top: 9px; bottom: 9px;
  width: 3px; border-radius: 2px; background: var(--accent);
}
.sidebar-nav-badge {
  margin-left: auto;
  min-width: 17px; height: 17px; padding: 0 5px;
  border-radius: var(--radius-full);
  background: var(--danger); color: #FFFFFF;
  font-family: var(--font-mono); font-size: 10px; line-height: 17px; text-align: center;
  animation: cardIn .25s ease;
}
.sidebar-spacer { flex: 1; min-height: 14px; }

.sidebar-write {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px; border-radius: 12px;
  background: var(--accent); color: #FFFFFF; font-weight: 600; font-size: 15px;
  transition: transform .15s, background .15s;
}
.sidebar-write:hover { background: var(--accent-hover); }
.sidebar-write:active { transform: scale(.97); }
.sidebar-write svg { width: 17px; height: 17px; stroke: #FFFFFF; fill: none; }

.sidebar-user {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 8px 0; border-top: 1px solid var(--line); margin-top: 16px;
}
.sidebar-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--accent-soft); display: grid; place-items: center;
  font-size: 13px; color: var(--accent); font-weight: 600;
}
.sidebar-user-name { font-size: 14px; }
.sidebar-user-hint { font-size: 11px; color: var(--text-low); }

/* 底部署名（GitHub） */
.sidebar-github {
  display: flex; align-items: baseline; gap: 7px;
  margin-top: 10px; padding: 7px 8px; border-radius: var(--radius-sm);
  transition: background .15s, color .15s;
}
.sidebar-github svg { width: 14px; height: 14px; fill: var(--text-low); flex-shrink: 0; align-self: center; }
.sidebar-github-id { font-family: var(--font-mono); font-size: 12px; color: var(--text-mid); }
.sidebar-github-note { font-size: 11px; color: var(--text-low); }
.sidebar-github:hover { background: var(--ink-2); }
.sidebar-github:hover svg,
.sidebar-github:hover .sidebar-github-note { fill: var(--text-hi); color: var(--text-hi); }
.sidebar-github:hover .sidebar-github-id { color: var(--text-hi); }
</style>
