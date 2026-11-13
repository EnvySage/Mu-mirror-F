<script setup>
import { flowLabels, currency, shanghaiToday } from '@/utils/ledger'
const props = defineProps({
  flows: { type: Array, required: true },
  categories: { type: Array, default: () => [] },
  relatedExpenses: { type: Array, default: () => [] },
  disabled: Boolean,
})
defineEmits(['add', 'remove'])
function selectExpense(flow) {
  const expense = props.relatedExpenses.find(row => row.id === flow.relatedExpenseId)
  if (expense) flow.categoryId = expense.category_id || expense.categoryId || 'other'
}
</script>

<template>
  <div class="ledger-flow-fields">
    <fieldset v-for="(flow, index) in flows" :key="flow.key" :disabled="disabled">
      <legend>流水 {{ index + 1 }}</legend>
      <div class="ledger-flow-grid">
        <label>性质<select v-model="flow.kind"><option v-for="(label, kind) in flowLabels" :key="kind" :value="kind">{{ label }}</option></select></label>
        <label>金额（元）<input v-model="flow.amount" inputmode="decimal" autocomplete="off" required placeholder="0.00" /></label>
        <label>分类<select v-model="flow.categoryId" aria-label="流水分类" required><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label>
        <label>发生日<input v-model="flow.occurredOn" type="date" :min="shanghaiToday()" :max="shanghaiToday()" required /></label>
      </div>
      <p v-if="flow.occurredOn && flow.occurredOn !== shanghaiToday()" class="ledger-flow-note" role="status">识别日期为 {{ flow.occurredOn }}。只可保存当天实际发生的流水，请核对凭证。</p>
      <label v-if="flow.kind === 'RECOVERY' && relatedExpenses.length">对应原支出
        <select v-model="flow.relatedExpenseId" @change="selectExpense(flow)">
          <option value="">按账目关联</option>
          <option v-for="expense in relatedExpenses" :key="expense.id" :value="expense.id">{{ expense.occurred_on || expense.occurredOn }} · {{ currency(expense.amount) }} {{ expense.note }}</option>
        </select>
      </label>
      <label>流水备注<input v-model="flow.note" maxlength="280" placeholder="选填，例如第二位朋友的 AA 款" /></label>
      <div class="ledger-flow-tail"><small v-if="flow.evidenceId">已附凭证</small><button v-if="flows.length > 1" type="button" @click="$emit('remove', index)">移除此笔</button></div>
    </fieldset>
    <button type="button" class="ledger-flow-add" :disabled="disabled" @click="$emit('add')">＋ 添加一笔流水</button>
  </div>
</template>

<style scoped>
.ledger-flow-fields{display:grid;gap:10px}
fieldset{min-width:0;margin:0;padding:12px;border:1px solid #a7bee4;background:#edf4ff}
legend{padding:0 6px;color:#1b48a0;font-size:13px;font-weight:800}
.ledger-flow-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}
label{display:grid;gap:5px;color:#284770;font-size:12px;font-weight:700;margin:4px 0}
input,select{width:100%;min-width:0;min-height:41px;padding:7px 8px;border:1px solid #b7cae9;border-radius:0;color:#10254e;background:white;font:inherit;font-size:14px}
.ledger-flow-tail{display:flex;align-items:center;justify-content:space-between;gap:7px;font-size:12px}
.ledger-flow-tail button{margin-left:auto;color:#981e55;min-height:35px;padding:0 8px}
.ledger-flow-add{justify-self:start;border:1px solid #4675cf;color:#1247b5;min-height:40px;padding:6px 11px;font-size:13px;font-weight:700}
.ledger-flow-note{font-size:12px;color:#963d04;margin:6px 0}
</style>
