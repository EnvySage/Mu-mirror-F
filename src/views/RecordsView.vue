<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
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
import ActionCard from '@/components/organisms/ActionCard.vue'
import RecordsSidebar from '@/components/organisms/RecordsSidebar.vue'
import PageMasthead from '@/components/molecules/PageMasthead.vue'
import { useDialogFocus, prepareDialogFocusHandoff } from '@/composables/useDialogFocus'
import { stableVariant, prefersReducedMotion } from '@/motion/core'
import { useListMotion } from '@/motion/useListMotion'
import { useOverlayMotion } from '@/motion/useOverlayMotion'

const props = defineProps({
  date: { type: String, default: null },
})

const ui = useUIStore()
const recordsStore = useRecordsStore()
const summariesStore = useSummariesStore()
const statsStore = useStatsStore()
const todoStore = useTodoStore()
const toast = useToastStore()
const deleteProposal = ref(null)

const recordFilter = ref('all')
const selectedTag = ref('')
const recordFilters = [{ key:'all',label:'全部记录' },{ key:'record_only',label:'仅记录' },{ key:'reviewing',label:'待审核' },{ key:'done',label:'已入库' }]
const listRoot = ref(null)
let viewAlive = true
let highlightTimer = null
function clearHighlightLater(id) {
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => { if (String(ui.highlightRecordId) === String(id)) ui.highlightRecordId = null }, 1800)
}
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
useListMotion(listRoot, () => JSON.stringify(grouped.value.map(group => [group.dateKey, group.items.map(record => [record.id, record.status])])))

const tagOptions = computed(() => {
  const values = new Set()
  for (const record of recordsStore.records) {
    for (const chunk of record.chunks || []) {
      const tags = chunk.metadata?.userTags ?? chunk.metadata?.user_tags ?? chunk.metadata?.tags ?? []
      if (Array.isArray(tags)) tags.forEach(tag => { if (tag) values.add(String(tag)) })
    }
  }
  if (selectedTag.value) values.add(selectedTag.value)
  return [...values].sort((a, b) => a.localeCompare(b, 'zh-CN'))
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

const visibleRecordIds = computed(() => new Set(grouped.value.flatMap(group => group.items.map(r => String(r.id)))))
const highlightedRecordHidden = computed(() => !!ui.highlightRecordId
  && recordsStore.records.some(r => String(r.id) === String(ui.highlightRecordId))
  && !visibleRecordIds.value.has(String(ui.highlightRecordId)))
async function revealHighlightedRecord() {
  recordFilter.value = 'all'
  selectedTag.value = ''
  ui.sidebarSelectedDate = null
  await nextTick()
  if (!viewAlive) return
  document.querySelector(`[data-object-source="record"][data-object-id="${CSS.escape(String(ui.highlightRecordId))}"]`)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
  const id = ui.highlightRecordId
  clearHighlightLater(id)
}

watch(() => ui.highlightRecordId, async (id) => {
  if (!id) return
  await nextTick()
  if (!viewAlive) return
  if (visibleRecordIds.value.has(String(id))) {
    document.querySelector(`[data-object-source="record"][data-object-id="${CSS.escape(String(id))}"]`)?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    clearHighlightLater(id)
  }
}, { flush: 'post' })

function loadByDate(dateStr) {
  return recordsStore.fetchRecords({ startDate: dateStr, endDate: dateStr, ...(selectedTag.value ? { tags: selectedTag.value } : {}) })
}

function loadAll() {
  return recordsStore.fetchRecords(selectedTag.value ? { tags: selectedTag.value } : undefined)
}

// ---- 侧栏形态：≥1440px 常驻右栏；窄屏（手机/平板）FAB + 抽屉 ----
/** 与旧 CSS 断点同口径：1440px 以上侧栏常驻 */
const WIDE_QUERY = '(min-width: 1440px)'
const wideMql = window.matchMedia(WIDE_QUERY)
const isWide = ref(wideMql.matches)
/** 抽屉开合（仅窄屏有意义；转宽屏时强制收起，避免与常驻栏重复） */
const showSidebarDrawer = ref(false)
const drawerEl = ref(null)
const drawerFocusOpen = ref(false)
const drawerMotion = useOverlayMotion({ direction: 'right', distance: 0 })
const drawerFocus = useDialogFocus(() => drawerFocusOpen.value, drawerEl, '.sidebar-drawer-close', () => { showSidebarDrawer.value = false })
watch(showSidebarDrawer, open => { if (open) drawerFocusOpen.value = true })
function afterDrawerLeave() { if (!showSidebarDrawer.value) drawerFocusOpen.value = false }

function onWideChange(e) {
  isWide.value = e.matches
  if (e.matches) showSidebarDrawer.value = false
}

onMounted(async () => {
  const request = filterDate.value ? loadByDate(filterDate.value) : loadAll()
  // 侧栏数据源：每日总结（只取最近 7 篇，全量浏览由「全部」弹窗游标分页）+ stats（30s 缓存，两页共用）
  summariesStore.fetchList({ limit: 7 })
  statsStore.fetchStats()
  wideMql.addEventListener('change', onWideChange)
  await request
})

watch(() => props.date, (d) => {
  d ? loadByDate(d) : loadAll()
})

watch(selectedTag, () => {
  filterDate.value ? loadByDate(filterDate.value) : loadAll()
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
  if (!viewAlive) return
  if (!recordsStore.processingRecords.length) return
  pollTimer = setTimeout(async () => {
    await recordsStore.fetchRecords(filterDate.value
      ? { startDate: filterDate.value, endDate: filterDate.value, ...(selectedTag.value ? { tags: selectedTag.value } : {}) }
      : (selectedTag.value ? { tags: selectedTag.value } : undefined))
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
  viewAlive = false
  clearTimeout(highlightTimer)
  stopListPolling()
  wideMql.removeEventListener('change', onWideChange)
})

function openRecord(id, event) {
  ui.captureDetailOrigin(event?.currentTarget, id)
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
  prepareDialogFocusHandoff()
  showSidebarDrawer.value = false
  openTodoRecord(recordId)
}

function onDrawerOpenSummaries() {
  prepareDialogFocusHandoff()
  showSidebarDrawer.value = false
  openSummarySheet()
}

/** 列表内软删除（REVIEWING / FAILED） */
async function onDeleteRecord(record) {
  const proposal = await recordsStore.deleteRecord(record.id)
  if (proposal) deleteProposal.value = proposal
  else toast.error(recordsStore.error || '删除确认卡准备失败，请重试')
}

async function onDeleteActionUpdated(card) {
  deleteProposal.value = card?.state === 'PENDING' || card?.state === 'EXECUTING' || card?.state === 'FAILED' ? card : null
  if (card?.state === 'SUCCEEDED') {
    toast.success('记录已删除，关联成长贡献已按预览移除')
    await recordsStore.fetchRecords(filterDate.value
      ? { startDate: filterDate.value, endDate: filterDate.value, ...(selectedTag.value ? { tags: selectedTag.value } : {}) }
      : (selectedTag.value ? { tags: selectedTag.value } : undefined))
    statsStore.fetchStats(30, true)
  } else if (card?.state === 'CANCELLED') {
    toast.info('已取消删除，记录保持不变')
  }
}

/** failed 重试先打开详情，再由用户准备并确认新的整理卡。 */
function onRetryRecord(record) {
  ui.selectedRecordId = record.id
  ui.showDetail = true
}
</script>

<template>
  <div class="page records-page">
    <div class="page-content">
      <PageMasthead title="日常记录" english="DAILY RECORDS" :description="subtitle"><button class="p3-button secondary" @click="openSummarySheet">每日总结</button></PageMasthead>
      <ActionCard v-if="deleteProposal" :proposal="deleteProposal" @updated="onDeleteActionUpdated" />
      <section class="record-intro" aria-label="记录此刻">
        <div class="record-date"><strong>{{ dayNumber }}</strong><span>{{ dayMonth }}<small>此刻的你</small></span></div>
        <div class="record-intro-copy"><h2>把今天，留给以后的自己。</h2><button class="record-capture" @click="ui.openWriteModal()"><span>此刻，有什么想记下来？</span><b aria-hidden="true">＋</b></button></div>
      </section>
      <div class="record-toolbar"><div class="record-filters" aria-label="筛选记录"><button v-for="f in recordFilters" :key="f.key" :class="{ selected:recordFilter === f.key }" :aria-pressed="recordFilter === f.key" @click="recordFilter=f.key">{{ f.label }}<span v-if="f.key==='reviewing' && recordsStore.pendingRecords.length">{{ recordsStore.pendingRecords.length }}</span></button></div><label class="record-tag-filter">自由标签<select v-model="selectedTag" aria-label="按自由标签筛选"><option value="">全部标签</option><option v-for="tag in tagOptions" :key="tag" :value="tag">{{ tag }}</option></select></label><span class="record-count">{{ subtitle }}</span></div>
      <div v-if="highlightedRecordHidden" class="record-arrival-notice" role="status">新记录已保存，但当前筛选中看不到。<button @click="revealHighlightedRecord">查看新记录</button></div>
      <!-- 桌面双栏：记录列（fluid）+ 侧栏 320px（≥1440px 显示，sticky） -->
      <div class="records-layout">
        <div ref="listRoot" class="records-main">
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
              <section v-for="group in grouped" :key="group.dateKey" :class="['records-day', stableVariant(group.dateKey, 2) ? 'rail-offset-b' : 'rail-offset-a']" :aria-label="group.label">
                <aside class="date-rail"><span class="date-rail-dot" /><time>{{ group.label }}</time><small>{{ group.items.length }} 条</small></aside>
                <div class="records-day-flow">
                  <RecordCard
                    v-for="record in group.items"
                    :key="record.id"
                    :record="record"
                    editorial
                    :active="ui.selectedRecordId === record.id"
                    :featured="stableVariant(record.id, 7) === 0"
                    :layout-variant="stableVariant(record.id)"
                    :arrival="String(ui.highlightRecordId) === String(record.id)"
                    @open="openRecord(record.id, $event)"
                    @delete="onDeleteRecord"
                    @retry="onRetryRecord"
                  />
                </div>
              </section>
          </div>
        </div>

        <!-- 宽屏（≥1440px）：侧栏常驻右栏；窄屏由下方 FAB + 抽屉承载，此处不渲染 -->
        <div v-if="isWide" class="records-aside">
          <RecordsSidebar class="records-aside-shell"
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
      <Transition :css="false" v-bind="drawerMotion.backdropHooks">
        <div v-if="showSidebarDrawer" class="sidebar-overlay" @click="showSidebarDrawer = false" />
      </Transition>
      <Transition :css="false" v-bind="drawerMotion.panelHooks" @after-enter="drawerFocus.focusInitial" @after-leave="afterDrawerLeave">
        <div v-if="showSidebarDrawer" ref="drawerEl" class="sidebar-drawer" role="dialog" aria-label="概览侧栏" aria-modal="true" tabindex="-1">
          <div class="sidebar-drawer-head">
            <span class="sidebar-drawer-title">概览</span>
            <button type="button" class="sidebar-drawer-close" @click="showSidebarDrawer = false">关闭</button>
          </div>
          <div class="sidebar-drawer-body">
            <RecordsSidebar class="records-aside-shell"
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

/* 稳定 ID 决定版式；外壳补位，卡面独立响应指针。 */
.records-grid { position:relative; display:flex; flex-direction:column; gap:30px; }
.records-day { display:grid; grid-template-columns:86px minmax(0,1fr); gap:20px; align-items:stretch; }
.records-day.rail-offset-b { grid-template-columns:112px minmax(0,1fr); gap:16px; }
.date-rail { position:relative; display:flex; flex-direction:column; align-items:flex-end; padding:20px 12px 0 0; color:#d6e7ff; text-align:right; }
.date-rail::after { content:''; position:absolute; top:31px; bottom:-30px; right:0; width:2px; background:linear-gradient(#50edfa,#80b9ff20); transform:skewY(-13deg); transform-origin:top right; }
.rail-offset-b .date-rail { padding-top:56px; padding-right:17px; }
.rail-offset-b .date-rail::after { transform:skewY(12deg); }
.records-day:last-child .date-rail::after { display:none; }
.date-rail-dot { position:absolute; right:-4px; top:23px; width:9px; height:9px; border:2px solid var(--cyan); border-radius:50%; background:var(--night); z-index:1; }
.rail-offset-b .date-rail-dot { top:60px; right:-4px; border-radius:0; transform:rotate(45deg); border-color:var(--pink); }
.date-rail time { font:700 13px/1.3 var(--font-display); color:white; }
.date-rail small { margin-top:5px; color:#9ebde9; font-size:10px; }
.records-day-flow :deep(.record-layout.featured) { width:96%; align-self:flex-start; }
.records-day-flow { min-width:0; display:flex; flex-direction:column; align-items:flex-start; gap:15px; }
.records-day-flow :deep(.record-card) { margin:0; isolation:isolate; position:relative; background:#0b255c; border:1px solid #7ba5e94a; box-shadow:none; color:#eaf1ff; clip-path:polygon(0 0,calc(100% - 22px) 0,100% 20px,100% 100%,13px 100%,0 calc(100% - 14px)); transition:filter .2s,border-color .2s,box-shadow .2s; }
.records-day-flow :deep(.record-card.featured) { min-height:190px; padding:25px 30px; background:linear-gradient(112deg,#f8fbff 0 83%,#d8faff 83% 100%); color:var(--text-hi); border-color:#d9e6ff; filter:drop-shadow(9px 11px 0 #020c3440) drop-shadow(-5px 5px 0 #f03c8a75); clip-path:polygon(0 0,calc(100% - 42px) 0,100% 42px,100% 100%,20px 100%,0 calc(100% - 20px)); }
.records-day-flow :deep(.record-layout.layout-1:not(.featured)) { width:84%; align-self:flex-end; margin-right:1.5%; }
.records-day-flow :deep(.record-card.layout-1:not(.featured)) { padding:20px 24px; clip-path:polygon(24px 0,100% 0,100% calc(100% - 28px),calc(100% - 28px) 100%,0 100%,0 24px); }
.records-day-flow :deep(.record-layout.layout-2:not(.featured)) { width:91%; align-self:flex-start; margin-left:5%; }
.records-day-flow :deep(.record-card.layout-2:not(.featured)) { padding:18px 22px; background:#10306d; clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 34px),calc(100% - 34px) 100%,0 100%); }
.records-day-flow :deep(.record-layout.layout-0:not(.featured)) { width:78%; align-self:flex-end; margin-right:8%; }
.records-day-flow :deep(.record-card.layout-0:not(.featured)) { padding:18px 22px; clip-path:polygon(0 0,calc(100% - 30px) 0,100% 30px,100% 100%,0 100%); }
.records-day-flow :deep(.record-card::after) { content:''; position:absolute; right:0; top:0; width:8px; height:100%; background:linear-gradient(var(--cyan),var(--pink)); opacity:.8; clip-path:polygon(0 0,100% 0,100% 72%,0 100%); pointer-events:none; }
.records-day-flow :deep(.record-card.featured) { filter:drop-shadow(9px 11px 0 #020c3440) drop-shadow(-5px 5px 0 #f03c8a75); }
.records-day-flow :deep(.record-card:not(.featured)) { filter:drop-shadow(6px 7px 0 #50edfa50) drop-shadow(-5px 3px 0 #f03c8a55); }
.records-day-flow :deep(.record-card:not(.featured) .record-time), .records-day-flow :deep(.record-card:not(.featured) .record-summary) { color:#b7ccef; }
.records-day-flow :deep(.record-card:not(.featured) .record-title) { color:white; }
.records-day-flow :deep(.record-card:not(.featured) .chunk-count) { color:var(--cyan); }
.records-day-flow :deep(.record-card:hover), .records-day-flow :deep(.record-card:focus-visible), .records-day-flow :deep(.record-card.active) { border-color:var(--cyan); filter:drop-shadow(8px 10px 0 #50edfa88) drop-shadow(-5px 4px 0 #f03c8a75); }
.record-arrival-notice{display:flex;align-items:center;gap:12px;margin:8px 0;padding:9px 12px;color:#d7eaff;background:#0b255c;border-left:3px solid var(--cyan);font-size:12px}
.record-arrival-notice button{color:var(--cyan);text-decoration:underline;text-underline-offset:3px}
.records-aside-shell :deep(.side-card) { color:#dce9ff; background:#0a245f; border:1px solid #7ba5e94a; border-bottom:1px solid #7ba5e94a; box-shadow:none; }
.records-aside-shell :deep(.side-head-note), .records-aside-shell :deep(.side-empty), .records-aside-shell :deep(.sum-line), .records-aside-shell :deep(.sum-date), .records-aside-shell :deep(.today-unit) { color:#b7ccef; }
.records-aside-shell :deep(.today-num), .records-aside-shell :deep(.side-more) { color:var(--cyan); }
@media(max-width:599px){.records-day,.records-day.rail-offset-b{grid-template-columns:42px minmax(0,1fr);gap:8px}.date-rail,.rail-offset-b .date-rail{padding:16px 7px 0 0}.date-rail time{font-size:10px}.date-rail small{font-size:8px}.date-rail-dot,.rail-offset-b .date-rail-dot{top:19px;right:-4px}.records-grid{gap:20px}.records-day-flow{gap:11px}.records-day-flow :deep(.record-card.featured){min-height:164px;padding:19px 17px;clip-path:polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,14px 100%,0 calc(100% - 14px))}.records-day-flow :deep(.record-layout.layout-1:not(.featured)){width:96%;margin-right:0}.records-day-flow :deep(.record-layout.layout-2:not(.featured)){width:96%;margin-left:4%}.records-day-flow :deep(.record-layout.layout-0:not(.featured)){width:90%;margin-right:5%}.records-day-flow :deep(.record-layout.featured){width:100%}.records-day-flow :deep(.record-card:not(.featured)){padding:16px}}

.loading-state { display: flex; justify-content: center; padding: 60px 0; }

.records-page .page-content { padding-top:0; }
.record-intro { position:relative; display:flex; align-items:center; gap:25px; overflow:hidden; min-height:170px; padding:26px 34px; background:#0d43c0; border-left:5px solid var(--cyan); color:white; }
.record-intro::before { content:''; position:absolute; inset:0; background:url('/art/water-surface.webp') center 20% / cover; opacity:.3; pointer-events:none; }
.record-date { position:relative; display:flex; gap:12px; align-items:center; padding-right:25px; border-right:1px solid #84bbff70; }
.record-date strong { font:italic 800 94px/.8 var(--font-display); letter-spacing:-.05em; }
.record-date span { color:var(--cyan); font:italic 800 27px/1 var(--font-display); text-transform:uppercase; }
.record-date small { display:block; font:10px var(--font); color:#bed9ff; margin-top:10px; }
.record-intro-copy { position:relative; flex:1; max-width:90%; z-index:1; }
.record-intro-copy h2 { font-size:21px; font-weight:900; letter-spacing:-.035em; margin-bottom:15px; }
.record-capture { display:flex; align-items:center; justify-content:space-between; min-height:45px; width:min(100%,430px); padding:10px 16px; border:1px solid #afdcff80; background:#071c6550; color:#d3eaff; text-align:left; font-size:12px; }
.record-capture:hover { background:#052562; border-color:var(--cyan); }
.record-capture b { font-size:24px; line-height:1; color:var(--cyan); }

.record-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:22px 0 6px; padding-bottom:13px; border-bottom:1px solid #7bafff45; }
.record-filters { display:flex; gap:6px; }
.record-tag-filter{display:flex;align-items:center;gap:7px;color:#adc8f4;font-size:11px}.record-tag-filter select{max-width:170px;min-height:34px;padding:5px 24px 5px 9px;border:1px solid #7bafff65;border-radius:3px;background:#071f55;color:white;font:inherit}
.record-filters button { min-height:36px; padding:6px 16px; font-size:12px; color:#adc8f4; }
.record-filters button.selected { color:var(--night); background:var(--cyan); font-weight:800; transform:skew(-7deg); box-shadow:3px 3px 0 var(--electric); }
.record-filters span { margin-left:7px; background:var(--pink); color:white; font-size:10px; padding:0 5px; }
.record-count { font-size:11px; color:#b7ccef; }
.records-error { color:white; background:#09215c; padding:24px; border:1px solid #ffabc4; }
.records-error button { margin-top:16px; }
.records-main > .empty-state .empty-title { color:white; }
.records-main > .empty-state .empty-desc { color:var(--on-dark); }
@media(max-width:1199px){.record-intro{gap:18px;padding:25px}.record-date{padding-right:18px}.record-date strong{font-size:76px}.record-intro-copy h2{font-size:18px}.record-intro-copy{max-width:90%}}
@media(max-width:599px){.record-intro{padding:24px 18px;min-height:190px;align-items:flex-start}.record-date{display:none}.record-intro-copy{max-width:85%;width:100%}.record-intro-copy h2{font-size:19px;max-width:13em}.record-capture{font-size:11px;padding:9px 12px;margin-top:28px;background:#0516469e}.record-toolbar{flex-wrap:wrap;gap:12px}.record-filters button{padding:6px 13px}.record-tag-filter{flex:1 1 100%;justify-content:flex-start}.record-count{font-size:10px}.record-toolbar{margin-top:18px}}

</style>
<style scoped src="@/assets/styles/persona-records.css"></style>
