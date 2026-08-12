<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordsStore } from '@/stores/records'
import { useUIStore } from '@/stores/ui'
import { formatFullDate } from '@/utils/time'
import PageHeader from '@/components/organisms/PageHeader.vue'
import CalendarWidget from '@/components/molecules/CalendarWidget.vue'
import RecordCard from '@/components/molecules/RecordCard.vue'

const router = useRouter()
const recordsStore = useRecordsStore()
const ui = useUIStore()

const selectedDate = ref(null)
const filterInfo = ref('')

/** 只显示已完成和待审核的记录 */
const filteredRecords = computed(() => {
  if (!selectedDate.value) return []
  return recordsStore.getByDate(selectedDate.value).filter(
    r => r.status === 'done' || r.status === 'reviewing'
  )
})

/**
 * 日期选择：首次点击选中并加载预览，再次点击同一日期跳转到记录页
 */
function onDateSelect(date) {
  const isSameDate = selectedDate.value &&
    date.getFullYear() === selectedDate.value.getFullYear() &&
    date.getMonth() === selectedDate.value.getMonth() &&
    date.getDate() === selectedDate.value.getDate()

  if (isSameDate) {
    // 二次点击 → 跳转记录页并按日期筛选
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    router.push({ name: 'records', params: { date: `${y}-${m}-${d}` } })
    return
  }

  selectedDate.value = date
  filterInfo.value = formatFullDate(date)
  // 加载当天的记录数据
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  recordsStore.fetchRecords({
    startDate: `${year}-${month}-${day}`,
    endDate: `${year}-${month}-${day}`
  })
}

/** 直接打开详情面板，不跳转路由 */
function openRecord(id) {
  ui.selectedRecordId = id
  ui.showDetail = true
}
</script>

<template>
  <div class="page calendar-page">
    <PageHeader title="日历" :subtitle="filterInfo" />
    <div class="page-content">
      <CalendarWidget mode="full" @select-date="onDateSelect" />

      <div v-if="selectedDate" class="calendar-records">
        <template v-if="filteredRecords.length === 0">
          <div class="empty-state" style="padding: 40px 0">
            <div class="empty-title">这一天没有记录</div>
            <div class="empty-desc">点击写日记按钮开始记录</div>
          </div>
        </template>
        <template v-else>
          <div class="calendar-records-header">
            当天记录
            <span class="calendar-records-count">{{ filteredRecords.length }}条</span>
          </div>
          <RecordCard
            v-for="r in filteredRecords"
            :key="r.id"
            :record="r"
            :active="ui.selectedRecordId === r.id"
            @click="openRecord(r.id)"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: var(--bg); overflow-y: auto; overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.page-content { padding: 12px 16px 32px; }

@media (min-width: 900px) {
  .page-content { padding: 20px 36px 36px; }
}

.calendar-records { margin-top: 8px; }
.calendar-records-header {
  font-size: 15px; font-weight: 600; margin-bottom: 12px;
  display: flex; align-items: center; justify-content: space-between;
}
.calendar-records-count { font-size: 13px; font-weight: 400; color: var(--text-secondary); }
</style>
