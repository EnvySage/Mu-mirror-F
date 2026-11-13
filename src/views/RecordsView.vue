<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePresentationMode } from '@/composables/usePresentationMode'
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
import RecordWorkflowCard from '@/components/molecules/RecordWorkflowCard.vue'
import { useActionsStore } from '@/stores/actions'
import { recordDraftOf, recordIdOf, recordWorkflowState } from '@/utils/recordWorkflow'
import ActionCard from '@/components/organisms/ActionCard.vue'
import RecordsSidebar from '@/components/organisms/RecordsSidebar.vue'
import PageMasthead from '@/components/molecules/PageMasthead.vue'
import { useDialogFocus, prepareDialogFocusHandoff } from '@/composables/useDialogFocus'
import { stableVariant, prefersReducedMotion } from '@/motion/core'
import { useListMotion } from '@/motion/useListMotion'
import { useOverlayMotion } from '@/motion/useOverlayMotion'
import { reportAchievementActivity } from '@/api/achievements'

const props = defineProps({
  date: { type: String, default: null },
})

const ui = useUIStore()
const router = useRouter()
const route = useRoute()
watch(() => route.query.record, id => {
  if (route.name === 'records' && typeof id === 'string' && /^\d+$/.test(id)) ui.openRecordDetail(id)
}, { immediate: true })
const presentation = usePresentationMode()
const recordsStore = useRecordsStore()
const summariesStore = useSummariesStore()
const statsStore = useStatsStore()
const todoStore = useTodoStore()
const toast = useToastStore()
const deleteProposal = ref(null)
const actions = useActionsStore()
const workflowCards = computed(() => actions.recordWorkflows.filter(card => {
  if (card.state === 'SUCCEEDED') return false
  const date = dateKey(card.created_at || card.createdAt)
  if (filterDate.value && date !== filterDate.value) return false
  if (selectedTag.value && !(recordDraftOf(card).segments || []).some(s => s.tags?.includes(selectedTag.value))) return false
  return true
}))

const recordFilter = ref('all')
const selectedTag = ref('')
const selectedMood = ref('')
const selectedType = ref('')
function filterParams() {
  return { ...(selectedTag.value ? { tags: selectedTag.value } : {}), ...(selectedMood.value ? { mood: selectedMood.value } : {}), ...(selectedType.value ? { contentType: selectedType.value } : {}) }
}
const recordFilters = [{ key:'all',label:'全部记录' },{ key:'record_only',label:'仅记录' },{ key:'reviewing',label:'待审核' },{ key:'done',label:'已入库' }]
const filterDate = computed(() => props.date || (ui.sidebarSelectedDate ? formatDateStr(ui.sidebarSelectedDate) : null))
const listRoot = ref(null)
let viewAlive = true
let highlightTimer = null
function clearHighlightLater(id) {
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => { if (String(ui.highlightRecordId) === String(id)) ui.highlightRecordId = null }, 1800)
}
const dayNumber = new Intl.DateTimeFormat('en', { timeZone:'Asia/Shanghai',day:'2-digit' }).format(new Date())
const dayMonth = new Intl.DateTimeFormat('en', { timeZone:'Asia/Shanghai',month:'short' }).format(new Date())


const grouped = computed(() => {
  const groups = {}
  const replaced = new Set(workflowCards.value.map(recordIdOf).filter(id => id != null).map(String))
  const entries = [...recordsStore.records.filter(r => !replaced.has(String(r.id))), ...workflowCards.value.map(card => ({
    id: `action:${card.id}`, _action: card, status: recordWorkflowState(card).key === 'review' ? 'reviewing' : 'processing', created_at: card.created_at || card.createdAt,
  }))]
  entries.forEach(r => {
    if (recordFilter.value !== 'all' && r.status !== recordFilter.value) return
    const key = dateKey(r.created_at)
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  })
  return Object.keys(groups)
    .sort()
    .reverse()
    .map(k => ({ dateKey: k, label: dateLabel(groups[k][0].created_at), items: groups[k].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) }))
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
  return recordsStore.fetchRecords({ startDate: dateStr, endDate: dateStr, ...filterParams() })
}

function loadAll() {
  return recordsStore.fetchRecords(filterParams())
}

// ---- 侧栏形态：≥1440px 常驻右栏；窄屏（手机/平板）FAB + 抽屉 ----
// Keep the sidebar pinned above 1440px.
const WIDE_QUERY = '(min-width: 1440px)'
const wideMql = window.matchMedia(WIDE_QUERY)
const isWide = ref(wideMql.matches)
// Narrow-screen sidebar drawer.
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
  if (!recordsStore.error && localStorage.getItem('mirror.home-page') === 'records') reportAchievementActivity('home.opened', 'records')
})

watch(() => props.date, (d) => {
  d ? loadByDate(d) : loadAll()
})

watch([selectedTag, selectedMood, selectedType], () => {
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
      ? { startDate: filterDate.value, endDate: filterDate.value, ...filterParams() }
      : filterParams())
    scheduleListPolling()
  }, 3000)
}

watch(() => recordsStore.processingRecords.length, (n) => {
  if (n > 0 && !pollTimer) scheduleListPolling()
  if (n === 0) stopListPolling()
}, { immediate: true })


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
  const activities = []
  for (const [value, filter] of [['mood', selectedMood.value], ['type', selectedType.value], ['tag', selectedTag.value]]) {
    if (filter) activities.push({ kind: 'record.filtered', subjectId: id, otherId: filter, value })
  }
  if (filterDate.value) activities.push({ kind: 'calendar.viewed', subjectId: id, otherId: filterDate.value, value: 'date' })
  ui.openRecordWithActivity(id, activities)
}


function openTodoRecord(recordId) {
  if (!recordId) return
  ui.selectedRecordId = recordId
  ui.showDetail = true
}

// Open daily summaries.
function openSummarySheet() {
  ui.openSummarySheet()
}


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

// Prepare deletion.
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
      ? { startDate: filterDate.value, endDate: filterDate.value, ...filterParams() }
      : filterParams())
    statsStore.fetchStats(30, true)
  } else if (card?.state === 'CANCELLED') {
    toast.info('已取消删除，记录保持不变')
  }
}

// Failed records reopen the review flow.
function onRetryRecord(record) {
  ui.selectedRecordId = record.id
  ui.showDetail = true
}
</script>

<template>
  <div class="page records-page">
    <div class="page-content">
      <PageMasthead title="日常记录" english="DAILY RECORDS" :description="subtitle"><button class="p3-button secondary" @click="openSummarySheet">每日总结</button></PageMasthead>
      <button v-if="presentation.mode.value === 'mobile'" class="record-chat-entry" @click="router.push({ name: 'chat' })"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2ZM8 9h8M8 13h5" /></svg><span>和另一个自己聊聊</span><b aria-hidden="true">↗</b></button>
      <ActionCard v-if="deleteProposal" :proposal="deleteProposal" @updated="onDeleteActionUpdated" />
      <section class="record-intro" aria-label="记录此刻">
        <div class="record-date"><strong>{{ dayNumber }}</strong><span>{{ dayMonth }}<small>此刻的你</small></span></div>
        <div class="record-intro-copy"><h2>把今天，留给以后的自己。</h2><button class="record-capture" @click="ui.openWriteModal()"><span>此刻，有什么想记下来？</span><b aria-hidden="true">＋</b></button></div>
      </section>
      <div class="record-toolbar"><div class="record-filters" aria-label="筛选记录"><button v-for="f in recordFilters" :key="f.key" :class="{ selected:recordFilter === f.key }" :aria-pressed="recordFilter === f.key" @click="recordFilter=f.key">{{ f.label }}<span v-if="f.key==='reviewing' && recordsStore.pendingRecords.length">{{ recordsStore.pendingRecords.length }}</span></button></div><label class="record-tag-filter">自由标签<select v-model="selectedTag" aria-label="按自由标签筛选"><option value="">全部标签</option><option v-for="tag in tagOptions" :key="tag" :value="tag">{{ tag }}</option></select></label><label class="record-tag-filter">情绪<select v-model="selectedMood" aria-label="按情绪筛选"><option value="">全部情绪</option><option v-for="(label,key) in moodMap" :key="key" :value="key">{{ label }}</option></select></label><label class="record-tag-filter">内容类型<select v-model="selectedType" aria-label="按内容类型筛选"><option value="">全部类型</option><option v-for="(label,key) in typeMap" :key="key" :value="key">{{ label }}</option></select></label><span class="record-count">{{ subtitle }}</span></div>
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
                  <template v-for="record in group.items" :key="record.id">
                  <RecordWorkflowCard v-if="record._action" :proposal="record._action" @open="ui.openRecordReview(record._action.id)" />
                  <RecordCard
                    v-else
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
                  </template>
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

<style scoped src="@/assets/styles/records-view.css"></style>
<style scoped src="@/assets/styles/persona-records.css"></style>
