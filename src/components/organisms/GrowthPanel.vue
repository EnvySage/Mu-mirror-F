<script setup>
import { computed, onMounted, ref } from 'vue'
import { useGrowthStore } from '@/stores/growth'
import { useActionsStore } from '@/stores/actions'
import { useUIStore } from '@/stores/ui'
import GrowthRadar from '@/components/charts/GrowthRadar.vue'
import ActionCard from '@/components/organisms/ActionCard.vue'
import { createPrepareKey } from '@/api/actions'

const growth = useGrowthStore()
const actions = useActionsStore()
const ui = useUIStore()
const axesEditing = ref(false)
const axesDraft = ref([])
const manualDimensionId = ref('')
const manualPoints = ref('')
const manualReason = ref('')
const requestId = ref(makeRequestId())
const activeActionId = ref('')
const actionProposal = computed(() => actions.byId[activeActionId.value] || null)
const thresholds = computed(() => growth.config?.thresholds || growth.config?.growth_thresholds || [])
const manualMin = computed(() => Number(growth.config?.manual_min ?? growth.config?.manualMin ?? NaN))
const manualMax = computed(() => Number(growth.config?.manual_max ?? growth.config?.manualMax ?? NaN))
const entries = computed(() => (growth.entries || []).slice(0, 12))
const ready = computed(() => !!growth.overview && !!growth.config && Array.isArray(growth.axes) && growth.axes.length === 5)
const canAddManual = computed(() => growth.axes.some(axis => axis.id === manualDimensionId.value)
  && manualPoints.value !== ''
  && Number.isInteger(Number(manualPoints.value))
  && Number(manualPoints.value) >= manualMin.value && Number(manualPoints.value) <= manualMax.value
  && manualReason.value.trim().length > 0)

function makeRequestId() {
  return createPrepareKey()
}
function startAxisEdit() {
  axesDraft.value = growth.axesDefinition?.axes?.map(axis => ({ ...axis })) || growth.axes.map(axis => ({ id: axis.id, name: axis.name, description: axis.description || '' }))
  axesEditing.value = true
}
function updateAxis(index, key, value) {
  axesDraft.value = axesDraft.value.map((axis, current) => current === index ? { ...axis, [key]: value } : axis)
}
async function saveAxes() {
  const valid = axesDraft.value.length === 5 && axesDraft.value.every(axis => axis.name?.trim() && axis.description?.trim())
  if (!valid) return
  const saved = await growth.saveAxes(axesDraft.value.map(axis => ({ id: axis.id, name: axis.name.trim(), description: axis.description.trim() })))
  if (saved) axesEditing.value = false
}
async function addManualContribution() {
  if (!canAddManual.value || growth.saving) return
  const ok = await growth.addContribution({
    dimensionId: manualDimensionId.value,
    points: Number(manualPoints.value),
    reason: manualReason.value.trim(),
    requestId: requestId.value,
  })
  if (ok) {
    manualPoints.value = ''
    manualReason.value = ''
    requestId.value = makeRequestId()
  }
}
async function prepareCorrection(entry) {
  const dimensionId = entry.dimension_id ?? entry.dimensionId
  const response = await actions.prepare('growth.adjust', {
    entryId: entry.id,
    expectedVersion: entry.version,
    dimensionId,
    points: Number(entry.points || 0),
    reason: entry.reason || '',
  }, createPrepareKey())
  activeActionId.value = response?.id || ''
}
function sourceRecordId(entry) { return entry.source_record_id ?? entry.sourceRecordId ?? null }
function sourceLabel(entry) {
  const kind = String(entry.source_type ?? entry.sourceType ?? '').toLowerCase()
  if (sourceRecordId(entry)) return `记录 #${sourceRecordId(entry)}`
  return kind === 'manual' ? '手动记下' : '成长调整'
}
function entryDimension(entry) {
  const id = entry.dimension_id ?? entry.dimensionId
  const historicalName = entry.dimension_name ?? entry.dimensionName ?? entry.axis_name ?? entry.axisName
  if (historicalName) return historicalName
  const axis = growth.axes.find(item => item.id === id)
  const entryVersion = Number(entry.definition_version ?? entry.definitionVersion ?? -1)
  const currentVersion = Number(axis?.definition_version ?? axis?.definitionVersion ?? -2)
  if (axis && entryVersion === currentVersion) return axis.name
  return `${axis?.name || id || '未知维度'}（历史定义 v${entry.definition_version ?? entry.definitionVersion ?? '—'}）`
}
function formatDate(value) {
  if (!value) return '时间未知'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}
function openSource(entry) {
  const id = sourceRecordId(entry)
  if (!id) return
  ui.selectedRecordId = id
  ui.showDetail = true
}
async function onActionUpdated(card) {
  if (card?.state === 'SUCCEEDED') await growth.refresh()
}

onMounted(() => {
  growth.refresh().then(() => {
    if (!manualDimensionId.value) manualDimensionId.value = growth.axes[0]?.id || ''
  })
})
</script>

<template>
  <section class="growth-panel" aria-labelledby="growth-panel-title">
    <header class="growth-heading">
      <div>
        <h2 id="growth-panel-title">五维成长</h2>
        <p>只记录你确认过的进展；不因停更扣分。</p>
      </div>
      <button v-if="ready && !axesEditing" type="button" class="growth-secondary" @click="startAxisEdit">编辑五维</button>
    </header>

    <div v-if="growth.loading && !growth.overview" class="growth-status" role="status">正在读取成长账本…</div>
    <div v-else-if="growth.error && !ready" class="growth-status growth-error" role="alert">
      <span>{{ growth.error }}</span>
      <button type="button" class="growth-secondary" @click="growth.refresh">重新加载</button>
    </div>
    <div v-else-if="!ready" class="growth-status" role="status">成长分值配置暂不可用；当前不会展示或提交分数。<button type="button" class="growth-secondary" @click="growth.refresh">重新加载</button></div>
    <template v-else-if="ready">
      <div class="growth-overview">
        <GrowthRadar :axes="growth.axes" :thresholds="thresholds" />
        <div class="growth-axis-list" aria-label="各维度累计分数">
          <div v-for="axis in growth.axes" :key="axis.id" class="growth-axis-row">
            <div class="growth-axis-name"><strong>{{ axis.name }}</strong><small>{{ axis.description }}</small></div>
            <div class="growth-axis-score"><b>{{ Number(axis.total_points ?? axis.totalPoints ?? 0) }}</b><span>分</span><small>阶段 {{ axis.stage_index ?? axis.stageIndex ?? '—' }}</small></div>
          </div>
          <p v-if="growth.stage?.label" class="growth-stage">当前阶段：{{ growth.stage.label }}</p>
        </div>
      </div>

      <div v-if="axesEditing" class="growth-editor">
        <h3>调整五维名称和说明</h3>
        <p class="growth-help">维度 ID 固定。更名只影响以后显示和建议，历史条目保留确认时的定义。</p>
        <div v-for="(axis, index) in axesDraft" :key="axis.id" class="growth-axis-edit">
          <label>名称<input :value="axis.name" maxlength="24" required @input="updateAxis(index, 'name', $event.target.value)"></label>
          <label>说明<input :value="axis.description" maxlength="160" required @input="updateAxis(index, 'description', $event.target.value)"></label>
        </div>
        <div class="growth-actions"><button type="button" class="growth-secondary" @click="axesEditing=false">取消</button><button type="button" class="growth-primary" :disabled="growth.saving || axesDraft.some(axis => !axis.name?.trim() || !axis.description?.trim())" @click="saveAxes">{{ growth.saving ? '正在保存…' : '保存五维' }}</button></div>
      </div>

      <form v-else class="growth-manual-form" @submit.prevent="addManualContribution">
        <div class="growth-form-title"><h3>记下一笔进展</h3><span>手动记录 · {{ manualMin }}–{{ manualMax }} 分</span></div>
        <label>维度<select v-model="manualDimensionId" required><option v-for="axis in growth.axes" :key="axis.id" :value="axis.id">{{ axis.name }}</option></select></label>
        <label>分值<input v-model="manualPoints" type="number" :min="manualMin" :max="manualMax" step="1" required></label>
        <label class="growth-reason">进展原因<textarea v-model.trim="manualReason" maxlength="500" rows="2" placeholder="记下这次具体做了什么" required /></label>
        <div class="growth-actions"><span v-if="growth.error" class="growth-inline-error" role="alert">{{ growth.error }}</span><button type="submit" class="growth-primary" :disabled="growth.saving || !canAddManual">{{ growth.saving ? '正在保存…' : '记下这笔贡献' }}</button></div>
      </form>

      <div v-if="actionProposal" class="growth-action-slot">
        <h3>更正确认</h3>
        <ActionCard :proposal="actionProposal" @updated="onActionUpdated" />
      </div>

      <section class="growth-ledger" aria-labelledby="growth-ledger-title">
        <div class="growth-ledger-heading"><h3 id="growth-ledger-title">最近的进展</h3><span>累计账本 · 不按近期窗口扣减</span></div>
        <div v-if="growth.loading && !entries.length" class="growth-status" role="status">正在读取账本…</div>
        <p v-else-if="!entries.length" class="growth-empty">还没有成长贡献。确认记录整理结果或手动记下一笔后，会从这里开始累计。</p>
        <ol v-else class="growth-entry-list">
          <li v-for="entry in entries" :key="entry.id" class="growth-entry">
            <div class="growth-entry-points"><b>+{{ Number(entry.points || 0) }}</b><span>{{ entryDimension(entry) }}</span></div>
            <div class="growth-entry-body"><p>{{ entry.reason || '未填写原因' }}</p><small>{{ sourceLabel(entry) }} · {{ formatDate(entry.created_at ?? entry.createdAt ?? entry.confirmed_at ?? entry.confirmedAt) }} · 定义版本 {{ entry.definition_version ?? entry.definitionVersion ?? '—' }}</small>
              <button v-if="sourceRecordId(entry)" type="button" class="growth-source-link" @click="openSource(entry)">查看来源记录</button>
            </div>
            <button type="button" class="growth-correct" :disabled="!!activeActionId" @click="prepareCorrection(entry)">更正</button>
          </li>
        </ol>
        <p class="growth-note">记录删除时，只移除其关联贡献；停止未来记忆使用会保留已确认的成长账本。</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.growth-panel{padding:20px clamp(16px,3vw,28px);background:#08276190;border:1px solid #88b6ff40;color:var(--on-dark,#eef4ff)}.growth-heading,.growth-ledger-heading,.growth-form-title,.growth-axis-row,.growth-entry{display:flex;align-items:center;justify-content:space-between;gap:14px}.growth-heading h2{margin:0;font-size:20px}.growth-heading p,.growth-help,.growth-note,.growth-ledger-heading span,.growth-form-title span{margin:5px 0 0;color:#b9ceef;font-size:12px;line-height:1.5}.growth-overview{display:grid;grid-template-columns:minmax(250px,350px) minmax(0,1fr);align-items:center;gap:clamp(18px,4vw,48px);padding:16px 0 22px}.growth-axis-list{display:grid;gap:0}.growth-axis-row{padding:12px 0;border-bottom:1px solid #88b6ff30}.growth-axis-name{display:grid;gap:4px}.growth-axis-name strong{font-size:14px}.growth-axis-name small,.growth-axis-score small{color:#adc4eb;font-size:11px;line-height:1.4}.growth-axis-score{text-align:right;min-width:60px;display:grid;grid-template-columns:auto auto;justify-content:end;align-items:baseline;column-gap:4px}.growth-axis-score b{font-size:23px;color:var(--cyan,#65ddff)}.growth-axis-score span{font-size:11px;color:#b9ceef}.growth-axis-score small{grid-column:1/3}.growth-stage{margin:14px 0 0;color:#c9dbf7;font-size:12px}.growth-editor,.growth-manual-form,.growth-action-slot{padding:16px 0;border-top:1px solid #88b6ff40}.growth-editor h3,.growth-manual-form h3,.growth-action-slot h3,.growth-ledger h3{margin:0;font-size:15px}.growth-axis-edit{display:grid;grid-template-columns:minmax(120px,.7fr) minmax(180px,1.5fr);gap:12px;margin-top:12px}.growth-panel label{display:grid;gap:6px;color:#d0e0fa;font-size:12px}.growth-panel input,.growth-panel textarea,.growth-panel select{box-sizing:border-box;width:100%;min-height:38px;padding:8px 10px;border:1px solid #88b6ff66;border-radius:5px;background:#061d50;color:#f5f8ff;font:inherit}.growth-panel textarea{resize:vertical}.growth-manual-form{display:grid;grid-template-columns:minmax(150px,.8fr) minmax(100px,.35fr) minmax(210px,1.7fr);align-items:end;gap:12px}.growth-form-title{grid-column:1/-1;justify-content:flex-start}.growth-form-title span{margin:0}.growth-reason{min-width:0}.growth-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;grid-column:1/-1}.growth-secondary,.growth-primary,.growth-correct,.growth-source-link{border:1px solid #8fb9ff70;border-radius:4px;min-height:34px;padding:6px 11px;background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:12px}.growth-primary{background:var(--cyan,#65ddff);border-color:var(--cyan,#65ddff);color:#051746;font-weight:800}.growth-secondary:hover,.growth-correct:hover,.growth-source-link:hover{border-color:var(--cyan,#65ddff);color:var(--cyan,#65ddff)}.growth-primary:disabled,.growth-secondary:disabled,.growth-correct:disabled{opacity:.55;cursor:wait}.growth-inline-error,.growth-error{color:#ffd4da;font-size:12px}.growth-ledger{padding-top:18px;border-top:1px solid #88b6ff40}.growth-ledger-heading{margin-bottom:8px}.growth-entry-list{list-style:none;padding:0;margin:0}.growth-entry{align-items:flex-start;padding:12px 0;border-bottom:1px solid #88b6ff25}.growth-entry-points{display:grid;min-width:76px;text-align:center}.growth-entry-points b{font-size:20px;color:var(--cyan,#65ddff)}.growth-entry-points span{font-size:10px;color:#c7d9f5}.growth-entry-body{flex:1;min-width:0}.growth-entry-body p{margin:0 0 5px;font-size:13px;line-height:1.45;overflow-wrap:anywhere}.growth-entry-body small{color:#adc4eb;font-size:10px;line-height:1.5}.growth-source-link{display:block;min-height:28px;margin-top:5px;padding:3px 8px;font-size:11px}.growth-correct{flex-shrink:0}.growth-empty,.growth-status{padding:18px 8px;color:#c0d4f2;font-size:12px;line-height:1.5}.growth-empty{margin:0}.growth-note{padding-top:12px;border-top:1px solid #88b6ff25}.growth-error{display:flex;align-items:center;justify-content:space-between;gap:12px}
@media(max-width:700px){.growth-overview{grid-template-columns:1fr;gap:10px}.growth-manual-form{grid-template-columns:1fr 100px}.growth-form-title,.growth-reason,.growth-actions{grid-column:1/-1}.growth-axis-edit{grid-template-columns:1fr}.growth-entry{gap:8px}.growth-entry-points{min-width:56px}.growth-entry-points b{font-size:17px}}
</style>
