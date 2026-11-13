<script setup>
import { reportAchievementActivity } from '@/api/achievements'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordsStore } from '@/stores/records'
import { useUIStore } from '@/stores/ui'
import { formatFullDate } from '@/utils/time'
import { typeMap, moodMap } from '@/constants/tags'
import { MOOD_COLOR } from '@/constants/moodColor'
import CalendarWidget from '@/components/molecules/CalendarWidget.vue'
import RecordCard from '@/components/molecules/RecordCard.vue'
import PageMasthead from '@/components/molecules/PageMasthead.vue'
import DateTurnOverlay from '@/components/atoms/DateTurnOverlay.vue'
import { prefersReducedMotion } from '@/motion/core'
import { getLedgerBrief, getLedgerRecords, getWishEvents } from '@/api/ledger'
import { currency, flowLabels, shanghaiToday } from '@/utils/ledger'

const router = useRouter()
const recordsStore = useRecordsStore()
const ui = useUIStore()

const selectedDate = ref(null)
const selectedByUser = ref(false)
const changedMonth = ref(null)
const dateTurn = ref(null)
let turnSerial = 0
const filterInfo = ref('按月标记，点击日期看当天')
const dayLedger = ref([]), dayWishes = ref([]), ledgerDays = ref([]), wishDays = ref([])
const ledgerLoading = ref(false), ledgerError = ref('')
let dayGeneration = 0, monthGeneration = 0, loadedMonth = ''

async function loadLedgerAgenda(date) {
  const key = dayKey(date), token = ++dayGeneration
  ledgerLoading.value = true; ledgerError.value = ''; dayLedger.value = []; dayWishes.value = []
  const [ledger, wishes] = await Promise.allSettled([getLedgerRecords({ start: key, end: key, limit: 100 }), getWishEvents(key, key)])
  if (token !== dayGeneration) return
  if (ledger.status === 'fulfilled') dayLedger.value = (ledger.value || []).flatMap(entry => (entry.flows || [])
    .filter(flow => flow.occurred_on === key).map(flow => ({ ...flow, recordId: entry.id, title: entry.title })))
  if (wishes.status === 'fulfilled') dayWishes.value = wishes.value || []
  if ([ledger, wishes].some(result => result.status === 'rejected')) ledgerError.value = '当天的账目或愿望记录暂时无法全部读取。'
  ledgerLoading.value = false
}
async function loadLedgerMarks(date) {
  const month = dayKey(date).slice(0, 7)
  if (loadedMonth === month) return
  loadedMonth = month
  const token = ++monthGeneration
  ledgerDays.value = []; wishDays.value = []
  const start = month + '-01', end = dayKey(new Date(date.getFullYear(), date.getMonth() + 1, 0))
  const [ledger, wishes] = await Promise.allSettled([getLedgerBrief(start, end), getWishEvents(start, end)])
  if (token !== monthGeneration) return
  if (ledger.status === 'fulfilled') ledgerDays.value = (ledger.value?.days || []).filter(row => row.flow_count > 0).map(row => row.date)
  if (wishes.status === 'fulfilled') wishDays.value = (wishes.value || []).map(row => row.achieved_on)
}

/**
 * 当天记录：读 dayRecords（日历专属存储）而不是 recordsStore.records——
 * 后者是主列表单例，会被记录页 loadAll / 按日筛选 / 轮询整体覆盖。
 */
const filteredRecords = computed(() => {
  if (!selectedDate.value) return []
  return recordsStore.dayRecords
})

/** 选中的日期与已加载数据是否同一天（切页回来 / 请求失败时避免显示上一天的数据） */
const daySynced = computed(() => !!selectedDate.value && recordsStore.dayRecordsKey === dayKey(selectedDate.value))

function dayKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function onDateSelect(date) {
  selectedByUser.value = true
  if (selectedDate.value && dayKey(date) !== dayKey(selectedDate.value) && !prefersReducedMotion()) {
    dateTurn.value = { from:new Date(selectedDate.value), to:new Date(date), serial:++turnSerial }
  }
  selectedDate.value = date
  filterInfo.value = formatFullDate(date)
  recordsStore.fetchDayRecords(dayKey(date))
  loadLedgerAgenda(date)
  loadLedgerMarks(date)
}
function onMonthChange(date) {
  onDateSelect(date)
  changedMonth.value = dayKey(date).slice(0, 7)
  selectedByUser.value = false
}

/** 双击日期 → 跳转记录页按日筛选 */
function onDateDouble(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  router.push({ name: 'records', params: { date: `${y}-${m}-${d}` } })
}

function openRecord(id) {
  const date = dayKey(selectedDate.value)
  const activities = [{ kind: 'calendar.opened', subjectId: id }]
  if (selectedByUser.value) activities.push({ kind: 'calendar.viewed', subjectId: id, otherId: date, value: 'date' })
  if (changedMonth.value === date.slice(0, 7)) activities.push({ kind: 'calendar.viewed', subjectId: id, otherId: changedMonth.value, value: 'month' })
  ui.openRecordWithActivity(id, activities)
}

onMounted(() => {
  const [year, month, day] = shanghaiToday().split('-').map(Number)
  onDateSelect(new Date(year, month - 1, day))
})
</script>

<template>
  <div class="page calendar-page">
    <div class="page-content">
      <PageMasthead title="时间日历" english="CALENDAR" :description="filterInfo" />
      <div class="calendar-layout">
        <div class="calendar-full">
          <CalendarWidget
            mode="full"
            :model-value="selectedDate"
            :ledger-days="ledgerDays"
            :wish-days="wishDays"
            @select-date="onDateSelect"
            @pick-date="onDateDouble"
            @change-month="onMonthChange"
          />
        </div>

        <div v-if="selectedDate" class="calendar-records">
          <header class="agenda-heading"><span>DAILY LOG / {{ selectedDate.getFullYear() }}</span><div><strong>{{ String(selectedDate.getMonth()+1).padStart(2,'0') }}<i>/</i>{{ String(selectedDate.getDate()).padStart(2,'0') }}</strong><b>{{ ['SUN','MON','TUE','WED','THU','FRI','SAT'][selectedDate.getDay()] }}<small>{{ ['周日','周一','周二','周三','周四','周五','周六'][selectedDate.getDay()] }}</small></b></div><p>把普通的一天，留在这里。</p></header>
          <div v-if="recordsStore.dayRecordsLoading || !daySynced" class="empty-state" style="padding:34px 0">
            <div class="empty-title">加载中…</div>
          </div>
          <div v-else-if="recordsStore.dayRecordsError" class="empty-state" style="padding:34px 0">
            <div class="empty-title">{{ recordsStore.dayRecordsError }}</div>
            <button class="agenda-retry" @click="recordsStore.fetchDayRecords(dayKey(selectedDate))">重新加载当天记录 ↗</button>
          </div>
          <div v-else-if="filteredRecords.length === 0" class="empty-state" style="padding:34px 0">
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
          <section class="calendar-ledger" aria-label="当天账目与愿望">
            <header><h3>账目与愿望</h3><RouterLink :to="{ name: 'ledger', query: { date: dayKey(selectedDate) } }">查看这天账本</RouterLink></header>
            <p v-if="ledgerLoading" role="status">正在读取当天收支…</p>
            <p v-if="ledgerError" role="alert">{{ ledgerError }} <button type="button" @click="loadLedgerAgenda(selectedDate)">重试</button></p>
            <p v-if="!ledgerLoading && !ledgerError && !dayLedger.length && !dayWishes.length">这一天没有账目或愿望达成记录。</p>
            <RouterLink v-for="flow in dayLedger" :key="flow.id" class="calendar-ledger-row" :to="{ name: 'ledger', query: { record: flow.recordId, date: dayKey(selectedDate) } }">
              <span>{{ flow.title }}<small>{{ flow.category_name }} · {{ flowLabels[flow.kind] }}</small></span><strong>{{ currency(flow.amount) }}</strong>
            </RouterLink>
            <article v-for="event in dayWishes" :key="event.id" class="calendar-wish">
              <strong>{{ event.title }} · 已达成</strong><p>{{ event.period_start }} 至 {{ event.period_end }} · {{ currency(event.amount) }}</p>
              <RouterLink v-for="id in event.record_ids" :key="id" :to="{ name: 'ledger', query: { record: id } }">关联账目</RouterLink>
            </article>
          </section>
        </div>
        <aside v-else class="calendar-invitation"><span aria-hidden="true">DAY BY DAY</span><div><h2>选个日子，<br>重逢那天的你。</h2><p>点亮的日期里，藏着你留下的生活。<br>选择一天，看看当时发生了什么。</p></div></aside>
      </div>
    </div>
    <Teleport to="body"><DateTurnOverlay v-if="dateTurn" :key="dateTurn.serial" :from="dateTurn.from" :to="dateTurn.to" @done="dateTurn = null" /></Teleport>
  </div>
</template>

<style scoped src="@/assets/styles/persona-calendar.css"></style>

<style scoped>
.calendar-ledger{margin-top:17px;padding:12px 14px;background:#0d2962;border-top:3px solid var(--cyan);color:#ecf5ff}
.calendar-ledger header,.calendar-ledger-row{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.calendar-ledger h3,.calendar-ledger p{margin:0}.calendar-ledger h3{font-size:17px}.calendar-ledger p{margin-top:6px;font-size:12px;color:#c7deff}
.calendar-ledger :is(a,button){color:#7cf4ff;font-size:12px}.calendar-ledger-row{padding:9px 0;border-bottom:1px solid #5579be;min-height:41px}.calendar-ledger-row small{display:block;margin-top:3px;color:#d1e0ff}.calendar-ledger-row strong{font:italic 700 19px var(--font-display);color:#fff}
.calendar-wish{padding:8px 0;border-top:1px solid #ee246a;color:#fff;font-size:13px}.calendar-wish a{display:inline-block;margin:6px 12px 0 0}
.page { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.page-header { display: none; padding: 26px clamp(32px, 4vw, 72px) 0; align-items: baseline; gap: 14px; }
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

/* 日历左右布局（≥1200px）：日历卡固定左列 340px，当日记录右侧流式填充 */
.calendar-layout { display: block; }
.calendar-records { margin-top: 16px; }
@media (min-width: 1200px) {
  .calendar-layout { display: flex; align-items: flex-start; gap: 16px; }
  .calendar-full { width: 380px; flex-shrink: 0; align-self: flex-start; }
  .calendar-records { flex: 1; min-width: 0; margin-top: 0; }
}

.calendar-full { padding: 16px; }
.calendar-records-header {
  font-size: 13.5px; font-weight: 600; margin-bottom: 10px;
  display: flex; align-items: center; gap: 8px;
}
.calendar-records-count {
  font-family: var(--font-mono); font-size: 11px; color: var(--accent); font-weight: 400;
}

.calendar-page .page-content { padding-top:0; }
.calendar-layout { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(0,1fr); gap:25px; align-items:start; }
.calendar-full { width:auto; padding:26px; background:#0a38a7b3; border:1px solid #7bd8ff80; border-bottom:4px solid var(--cyan); }
.calendar-records { min-width:0; margin-top:0; }
.calendar-records-header { color:white; font-size:15px; padding:16px 0; border-bottom:1px solid #73afff60; margin-bottom:18px; }
.calendar-records-count { color:var(--cyan); font-size:16px; }
.calendar-records .empty-title { color:white; }.calendar-records .empty-desc { color:var(--on-dark); }
.calendar-invitation { position:relative; min-height:520px; overflow:hidden; color:white; border-bottom:1px solid #89b4ff50; }
.calendar-invitation > span { position:absolute; top:12px; left:0; font:italic 800 110px var(--font-display); color:#8edbff22; white-space:normal; line-height:.85; width:3em; transform:rotate(-8deg); }
.calendar-invitation img { position:absolute; height:580px; width:580px; top:-6px; left:50%; transform:translateX(-50%); opacity:.95; mask-image:linear-gradient(#000 65%,transparent 100%); }
.calendar-invitation::before { content:""; position:absolute; width:300px; height:300px; border:32px solid #50edfa45; border-radius:50%; right:-130px; top:100px; transform:scaleX(.65) rotate(-25deg); }
.calendar-invitation > div { position:absolute; left:0; bottom:15px; right:0; padding:25px 20px; background:linear-gradient(0deg,#06123f 55%,#06123f00); }
.calendar-invitation h2 { font-size:27px; font-weight:900; line-height:1.4; }
.calendar-invitation p { font-size:11px; color:var(--on-dark); margin-top:15px; line-height:1.9; }
@media(max-width:1099px){.calendar-layout{grid-template-columns:minmax(0,1fr)}.calendar-invitation{display:none}.calendar-full{padding:22px}.calendar-records{margin-top:8px}}
@media(max-width:599px){.calendar-full{padding:16px}.calendar-layout{gap:16px}}
</style>
