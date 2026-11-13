<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getLedgerCategories, getLedgerRecords, getLedgerRecord } from '@/api/ledger'
import { currency, flowPayload, makeFlow, shanghaiToday, shiftDay, validAmount } from '@/utils/ledger'
import LedgerFlowFields from '@/components/ledger/LedgerFlowFields.vue'

const props = defineProps({ proposal: { type: Object, required: true }, busy: Boolean })
const emit = defineEmits(['save', 'cancel'])
const draft = props.proposal.payload || {}
const title = ref(draft.title || ''), description = ref(draft.description || '')
const recordId = ref(draft.recordId || draft.record_id || '')
const flows = ref((draft.flows?.length ? draft.flows : [{}]).map(flow => makeFlow(flow)))
const categories = ref([]), candidates = ref([]), target = ref(null), linkExisting = ref(!!recordId.value)
const error = ref(''), loading = ref(true)
const expenses = computed(() => (target.value?.flows || []).filter(flow => flow.kind === 'EXPENSE'))
let targetGeneration = 0

async function load() {
  loading.value = true; error.value = ''
  try { categories.value = await getLedgerCategories() || [] }
  catch (e) { error.value = e.message || '无法读取分类' }
  finally { loading.value = false }
}
async function loadCandidates() {
  if (!linkExisting.value) { recordId.value = ''; return }
  if (candidates.value.length) return
  try {
    const today = shanghaiToday()
    candidates.value = await getLedgerRecords({ start: shiftDay(today, -89), end: today, limit: 80 }) || []
  } catch (e) { error.value = e.message || '无法查找近期账目' }
}
watch(recordId, async id => {
  const token = ++targetGeneration
  target.value = null
  if (!id) return
  try {
    const entry = await getLedgerRecord(id)
    if (token === targetGeneration) target.value = entry
  } catch (e) { if (token === targetGeneration) error.value = e.message || '无法打开关联账目' }
}, { immediate: true })
onMounted(() => { load(); loadCandidates() })

function submit() {
  if (props.busy) return
  error.value = ''
  if (linkExisting.value && !recordId.value) { error.value = '请选择要追加的账目。'; return }
  if (flows.value.some(flow => !validAmount(flow.amount))) { error.value = '请填写每笔有效金额。'; return }
  if (flows.value.some(flow => flow.occurredOn !== shanghaiToday())) { error.value = '只可入账当天实际发生的流水。'; return }
  emit('save', {
    ...draft, title: title.value.trim(), description: description.value.trim(),
    recordId: linkExisting.value ? recordId.value : null,
    diaryMode: draft.diaryMode || 'NONE', flows: flows.value.map(flowPayload),
  })
}
</script>

<template>
  <form class="ledger-action-form" @submit.prevent="submit">
    <label class="action-append"><input v-model="linkExisting" type="checkbox" :disabled="busy" @change="loadCandidates" />追加到已有账目</label>
    <label v-if="linkExisting">已有账目
      <select v-model="recordId" :disabled="busy" required>
        <option value="">选择一条近期账目</option>
        <option v-if="target && !candidates.some(entry => entry.id === target.id)" :value="target.id">{{ target.title }} · {{ currency(target.net_expense) }}</option>
        <option v-for="entry in candidates" :key="entry.id" :value="entry.id">{{ entry.record_date }} · {{ entry.title }} · {{ currency(entry.net_expense) }}</option>
      </select>
    </label>
    <template v-else>
      <label>账目名称<input v-model="title" maxlength="100" :disabled="busy" /></label>
      <label>描述<input v-model="description" maxlength="500" :disabled="busy" /></label>
    </template>
    <LedgerFlowFields :flows="flows" :categories="categories" :related-expenses="expenses" :disabled="busy || loading"
      @add="flows.push(makeFlow())" @remove="flows.splice($event, 1)" />
    <p v-if="error" class="action-ledger-error" role="alert">{{ error }}</p>
    <div class="action-ledger-footer"><button type="button" :disabled="busy" @click="$emit('cancel')">取消修改</button><button type="submit" :disabled="busy || loading">{{ busy ? '处理中…' : '保存候选' }}</button></div>
  </form>
</template>

<style scoped>
.ledger-action-form{display:grid;gap:9px;margin-top:10px;color:#1d3f73}
.ledger-action-form>label{display:grid;gap:4px;font-size:13px;font-weight:700}.ledger-action-form>.action-append{display:flex;align-items:center;gap:8px}
.ledger-action-form>label :is(input:not([type=checkbox]),select){min-height:40px;width:100%;border:1px solid #aac4ef;padding:6px 8px;background:white;font:inherit;color:#18315a}
.action-ledger-error{margin:0;font-size:13px;color:#a91d53}
.action-ledger-footer{display:flex;justify-content:flex-end;gap:7px}.action-ledger-footer button{min-height:40px;border:1px solid #3562c5;padding:6px 10px;color:#1545ac}
.action-ledger-footer button:last-child{background:#124bd8;color:white}
</style>
