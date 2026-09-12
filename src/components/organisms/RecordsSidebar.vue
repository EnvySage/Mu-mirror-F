<script setup>
/**
 * 记录页右侧栏（≥1440px，320px，sticky top）
 *
 * 四卡自上而下（白卡细边晨纸 token）：
 *  1. 今日概览 —— 今天 N 条 + 8 类型分布 mini 条（CONTENT_TYPES 顺序，typeMap 色 = 墨蓝深浅阶梯）
 *  2. 每日总结 —— summaries store 最近 7 篇（日期 + 2 行摘要），点击内联展开全文（复用 fetchDetail）
 *  3. 本周情绪带 —— 7 个色点（每天出现最多的情绪，moodColor 13 色），下标周一~周日，无记录天灰点
 *  4. 待办速览 —— todo.chains 证据链卡（TodoChainCard，两层：L1 行 + L2 时间线）
 *     卡头 pending 角标 + 状态圈直调；orphan/completed 建议（todo 不在 chains）降级独立建议卡
 *
 * 数据源：stats/summaries 仍由父级 onMounted 触发；todo store（chains+建议+registry）由本组件
 * 自拉（独立生命周期，操作后需即时刷新不受 stats 30s 缓存牵连）。
 * 交互上行：open-record / open-summaries / open-record（链节点证据行复用同一跳转）。
 */
import { computed, ref, onMounted } from 'vue'
import { useRecordsStore } from '@/stores/records'
import { useSummariesStore } from '@/stores/summaries'
import { useSettingsStore } from '@/stores/settings'
import { useTodoStore } from '@/stores/todo'
import TodoSuggestionCard from '@/components/molecules/TodoSuggestionCard.vue'
import TodoChainCard from '@/components/molecules/TodoChainCard.vue'
import { MOOD_COLOR } from '@/constants/moodColor'
import { moodMap, typeMap, CONTENT_TYPES } from '@/constants/tags'
import { parseDate } from '@/utils/time'

const emit = defineEmits(['open-record', 'open-summaries'])

const recordsStore = useRecordsStore()
const summariesStore = useSummariesStore()
const settingsStore = useSettingsStore()
const todoStore = useTodoStore()

/**
 * 建议卡只在 auto 模式出现
 * auto 没有审核窗口，侧栏是唯一的裁决动线；manual 模式用户会走审核，
 * 待办状态在「确认入库」时由后端统一更新，不需要（也不该）在这里单独裁决——
 * 记录尚未入库，此时改状态没有记录支撑。
 */
const showSuggestions = computed(() => settingsStore.settings.review_mode === 'auto')

/** 建议 + 证据链数据在本组件挂载时自拉（走查/真接口同路径；失败 toast 兜底不白屏） */
onMounted(() => {
  todoStore.fetch()
  todoStore.fetchChains()
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

// ==================== 4. 待办速览（证据链卡 + orphan 建议降级） ====================

/**
 * 证据链（TodoChainCard 数据源，todoStore.chains，createdAt DESC）。
 * 旧 stats.open_items 行列表已被链视图取代；状态圈直调浮层在卡内。
 * 上限 5 条与旧列表同口径（侧栏 320px 高度克制）。
 */
const chains = computed(() => todoStore.chains.slice(0, 5))

/**
 * orphan/completed 建议降级：pending 建议的 todo 不在 chains（未登记证据链、
 * 或已完成后从 open-chain 掉出）——这类建议没地方挂到链尾虚线节点，
 * 仍在卡头下方以独立建议卡展示（裁决动线不丢）。
 */
const orphanSuggestions = computed(() => {
  if (!showSuggestions.value) return []
  const inChains = new Set(todoStore.chains.map(c => String(c.todo_id ?? c.todoId ?? '')))
  return todoStore.pendingSuggestions.filter(
    s => !inChains.has(String(s.todo_id ?? s.todoId ?? '')))
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

    <!-- 4. 待办速览（证据链卡；orphan 建议降级为独立卡） -->
    <section class="card side-card">
      <div class="side-head">
        <span class="section-label">OPEN TODO</span>
        <span class="side-head-note">
          <span v-if="showSuggestions && todoStore.pendingCount" class="todo-badge" :title="`${todoStore.pendingCount} 条待办状态建议`">
            <i class="todo-badge-dot" />{{ todoStore.pendingCount }}
          </span>
          <span v-else>状态可直调</span>
        </span>
      </div>

      <!-- orphan 降级建议卡（todo 不在 chains 的建议；正常情况不渲染） -->
      <div v-if="orphanSuggestions.length" class="sug-list">
        <TodoSuggestionCard
          v-for="s in orphanSuggestions"
          :key="s.id"
          :suggestion="s"
          context="sidebar"
          @open-record="emit('open-record', $event)"
        />
      </div>

      <!-- 证据链列表（L1 行 + L2 卡内展开；直调浮层/建议三键在卡内） -->
      <div v-if="todoStore.chainsLoading && !chains.length" class="side-empty">加载中…</div>
      <div v-else-if="todoStore.error && !chains.length" class="side-empty">{{ todoStore.error }}</div>
      <div v-else-if="!chains.length" class="side-empty">没有挂起的待办</div>
      <div v-else class="chain-list">
        <TodoChainCard
          v-for="c in chains"
          :key="`chain-${c.todo_id ?? c.todoId ?? c.title}`"
          :chain="c"
          @open-record="emit('open-record', $event)"
        />
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

/* 建议卡（orphan 降级用；卡片本体样式在 TodoSuggestionCard 内，侧栏只管列表间距） */
.sug-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }

/* 证据链列表（卡内分隔线由 TodoChainCard 自带） */
.chain-list { display: flex; flex-direction: column; }
</style>
