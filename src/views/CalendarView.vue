<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordsStore } from '@/stores/records'
import { useUIStore } from '@/stores/ui'
import { formatFullDate } from '@/utils/time'
import { typeMap, moodMap } from '@/constants/tags'
import { MOOD_COLOR } from '@/constants/moodColor'
import CalendarWidget from '@/components/molecules/CalendarWidget.vue'
import RecordCard from '@/components/molecules/RecordCard.vue'

const router = useRouter()
const recordsStore = useRecordsStore()
const ui = useUIStore()

const selectedDate = ref(null)
const filterInfo = ref('按月标记，点击日期看当天')

const filteredRecords = computed(() => {
  if (!selectedDate.value) return []
  return recordsStore.getByDate(selectedDate.value).filter(
    r => r.status === 'done' || r.status === 'reviewing'
  )
})

function onDateSelect(date) {
  selectedDate.value = date
  filterInfo.value = formatFullDate(date)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  recordsStore.fetchRecords({ startDate: `${y}-${m}-${d}`, endDate: `${y}-${m}-${d}` })
}

/** 双击日期 → 跳转记录页按日筛选 */
function onDateDouble(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  router.push({ name: 'records', params: { date: `${y}-${m}-${d}` } })
}

function openRecord(id) {
  ui.selectedRecordId = id
  ui.showDetail = true
}
</script>

<template>
  <div class="page calendar-page">
    <div class="page-header">
      <div class="page-title">日历</div>
      <div class="page-subtitle">{{ filterInfo }}</div>
    </div>
    <div class="page-content">
      <div class="calendar-full card">
        <CalendarWidget
          mode="full"
          :model-value="selectedDate"
          @select-date="onDateSelect"
          @pick-date="onDateDouble"
        />
      </div>

      <div v-if="selectedDate" class="calendar-records">
        <div v-if="filteredRecords.length === 0" class="empty-state" style="padding:34px 0">
          <div class="empty-title">这一天没有记录</div>
          <div class="empty-desc">点下方写日记按钮补一条</div>
        </div>
        <template v-else>
          <div class="calendar-records-header">
            当天记录
            <span class="calendar-records-count">{{ filteredRecords.length }} 条</span>
          </div>
          <RecordCard
            v-for="r in filteredRecords"
            :key="r.id"
            :record="r"
            :active="ui.selectedRecordId === r.id"
            @open="openRecord(r.id)"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.page-header { display: none; padding: 26px 32px 0; align-items: baseline; gap: 14px; }
@media (min-width: 900px) { .page-header { display: flex; } }
.page-title { font-family: var(--font-display); font-size: 26px; font-weight: 600; }
.page-subtitle { font-size: 13px; color: var(--text-low); }

.page-content {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 10px 18px calc(96px + var(--safe-bottom));
  -webkit-overflow-scrolling: touch;
}
@media (min-width: 900px) {
  .page-content { padding: 18px 32px 40px; max-width: 760px; }
}

.calendar-full { padding: 16px; }
.calendar-records { margin-top: 16px; }
.calendar-records-header {
  font-size: 13.5px; font-weight: 600; margin-bottom: 10px;
  display: flex; align-items: center; gap: 8px;
}
.calendar-records-count {
  font-family: var(--font-mono); font-size: 11px; color: var(--accent); font-weight: 400;
}
</style>
