<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { downloadLedger, getLedgerBrief, getLedgerCategories, getLedgerRecord, getLedgerRecords, removeLedgerFlow, removeLedgerRecord } from '@/api/ledger'
import { fetchPreviewBlob } from '@/api/vault'
import { useToastStore } from '@/stores/toast'
import { currency, entryHeadline, flowLabels, shanghaiToday, shiftDay } from '@/utils/ledger'
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
const displayEntries = computed(() => entries.value.map(entry => ({ ...entry, headline: entryHeadline(entry) })))
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
          <div class="ledger-title-line"><h1>账本</h1><time :datetime="today">{{ today.slice(5).replace('-', '.') }}</time></div>
          <p>今天的每一笔，都有来处。</p>
        </div>
        <button class="ledger-main-action" type="button" @click="openEditor()">＋ 记一笔</button>
      </header>

      <section class="ledger-briefs" aria-label="收支简报">
        <article class="ledger-today">
          <div class="ticket-lines" aria-hidden="true" />
          <div class="ledger-today-copy">
            <h2>今日简报 <small>{{ day ? day.flow_count : '—' }} 笔已确认</small></h2>
            <p>净支出</p>
            <strong>{{ day ? currency(day.net_expense) : '—' }}</strong>
            <dl><div v-for="[key, label] in totalLabels" :key="key"><dt>{{ label }}</dt><dd>{{ day ? currency(day[key]) : '—' }}</dd></div></dl>
          </div>
        </article>
        <article class="ledger-week">
          <div class="week-heading"><h2>近七天</h2><strong>{{ week ? currency(week.net_expense) : '—' }}</strong></div>
          <p>已确认净消费 · 下方按日显示实际付出</p>
          <div v-if="week?.days?.length" class="week-bars" aria-label="近七天每日付出">
            <div v-for="(row, index) in week.days" :key="row.date" :title="row.date + ' 付出 ' + currency(row.expense)" :style="{ '--bar': index }" role="img" :aria-label="row.date + ' 付出 ' + currency(row.expense)">
              <i :style="{ height: Math.max(3, 100 * Number(row.expense || 0) / scale) + '%' }" />
              <span>{{ row.date.slice(5) }}</span>
            </div>
          </div>
          <div v-else class="week-empty">{{ loading ? '正在加载…' : '这段时间还没有账目。' }}</div>
        </article>
      </section>

      <nav class="ledger-sections" aria-label="账本分区" :style="{ '--ledger-tab': panel === 'plans' ? 1 : 0 }">
        <button type="button" :aria-pressed="panel === 'entries'" @click="panel = 'entries'">账目流水</button>
        <button type="button" :aria-pressed="panel === 'plans'" @click="panel = 'plans'">愿望与周期</button>
      </nav>
      <Transition name="ledger-pane" mode="out-in">
      <LedgerPlanning v-if="panel === 'plans'" :categories="categories" @ledger-updated="load" @open-record="navigateToRecord" />
      <section v-else class="ledger-history" aria-labelledby="ledger-entries">
        <div class="ledger-history-title"><h2 id="ledger-entries">账目流水</h2><span>{{ entries.length }} 组账目</span></div>
        <details class="ledger-filter-panel">
        <summary><span>筛选与导出</span><time>{{ from.slice(5).replace('-', '.') }} — {{ to.slice(5).replace('-', '.') }}</time></summary>
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
        </details>
        <div v-if="viewError" class="ledger-message" role="alert"><p>{{ viewError }}</p><button type="button" @click="load">重试</button></div>
        <p v-if="loading" class="ledger-message" role="status">正在查账…</p>
        <p v-else-if="!entries.length && !viewError" class="ledger-message">这个日期范围里还没有账目。</p>
        <ul v-else class="ledger-items">
          <li v-for="(entry, index) in displayEntries" :key="entry.id" :style="{ '--row': Math.min(index, 7) }">
            <button type="button" class="ledger-item" :data-tone="entry.headline.tone" @click="navigateToRecord(entry.id)">
              <time class="ledger-item-day" :datetime="entry.record_date" aria-hidden="true">{{ entry.record_date.slice(8) }}<small>{{ entry.record_date.slice(5, 7) }} 月</small></time>
              <span class="ledger-item-paper">
                <span class="ledger-item-direction" aria-hidden="true">{{ entry.headline.tone === 'expense' ? '↙' : '↗' }}</span>
                <span class="ledger-item-copy"><strong>{{ entry.title }}</strong><span>{{ entry.record_date }} · {{ entry.flows?.length || 0 }} 笔<span v-if="entry.diary_ids?.length"> · 已关联随记</span></span></span>
                <span class="ledger-item-amount"><small>{{ entry.headline.label }}</small><strong>{{ currency(entry.headline.amount) }}</strong><small v-if="entry.income && entry.headline.tone !== 'income'">收入 {{ currency(entry.income) }}</small><small v-if="entry.recovery && entry.headline.tone !== 'recovery'">收回 {{ currency(entry.recovery) }}</small></span>
                <span class="ledger-item-arrow" aria-hidden="true">›</span>
              </span>
            </button>
          </li>
        </ul>
      </section>
      </Transition>
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

<style scoped src="../assets/styles/ledger-view.css"></style>
