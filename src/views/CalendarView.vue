<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordsStore } from '@/stores/records'
import { useUIStore } from '@/stores/ui'
import { formatFullDate } from '@/utils/time'
import { typeMap, moodMap, MOOD_COLOR_MAP } from '@/constants/tags'
import PageHeader from '@/components/organisms/PageHeader.vue'
import CalendarWidget from '@/components/molecules/CalendarWidget.vue'

const router = useRouter()
const recordsStore = useRecordsStore()
const ui = useUIStore()

const selectedDate = ref(null)
const filterInfo = ref('')

const filteredRecords = computed(() => {
  if (!selectedDate.value) return []
  return recordsStore.getByDate(selectedDate.value)
})

function onDateSelect(date) {
  selectedDate.value = date
  filterInfo.value = formatFullDate(date)
}

function openRecord(id) {
  router.push({ name: 'records' }).then(() => {
    setTimeout(() => {
      ui.selectedRecordId = id
      ui.showDetail = true
    }, 100)
  })
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
          <div
            v-for="r in filteredRecords"
            :key="r.id"
            class="calendar-record-item"
            @click="openRecord(r.id)"
          >
            <div class="calendar-record-title">
              {{ r.status === 'processing' ? r.content.substring(0, 20) + '...' : r.title }}
            </div>
            <div v-if="r.status !== 'processing'" class="calendar-record-summary">
              {{ r.summary }}
            </div>
            <div class="calendar-record-tags">
              <span v-if="r.status === 'processing'" class="tag tag-processing">AI 整理中</span>
              <template v-else>
                <span class="tag tag-type">{{ typeMap[r.content_type] || r.content_type }}</span>
                <span
                  v-for="m in (r.mood || [])"
                  :key="m"
                  :class="['tag', 'tag-mood', MOOD_COLOR_MAP[m] || '']"
                >{{ moodMap[m] || m }}</span>
              </template>
            </div>
          </div>
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
.calendar-record-item {
  background: var(--surface); border-radius: var(--radius-md);
  padding: 14px 16px; margin-bottom: 8px;
  border: 0.5px solid var(--border); cursor: pointer; transition: all 0.15s;
}
.calendar-record-item:active { transform: scale(0.98); }
.calendar-record-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.calendar-record-summary { font-size: 12px; color: var(--text-secondary); }
.calendar-record-tags { display: flex; gap: 4px; margin-top: 8px; }

.tag { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: var(--radius-full); font-size: 11px; font-weight: 500; }
.tag-type { background: var(--accent-light); color: var(--accent); }
.tag-mood { background: var(--success-light); color: var(--success); }
.tag-mood.anxious { background: var(--warning-light); color: var(--warning); }
.tag-mood.sad { background: var(--danger-light); color: var(--danger); }
.tag-mood.tired { background: #F3F0FF; color: #7C3AED; }
.tag-processing { background: var(--processing-light); color: var(--processing); animation: tagPulse 2s ease-in-out infinite; }
@keyframes tagPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
</style>
