<script setup>
import { computed, onMounted, ref } from 'vue'
import { useToastStore } from '@/stores/toast'
import { uploadVaultItem } from '@/api/vault'
import { addRecurringRule, addWish, changeWish, confirmDueLedgerRecord, getDueLedgerRecords, getRecurringRules, getWishEvents, getWishes, removeRecurringRule, removeWish, skipDueLedgerRecord } from '@/api/ledger'
import { currency, shanghaiToday, shiftDay, validAmount } from '@/utils/ledger'
import LedgerDialog from './LedgerDialog.vue'
import LedgerEvidence from './LedgerEvidence.vue'

const props = defineProps({ categories: { type: Array, default: () => [] } })
const emit = defineEmits(['ledger-updated', 'open-record'])
const toast = useToastStore()
const active = ref('wishes'), dialog = ref(''), current = ref(null)
const wishes = ref([]), recurring = ref([]), due = ref([]), events = ref([])
const error = ref(''), formError = ref(''), busy = ref(false), loading = ref(false)
const wishDefaults = () => ({ title: '', link: '', price: '', evidenceId: null, kind: 'ONCE', metric: 'SAVINGS', startOn: shanghaiToday(), windowDays: 30, windowMode: 'ROLLING', targetAmount: '', budget: '', categoryBudgets: {} })
const recurringDefaults = () => ({ title: '', amount: '', categoryId: 'other', startOn: shanghaiToday(), interval: 'MONTH', intervalCount: 1, note: '' })
const form = ref({})
const budgetScope = ref('all')
const metrics = { SAVINGS: '少花', INCOME: '收入', BALANCE: '结余' }
const intervals = { DAY: '天', WEEK: '周', MONTH: '个月' }
const statusLabels = { NOT_STARTED: '尚未开始', ACTIVE: '进行中', ACHIEVED: '已达成' }
const nearest = computed(() => [...wishes.value]
  .filter(wish => wish.state === 'ACTIVE')
  .sort((a, b) => Number(b.progress_ratio || 0) - Number(a.progress_ratio || 0))[0])
const previousAchievements = computed(() => {
  const eventsByPeriod = new Map(events.value.map(event => [`${event.wish_id}:${event.period_start}`, event]))
  return Object.fromEntries(wishes.value
    .filter(wish => wish.kind === 'RECURRING' && wish.state === 'ACTIVE' && wish.period_start)
    .map(wish => [wish.id, eventsByPeriod.get(`${wish.id}:${shiftDay(wish.period_start, -wish.window_days)}`)]))
})
const formTitle = computed(() => ({ wish: '许个愿望', edit: '调整目标金额', recurring: '新建周期账单', due: '确认周期账单' }[dialog.value]))

function linkFor(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

async function load() {
  loading.value = true; error.value = ''
  const today = shanghaiToday()
  const responses = await Promise.allSettled([getWishes(), getRecurringRules(), getDueLedgerRecords(), getWishEvents(shiftDay(today, -89), today)])
  const targets = [wishes, recurring, due, events]
  responses.forEach((result, i) => { if (result.status === 'fulfilled') targets[i].value = result.value || [] })
  const failure = responses.find(result => result.status === 'rejected')
  error.value = failure ? failure.reason?.message || '无法加载计划。' : ''
  loading.value = false
}
function open(kind, item = null) {
  current.value = item; formError.value = ''; budgetScope.value = 'all'
  if (kind === 'wish') form.value = wishDefaults()
  if (kind === 'recurring') form.value = recurringDefaults()
  if (kind === 'due') form.value = { amount: String(item.amount ?? '') }
  if (kind === 'edit') {
    form.value = {
      targetAmount: String(item.target_amount ?? ''), price: item.price == null ? '' : String(item.price), budget: item.budget == null ? '' : String(item.budget),
      categoryBudgets: Object.fromEntries(Object.entries(item.category_budgets || {}).map(([id, value]) => [id, String(value)])),
    }
    if (Object.keys(form.value.categoryBudgets).length) budgetScope.value = 'category'
  }
  dialog.value = kind
}
function changeKind() { form.value.windowMode = form.value.kind === 'RECURRING' ? 'FIXED' : 'ROLLING' }
function categoryBudget(id, checked) {
  if (checked) form.value.categoryBudgets[id] = ''
  else delete form.value.categoryBudgets[id]
}
function categoryLabel(id) { return props.categories.find(category => category.id === id)?.name || '未分类' }
async function savePhoto(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || busy.value) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    formError.value = '请选择 8 MB 以内的 PNG、JPG 或 WebP 图片。'; return
  }
  busy.value = true; formError.value = ''
  try {
    const result = await uploadVaultItem(file)
    form.value.evidenceId = result.data?.id
    if (!form.value.evidenceId) throw new Error('图片未保存')
  } catch (e) { formError.value = e.message || '上传失败' }
  finally { busy.value = false }
}
async function mutate(operation, message, ledger = false) {
  if (busy.value) return
  busy.value = true; formError.value = ''; error.value = ''
  try {
    await operation()
    dialog.value = ''
    toast.success(message)
    if (ledger) emit('ledger-updated')
    await load()
  } catch (e) {
    if (dialog.value) formError.value = e.message || '操作失败'
    else error.value = e.message || '操作失败'
  } finally { busy.value = false }
}
function submit() {
  const item = form.value
  if (dialog.value === 'due' || dialog.value === 'recurring') {
    if (!validAmount(item.amount)) { formError.value = '请输入有效的金额，最多两位小数。'; return }
    if (dialog.value === 'due') return mutate(() => confirmDueLedgerRecord(current.value.id, item.amount), '周期账单已入账', true)
    return mutate(() => addRecurringRule(item), '已创建周期账单')
  }
  if (!validAmount(item.targetAmount) || item.price && !validAmount(item.price)) { formError.value = '请输入有效的目标金额。'; return }
  const metric = dialog.value === 'edit' ? current.value.metric : item.metric
  const categoryBudgets = metric === 'SAVINGS' && budgetScope.value === 'category' ? item.categoryBudgets : {}
  const budget = metric === 'SAVINGS' && budgetScope.value === 'all' ? item.budget : null
  if (metric === 'SAVINGS' && (budgetScope.value === 'all' ? !validAmount(budget) : !Object.keys(categoryBudgets).length || Object.values(categoryBudgets).some(value => !validAmount(value)))) {
    formError.value = '少花目标需要一个总预算，或至少一个带有效预算的分类。'; return
  }
  const numeric = { targetAmount: item.targetAmount, price: item.price || null, budget, categoryBudgets }
  if (dialog.value === 'edit') return mutate(() => changeWish(current.value.id, numeric), '已调整愿望金额')
  if (item.link && !linkFor(item.link)) { formError.value = '请输入有效的 http 或 https 链接。'; return }
  return mutate(() => addWish({ ...item, ...numeric }), '愿望已加入')
}
function confirmDelete(kind, item) {
  if (!window.confirm(kind === 'wish' ? '取消这个愿望？' : '停止这条周期账单？')) return
  return mutate(() => kind === 'wish' ? removeWish(item.id) : removeRecurringRule(item.id), kind === 'wish' ? '愿望已取消' : '周期账单已停止')
}
function skip(item) {
  if (!window.confirm('跳过这期账单？')) return
  return mutate(() => skipDueLedgerRecord(item.id), '已跳过本期')
}
onMounted(load)
</script>

<template>
  <section class="ledger-planning" aria-label="愿望和周期账单">
    <div class="planning-head">
      <div class="planning-tabs" aria-label="计划切换">
        <button type="button" :aria-pressed="active === 'wishes'" @click="active = 'wishes'">愿望</button>
        <button type="button" :aria-pressed="active === 'recurring'" @click="active = 'recurring'">周期账单 <span v-if="due.length">{{ due.length }}</span></button>
      </div>
      <button type="button" class="planning-primary" @click="open(active === 'wishes' ? 'wish' : 'recurring')">{{ active === 'wishes' ? '＋ 许个愿望' : '＋ 新建规则' }}</button>
    </div>
    <p v-if="error" class="planning-alert" role="alert">{{ error }} <button type="button" @click="load">重试</button></p>
    <p v-if="loading" class="planning-empty" role="status">正在查看计划…</p>

    <div v-else-if="active === 'wishes'" class="wish-board">
      <p v-if="!wishes.length" class="planning-empty">给自己一个期待。预算内少花一点，或达到一个收入目标。</p>
      <article v-for="(wish, index) in wishes" :key="wish.id" class="wish-card" :style="{ '--wish': Math.min(index, 5) }" :class="{ achieved: wish.state === 'ACHIEVED', nearest: nearest?.id === wish.id, 'not-started': wish.state === 'NOT_STARTED' }">
        <div class="wish-head"><h3>{{ wish.title }}</h3><span>{{ statusLabels[wish.state] || '进行中' }}</span></div>
        <p v-if="nearest?.id === wish.id" class="nearest-label">最接近达标</p>
        <p>{{ wish.kind === 'RECURRING' ? '周期愿望' : '普通愿望' }} · {{ metrics[wish.metric] }} {{ currency(wish.target_amount) }}<span v-if="wish.price"> · 目标价格 {{ currency(wish.price) }}</span></p>
        <div class="wish-progress">
          <div class="wish-meter" :aria-label="'目标完成度 ' + Math.round(100 * Number(wish.progress_ratio || 0)) + '%'">
            <span :style="{ width: Math.min(100, Math.max(0, 100 * Number(wish.progress_ratio || 0))) + '%' }" />
          </div>
          <strong aria-hidden="true">{{ Math.round(100 * Number(wish.progress_ratio || 0)) }}<small>%</small></strong>
        </div>
        <small v-if="wish.period_start">{{ wish.period_start }} 至 {{ wish.period_end }} · 当前 {{ currency(wish.progress_amount) }}</small>
        <small v-else>从 {{ wish.start_on }} 起计算</small>
        <small v-if="wish.achievement">已达成于 {{ wish.achievement.achieved_on }}</small>
        <small v-if="previousAchievements[wish.id]" class="previous-achievement">✦ 上期已达成 · {{ previousAchievements[wish.id].achieved_on }} · {{ currency(previousAchievements[wish.id].amount) }}</small>
        <div class="planning-actions">
          <a v-if="linkFor(wish.link)" :href="linkFor(wish.link)" target="_blank" rel="noopener noreferrer">查看愿望链接</a>
          <button v-if="wish.evidence_id" type="button" @click="open('evidence', wish)">查看图片</button>
          <button type="button" @click="open('edit', wish)">调整金额</button>
          <button type="button" :disabled="busy" @click="confirmDelete('wish', wish)">取消愿望</button>
        </div>
      </article>
      <details v-if="events.length" class="wish-events">
        <summary>达成记录（近 90 天）</summary>
        <div v-for="event in events" :key="event.id" class="planning-row">
          <div><strong>{{ event.title }}</strong><small>{{ event.achieved_on }} · {{ event.period_start }} 至 {{ event.period_end }} · {{ currency(event.amount) }}</small></div>
          <div class="planning-actions"><button v-for="id in event.record_ids" :key="id" type="button" @click="emit('open-record', id)">查看关联账目</button></div>
        </div>
      </details>
    </div>

    <div v-else>
      <h3 v-if="due.length" class="planning-title">待确认</h3>
      <article v-for="item in due" :key="item.id" class="planning-row is-due">
        <div><strong>{{ item.title }} · {{ currency(item.amount) }}</strong><small>到期 {{ item.due_on }} · {{ categoryLabel(item.category_id) }}</small></div>
        <div class="planning-actions"><button type="button" :disabled="busy" @click="open('due', item)">确认今天已付</button><button type="button" :disabled="busy" @click="skip(item)">跳过</button></div>
      </article>
      <h3 v-if="recurring.length" class="planning-title">周期规则</h3>
      <p v-if="!recurring.length" class="planning-empty">把房租、订阅等账单设置成周期提醒。确认实际支付时才会入账。</p>
      <article v-for="rule in recurring" :key="rule.id" class="planning-row">
        <div><strong>{{ rule.title }} · {{ currency(rule.amount) }}</strong><small>每 {{ rule.interval_count }} {{ intervals[rule.interval] }} · 从 {{ rule.start_on }} 起</small></div>
        <button type="button" :disabled="busy" @click="confirmDelete('recurring', rule)">停止规则</button>
      </article>
    </div>

    <LedgerDialog :open="!!dialog && dialog !== 'evidence'" :title="formTitle" :busy="busy" @close="dialog = ''">
      <form v-if="dialog && dialog !== 'evidence'" class="planning-form" @submit.prevent="submit">
        <template v-if="dialog === 'wish'">
          <label>愿望名称<input v-model="form.title" required maxlength="100" /></label>
          <label>商品或愿望链接<input v-model="form.link" type="url" maxlength="1000" placeholder="选填" /></label>
          <label class="wish-upload">{{ form.evidenceId ? '已附图片，可替换' : '附一张愿望图片' }}<input type="file" accept="image/png,image/jpeg,image/webp" :disabled="busy" @change="savePhoto" /></label>
          <div class="planning-form-grid">
            <label>愿望类型<select v-model="form.kind" @change="changeKind"><option value="ONCE">普通愿望</option><option value="RECURRING">周期愿望</option></select></label>
            <label>统计指标<select v-model="form.metric"><option v-for="(label, key) in metrics" :key="key" :value="key">{{ label }}</option></select></label>
            <label>起算日<input v-model="form.startOn" type="date" required /></label>
            <label>每期天数<input v-model.number="form.windowDays" type="number" min="7" max="365" step="1" required /></label>
            <label v-if="form.kind === 'ONCE'">统计方式<select v-model="form.windowMode"><option value="ROLLING">滑动窗口</option><option value="FIXED">固定周期</option></select></label>
          </div>
        </template>
        <template v-if="dialog === 'wish' || dialog === 'edit'">
          <div class="planning-form-grid">
            <label>达标金额<input v-model="form.targetAmount" inputmode="decimal" required /></label>
            <label>目标物价格<input v-model="form.price" inputmode="decimal" placeholder="选填" /></label>
          </div>
          <template v-if="(dialog === 'wish' ? form.metric : current.metric) === 'SAVINGS'">
            <label v-if="dialog === 'wish'">预算范围<select v-model="budgetScope"><option value="all">全部消费</option><option value="category">按分类</option></select></label>
            <label v-if="budgetScope === 'all'">消费总预算<input v-model="form.budget" inputmode="decimal" required /></label>
            <div v-else class="budget-fields">
              <label v-for="category in dialog === 'edit' ? Object.keys(form.categoryBudgets).map(id => ({ id, name: categoryLabel(id) })) : categories" :key="category.id">
                <span><input v-if="dialog === 'wish'" type="checkbox" :checked="category.id in form.categoryBudgets" @change="categoryBudget(category.id, $event.target.checked)" />{{ category.name }}</span>
                <input v-if="category.id in form.categoryBudgets" v-model="form.categoryBudgets[category.id]" inputmode="decimal" :aria-label="category.name + '预算'" placeholder="该分类预算" required />
              </label>
            </div>
          </template>
        </template>
        <template v-if="dialog === 'recurring'">
          <label>账单名称<input v-model="form.title" maxlength="100" required placeholder="例如：房租" /></label>
          <div class="planning-form-grid">
            <label>预计金额<input v-model="form.amount" inputmode="decimal" required /></label>
            <label>分类<select v-model="form.categoryId"><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label>
            <label>首次到期日<input v-model="form.startOn" type="date" required /></label>
            <label>每隔<input v-model.number="form.intervalCount" type="number" min="1" max="365" step="1" required /></label>
            <label>频率单位<select v-model="form.interval"><option v-for="(name, key) in intervals" :key="key" :value="key">{{ name }}</option></select></label>
          </div>
          <label>备注<input v-model="form.note" maxlength="280" /></label>
        </template>
        <template v-if="dialog === 'due'">
          <p>{{ current.title }} · 到期 {{ current.due_on }}。按今天实际支付的金额入账。</p>
          <label>实际金额<input v-model="form.amount" inputmode="decimal" required /></label>
        </template>
        <p v-if="formError" class="planning-form-error" role="alert">{{ formError }}</p>
        <footer><button type="button" :disabled="busy" @click="dialog = ''">取消</button><button class="planning-primary" type="submit" :disabled="busy">{{ busy ? '处理中…' : dialog === 'due' ? '确认入账' : '保存' }}</button></footer>
      </form>
    </LedgerDialog>
    <LedgerEvidence v-if="dialog === 'evidence'" :id="current.evidence_id" title="愿望图片" @close="dialog = ''" />
  </section>
</template>

<style scoped src="../../assets/styles/ledger-planning.css"></style>
