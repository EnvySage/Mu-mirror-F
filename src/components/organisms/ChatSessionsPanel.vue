<script setup>
/**
 * ChatSessionsPanel —— 会话列表面板（抽屉与桌面常驻栏共用，T-F-R6 任务 B）
 *
 * 形态由 variant prop 控制：
 *  - 'drawer'：抽屉内嵌（带头部标题/新会话/关闭），close 可用
 *  - 'rail'：桌面 ≥1440px 右侧常驻栏（带紧凑头部：新话题按钮置顶），无关闭
 *
 * 内容 = 原抽屉逻辑原样迁移：今天/昨天/更早分组、组内 updated_at 倒序、
 * active 会话高亮、点击切换、删除按钮。
 * 数据走 chat store（fetchSessions 由父级触发），组件内不发请求。
 */
import { computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { timeAgo } from '@/utils/time'

const props = defineProps({
  /** drawer = 抽屉形态（带关闭）；rail = 常驻栏形态 */
  variant: { type: String, default: 'drawer' },
  /** 当前打开会话的会话标题（rail 头部展示） */
  activeTitle: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const chat = useChatStore()

const isRail = computed(() => props.variant === 'rail')

// ==================== 日期分组：今天 / 昨天 / 更早（自 ChatView 迁入） ====================

/** 按本地日期归类（yyyy-MM-dd），与后端北京时间字符串直接比对 */
function localDateKey(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
    value = new Date(value.replace(' ', 'T'))
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ''
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function dayKeyOffset(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const todayKey = dayKeyOffset(0)
const yesterdayKey = dayKeyOffset(-1)

/** 分组后的会话列表：组间按 今天 → 昨天 → 更早，组内 updated_at 倒序 */
const groupedSessions = computed(() => {
  const groups = [
    { key: 'today', label: '今天', items: [] },
    { key: 'yesterday', label: '昨天', items: [] },
    { key: 'earlier', label: '更早', items: [] },
  ]
  const byKey = Object.fromEntries(groups.map(g => [g.key, g]))
  const sorted = [...chat.sessions].sort((a, b) =>
    String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
  )
  for (const s of sorted) {
    const k = localDateKey(s.updated_at || s.created_at)
    if (k === todayKey) byKey.today.items.push(s)
    else if (k === yesterdayKey) byKey.yesterday.items.push(s)
    else byKey.earlier.items.push(s)
  }
  return groups.filter(g => g.items.length > 0)
})
</script>

<template>
  <div :class="['sessions-panel', `sessions-panel-${variant}`]">
    <div class="sessions-head">
      <span class="sessions-title">历史会话</span>
      <div class="sessions-head-actions">
        <button class="sessions-new" @click="emit('new-session')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:12px;height:12px"><path d="M12 5v14M5 12h14"/></svg>
          新话题
        </button>
        <button v-if="!isRail" class="sessions-close" @click="emit('close')">关闭</button>
      </div>
    </div>

    <!-- rail 形态：当前会话名（空态给引导词） -->
    <div v-if="isRail" class="sessions-active">
      {{ activeTitle || '新话题草稿' }}
    </div>

    <div class="sessions-list">
      <div v-if="chat.sessionsLoading && !chat.sessions.length" class="sessions-empty">加载中…</div>
      <div v-else-if="!chat.sessions.length" class="sessions-empty">还没有会话 · 开始第一次提问吧</div>
      <template v-else>
        <section v-for="group in groupedSessions" :key="group.key" class="session-group">
          <div class="session-group-label">{{ group.label }}</div>
          <div
            v-for="s in group.items"
            :key="s.id"
            :class="['session-item', { active: s.id === chat.activeSessionId }]"
            @click="emit('open-session', s.id)"
          >
            <div class="session-item-main">
              <div class="session-item-title">{{ s.title || '未命名会话' }}</div>
              <div class="session-item-time">{{ timeAgo(s.updated_at) }}</div>
            </div>
            <button class="session-item-del" title="删除会话" @click.stop="emit('remove-session', s.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 样式与原抽屉一致；形态差异（padding/头部）由 variant 类控制 */
.sessions-panel { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.sessions-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px 8px; }
.sessions-panel-rail .sessions-head { padding: 14px 16px 4px; }
.sessions-title { font-family: var(--font-display); font-size: 16px; }
.sessions-head-actions { display: flex; gap: 14px; align-items: center; }
.sessions-new {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12.5px; color: var(--accent); cursor: pointer;
}
.sessions-new:hover { color: var(--accent-hover); }
.sessions-new svg { width: 12px; height: 12px; }
.sessions-close { font-size: 14.5px; color: var(--text-mid); padding: 6px 2px; cursor: pointer; }

/* rail 当前会话名（单行截断） */
.sessions-active {
  padding: 0 16px 8px;
  font-size: 12px; color: var(--text-low);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  border-bottom: 1px solid var(--line);
}

.sessions-list { overflow-y: auto; padding: 4px 12px 18px; }
.sessions-empty {
  text-align: center; color: var(--text-low); font-size: 13px;
  padding: 30px 0;
}
.session-group { margin-bottom: 6px; }
.session-group-label {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .16em;
  color: var(--text-low);
  margin: 14px 8px 4px;
  display: flex; align-items: center; gap: 10px;
}
.session-group-label::after { content: ""; flex: 1; height: 1px; background: var(--line); }
.session-group:first-child .session-group-label { margin-top: 6px; }
.session-item {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 8px; border-radius: var(--radius-sm);
  cursor: pointer; transition: background .15s;
}
.session-item:hover { background: var(--ink-2); }
.session-item.active { box-shadow: inset 0 0 0 1.5px var(--accent); background: var(--accent-soft); }
.session-item-main { flex: 1; min-width: 0; }
.session-item-title {
  font-size: 13.5px; color: var(--text-hi);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.session-item-time { font-family: var(--font-mono); font-size: 11px; color: var(--text-low); margin-top: 3px; }
.session-item-del {
  width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
  display: grid; place-items: center; opacity: 0; transition: opacity .15s;
}
.session-item:hover .session-item-del { opacity: 1; }
.session-item-del svg { width: 13px; height: 13px; stroke: var(--danger); fill: none; }
.session-item-del:hover { background: var(--danger-bg); }
/* 触屏无 hover：常驻栏内删除钮常显（rail 是桌面形态，保留 hover 规则即可） */
</style>
