<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { downloadLedger, getLedgerBrief, getLedgerCategories, getLedgerRecord, getLedgerRecords, removeLedgerFlow, removeLedgerRecord } from '@/api/ledger'
import { fetchPreviewBlob } from '@/api/vault'
import { useToastStore } from '@/stores/toast'
import { currency, flowLabels, shanghaiToday, shiftDay } from '@/utils/ledger'
import LedgerDialog from '@/components/ledger/LedgerDialog.vue'
import LedgerEntryEditor from '@/components/ledger/LedgerEntryEditor.vue'
import LedgerPlanning from '@/components/ledger/LedgerPlanning.vue'

const route = useRoute(), router = useRouter(), toast = useToastStore()
const today = ref(shanghaiToday())
const from = ref(shiftDay(today.value, -6)), to = ref(today.value), query = ref('')
const categories = ref([]), entries = ref([]), day = ref(null), week = ref(null)
const viewError = ref(''), loading = ref(true), exporting = ref(false)
const activeDialog = ref(''), editorMode = ref('create'), editorSeed = ref(null)
const selected = ref(null), dialogError = ref(''), detailBusy = ref(false), editorBusy = ref(false)
const preview = ref(null), previewBusy = ref(false)
const panel = ref('entries')
let requestSerial = 0, detailSerial = 0, imageSerial = 0, clock

const totalLabels = [['expense', '付出'], ['income', '收入'], ['recovery', '收回']]
const scale = computed(() => Math.max(1, ...(week.value?.days || []).map(row => Number(row.expense || 0))))
const detailFlows = computed(() => selected.value?.flows || [])
const todayFlows = computed(() => detailFlows.value.filter(flow => flow.occurred_on === today.value))
const canDeleteGroup = computed(() => !!selected.value && selected.value.record_date === today.value && detailFlows.value.every(flow => flow.occurred_on === today.value))
const dateRangeValid = computed(() => !!from.value && !!to.value && from.value <= to.value && to.value <= today.value)
const editorTitle = computed(() => ({ create: '记一笔', edit: '修改当天流水', append: '追加流水' }[editorMode.value]))

async function load() {
  if (!dateRangeValid.value) { viewError.value = '请选择有效的查询日期。'; return }
  const generation = ++requestSerial
  loading.value = true; viewError.value = ''
  const range = [from.value, to.value], now = today.value
  const results = await Promise.allSettled([
    getLedgerCategories(), getLedgerRecords({ start: range[0], end: range[1], q: query.value.trim() || undefined, limit: 100 }),
    getLedgerBrief(now, now), getLedgerBrief(shiftDay(now, -6), now),
  ])
  if (generation !== requestSerial) return
  const targets = [categories, entries, day, week]
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') targets[index].value = index < 2 ? result.value || [] : result.value || null
    else targets[index].value = index < 2 ? [] : null
  })
  const failure = results.find(result => result.status === 'rejected')
  viewError.value = failure ? failure.reason?.message || '账本暂时无法加载。' : ''
  loading.value = false
}
function addCategory(category) { categories.value = [...categories.value.filter(item => item.id !== category.id), category] }
function disposePreview() {
  imageSerial++
  previewBusy.value = false
  if (preview.value?.url) URL.revokeObjectURL(preview.value.url)
  preview.value = null
}
function openEditor(mode = 'create', seed = null) {
  disposePreview()
  editorSeed.value = seed
  editorMode.value = mode
  dialogError.value = ''
  activeDialog.value = 'editor'
}
async function fetchDetail(id) {
  const generation = ++detailSerial
  disposePreview()
  selected.value = null; detailBusy.value = true; dialogError.value = ''
  activeDialog.value = 'detail'
  try {
    const entry = await getLedgerRecord(id)
    if (generation === detailSerial) selected.value = entry
  } catch (error) {
    if (generation === detailSerial) dialogError.value = error.message || '无法打开账目'
  } finally {
    if (generation === detailSerial) detailBusy.value = false
  }
}
function navigateToRecord(id) {
  const next = { ...route.query, record: id }
  delete next.compose
  if (route.query.record === id) fetchDetail(id)
  else router.push({ name: 'ledger', query: next })
}
function closeDialog() {
  detailSerial++
  disposePreview()
  activeDialog.value = ''
  if (route.query.record || route.query.compose) {
    const next = { ...route.query }
    delete next.record; delete next.compose
    router.replace({ name: 'ledger', query: next })
  }
}
function backFromEditor() {
  if (editorMode.value !== 'create' && selected.value) activeDialog.value = 'detail'
  else closeDialog()
}
async function saved(entry) {
  toast.success(entry?.diary_action_id ? '已入账，日记正在整理' : '账目已保存')
  activeDialog.value = ''
  load()
  if (entry?.id) navigateToRecord(entry.id)
  else closeDialog()
}
async function remove(flow = null) {
  if (!selected.value || detailBusy.value) return
  if (!window.confirm(flow ? '删除这笔当天流水？' : '删除这条账目及其当天流水？')) return
  detailBusy.value = true; dialogError.value = ''
  const id = selected.value.id
  try {
    if (flow) await removeLedgerFlow(id, flow.id)
    else await removeLedgerRecord(id)
    toast.success('已删除')
    load()
    if (flow && detailFlows.value.length > 1) await fetchDetail(id)
    else closeDialog()
  } catch (error) { dialogError.value = error.message || '删除失败' }
  finally { detailBusy.value = false }
}
async function showEvidence(flow) {
  if (previewBusy.value) return
  disposePreview()
  const generation = imageSerial
  previewBusy.value = true; dialogError.value = ''
  try {
    const blob = await fetchPreviewBlob(flow.evidence_id)
    if (generation !== imageSerial) return
    if (!(blob instanceof Blob) || !blob.type.startsWith('image/')) throw new Error('未收到图片凭证')
    preview.value = { url: URL.createObjectURL(blob), flowId: flow.id }
  } catch (error) {
    if (generation === imageSerial) dialogError.value = error.message || '无法读取凭证'
  } finally { if (generation === imageSerial) previewBusy.value = false }
}
async function exportRange(format) {
  if (!dateRangeValid.value || exporting.value) return
  exporting.value = true
  try { await downloadLedger(format, from.value, to.value); toast.success('导出完成') }
  catch (error) { toast.error(error.message || '导出失败') }
  finally { exporting.value = false }
}
watch(() => [route.query.record, route.query.compose, route.query.date], ([record, compose, date], old) => {
  if (route.name !== 'ledger') return
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today.value) {
    from.value = date; to.value = date
    if (old) load()
  }
  if (typeof record === 'string') fetchDetail(record)
  else if (compose === '1') openEditor()
  else if (old?.[0] || old?.[1]) { detailSerial++; activeDialog.value = ''; disposePreview() }
}, { immediate: true })
onMounted(() => {
  load()
  clock = setInterval(() => {
    const date = shanghaiToday()
    if (date === today.value) return
    if (to.value === today.value) to.value = date
    today.value = date
    load()
  }, 30000)
})
onBeforeUnmount(() => { clearInterval(clock); requestSerial++; detailSerial++; disposePreview() })
</script>

<template>
  <div class="page ledger-page">
    <div class="page-content">
      <header class="ledger-masthead">
        <div>
          <h1>账本</h1>
          <p>今天的每一笔，都有来处。</p>
        </div>
        <button class="ledger-main-action" type="button" @click="openEditor()">＋ 记一笔</button>
      </header>

      <section class="ledger-briefs" aria-label="收支简报">
        <article class="ledger-today">
          <div class="ticket-lines" aria-hidden="true" />
          <div class="ledger-today-copy">
            <h2>今日简报 <small>{{ today }}</small></h2>
            <p>净消费</p>
            <strong>{{ day ? currency(day.net_expense) : '—' }}</strong>
            <dl><div v-for="[key, label] in totalLabels" :key="key"><dt>{{ label }}</dt><dd>{{ day ? currency(day[key]) : '—' }}</dd></div></dl>
          </div>
        </article>
        <article class="ledger-week">
          <div class="week-heading"><h2>近七天</h2><strong>{{ week ? currency(week.net_expense) : '—' }}</strong></div>
          <p>已确认净消费 · 下方按日显示实际付出</p>
          <div v-if="week?.days?.length" class="week-bars" aria-label="近七天每日付出">
            <div v-for="row in week.days" :key="row.date" :title="row.date + ' 付出 ' + currency(row.expense)">
              <i :style="{ height: Math.max(3, 100 * Number(row.expense || 0) / scale) + '%' }" />
              <span>{{ row.date.slice(5) }}</span>
            </div>
          </div>
          <div v-else class="week-empty">{{ loading ? '正在加载…' : '这段时间还没有账目。' }}</div>
        </article>
      </section>

      <nav class="ledger-sections" aria-label="账本分区">
        <button type="button" :aria-pressed="panel === 'entries'" @click="panel = 'entries'">账目流水</button>
        <button type="button" :aria-pressed="panel === 'plans'" @click="panel = 'plans'">愿望与周期</button>
      </nav>
      <LedgerPlanning v-if="panel === 'plans'" :categories="categories" @ledger-updated="load" @open-record="navigateToRecord" />
      <section v-else class="ledger-history" aria-labelledby="ledger-entries">
        <div class="ledger-history-title"><h2 id="ledger-entries">账目流水</h2><span>按发生日查看</span></div>
        <form class="ledger-filter" @submit.prevent="load">
          <label>从<input v-model="from" type="date" :max="today" /></label>
          <label>至<input v-model="to" type="date" :max="today" /></label>
          <label class="ledger-search">搜索<input v-model="query" type="search" placeholder="账目名称或备注" maxlength="100" /></label>
          <button type="submit" :disabled="loading">查看</button>
        </form>
        <div class="ledger-export" aria-label="导出选中日期范围">
          <button type="button" :disabled="exporting || !dateRangeValid" @click="exportRange('csv')">导出 CSV</button>
          <button type="button" :disabled="exporting || !dateRangeValid" @click="exportRange('json')">导出 JSON</button>
        </div>
        <div v-if="viewError" class="ledger-message" role="alert"><p>{{ viewError }}</p><button type="button" @click="load">重试</button></div>
        <p v-if="loading" class="ledger-message" role="status">正在查账…</p>
        <p v-else-if="!entries.length && !viewError" class="ledger-message">这个日期范围里还没有账目。</p>
        <ul v-else class="ledger-items">
          <li v-for="entry in entries" :key="entry.id">
            <button type="button" class="ledger-item" @click="navigateToRecord(entry.id)">
              <div><strong>{{ entry.title }}</strong><p>{{ entry.record_date }} · {{ entry.flows?.length || 0 }} 笔</p></div>
              <div class="ledger-item-amount"><strong>{{ currency(entry.net_expense) }}</strong><small v-if="entry.income">收入 {{ currency(entry.income) }}</small><small v-if="entry.recovery">收回 {{ currency(entry.recovery) }}</small></div>
              <span aria-hidden="true">›</span>
            </button>
          </li>
        </ul>
      </section>
    </div>

    <LedgerDialog :open="activeDialog === 'editor'" :title="editorTitle" :busy="editorBusy" @close="backFromEditor">
      <LedgerEntryEditor v-if="activeDialog === 'editor'" :mode="editorMode" :entry="selected" :initial="editorSeed" :categories="categories"
        @busy="editorBusy = $event" @category="addCategory" @saved="saved" @close="backFromEditor" />
    </LedgerDialog>
    <LedgerDialog :open="activeDialog === 'detail'" :title="selected?.title || '账目详情'" @close="closeDialog">
      <p v-if="dialogError" class="ledger-detail-error" role="alert">{{ dialogError }}</p>
      <p v-if="detailBusy && !selected" role="status">正在读取账目…</p>
      <div v-if="selected" class="ledger-detail">
        <p v-if="selected.description">{{ selected.description }}</p>
        <dl><div v-for="[key, label] in totalLabels" :key="key"><dt>{{ label }}</dt><dd>{{ currency(selected[key]) }}</dd></div></dl>
        <ol>
          <li v-for="flow in detailFlows" :key="flow.id">
            <div><b>{{ flowLabels[flow.kind] }} {{ currency(flow.amount) }}</b><small>{{ flow.occurred_on }} · {{ flow.category_name }}</small><p v-if="flow.note">{{ flow.note }}</p></div>
            <div class="ledger-flow-actions">
              <button v-if="flow.evidence_id" type="button" :disabled="previewBusy" @click="showEvidence(flow)">凭证</button>
              <button v-if="flow.occurred_on === today" type="button" :disabled="detailBusy" @click="remove(flow)">删除</button>
            </div>
            <img v-if="preview?.flowId === flow.id" :src="preview.url" alt="此笔流水的支付凭证" />
          </li>
        </ol>
        <div v-if="selected.diary_ids?.length" class="ledger-diary-links">
          <RouterLink v-for="id in selected.diary_ids" :key="id" :to="{ name: 'records', query: { record: id } }">查看关联日记</RouterLink>
        </div>
        <footer>
          <button v-if="todayFlows.length" type="button" :disabled="detailBusy" @click="openEditor('edit')">修改当天流水</button>
          <button type="button" :disabled="detailBusy" @click="openEditor('append')">追加回款或流水</button>
          <button v-if="canDeleteGroup" type="button" :disabled="detailBusy" @click="remove()">删除账目</button>
        </footer>
      </div>
    </LedgerDialog>
  </div>
</template>

<style scoped>
.ledger-page{display:flex;flex:1;min-height:0;overflow:auto;color:#edf5ff}
.ledger-page .page-content{flex:1;width:100%;min-width:0;padding-top:clamp(24px,4vw,54px);padding-bottom:40px}
.ledger-masthead{display:flex;align-items:end;justify-content:space-between;gap:14px;padding:0 1px 17px;border-bottom:1px solid #5682d2;margin-bottom:17px}
.ledger-masthead h1{margin:0;font-size:clamp(45px,7vw,86px);font-weight:900;line-height:1;letter-spacing:-.1em;transform:skew(-9deg);transform-origin:left;color:#fff;text-shadow:4px 4px 0 #1251e7}
.ledger-masthead p{margin:12px 0 0;font-size:13px;color:#c6d9ff}
.ledger-main-action{flex-shrink:0;min-height:46px;padding:8px 18px;background:var(--cyan);color:var(--night);font-size:16px;font-weight:900;transform:skew(-8deg);box-shadow:4px 4px 0 var(--pink)}
.ledger-briefs{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:13px}
.ledger-today{position:relative;isolation:isolate;min-height:252px;overflow:hidden;background:var(--night);border-left:5px solid var(--cyan);clip-path:polygon(0 0,100% 0,100% 91%,96% 100%,0 100%)}
.ticket-lines{position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,#06123f 7%,#06123f 28%,#06123fdd 49%,#06123f00 76%),url('/art/ledger/receipt-tide.svg') right center/auto 100% no-repeat}
.ledger-today-copy{padding:22px clamp(14px,2.4vw,27px)}
.ledger-today h2,.ledger-week h2,.ledger-history h2{margin:0;font-size:19px;font-weight:900}
.ledger-today h2 small{margin-left:6px;font:italic 700 14px var(--font-display);color:var(--cyan);white-space:nowrap}
.ledger-today p,.ledger-week p{margin:12px 0 0;font-size:12px;color:#c2d5ff}
.ledger-today-copy>strong{font:italic 900 clamp(49px,8vw,78px)/1 var(--font-display);letter-spacing:-.025em;color:white;text-shadow:3px 3px 0 var(--electric);overflow-wrap:anywhere}
.ledger-today dl,.ledger-detail dl{display:flex;flex-wrap:wrap;gap:12px 16px;margin:17px 0 0;padding:0}
.ledger-today dl{width:fit-content;max-width:100%;padding:5px 12px 6px 0;background:linear-gradient(94deg,#06123fdd,#06123fc8);clip-path:polygon(0 0,100% 0,97% 100%,0 100%)}
.ledger-today dl div{border-left:2px solid var(--pink);padding-left:8px}
.ledger-today dt,.ledger-detail dt{font-size:11px;color:inherit}
.ledger-today dd,.ledger-detail dd{margin:2px 0 0;font:italic 800 22px var(--font-display);color:inherit}
.ledger-week{padding:20px clamp(14px,2.1vw,23px);background:#143572c9;border-top:4px solid var(--pink);min-width:0}
.week-heading{display:flex;justify-content:space-between;align-items:baseline;gap:6px;flex-wrap:wrap}.week-heading strong{font:italic 800 31px var(--font-display);color:var(--cyan)}
.ledger-week p{margin:3px 0 16px}
.week-bars{height:96px;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:5px;padding:0 0 15px;border-bottom:1px solid #84b6fb68}
.week-bars>div{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;position:relative}
.week-bars i{display:block;width:68%;background:var(--cyan);box-shadow:3px 0 0 #1762ff;transform:skew(-7deg)}
.week-bars span{font:700 11px var(--font-display);position:absolute;bottom:-15px;color:#d8e7ff}
.week-empty{display:grid;place-items:center;height:90px;color:#bed2fa;font-size:13px}
.ledger-sections{display:flex;gap:7px;margin-top:23px;align-items:center}
.ledger-sections button{padding:5px 12px;min-height:42px;border:1px solid #688fda;color:#dceaff;font-size:13px;font-weight:800;clip-path:polygon(0 0,100% 0,95% 100%,0 100%)}
.ledger-sections button[aria-pressed=true]{background:var(--cyan);border-color:var(--cyan);color:var(--night)}
.ledger-history{margin-top:9px;background:#0b2152ed;border:1px solid #4066ac;padding:clamp(14px,2.2vw,24px)}
.ledger-history-title{display:flex;align-items:baseline;gap:10px;margin-bottom:12px}.ledger-history-title span{font-size:11px;color:#c1d4f8}
.ledger-filter{display:grid;grid-template-columns:repeat(2,minmax(110px,.7fr)) minmax(130px,1.4fr) auto;gap:8px;align-items:end}
.ledger-filter label{display:grid;gap:5px;font-size:11px;color:#d0e0ff;min-width:0}
.ledger-filter input{min-height:40px;width:100%;min-width:0;padding:7px 9px;background:#f4f9ff;color:#091b43;border:0;border-radius:0;font:inherit;font-size:14px}
.ledger-filter button,.ledger-message button{min-height:40px;padding:6px 13px;background:#50edfa;color:var(--night);font-weight:800}
.ledger-export{display:flex;gap:9px;margin:11px 0 0;justify-content:flex-end}.ledger-export button{min-height:35px;border-bottom:1px solid #6bb8f3;padding:4px 5px;color:#c9e5ff;font-size:12px}
.ledger-export button:disabled,.ledger-filter button:disabled{opacity:.5}
.ledger-items{list-style:none;margin:9px 0 0;padding:0}.ledger-items li+li{border-top:1px solid #4765a0}
.ledger-item{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:13px;text-align:left;min-height:66px;width:100%;padding:9px 4px;color:#f3f8ff}
.ledger-item:hover{background:#3152a44d}.ledger-item strong{overflow-wrap:anywhere}.ledger-item p{font-size:11px;color:#b3c8f4;margin:4px 0 0}
.ledger-item-amount{display:grid;justify-items:end;gap:1px}.ledger-item-amount strong{font:italic 800 25px var(--font-display);color:var(--cyan)}.ledger-item-amount small{font-size:10px;color:#c9dcff}
.ledger-message{font-size:14px;margin:12px 0 0;color:#dbebff}.ledger-detail-error{color:#a92450;font-size:13px}
.ledger-detail p{margin:0 0 10px}.ledger-detail dl{margin:0;background:#e6efff;padding:10px 13px}.ledger-detail ol{padding:0;list-style:none}.ledger-detail li{display:grid;grid-template-columns:1fr auto;align-items:start;gap:8px;border-bottom:1px solid var(--line);padding:10px 0}
.ledger-detail li small{display:block;color:#4c6590;margin-top:4px}.ledger-detail li p{font-size:13px;margin:6px 0 0}.ledger-detail li img{max-width:min(100%,380px);grid-column:1/-1}
.ledger-flow-actions,.ledger-detail footer{display:flex;gap:7px;flex-wrap:wrap}.ledger-detail button,.ledger-diary-links a{min-height:37px;padding:6px 9px;border:1px solid #b8cbed;color:#174396;font-weight:700;font-size:12px}
.ledger-diary-links{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
@media(max-width:770px){.ledger-briefs{grid-template-columns:1fr}.ledger-today{min-height:225px}.ledger-filter{grid-template-columns:repeat(2,minmax(0,1fr))}.ledger-filter button{justify-self:stretch}}
@media(max-width:400px){.ledger-page .page-content{padding-inline:12px}.ledger-main-action{padding-inline:13px}.ledger-week{padding-top:13px}.ledger-item{gap:8px}.ledger-item-amount strong{font-size:22px}}
</style>
