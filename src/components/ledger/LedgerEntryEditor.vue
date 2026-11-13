<script setup>
import { computed, ref, watch } from 'vue'
import { createPrepareKey } from '@/api/actions'
import { uploadVaultItem } from '@/api/vault'
import { addLedgerCategory, appendLedgerFlows, createLedgerRecord, recognizeLedgerEvidence, updateLedgerRecord } from '@/api/ledger'
import { flowPayload, makeFlow, shanghaiToday, validAmount } from '@/utils/ledger'
import LedgerFlowFields from './LedgerFlowFields.vue'

const props = defineProps({
  mode: { type: String, default: 'create' },
  entry: { type: Object, default: null },
  initial: { type: Object, default: null },
  categories: { type: Array, default: () => [] },
})
const emit = defineEmits(['saved', 'close', 'category', 'busy'])
const today = shanghaiToday()
const requestId = createPrepareKey()
const title = ref(props.initial?.title ?? props.entry?.title ?? '')
const description = ref(props.initial?.description ?? props.entry?.description ?? '')
const initialFlows = props.initial?.flows?.length ? props.initial.flows
  : props.mode === 'edit' ? props.entry.flows.filter(flow => flow.occurred_on === today)
  : props.mode === 'append' ? [{ kind: 'RECOVERY', categoryId: props.entry?.flows.find(flow => flow.kind === 'EXPENSE')?.category_id }]
  : [{}]
const flows = ref(initialFlows.map(flow => makeFlow(flow, today)))
const keepDiary = ref(false), diaryText = ref('')
const error = ref(''), receiptNotice = ref(''), categoryName = ref('')
const saving = ref(false), recognizing = ref(false), categorySaving = ref(false)
const busy = computed(() => saving.value || recognizing.value || categorySaving.value)
watch(busy, value => emit('busy', value), { flush: 'sync' })
const relatedExpenses = computed(() => (props.entry?.flows || []).filter(flow => flow.kind === 'EXPENSE'))
const editTitle = computed(() => props.mode === 'create' || props.mode === 'edit' && props.entry?.record_date === today)
function addFlow() { flows.value.push(makeFlow({ kind: props.mode === 'append' ? 'RECOVERY' : 'EXPENSE' }, today)) }

async function addCategory() {
  if (!categoryName.value.trim() || busy.value) return
  categorySaving.value = true; error.value = ''
  try {
    const category = await addLedgerCategory(categoryName.value.trim())
    emit('category', category)
    if (flows.value.length === 1) flows.value[0].categoryId = category.id
    categoryName.value = ''
  } catch (e) { error.value = e.message || '创建分类失败' }
  finally { categorySaving.value = false }
}

async function readReceipt(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || busy.value) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { error.value = '请选择 PNG、JPG 或 WebP 图片'; return }
  if (file.size > 8 * 1024 * 1024) { error.value = '凭证图片须小于 8 MB'; return }
  const filled = flows.value.some(flow => flow.amount || flow.note || flow.evidenceId)
  if (filled && !window.confirm('识别结果会替换目前填写的流水。继续？')) return
  recognizing.value = true; error.value = ''; receiptNotice.value = ''
  try {
    const uploaded = await uploadVaultItem(file)
    const vaultId = uploaded.data?.id
    if (!vaultId) throw new Error('凭证上传后没有返回编号')
    // Preserve the authorized attachment even when the configured model cannot read images.
    flows.value[0].evidenceId = vaultId
    const result = await recognizeLedgerEvidence(vaultId)
    const rows = result?.draft?.flows
    if (result.status !== 'NOT_BILL' && Array.isArray(rows) && rows.length) {
      flows.value = rows.map(flow => makeFlow({ ...flow, evidenceId: vaultId }, today))
      if (editTitle.value) {
        title.value ||= result.draft.title || ''
        description.value ||= result.draft.description || ''
      }
    }
    receiptNotice.value = result.message || (result.status === 'NOT_BILL' ? '图片不像支付凭证，可手动填写。' : '请核对识别出来的金额、日期和分类。')
  } catch (e) {
    receiptNotice.value = '图片识别未完成，可继续手动填写。'
    error.value = e.message || '无法读取截图'
  } finally { recognizing.value = false }
}

async function submit() {
  if (busy.value) return
  error.value = ''
  if (!flows.value.length || flows.value.some(flow => !validAmount(flow.amount))) {
    error.value = '每笔金额须大于零，最多保留两位小数。'; return
  }
  if (flows.value.some(flow => flow.occurredOn !== shanghaiToday())) { error.value = '只可保存当天发生的流水。'; return }
  saving.value = true
  try {
    const input = {
      requestId, title: title.value.trim(), description: description.value.trim(),
      flows: flows.value.map(flowPayload),
      diaryMode: keepDiary.value ? diaryText.value.trim() ? 'AI' : 'TEMPLATE' : 'NONE',
      diaryText: keepDiary.value ? diaryText.value.trim() : '',
    }
    const result = props.mode === 'edit' ? await updateLedgerRecord(props.entry.id, input)
      : props.mode === 'append' ? await appendLedgerFlows(props.entry.id, { requestId, flows: input.flows })
      : await createLedgerRecord(input)
    emit('saved', result)
  } catch (e) { error.value = e.message || '账目未保存，请重试' }
  finally { saving.value = false }
}
</script>

<template>
  <form class="ledger-editor" @submit.prevent="submit">
    <div v-if="editTitle" class="entry-heading">
      <label>账目名称<input v-model="title" maxlength="100" placeholder="例如：和朋友吃晚餐" :disabled="busy" /></label>
      <label>记账描述<input v-model="description" maxlength="500" placeholder="选填，留下这笔钱的来由" :disabled="busy" /></label>
    </div>
    <p v-else class="ledger-editor-info">{{ entry?.title }} · 仅操作当天流水</p>
    <p v-if="mode !== 'create' && entry?.diary_ids?.length" class="ledger-editor-info">
      这条账目已关联日记。保存后会更新自动生成的随记，并保留手写正文。
    </p>
    <label v-if="mode !== 'edit'" class="ledger-upload">
      <span>{{ recognizing ? '正在阅读支付截图…' : '上传支付截图，帮我填一笔' }}</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" :disabled="busy" @change="readReceipt" />
    </label>
    <p v-if="receiptNotice" class="ledger-editor-info" role="status">{{ receiptNotice }}</p>
    <LedgerFlowFields :flows="flows" :categories="categories" :related-expenses="relatedExpenses" :disabled="busy" @add="addFlow" @remove="flows.splice($event, 1)" />
    <details class="ledger-category">
      <summary>自定义分类</summary>
      <div><input v-model="categoryName" aria-label="分类名称" maxlength="30" :disabled="busy" @keydown.enter.prevent="addCategory" /><button type="button" :disabled="busy || !categoryName.trim()" @click="addCategory">添加分类</button></div>
    </details>
    <template v-if="mode === 'create'">
      <label class="ledger-diary-check"><input v-model="keepDiary" type="checkbox" :disabled="busy" />顺便写日记</label>
      <label v-if="keepDiary">日记正文
        <textarea v-model="diaryText" maxlength="500" rows="3" placeholder="留空按账目生成随记；写下正文，AI 会帮你整合。" :disabled="busy" />
      </label>
    </template>
    <p v-if="error" class="ledger-form-error" role="alert">{{ error }}</p>
    <footer><button type="button" :disabled="busy" @click="emit('close')">取消</button><button class="ledger-submit" type="submit" :disabled="busy">{{ saving ? '保存中…' : '确认入账' }}</button></footer>
  </form>
</template>

<style scoped>
.ledger-editor,.entry-heading{display:grid;gap:12px}
.ledger-editor label{display:grid;gap:5px;font-size:13px;font-weight:700;color:#294874}
.ledger-editor :is(input:not([type=checkbox]),textarea){min-height:42px;width:100%;border:0;border-bottom:1px solid #9fb8dc;border-radius:0;padding:9px 10px;background:#edf3ff;color:var(--night);font:inherit;font-size:14px;transition:background .15s,border-color .15s}
.ledger-editor :is(input:not([type=checkbox]),textarea):focus{background:#e2faff;outline:2px solid var(--electric);outline-offset:1px}
.ledger-editor textarea{resize:vertical}
.ledger-editor .ledger-upload{position:relative;display:flex;align-items:center;min-height:47px;padding:10px 14px;background:#dcf8ff;border:1px dashed #5b8eb9;color:#1647a5;cursor:pointer;box-shadow:3px 3px 0 #c2d9f6}
.ledger-upload input{position:absolute;inset:0;opacity:0;cursor:pointer}
.ledger-upload:focus-within{outline:2px solid var(--electric);outline-offset:2px}
.ledger-editor-info,.ledger-form-error{font-size:13px;line-height:1.55;margin:0}
.ledger-form-error{color:#aa1f4e}
.ledger-category{font-size:13px;color:#254e96}
.ledger-category summary{cursor:pointer;padding:7px 0}
.ledger-category>div{display:grid;grid-template-columns:1fr auto;gap:8px}
.ledger-editor .ledger-diary-check{display:flex;align-items:center;gap:8px;min-height:40px}
footer{position:sticky;bottom:0;z-index:2;display:flex;justify-content:flex-end;gap:9px;padding:14px 0 5px;border-top:1px dashed #a7bddc;background:#f8fbfff5;backdrop-filter:blur(8px)}
button{min-height:41px;padding:7px 13px;border:1px solid #b3c8e9;font-weight:700}
.ledger-submit{background:#0c44cb;color:white;border-color:#0c44cb;box-shadow:3px 3px 0 var(--cyan);transition:transform .2s,box-shadow .2s}
.ledger-submit:hover{transform:translateY(-2px);box-shadow:4px 5px 0 var(--cyan)}
button:disabled{opacity:.5}
</style>
