<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useRecordsStore } from '@/stores/records'
import { useSummariesStore } from '@/stores/summaries'
import { useStatsStore } from '@/stores/stats'
import { useTodoStore } from '@/stores/todo'
import { useToastStore } from '@/stores/toast'
import { MOOD_COLOR } from '@/constants/moodColor'
import { moodMap, typeMap, taskStatusMap } from '@/constants/tags'
import { dateLabel, formatFullDate } from '@/utils/time'
import RecordCard from '@/components/molecules/RecordCard.vue'
import RecordsSidebar from '@/components/organisms/RecordsSidebar.vue'
import PageMasthead from '@/components/molecules/PageMasthead.vue'

const props = defineProps({
  date: { type: String, default: null },
})

const ui = useUIStore()
const recordsStore = useRecordsStore()
const summariesStore = useSummariesStore()
const statsStore = useStatsStore()
const todoStore = useTodoStore()
const toast = useToastStore()

const recordFilter = ref('all')
const recordFilters = [{ key:'all',label:'全部记录' },{ key:'reviewing',label:'待审核' },{ key:'done',label:'已入库' }]
const dayNumber = new Intl.DateTimeFormat('en', { timeZone:'Asia/Shanghai',day:'2-digit' }).format(new Date())
const dayMonth = new Intl.DateTimeFormat('en', { timeZone:'Asia/Shanghai',month:'short' }).format(new Date())

/** 按日期分组（倒序） */
const grouped = computed(() => {
  const groups = {}
  recordsStore.records.forEach(r => {
    if (recordFilter.value !== 'all' && r.status !== recordFilter.value) return
    const key = dateKey(r.created_at)
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  })
  return Object.keys(groups)
    .sort()
    .reverse()
    .map(k => ({ dateKey: k, label: dateLabel(groups[k][0].created_at), items: groups[k] }))
})

function dateKey(dateStr) {
  const d = new Date(String(dateStr).replace(' ', 'T'))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const countText = computed(() => {
  const n = recordsStore.totalCount
  if (!n) return ''
  const todayCount = recordsStore.records.filter(r => dateKey(r.created_at) === dateKey(new Date().toISOString())).length
  return `${n} 条记录 · 今天 ${todayCount} 条`
})

const filterDate = computed(() => props.date || (ui.sidebarSelectedDate ? formatDateStr(ui.sidebarSelectedDate) : null))

const subtitle = computed(() => {
  if (filterDate.value) return formatFullDate(new Date(filterDate.value + 'T00:00:00'))
  return countText.value
})

function formatDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadByDate(dateStr) {
  recordsStore.fetchRecords({ startDate: dateStr, endDate: dateStr })
}

function loadAll() {
  recordsStore.fetchRecords()
}

// ---- 侧栏形态：≥1440px 常驻右栏；窄屏（手机/平板）FAB + 抽屉 ----
/** 与旧 CSS 断点同口径：1440px 以上侧栏常驻 */
const WIDE_QUERY = '(min-width: 1440px)'
const wideMql = window.matchMedia(WIDE_QUERY)
const isWide = ref(wideMql.matches)
/** 抽屉开合（仅窄屏有意义；转宽屏时强制收起，避免与常驻栏重复） */
const showSidebarDrawer = ref(false)

function onWideChange(e) {
  isWide.value = e.matches
  if (e.matches) showSidebarDrawer.value = false
}

onMounted(() => {
  filterDate.value ? loadByDate(filterDate.value) : loadAll()
  // 侧栏数据源：每日总结（只取最近 7 篇，全量浏览由「全部」弹窗游标分页）+ stats（30s 缓存，两页共用）
  summariesStore.fetchList({ limit: 7 })
  statsStore.fetchStats()
  wideMql.addEventListener('change', onWideChange)
})

watch(() => props.date, (d) => {
  d ? loadByDate(d) : loadAll()
})

watch(() => ui.sidebarSelectedDate, (newDate) => {
  if (newDate) loadByDate(formatDateStr(newDate))
  else loadAll()
})

// ---- 列表级轮询：存在 processing 记录时每 3s 重拉 ----
let pollTimer = null

function stopListPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function scheduleListPolling() {
  stopListPolling()
  if (!recordsStore.processingRecords.length) return
  pollTimer = setTimeout(async () => {
    await recordsStore.fetchRecords(filterDate.value
      ? { startDate: filterDate.value, endDate: filterDate.value }
      : undefined)
    scheduleListPolling()
  }, 3000)
}

watch(() => recordsStore.processingRecords.length, (n) => {
  if (n > 0 && !pollTimer) scheduleListPolling()
  if (n === 0) stopListPolling()
}, { immediate: true })

/**
 * AI 全部处理完成后刷新待办数据
 * 待办登记与状态建议都在处理过程中落库，处理完成前拉不到；
 * 侧栏待办列表读 stats.todo.open_items（30s 缓存），不强制刷新就停在旧数据上，
 * 只有整页刷新才看得到新待办。
 */
watch(() => recordsStore.processingRecords.length, (n, prev) => {
  if (n !== 0 || !prev) return
  todoStore.fetch()
  statsStore.fetchStats(30, true)
})

onBeforeUnmount(() => {
  stopListPolling()
  wideMql.removeEventListener('change', onWideChange)
  // 卸载时抽屉可能仍开着：body 滚动锁必须复位，否则切页后整页滚不动
  document.body.style.overflow = ''
})

function openRecord(id) {
  ui.selectedRecordId = id
  ui.showDetail = true
}

/** 侧栏 todo 项点击 → 打开来源记录详情 */
function openTodoRecord(recordId) {
  if (!recordId) return
  ui.selectedRecordId = recordId
  ui.showDetail = true
}

/** 侧栏「查看全部」→ 打开全局每日总结 sheet（复用现有入口） */
function openSummarySheet() {
  ui.openSummarySheet()
}

/** 抽屉内交互：先收起抽屉再执行（详情页/sheet 都是全屏层，叠在抽屉上会打架） */
function onDrawerOpenRecord(recordId) {
  showSidebarDrawer.value = false
  openTodoRecord(recordId)
}

function onDrawerOpenSummaries() {
  showSidebarDrawer.value = false
  openSummarySheet()
}

/** 抽屉打开时锁 body 滚动（抽屉内自滚，背景不跟着动） */
watch(showSidebarDrawer, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

/** 瀑布入场：分组的全局序号（前序组卡片数累计），供 40ms 递增 delay */
function groupIndex(group) {
  let n = 0
  for (const g of grouped.value) {
    if (g.dateKey === group.dateKey) break
    n += g.items.length
  }
  return n
}

/** 列表内软删除（REVIEWING / FAILED） */
async function onDeleteRecord(record) {
  if (!window.confirm('确定删除这条记录？软删除后不可恢复。')) return
  const ok = await recordsStore.deleteRecord(record.id)
  if (ok) toast.success('记录已删除')
  else toast.error(recordsStore.error || '删除失败，请重试')
}

/** failed 重试：POST /records/{id}/retry（store 内含回退逻辑） */
async function onRetryRecord(record) {
  const updated = await recordsStore.retryRecord(record.id)
  if (updated) toast.info('已重新提交，AI 处理中…')
  else toast.error(recordsStore.error || '重试失败，请重试')
}
</script>

<template>
  <div class="page records-page">
    <div class="page-content">
      <PageMasthead title="日常记录" english="DAILY RECORDS" :description="subtitle"><button class="p3-button secondary" @click="openSummarySheet">每日总结</button></PageMasthead>
      <section class="record-intro" aria-label="记录此刻">
        <div class="record-date"><strong>{{ dayNumber }}</strong><span>{{ dayMonth }}<small>此刻的你</small></span></div>
        <div class="record-intro-copy"><h2>把今天，留给以后的自己。</h2><button class="record-capture" @click="ui.openWriteModal()"><span>此刻，有什么想记下来？</span><b aria-hidden="true">＋</b></button></div>
        <img src="/art/p3r/yukari.webp" class="record-character" alt="" width="1080" height="1080">
      </section>
      <div class="record-toolbar"><div class="record-filters" aria-label="筛选记录"><button v-for="f in recordFilters" :key="f.key" :class="{ selected:recordFilter === f.key }" :aria-pressed="recordFilter === f.key" @click="recordFilter=f.key">{{ f.label }}<span v-if="f.key==='reviewing' && recordsStore.pendingRecords.length">{{ recordsStore.pendingRecords.length }}</span></button></div><span class="record-count">{{ subtitle }}</span></div>
      <!-- 桌面双栏：记录列（fluid）+ 侧栏 320px（≥1440px 显示，sticky） -->
      <div class="records-layout">
        <div class="records-main">
          <!-- 加载状态 -->
          <div v-if="recordsStore.loading && !recordsStore.records.length" class="loading-state">
            <span class="spinner" style="width:22px;height:22px" />
          </div>

          <div v-else-if="recordsStore.error" class="records-error" role="alert"><p>{{ recordsStore.error }}</p><button class="p3-button secondary" @click="filterDate ? loadByDate(filterDate) : loadAll()">重新加载</button></div>
          <!-- 空状态 -->
          <div v-else-if="grouped.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <div class="empty-title">{{ recordsStore.records.length ? '这个分类下暂时没有记录' : '还没有记录' }}</div>
            <div class="empty-desc">写下此刻的一件小事，让生活开始留下痕迹</div>
          </div>

          <!-- 日期分组列表（≥1200px 双列网格，日期分隔条跨双列） -->
          <div v-else class="records-grid">
            <template v-for="group in grouped" :key="group.dateKey">
              <div class="date-separator">{{ group.label }}</div>
              <RecordCard
                v-for="(record, i) in group.items"
                :key="record.id"
                :record="record"
                :active="ui.selectedRecordId === record.id"
                :style="{ animationDelay: `${(groupIndex(group) + i) * 40}ms` }"
                @open="openRecord(record.id)"
                @delete="onDeleteRecord"
                @retry="onRetryRecord"
              />
            </template>
          </div>
        </div>

        <!-- 宽屏（≥1440px）：侧栏常驻右栏；窄屏由下方 FAB + 抽屉承载，此处不渲染 -->
        <div v-if="isWide" class="records-aside">
          <RecordsSidebar
            @open-record="openTodoRecord"
            @open-summaries="openSummarySheet"
          />
        </div>
      </div>
    </div>

    <!-- 窄屏侧栏入口：悬浮按钮 → 抽屉（与 BottomNav 凸钮同区，避开导航高度） -->
    <button
      v-if="!isWide"
      type="button"
      class="sidebar-fab"
      aria-label="打开概览侧栏"
      title="概览"
      @click="showSidebarDrawer = true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>
      </svg>
    </button>

    <!-- 侧栏抽屉（Teleport to body：脱离页面滚动容器；点遮罩/关闭收起） -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showSidebarDrawer" class="sidebar-overlay" @click="showSidebarDrawer = false" />
      </Transition>
      <Transition name="slide-right">
        <div v-if="showSidebarDrawer" class="sidebar-drawer" role="dialog" aria-label="概览侧栏">
          <div class="sidebar-drawer-head">
            <span class="sidebar-drawer-title">概览</span>
            <button type="button" class="sidebar-drawer-close" @click="showSidebarDrawer = false">关闭</button>
          </div>
          <div class="sidebar-drawer-body">
            <RecordsSidebar
              @open-record="onDrawerOpenRecord"
              @open-summaries="onDrawerOpenSummaries"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.page { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.page-header {
  display: none; padding: 26px clamp(32px, 4vw, 72px) 0; align-items: baseline; gap: 14px;
}
@media (min-width: 900px) { .page-header { display: flex; } }
.page-title { font-family: var(--font-display); font-size: 26px; font-weight: 600; }
.page-subtitle { font-size: 13px; color: var(--text-low); }

.page-content {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 10px 18px var(--page-bottom-clearance);
  -webkit-overflow-scrolling: touch;
}
@media (min-width: 900px) {
  /* fluid：宽度跟随空间，弹性侧距替代定宽居中（1920 屏内容占比 45%→75%） */
  .page-content { padding: 18px clamp(32px, 4vw, 72px) 40px; }
}

/* ===== 双栏：主列 fluid + 右侧栏 320px（≥1440px 常驻；窄屏走抽屉，见下） ===== */
.records-layout { display: flex; align-items: flex-start; gap: 18px; }
.records-main { flex: 1; min-width: 0; }
.records-aside { flex: 0 0 320px; width: 320px; position: sticky; top: 18px; }

/* ===== 窄屏侧栏入口：FAB + 右滑抽屉 ===== */
.sidebar-fab {
  position: fixed; z-index: 18;
  /* 上移让位给右下角的写日记 FAB（52px + 14px 间距），否则两个按钮叠在一起 */
  right: 16px; bottom: calc(var(--nav-height) + var(--safe-bottom) + 78px);
  width: 44px; height: 44px; border-radius: 14px;
  display: grid; place-items: center;
  background: var(--card); border: 1px solid var(--line);
  box-shadow: var(--shadow-float);
}
.sidebar-fab svg { width: 19px; height: 19px; stroke: var(--text-mid); }
.sidebar-fab:active { transform: scale(.94); }
@media (min-width: 1440px) { .sidebar-fab { display: none; } }

.sidebar-overlay { position: fixed; inset: 0; z-index: 46; background: rgba(26,26,23,.35); }
.sidebar-drawer {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 47;
  width: min(88vw, 360px);
  display: flex; flex-direction: column;
  background: var(--ink); border-left: 1px solid var(--line);
  box-shadow: var(--shadow-float);
}
.sidebar-drawer-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 10px; border-bottom: 1px solid var(--line);
}
.sidebar-drawer-title { font-family: var(--font-display); font-size: 16px; }
.sidebar-drawer-close { font-size: 13px; color: var(--text-mid); padding: 4px 2px; }
.sidebar-drawer-close:hover { color: var(--accent); }
.sidebar-drawer-body {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 12px 14px calc(20px + var(--safe-bottom));
}

/* 记录双列（≥1200px）：卡片走网格，日期分隔条跨双列；stagger delay 不变 */
.records-grid { display: grid; grid-template-columns: 1fr; align-items: start; }
@media (min-width: 1200px) {
  /* 卡片自带 margin-bottom 改由 row-gap 提供（间距 12px），避免双倍间距 */
  .records-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .records-grid .record-card { margin-bottom: 0; }
  .records-grid .date-separator { grid-column: 1 / -1; margin-bottom: -4px; }
}

.loading-state { display: flex; justify-content: center; padding: 60px 0; }

.records-page .page-content { padding-top:0; }
.record-intro { position:relative; display:flex; align-items:center; gap:25px; overflow:hidden; min-height:170px; padding:26px 34px; background:#0d43c0; border-left:5px solid var(--cyan); color:white; }
.record-intro::before { content:''; position:absolute; inset:0; background:url('/art/water-surface.webp') center 20% / cover; opacity:.3; pointer-events:none; }
.record-date { position:relative; display:flex; gap:12px; align-items:center; padding-right:25px; border-right:1px solid #84bbff70; }
.record-date strong { font:italic 800 94px/.8 var(--font-display); letter-spacing:-.05em; }
.record-date span { color:var(--cyan); font:italic 800 27px/1 var(--font-display); text-transform:uppercase; }
.record-date small { display:block; font:10px var(--font); color:#bed9ff; margin-top:10px; }
.record-intro-copy { position:relative; flex:1; max-width:64%; z-index:1; }
.record-intro-copy h2 { font-size:21px; font-weight:900; letter-spacing:-.035em; margin-bottom:15px; }
.record-capture { display:flex; align-items:center; justify-content:space-between; min-height:45px; width:min(100%,430px); padding:10px 16px; border:1px solid #afdcff80; background:#071c6550; color:#d3eaff; text-align:left; font-size:12px; }
.record-capture:hover { background:#052562; border-color:var(--cyan); }
.record-capture b { font-size:24px; line-height:1; color:var(--cyan); }
.record-character { position:absolute; width:470px; height:470px; top:-32px; right:-161px; pointer-events:none; }
.record-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:22px 0 6px; padding-bottom:13px; border-bottom:1px solid #7bafff45; }
.record-filters { display:flex; gap:6px; }
.record-filters button { min-height:36px; padding:6px 16px; font-size:12px; color:#adc8f4; }
.record-filters button.selected { color:var(--night); background:var(--cyan); font-weight:800; transform:skew(-7deg); box-shadow:3px 3px 0 var(--electric); }
.record-filters span { margin-left:7px; background:var(--pink); color:white; font-size:10px; padding:0 5px; }
.record-count { font-size:11px; color:#b7ccef; }
.records-error { color:white; background:#09215c; padding:24px; border:1px solid #ffabc4; }
.records-error button { margin-top:16px; }
.records-main > .empty-state .empty-title { color:white; }
.records-main > .empty-state .empty-desc { color:var(--on-dark); }
@media(max-width:1199px){.record-intro{gap:18px;padding:25px}.record-date{padding-right:18px}.record-date strong{font-size:76px}.record-intro-copy h2{font-size:18px}.record-intro-copy{max-width:60%}.record-character{right:-184px}}
@media(max-width:599px){.record-intro{padding:24px 18px;min-height:190px;align-items:flex-start}.record-date{display:none}.record-intro-copy{max-width:85%;width:100%}.record-intro-copy h2{font-size:19px;max-width:13em}.record-capture{font-size:11px;padding:9px 12px;margin-top:28px;background:#0516469e}.record-character{width:400px;height:400px;right:-190px;top:-7px;opacity:.7}.record-toolbar{flex-wrap:wrap;gap:12px}.record-filters button{padding:6px 13px}.record-count{font-size:10px}.record-toolbar{margin-top:18px}}

</style>
