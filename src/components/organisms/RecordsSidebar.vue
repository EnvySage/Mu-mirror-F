<script setup>
/**
 * 记录页右侧栏（≥1440px，320px，sticky top）
 *
 * 四卡自上而下（白卡细边晨纸 token）：
 *  1. 今日概览 —— 今天 N 条 + 8 类型分布 mini 条（CONTENT_TYPES 顺序，typeMap 色 = 墨蓝深浅阶梯）
 *  2. 每日总结 —— summaries store 最近 7 篇（日期 + 2 行摘要），点击内联展开全文（复用 fetchDetail）
 *  3. 本周情绪带 —— 7 个色点（每天出现最多的情绪，moodColor 13 色），下标周一~周日，无记录天灰点
 *  4. 待办速览 —— todo store 建议卡（pending 角标 + 三态 chip 裁决）+ stats store
 *     todo.open_items 最多 5 条；状态圈升级为可点三态浮层（直调 PUT，裁决 6 auto/manual 通用）
 *
 * 数据源：stats/summaries 仍由父级 onMounted 触发；todo store（建议+registry）由本组件
 * 自拉（独立生命周期，操作后需即时刷新不受 stats 30s 缓存牵连）。
 * 交互上行：open-record / open-summaries / open-record（建议证据行复用同一跳转）。
 */
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRecordsStore } from '@/stores/records'
import { useSummariesStore } from '@/stores/summaries'
import { useStatsStore } from '@/stores/stats'
import { useTodoStore } from '@/stores/todo'
import { useToastStore } from '@/stores/toast'
import { MOOD_COLOR } from '@/constants/moodColor'
import { moodMap, typeMap, CONTENT_TYPES, taskStatusMap, TASK_STATUSES } from '@/constants/tags'
import { parseDate } from '@/utils/time'

const emit = defineEmits(['open-record', 'open-summaries'])

const recordsStore = useRecordsStore()
const summariesStore = useSummariesStore()
const statsStore = useStatsStore()
const todoStore = useTodoStore()
const toast = useToastStore()

/** 建议数据在本组件挂载时自拉（走查/真接口同路径；失败 toast 兜底不白屏） */
onMounted(() => {
  todoStore.fetch()
})

// ==================== 1. 今日概览 ====================

/** 本地日期 key（yyyy-MM-dd）；兼容 Date 对象与后端 "yyyy-MM-dd HH:mm:ss" 字符串 */
function localDayKey(dateLike) {
  const d = dateLike instanceof Date ? dateLike : parseDate(dateLike)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const todayKey = localDayKey(new Date())
const todayRecords = computed(() => recordsStore.records.filter(r => localDayKey(r.created_at) === todayKey))

/** 8 类型分布（CONTENT_TYPES 固定顺序，缺类型不计入） */
const typeDist = computed(() => {
  const count = {}
  todayRecords.value.forEach(r => (r.chunks || []).forEach(c => {
    const t = c.metadata?.contentType
    if (t) count[t] = (count[t] || 0) + 1
  }))
  const total = Object.values(count).reduce((a, b) => a + b, 0)
  if (!total) return []
  return CONTENT_TYPES
    .map(t => ({ key: t.key, count: count[t.key] || 0 }))
    .filter(t => t.count > 0)
    .map(t => ({ ...t, label: typeMap[t.key], pct: (t.count / total) * 100 }))
})

/** 类型色（晨纸：唯一 accent，用墨蓝 alpha 阶梯区分类型，保持单色系克制） */
const TYPE_ALPHAS = [1, .82, .66, .54, .44, .36, .28, .22]
function typeColor(i) {
  const a = TYPE_ALPHAS[i % TYPE_ALPHAS.length]
  return `rgba(44, 95, 232, ${a})`
}

// ==================== 2. 每日总结 ====================

const recentSummaries = computed(() => summariesStore.list.slice(0, 7))
/** 当前内联展开的日报日期 */
const expandedDate = ref(null)

async function toggleSummary(item) {
  if (expandedDate.value === item.summary_date) {
    expandedDate.value = null
    return
  }
  expandedDate.value = item.summary_date
  // 列表接口 content 为空，首次展开拉全文
  if (!item.content) await summariesStore.fetchDetail(item.summary_date)
}

/** 摘要前 2 行 */
function briefLines(item) {
  const lines = item.highlights && item.highlights.length ? item.highlights : []
  return lines.slice(0, 2)
}

// ==================== 3. 本周情绪带 ====================

/** 本周周一（周一为一周起点） */
function mondayOfThisWeek() {
  const d = new Date()
  const dow = (d.getDay() + 6) % 7 // 周一=0
  d.setDate(d.getDate() - dow)
  return d
}

/** 7 天（周一~周日）：每天出现最多的情绪（无则 null → 灰点） */
const weekMoods = computed(() => {
  const monday = mondayOfThisWeek()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const count = {}
    recordsStore.records.forEach(r => {
      if (localDayKey(r.created_at) !== key) return
      ;(r.chunks || []).forEach(c => (c.metadata?.mood || []).forEach(m => { count[m] = (count[m] || 0) + 1 }))
    })
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0]
    return {
      key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      mood: top ? top[0] : null,
      count: top ? top[1] : 0,
      color: top ? (MOOD_COLOR[top[0]] || '#A8A8A0') : null,
      moodLabel: top ? (moodMap[top[0]] || top[0]) : '无记录',
    }
  })
})

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

// ==================== 4. 待办速览（建议卡 + 直调三态） ====================

/**
 * 待办项（混合源）：优先 todo store registry 条目（有 registry.id 可直调状态），
 * 用 title 桥接 stats.open_items（stats 30s 缓存期间仍即时反映写操作）。
 * 字段口径 snake_case（stats 真接口）与 camelCase（历史 mock 兜底）双兼容。
 */
const todoItems = computed(() => {
  const t = statsStore.todo
  const items = t.open_items || t.openItems || []
  return items.slice(0, 5).map(it => {
    const title = it.title || it.summary || ''
    const entry = todoStore.findTodoByTitle(title)
    return {
      key: `${entry?.id ?? 'x'}-${title}`,
      title,
      recordId: it.record_id ?? it.recordId,
      status: entry?.current_status ?? it.task_status ?? it.taskStatus ?? 'not_started',
      entryId: entry?.id ?? null,
      hasSuggestion: entry ? todoStore.pendingSuggestions.some(s => s.todo_id === entry.id) : false,
    }
  })
})

/** 状态圈 SVG 视觉键（未开始空心 / 进行中半圆 / 已完成勾） */
function statusKind(s) {
  return s === 'completed' ? 'done' : (s === 'in_progress' ? 'doing' : 'todo')
}

// ---- 建议卡三态 chip（LLM 建议态预选高亮，确认可改选） ----

/** 每张建议卡本地选中的状态（key=suggestion_id；初始 = LLM 建议态） */
const pickedStatus = ref({})
function picked(s) {
  if (!pickedStatus.value[s.suggestion_id]) {
    pickedStatus.value[s.suggestion_id] = s.suggested_status
  }
  return pickedStatus.value[s.suggestion_id]
}
function pick(s, status) {
  pickedStatus.value[s.suggestion_id] = status
}

/** 证据行摘录截 40 字 */
function excerptShort(text) {
  const t = String(text || '')
  return t.length > 40 ? t.slice(0, 40) + '…' : t
}

/** 证据/建议日期（x月x日） */
function shortDate(s) {
  const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${Number(m[2])}月${Number(m[3])}日` : ''
}

/** [确认]：带当前选中态提交（裁决期事务三写都在 B 端点内，前端只发请求） */
async function onConfirmSuggestion(s) {
  const ok = await todoStore.resolve(s, 'confirmed', picked(s))
  if (ok) {
    // stats.open_items 镜像同步（侧栏待办行即时变状态）
    todoStore.syncStatsOpenItem(s.todo_title, picked(s))
    toast.success(`「${s.todo_title}」已更新为${taskStatusMap[picked(s)] || picked(s)}`)
  } else {
    toast.error(todoStore.error || '确认失败，请重试')
  }
}

/** [忽略]：建议 dismissed（永久静默同一证据），待办状态不动 */
async function onDismissSuggestion(s) {
  const ok = await todoStore.resolve(s, 'dismissed')
  if (ok) toast.info(`已忽略「${s.todo_title}」的状态建议`)
  else toast.error(todoStore.error || '操作失败，请重试')
}

/** 证据行点击 → 打开证据所在记录详情 */
function openEvidence(s) {
  const rid = s.evidence?.record_id
  if (rid) emit('open-record', rid)
}

// ---- 直调三态浮层（裁决 6：auto 无审核窗口，此处是唯一动线；manual 也可用） ----

/** 当前展开三态浮层的待办 key（null = 全收起；同时只开一个） */
const statusPopKey = ref(null)

function toggleStatusPop(item) {
  statusPopKey.value = statusPopKey.value === item.key ? null : item.key
}

function closeStatusPop(e) {
  // 浮层内点击不关（closest 判定），点外部收起
  if (e.target.closest?.('.todo-status-pop') || e.target.closest?.('.todo-circle-btn')) return
  statusPopKey.value = null
}
document.addEventListener('click', closeStatusPop, true)
onBeforeUnmount(() => {
  document.removeEventListener('click', closeStatusPop, true)
})

/** 浮层选中 → setTodoStatus 直调（乐观更新+回滚在 store；后端双写+建议作废） */
async function onPickStatus(item, status) {
  statusPopKey.value = null
  if (!item.entryId) return
  const entry = todoStore.todos.find(t => t.id === item.entryId)
  if (!entry || entry.current_status === status) return
  const ok = await todoStore.setStatus(entry, status)
  if (ok) {
    todoStore.syncStatsOpenItem(item.title, status)
    toast.success(`「${item.title}」已标记为${taskStatusMap[status]}`)
  } else {
    toast.error(todoStore.error || '状态更新失败，请重试')
  }
}
</script>

<template>
  <aside class="records-sidebar">
    <!-- 1. 今日概览 -->
    <section class="card side-card">
      <div class="side-head">
        <span class="section-label">TODAY</span>
        <span class="side-head-note">今日概览</span>
      </div>
      <div class="today-count">
        <span class="today-num">{{ todayRecords.length }}</span>
        <span class="today-unit">条记录</span>
      </div>
      <template v-if="typeDist.length">
        <div class="type-bar" aria-label="今日类型分布">
          <span
            v-for="(t, i) in typeDist"
            :key="t.key"
            class="type-seg"
            :style="{ flex: t.pct, background: typeColor(i) }"
            :title="`${t.label} ${t.count}`"
          />
        </div>
        <div class="type-legend">
          <span v-for="(t, i) in typeDist" :key="t.key" class="type-legend-item">
            <i class="type-dot" :style="{ background: typeColor(i) }" />{{ t.label }} {{ t.count }}
          </span>
        </div>
      </template>
      <div v-else class="side-empty">今天还没有记录</div>
    </section>

    <!-- 2. 每日总结 -->
    <section class="card side-card">
      <div class="side-head">
        <span class="section-label">DAILY SUMMARY</span>
        <button class="side-more" @click="emit('open-summaries')">全部</button>
      </div>
      <div v-if="summariesStore.loading && !recentSummaries.length" class="side-empty">加载中…</div>
      <div v-else-if="summariesStore.error && !recentSummaries.length" class="side-empty">{{ summariesStore.error }}</div>
      <div v-else-if="!recentSummaries.length" class="side-empty">还没有每日总结</div>
      <div v-else class="sum-list">
        <div v-for="item in recentSummaries" :key="item.summary_date" class="sum-item">
          <button class="sum-row" @click="toggleSummary(item)">
            <span class="sum-date">{{ item.summary_date.slice(5) }}</span>
            <span v-if="item.stats?.record_count != null" class="sum-count">{{ item.stats.record_count }} 条</span>
          </button>
          <template v-if="expandedDate === item.summary_date">
            <div v-if="summariesStore.detailLoading" class="side-empty side-empty-tight">加载全文…</div>
            <p v-else-if="item.content" class="sum-full">{{ item.content }}</p>
            <div v-else class="side-empty side-empty-tight">全文加载失败</div>
          </template>
          <template v-else-if="briefLines(item).length">
            <p class="sum-brief">
              <span v-for="(line, i) in briefLines(item)" :key="i" class="sum-line">{{ line }}</span>
            </p>
          </template>
        </div>
      </div>
    </section>

    <!-- 3. 本周情绪带 -->
    <section class="card side-card">
      <div class="side-head">
        <span class="section-label">MOOD WEEK</span>
        <span class="side-head-note">每天最多的情绪</span>
      </div>
      <div class="week-moods">
        <div v-for="(d, i) in weekMoods" :key="d.key" class="week-col" :title="`${d.label} · ${d.moodLabel}${d.count ? ' ' + d.count : ''}`">
          <span
            :class="['week-dot', { 'week-dot-empty': !d.color }]"
            :style="d.color ? { background: d.color } : {}"
          />
          <span class="week-label">{{ WEEK_LABELS[i] }}</span>
        </div>
      </div>
    </section>

    <!-- 4. 待办速览 -->
    <section class="card side-card">
      <div class="side-head">
        <span class="section-label">OPEN TODO</span>
        <span class="side-head-note">
          <span v-if="todoStore.pendingCount" class="todo-badge" :title="`${todoStore.pendingCount} 条待办状态建议`">
            <i class="todo-badge-dot" />{{ todoStore.pendingCount }}
          </span>
          <span v-else>状态可直调</span>
        </span>
      </div>

      <!-- 建议卡（无建议不渲染整个分区） -->
      <div v-if="todoStore.pendingSuggestions.length" class="sug-list">
        <div
          v-for="s in todoStore.pendingSuggestions"
          :key="s.suggestion_id"
          :class="['sug-card', { 'sug-busy': todoStore.resolvingId === s.suggestion_id }]"
        >
          <div class="sug-head">
            <svg class="sug-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z" />
            </svg>
            <span class="sug-title-line">检测到「{{ s.todo_title }}」可能{{ taskStatusMap[s.suggested_status] || s.suggested_status }}</span>
          </div>
          <!-- 证据行：excerpt 截 40 字 + 日期，点击跳证据记录详情 -->
          <button
            v-if="s.evidence?.excerpt"
            class="sug-evidence"
            :title="s.evidence.excerpt"
            @click="openEvidence(s)"
          >
            <span class="sug-evidence-text">"{{ excerptShort(s.evidence.excerpt) }}"</span>
            <span class="sug-evidence-date">{{ shortDate(s.evidence.created_at) }}</span>
          </button>
          <!-- 三态 chip（LLM 建议态预选高亮，确认前可改选） -->
          <div class="sug-chips">
            <button
              v-for="st in TASK_STATUSES"
              :key="st.key"
              :class="['sug-chip', { selected: picked(s) === st.key, suggested: s.suggested_status === st.key }]"
              :disabled="todoStore.resolvingId === s.suggestion_id"
              @click="pick(s, st.key)"
            >{{ st.label }}</button>
          </div>
          <div class="sug-actions">
            <button class="sug-btn sug-btn-primary" :disabled="todoStore.resolvingId === s.suggestion_id" @click="onConfirmSuggestion(s)">
              {{ todoStore.resolvingId === s.suggestion_id ? '提交中…' : '确认' }}
            </button>
            <button class="sug-btn sug-btn-ghost" :disabled="todoStore.resolvingId === s.suggestion_id" @click="onDismissSuggestion(s)">忽略</button>
          </div>
        </div>
      </div>

      <!-- 待办列表（直调三态 chip：状态圈可点开浮层） -->
      <div v-if="todoStore.loading && !todoItems.length" class="side-empty">加载中…</div>
      <div v-else-if="!todoItems.length" class="side-empty">没有挂起的待办</div>
      <div v-else class="todo-list">
        <div v-for="t in todoItems" :key="t.key" class="todo-item-wrap">
          <button
            class="todo-item"
            :title="t.title"
            @click="emit('open-record', t.recordId)"
          >
            <!-- 状态圈（升级为可点）：未开始空心 / 进行中半圆 / 已完成勾 -->
            <span class="todo-circle-btn" :title="`改状态 · 当前${taskStatusMap[t.status] || '未开始'}`" @click.stop="toggleStatusPop(t)">
              <svg v-if="statusKind(t.status) === 'done'" class="todo-circle" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="var(--success)" stroke-width="1.5" />
                <path d="M5.2 8.3l1.9 1.9 3.7-4.2" stroke="var(--success)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="statusKind(t.status) === 'doing'" class="todo-circle" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="var(--accent)" stroke-width="1.5" opacity=".35" />
                <path d="M8 1.5a6.5 6.5 0 0 1 0 13" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" />
              </svg>
              <svg v-else class="todo-circle" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="var(--text-low)" stroke-width="1.5" />
              </svg>
            </span>
            <span class="todo-text">{{ t.title }}</span>
            <!-- 有 pending 建议的待办：小闪电提示 -->
            <svg v-if="t.hasSuggestion" class="todo-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z" />
            </svg>
            <span class="todo-status">{{ taskStatusMap[t.status] || '未开始' }}</span>
          </button>
          <!-- 三态浮层（选中即直调 PUT；同时只开一个） -->
          <div v-if="statusPopKey === t.key" class="todo-status-pop">
            <button
              v-for="st in TASK_STATUSES"
              :key="st.key"
              :class="['todo-pop-item', { current: t.status === st.key }]"
              @click.stop="onPickStatus(t, st.key)"
            >
              <i :class="['pop-dot', `pop-dot-${st.key}`]" />{{ st.label }}
              <span v-if="t.status === st.key" class="pop-cur">当前</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.records-sidebar { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

.side-card { padding: 15px 16px 16px; }
.side-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  margin-bottom: 12px;
}
.side-head-note { font-size: 11.5px; color: var(--text-mid); font-weight: 500; }
.side-more { font-size: 12px; color: var(--accent); padding: 2px 0; }
.side-more:hover { text-decoration: underline; }
.side-empty { font-size: 12.5px; color: var(--text-low); text-align: center; padding: 14px 0; }
.side-empty-tight { padding: 6px 0; }

/* 1. 今日概览 */
.today-count { display: flex; align-items: baseline; gap: 6px; margin-bottom: 12px; }
.today-num {
  font-family: var(--font-display); font-size: 30px; font-weight: 600;
  color: var(--accent); font-variant-numeric: tabular-nums; line-height: 1;
}
.today-unit { font-size: 12.5px; color: var(--text-low); }
.type-bar {
  display: flex; height: 8px; border-radius: 4px; overflow: hidden; gap: 2px;
  margin-bottom: 10px;
}
.type-seg { min-width: 4px; transition: flex .4s ease; }
.type-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; }
.type-legend-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-mid); }
.type-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

/* 2. 每日总结 */
.sum-list { display: flex; flex-direction: column; }
.sum-item { padding: 6px 0 8px; border-bottom: 1px dashed var(--line); }
.sum-item:last-child { border-bottom: none; padding-bottom: 0; }
.sum-row { display: flex; align-items: baseline; gap: 8px; width: 100%; text-align: left; }
.sum-date {
  font-family: var(--font-mono); font-size: 12px; color: var(--text-hi); font-weight: 600;
}
.sum-row:hover .sum-date { color: var(--accent); }
.sum-count { font-family: var(--font-mono); font-size: 10.5px; color: var(--text-low); }
.sum-brief { margin-top: 3px; }
.sum-line {
  display: block; font-size: 12px; color: var(--text-mid); line-height: 1.6;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sum-full { margin-top: 5px; font-size: 12px; line-height: 1.75; color: var(--text-mid); white-space: pre-wrap; }

/* 3. 本周情绪带 */
.week-moods { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.week-col { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.week-dot {
  width: 13px; height: 13px; border-radius: 50%;
  transition: transform .15s ease;
}
.week-col:hover .week-dot { transform: scale(1.18); }
.week-dot-empty { background: var(--ink-2); box-shadow: inset 0 0 0 1px var(--line); }
.week-label { font-family: var(--font-mono); font-size: 9.5px; color: var(--text-low); }

/* 4. 待办速览 */
/* 卡头 pending 角标（小蓝点 + 数字，与词典候选角标同语言） */
.todo-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-mono); font-size: 10.5px; font-weight: 600;
  color: var(--accent); background: var(--accent-soft);
  padding: 1px 8px 1px 6px; border-radius: var(--radius-full);
}
.todo-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }

/* 建议卡 */
.sug-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.sug-card {
  border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--ink-2); padding: 10px 11px;
  transition: opacity .2s ease;
}
.sug-busy { opacity: .6; pointer-events: none; }
.sug-head { display: flex; align-items: flex-start; gap: 6px; }
.sug-spark { width: 12px; height: 12px; flex-shrink: 0; margin-top: 3px; stroke: var(--accent); fill: none; }
.sug-title-line { font-size: 12.5px; line-height: 1.55; color: var(--text-hi); font-weight: 500; word-break: break-word; }
.sug-evidence {
  display: block; width: 100%; text-align: left; margin-top: 7px;
  padding: 6px 8px; border-radius: var(--radius-sm);
  background: var(--card); box-shadow: inset 0 0 0 1px var(--line);
  transition: box-shadow .15s;
}
.sug-evidence:hover { box-shadow: inset 0 0 0 1px var(--accent); }
.sug-evidence-text { display: block; font-size: 11.5px; line-height: 1.6; color: var(--text-mid); }
.sug-evidence-date { display: block; margin-top: 3px; font-family: var(--font-mono); font-size: 10px; color: var(--text-low); }
.sug-chips { display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap; }
.sug-chip {
  font-size: 11px; padding: 3px 10px; border-radius: var(--radius-full);
  color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong);
  transition: all .12s;
}
.sug-chip:hover:not(:disabled) { color: var(--text-hi); background: var(--card); }
/* LLM 建议态未选中时的预选提示（虚线圈），选中 = 实心蓝（与全局 .chip.selected 同语言） */
.sug-chip.suggested { box-shadow: inset 0 0 0 1px var(--accent); color: var(--accent); }
.sug-chip.selected { background: var(--accent); color: #FFFFFF; box-shadow: none; font-weight: 600; }
.sug-chip:disabled { opacity: .55; cursor: not-allowed; }
.sug-actions { display: flex; gap: 7px; margin-top: 9px; }
.sug-btn {
  font-size: 12px; padding: 4px 14px; border-radius: var(--radius-full);
  transition: background .15s, opacity .15s;
}
.sug-btn:disabled { opacity: .5; cursor: not-allowed; }
.sug-btn-primary { background: var(--accent); color: #FFFFFF; font-weight: 600; }
.sug-btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.sug-btn-ghost { color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong); }
.sug-btn-ghost:hover:not(:disabled) { background: var(--card); color: var(--text-hi); }

/* 待办列表（直调三态） */
.todo-list { display: flex; flex-direction: column; }
.todo-item-wrap { position: relative; border-bottom: 1px dashed var(--line); }
.todo-item-wrap:last-child { border-bottom: none; }
.todo-item {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 0; width: 100%; text-align: left;
}
.todo-item:hover .todo-text { color: var(--accent); }
/* 状态圈按钮化（直调入口）：hover 微提示，点开三态浮层 */
.todo-circle-btn { display: grid; place-items: center; width: 17px; height: 17px; flex-shrink: 0; border-radius: 50%; transition: transform .12s ease; }
.todo-circle-btn:hover { transform: scale(1.18); }
.todo-circle { width: 15px; height: 15px; }
.todo-text {
  flex: 1; min-width: 0; font-size: 12.5px; color: var(--text-hi);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: color .15s;
}
.todo-spark { width: 10px; height: 10px; flex-shrink: 0; stroke: var(--accent); fill: none; }
.todo-status { font-family: var(--font-mono); font-size: 10px; color: var(--text-low); flex-shrink: 0; }

/* 三态浮层（小卡弹出，晨纸白卡细边） */
.todo-status-pop {
  position: absolute; right: 0; top: 26px; z-index: 5;
  min-width: 128px; padding: 4px;
  background: var(--card); border: 1px solid var(--line);
  border-radius: var(--radius-sm); box-shadow: var(--shadow-float);
  display: flex; flex-direction: column;
  animation: popIn .14s ease;
}
@keyframes popIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
.todo-pop-item {
  display: flex; align-items: center; gap: 7px;
  font-size: 12px; color: var(--text-mid);
  padding: 6px 9px; border-radius: 6px; text-align: left;
  transition: background .12s;
}
.todo-pop-item:hover { background: var(--ink-2); color: var(--text-hi); }
.todo-pop-item.current { color: var(--accent); font-weight: 600; }
.pop-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.pop-dot-not_started { box-shadow: inset 0 0 0 1.5px var(--text-low); }
.pop-dot-in_progress { background: conic-gradient(var(--accent) 0 50%, transparent 50% 100%); box-shadow: inset 0 0 0 1.5px var(--accent); }
.pop-dot-completed { background: var(--success); }
.pop-cur { margin-left: auto; font-family: var(--font-mono); font-size: 9.5px; color: var(--accent); }
</style>
