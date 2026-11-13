<script setup>
import { ref, watch } from 'vue'
import { getDiaryLedgerRecords, getLedgerRecords, linkDiaryLedgerRecords } from '@/api/ledger'
import { currency, shanghaiToday, shiftDay } from '@/utils/ledger'

const props = defineProps({ diaryId: { type: [Number, String], required: true } })
const linked = ref([]), choices = ref([]), selected = ref(new Map())
const editing = ref(false), saving = ref(false), loading = ref(false), search = ref(''), history = ref(false), error = ref('')
let generation = 0, searchGeneration = 0
watch(() => props.diaryId, async id => {
  const token = ++generation
  editing.value = false; linked.value = []; error.value = ''
  try {
    const result = await getDiaryLedgerRecords(id)
    if (token === generation) linked.value = result || []
  } catch (e) { if (token === generation) error.value = e.message || '无法读取关联账目' }
}, { immediate: true })

async function find() {
  const token = ++searchGeneration, id = props.diaryId
  loading.value = true; error.value = ''
  try {
    const today = shanghaiToday()
    const result = await getLedgerRecords({ start: history.value ? shiftDay(today, -364) : today, end: today, q: search.value.trim() || undefined, limit: 40 })
    if (token === searchGeneration && id === props.diaryId && editing.value) choices.value = result || []
  } catch (e) { if (token === searchGeneration) error.value = e.message || '查账失败' }
  finally { if (token === searchGeneration) loading.value = false }
}
function begin() {
  selected.value = new Map(linked.value.map(row => [row.id, row]))
  choices.value = []; search.value = ''; history.value = false
  editing.value = true
  find()
}
function toggle(row, checked) {
  if (checked) selected.value.set(row.id, row)
  else selected.value.delete(row.id)
}
async function save() {
  if (saving.value) return
  const id = props.diaryId, token = generation
  saving.value = true; error.value = ''
  try {
    const result = await linkDiaryLedgerRecords(id, [...selected.value.keys()])
    if (token === generation) { linked.value = Array.isArray(result) ? result : [...selected.value.values()]; editing.value = false }
  } catch (e) { if (token === generation) error.value = e.message || '关联未保存' }
  finally { saving.value = false }
}
</script>

<template>
  <section class="diary-ledger" aria-labelledby="diary-ledger-heading">
    <header><h3 id="diary-ledger-heading">关联账目</h3><button v-if="!editing" type="button" @click="begin">关联已有账目</button></header>
    <p v-if="error" role="alert">{{ error }}</p>
    <ul v-if="linked.length && !editing">
      <li v-for="row in linked" :key="row.id"><RouterLink :to="{ name: 'ledger', query: { record: row.id } }">{{ row.title }} · {{ row.record_date }} · 净消费 {{ currency(row.net_expense) }}</RouterLink></li>
    </ul>
    <p v-else-if="!editing && !error">可以把相关消费或回款与这篇日记放在一起看。</p>
    <div v-if="editing">
      <form class="diary-ledger-search" @submit.prevent="find">
        <input v-model="search" type="search" aria-label="搜索账目" placeholder="输入账目名称或备注" />
        <label><input v-model="history" type="checkbox" @change="find" /> 查近一年</label>
        <button type="submit" :disabled="loading">搜索</button>
      </form>
      <div v-if="selected.size" class="diary-ledger-selected"><span>已选 {{ selected.size }} 笔</span><button v-for="row in selected.values()" :key="row.id" type="button" @click="toggle(row, false)">{{ row.title }} ×</button></div>
      <p v-if="loading" role="status">正在查账…</p>
      <p v-else-if="!choices.length">当前范围内没有账目。</p>
      <label v-for="row in choices" :key="row.id" class="diary-ledger-option"><input type="checkbox" :checked="selected.has(row.id)" @change="toggle(row, $event.target.checked)" /> {{ row.title }} <small>{{ row.record_date }} · {{ currency(row.net_expense) }}</small></label>
      <footer><button type="button" :disabled="saving" @click="editing = false">取消</button><button type="button" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存关联' }}</button></footer>
    </div>
  </section>
</template>

<style scoped>
.diary-ledger{margin:18px 0;padding:14px;border-left:4px solid var(--electric);background:var(--card);color:var(--night)}
header,footer,.diary-ledger-selected{display:flex;align-items:center;gap:8px;flex-wrap:wrap}header{justify-content:space-between}
h3,p{margin:0;font-size:14px}p{margin-top:9px;color:#345580}
button,a{min-height:34px;padding:5px 8px;border:1px solid #a5c2f1;color:#1243ae;font-size:12px;font-weight:700}
ul{list-style:none;padding:0;margin:8px 0}li{margin:4px 0}a{display:inline-block;overflow-wrap:anywhere}
.diary-ledger-search{display:flex;gap:7px;align-items:center;margin:9px 0;flex-wrap:wrap}
.diary-ledger-search>input{flex:1;min-width:130px;height:36px;border:1px solid #b5c8ec;padding:5px 8px}
.diary-ledger-search label{font-size:12px}
.diary-ledger-selected{font-size:12px;padding:5px 0}.diary-ledger-selected button{min-height:30px}
.diary-ledger-option{display:block;padding:7px 0;font-size:13px}.diary-ledger-option small{color:#4c6897}
footer{margin-top:8px;justify-content:flex-end}footer button:last-child{background:#124bd8;color:white}
</style>
