<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRecordsStore } from '@/stores/records'
import { formatFullDate } from '@/utils/time'

const props = defineProps({
  mode: { type: String, default: 'mini' }, // mini | full
  /** 外部控制的选中日期（侧边栏联动用） */
  modelValue: { type: Date, default: null },
})

const emit = defineEmits(['selectDate', 'update:modelValue'])

const recordsStore = useRecordsStore()

const calendarDate = ref(new Date())
const selectedDate = ref(null)

/** 优先用外部传入的选中日期 */
const effectiveSelected = computed(() => props.modelValue || selectedDate.value)

const year = computed(() => calendarDate.value.getFullYear())
const month = computed(() => calendarDate.value.getMonth())

const monthText = computed(() => year.value + '年' + (month.value + 1) + '月')

const recordDates = computed(() => recordsStore.getRecordDates(year.value, month.value))

const today = new Date()

const calendarDays = computed(() => {
  const firstDay = new Date(year.value, month.value, 1).getDay()
  const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()
  const daysInPrevMonth = new Date(year.value, month.value, 0).getDate()

  const days = []

  // Previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: daysInPrevMonth - i, otherMonth: true })
  }

  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getFullYear() === year.value && today.getMonth() === month.value && today.getDate() === day
    const hasRecord = recordDates.value.has(day)
    const isSelected = effectiveSelected.value &&
      effectiveSelected.value.getFullYear() === year.value &&
      effectiveSelected.value.getMonth() === month.value &&
      effectiveSelected.value.getDate() === day
    days.push({ day, isToday, hasRecord, isSelected, otherMonth: false })
  }

  // Next month
  const totalCells = firstDay + daysInMonth
  const remaining = 7 - (totalCells % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, otherMonth: true })
    }
  }

  return days
})

// 加载日历标记数据
async function loadCalendarMarks() {
  await recordsStore.fetchCalendarMarks(year.value, month.value)
}

// 监听月份变化，重新加载标记数据
watch([year, month], () => {
  loadCalendarMarks()
})

// 初始加载
onMounted(() => {
  loadCalendarMarks()
})

function changeMonth(delta) {
  const d = new Date(calendarDate.value)
  d.setMonth(d.getMonth() + delta)
  calendarDate.value = d
}

function selectDay(dayObj) {
  if (dayObj.otherMonth) return
  const date = new Date(year.value, month.value, dayObj.day)
  selectedDate.value = date
  emit('selectDate', date)
  emit('update:modelValue', date)
}
</script>

<template>
  <div :class="['calendar-widget', mode]">
    <div class="calendar-header">
      <button class="calendar-nav-btn" @click="changeMonth(-1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span class="calendar-month">{{ monthText }}</span>
      <button class="calendar-nav-btn" @click="changeMonth(1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
    <div class="calendar-weekdays">
      <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
    </div>
    <div class="calendar-days">
      <div
        v-for="(d, i) in calendarDays"
        :key="i"
        :class="['calendar-day', { 'other-month': d.otherMonth, today: d.isToday, 'has-record': d.hasRecord, selected: d.isSelected }]"
        @click="selectDay(d)"
      >{{ d.day }}</div>
    </div>
    <div class="calendar-legend">
      <div class="calendar-legend-item"><div class="calendar-dot has-record" /><span>有记录</span></div>
      <div class="calendar-legend-item"><div class="calendar-dot today" /><span>今天</span></div>
      <div v-if="mode === 'full'" class="calendar-legend-item"><div class="calendar-dot selected" /><span>已选中</span></div>
    </div>
  </div>
</template>

<style scoped>
.calendar-widget {
  padding: 16px;
  background: var(--bg);
  border-radius: var(--radius-md);
}

.calendar-widget.full {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 16px;
  border: 0.5px solid var(--border);
}

.calendar-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.calendar-month { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.full .calendar-month { font-size: 18px; }

.calendar-nav-btn {
  width: 28px; height: 28px; border-radius: 8px;
  background: none; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); transition: all 0.15s;
}
.calendar-nav-btn:hover { background: var(--surface); }
.calendar-nav-btn svg { width: 16px; height: 16px; }

.calendar-weekdays {
  display: grid; grid-template-columns: repeat(7, 1fr);
  text-align: center; margin-bottom: 6px;
}
.calendar-weekdays span {
  font-size: 11px; font-weight: 500; color: var(--text-tertiary);
  padding: 4px 0;
}
.full .calendar-weekdays span { font-size: 12px; }
.full .calendar-weekdays { margin-bottom: 8px; }

.calendar-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.full .calendar-days { gap: 4px; }
.calendar-day {
  aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
  font-size: 12px; border-radius: 8px; cursor: pointer;
  transition: all 0.15s; position: relative;
  color: var(--text-secondary);
}
.full .calendar-day { font-size: 14px; border-radius: 10px; }
.calendar-day:hover { background: var(--surface); }
.calendar-day.other-month { color: var(--text-tertiary); opacity: 0.4; }
.calendar-day.today { background: var(--accent); color: #fff; font-weight: 600; }
.calendar-day.today:hover { background: var(--accent-hover); }
.calendar-day.selected { background: var(--accent-light); color: var(--accent); font-weight: 600; }
.calendar-day.has-record::after {
  content: ''; position: absolute; bottom: 4px;
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--accent);
}
.calendar-day.today.has-record::after { background: #fff; }

.calendar-legend {
  display: flex; gap: 12px; margin-top: 10px; padding-top: 10px;
  border-top: 0.5px solid var(--border);
}
.full .calendar-legend { margin-top: 16px; padding-top: 16px; }
.calendar-legend-item {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--text-tertiary);
}
.calendar-dot { width: 8px; height: 8px; border-radius: 50%; }
.calendar-dot.has-record { background: var(--accent); }
.calendar-dot.today { background: var(--accent); border: 2px solid var(--accent); box-shadow: 0 0 0 2px var(--accent-light); }
.calendar-dot.selected { background: var(--accent-light); border: 2px solid var(--accent); }
</style>
