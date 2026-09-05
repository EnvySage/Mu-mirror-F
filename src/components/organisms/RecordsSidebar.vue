<script setup>
/**
 * 记录页右侧栏（≥1440px，320px，sticky top）
 *
 * 四卡自上而下（白卡细边晨纸 token）：
 *  1. 今日概览 —— 今天 N 条 + 8 类型分布 mini 条（CONTENT_TYPES 顺序，typeMap 色 = 墨蓝深浅阶梯）
 *  2. 每日总结 —— summaries store 最近 7 篇（日期 + 2 行摘要），点击内联展开全文（复用 fetchDetail）
 *  3. 本周情绪带 —— 7 个色点（每天出现最多的情绪，moodColor 13 色），下标周一~周日，无记录天灰点
 *  4. 待办速览 —— stats store todo.open_items 最多 5 条，前置状态 SVG 圈（空心/半圆/勾），只读
 *
 * 数据均由父级（RecordsView onMounted）触发拉取，组件内不发请求；
 * 交互上行：open-record / open-summaries。
 */
import { computed, ref } from 'vue'
import { useRecordsStore } from '@/stores/records'
import { useSummariesStore } from '@/stores/summaries'
import { useStatsStore } from '@/stores/stats'
import { MOOD_COLOR } from '@/constants/moodColor'
import { moodMap, typeMap, CONTENT_TYPES, taskStatusMap } from '@/constants/tags'
import { parseDate } from '@/utils/time'

const emit = defineEmits(['open-record', 'open-summaries'])

const recordsStore = useRecordsStore()
const summariesStore = useSummariesStore()
const statsStore = useStatsStore()

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

// ==================== 4. 待办速览 ====================

/** 最多 5 条 open items（stats store 真接口 snake_case：open_items/task_status/record_id） */
const todoItems = computed(() => {
  const t = statsStore.todo
  const items = t.open_items || t.openItems || []
  return items.slice(0, 5)
})
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
        <span class="side-head-note">只读速览</span>
      </div>
      <div v-if="!todoItems.length" class="side-empty">没有挂起的待办</div>
      <div v-else class="todo-list">
        <button
          v-for="(t, i) in todoItems"
          :key="i"
          class="todo-item"
          :title="t.summary || t.title"
          @click="emit('open-record', t.record_id ?? t.recordId)"
        >
          <!-- 状态圈：未开始空心 / 进行中半圆 / 已完成勾 -->
          <svg v-if="(t.task_status ?? t.taskStatus) === 'completed'" class="todo-circle" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="var(--success)" stroke-width="1.5" />
            <path d="M5.2 8.3l1.9 1.9 3.7-4.2" stroke="var(--success)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else-if="(t.task_status ?? t.taskStatus) === 'in_progress'" class="todo-circle" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="var(--accent)" stroke-width="1.5" opacity=".35" />
            <path d="M8 1.5a6.5 6.5 0 0 1 0 13" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <svg v-else class="todo-circle" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="var(--text-low)" stroke-width="1.5" />
          </svg>
          <span class="todo-text">{{ t.title }}</span>
          <span class="todo-status">{{ taskStatusMap[t.task_status ?? t.taskStatus] || '未开始' }}</span>
        </button>
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
.todo-list { display: flex; flex-direction: column; }
.todo-item {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 0; width: 100%; text-align: left;
  border-bottom: 1px dashed var(--line);
}
.todo-item:last-child { border-bottom: none; }
.todo-item:hover .todo-text { color: var(--accent); }
.todo-circle { width: 15px; height: 15px; flex-shrink: 0; }
.todo-text {
  flex: 1; min-width: 0; font-size: 12.5px; color: var(--text-hi);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: color .15s;
}
.todo-status { font-family: var(--font-mono); font-size: 10px; color: var(--text-low); flex-shrink: 0; }
</style>
