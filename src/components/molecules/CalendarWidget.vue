<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRecordsStore } from '@/stores/records'
import { formatFullDate } from '@/utils/time'

const props = defineProps({
  mode: { type: String, default: 'mini' }, // mini | full
  modelValue: { type: Date, default: null },
})

const emit = defineEmits(['selectDate', 'pickDate', 'update:modelValue'])

const recordsStore = useRecordsStore()

const calendarDate = ref(new Date())
const selectedDate = ref(null)

const effectiveSelected = computed(() => props.modelValue || selectedDate.value)

const year = computed(() => calendarDate.value.getFullYear())
const month = computed(() => calendarDate.value.getMonth())

const monthText = computed(() => year.value + ' 年 ' + (month.value + 1) + ' 月')

const recordDates = computed(() => recordsStore.getRecordDates(year.value, month.value))

const today = new Date()

const calendarDays = computed(() => {
  const firstDay = new Date(year.value, month.value, 1).getDay()
  const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()
  const daysInPrevMonth = new Date(year.value, month.value, 0).getDate()

  const days = []

  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: daysInPrevMonth - i, otherMonth: true })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getFullYear() === year.value && today.getMonth() === month.value && today.getDate() === day
    const hasRecord = recordDates.value.has(day)
    const isSelected = effectiveSelected.value &&
      effectiveSelected.value.getFullYear() === year.value &&
      effectiveSelected.value.getMonth() === month.value &&
      effectiveSelected.value.getDate() === day
    days.push({ day, isToday, hasRecord, isSelected, otherMonth: false })
  }

  const totalCells = firstDay + daysInMonth
  const remaining = 7 - (totalCells % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, otherMonth: true })
    }
  }

  return days
})

async function loadCalendarMarks() {
  await recordsStore.fetchCalendarMarks(year.value, month.value)
}

watch([year, month], loadCalendarMarks)
onMounted(loadCalendarMarks)

function changeMonth(delta) {
  const d = new Date(calendarDate.value)
  d.setMonth(d.getMonth() + delta)
  calendarDate.value = d
  selectedDate.value = null
}

function selectDay(dayObj) {
  if (dayObj.otherMonth) return
  const date = new Date(year.value, month.value, dayObj.day)
  // 同一日再次点击 → 触发 pickDate（CalendarView 跳转记录页）
  if (effectiveSelected.value &&
      effectiveSelected.value.getFullYear() === year.value &&
      effectiveSelected.value.getMonth() === month.value &&
      effectiveSelected.value.getDate() === dayObj.day) {
    emit('pickDate', date)
    return
  }
  selectedDate.value = date
  emit('selectDate', date)
  emit('update:modelValue', date)
}
</script>

<template>
  <div :class="['calendar-widget', mode]">
    <div class="calendar-header">
      <button class="calendar-nav-btn" @click="changeMonth(-1)">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span class="calendar-month">{{ monthText }}</span>
      <button class="calendar-nav-btn" @click="changeMonth(1)">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
    <Transition name="fade" mode="out-in">
      <div :key="monthText" class="calendar-grid">
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
      </div>
    </Transition>
    <div class="calendar-legend">
      <div class="calendar-legend-item"><div class="calendar-dot has-record" /><span>有记录</span></div>
      <div class="calendar-legend-item"><div class="calendar-dot today" /><span>今天</span></div>
      <div v-if="mode === 'full'" class="calendar-legend-item"><div class="calendar-dot selected" /><span>已选中</span></div>
    </div>
  </div>
</template>

<style scoped>
.calendar-widget { padding: 0; }

.calendar-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.calendar-month { font-family: var(--font-display); font-size: 16px; font-weight: 600; }

.calendar-nav-btn {
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  display: grid; place-items: center;
  border: 1px solid var(--line);
  background: var(--card);
  transition: background .15s;
}
.calendar-nav-btn:hover { background: var(--ink-2); }
.calendar-nav-btn svg { width: 15px; height: 15px; stroke: var(--text-mid); fill: none; }

.calendar-grid { animation: monthIn .25s ease; }

.calendar-weekdays {
  display: grid; grid-template-columns: repeat(7, 1fr);
  text-align: center; margin-bottom: 8px;
}
.calendar-weekdays span {
  font-family: var(--font-mono); font-size: 10.5px; color: var(--text-low);
  padding: 4px 0;
}

.calendar-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.calendar-day {
  position: relative; aspect-ratio: 1;
  display: grid; place-items: center;
  font-size: 13.5px; border-radius: var(--radius-sm);
  color: var(--text-mid); transition: background .15s, color .15s; cursor: pointer;
}
.calendar-day:hover { background: var(--ink-2); }
.calendar-day.other-month { color: var(--text-low); opacity: .35; }
.calendar-day.has-record { color: var(--text-hi); font-weight: 500; }
.calendar-day.has-record::after {
  content: ""; position: absolute; bottom: 6px;
  width: 4.5px; height: 4.5px; border-radius: 50%;
  background: var(--accent);
}
.calendar-day.today { box-shadow: inset 0 0 0 1.5px var(--accent); border-radius: var(--radius-sm); }
.calendar-day.selected { background: var(--accent); color: #FFFFFF; font-weight: 600; animation: dayPop .25s cubic-bezier(.34,1.4,.5,1); }
.calendar-day.selected::after { background: #FFFFFF; }

.calendar-legend {
  display: flex; gap: 16px; margin-top: 14px; padding-top: 12px;
  border-top: 1px dashed var(--line);
}
.calendar-legend-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--text-low);
}
.calendar-dot { width: 7px; height: 7px; border-radius: 50%; }
.calendar-dot.has-record { background: var(--accent); }
.calendar-dot.today { box-shadow: inset 0 0 0 1.5px var(--accent); background: transparent; }
.calendar-dot.selected { background: var(--accent); }
</style>
