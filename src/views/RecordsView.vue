<script setup>
import { computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useRecordsStore } from '@/stores/records'
import { useToastStore } from '@/stores/toast'
import { dateLabel, formatFullDate } from '@/utils/time'
import RecordCard from '@/components/molecules/RecordCard.vue'

const props = defineProps({
  date: { type: String, default: null },
})

const ui = useUIStore()
const recordsStore = useRecordsStore()
const toast = useToastStore()

/** 按日期分组（倒序） */
const grouped = computed(() => {
  const groups = {}
  recordsStore.records.forEach(r => {
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

onMounted(() => {
  filterDate.value ? loadByDate(filterDate.value) : loadAll()
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

onBeforeUnmount(stopListPolling)

function openRecord(id) {
  ui.selectedRecordId = id
  ui.showDetail = true
}

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
    <div class="page-header">
      <div class="page-title">记录</div>
      <div class="page-subtitle">{{ subtitle }}</div>
    </div>
    <div class="page-content">
      <!-- 加载状态 -->
      <div v-if="recordsStore.loading && !recordsStore.records.length" class="loading-state">
        <span class="spinner" style="width:22px;height:22px" />
      </div>

      <!-- 空状态 -->
      <div v-else-if="grouped.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        </div>
        <div class="empty-title">还没有记录</div>
        <div class="empty-desc">点下方写日记按钮，随手记点什么</div>
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
  padding: 10px 18px calc(96px + var(--safe-bottom));
  -webkit-overflow-scrolling: touch;
}
@media (min-width: 900px) {
  /* fluid：宽度跟随空间，弹性侧距替代定宽居中（1920 屏内容占比 45%→75%） */
  .page-content { padding: 18px clamp(32px, 4vw, 72px) 40px; }
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
</style>
