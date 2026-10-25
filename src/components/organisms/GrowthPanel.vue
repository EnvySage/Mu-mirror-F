<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useGrowthStore } from '@/stores/growth'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import GrowthRadar from '@/components/charts/GrowthRadar.vue'
import GrowthEntryDialog from '@/components/organisms/GrowthEntryDialog.vue'
import { createPrepareKey } from '@/api/actions'
import { useDialogFocus } from '@/composables/useDialogFocus'

const props = defineProps({ active: { type: Boolean, default: true } })
const growth = useGrowthStore()
const ui = useUIStore()
const auth = useAuthStore()
const axesEditing = ref(false)
const axesDraft = ref([])
const manualDimensionId = ref('')
const previewDimensionId = ref('')
const entryOpen = ref(false), entryAnchor = ref(null)
const drafts = new Map()
const manualPoints = ref('')
const manualReason = ref('')
const requestId = ref(makeRequestId())
const ledgerOpen = ref(false)
const onboardingOpen = ref(false)
const ledgerDialog = ref(null)
const onboardingDialog = ref(null)
const receipt = ref(null)
useDialogFocus(() => ledgerOpen.value, ledgerDialog, 'button', () => { ledgerOpen.value = false })
useDialogFocus(() => onboardingOpen.value, onboardingDialog, 'button', () => { onboardingOpen.value = false })
const axesLocked = computed(() => !!growth.axesDefinition?.locked || entries.value.length > 0)
const presets = [
  {
    key: 'classic',
    name: '经典五维',
    desc: '学识、勇气、行动、体贴、表达',
    axes: [
      { id: 'knowledge', name: '学识', description: '学习与理解' },
      { id: 'courage', name: '勇气', description: '面对困难' },
      { id: 'action', name: '行动', description: '落实计划' },
      { id: 'care', name: '体贴', description: '关怀自己与他人' },
      { id: 'expression', name: '表达', description: '清晰表达' },
    ],
  },
  {
    key: 'learning',
    name: '学习成长',
    desc: '输入、探索、实践、复盘、分享',
    axes: [
      { id: 'knowledge', name: '输入', description: '阅读、课程与知识积累' },
      { id: 'courage', name: '探索', description: '尝试陌生领域与难题' },
      { id: 'action', name: '实践', description: '把想法做成可验证的产出' },
      { id: 'care', name: '复盘', description: '回看过程，照顾自己的节奏' },
      { id: 'expression', name: '分享', description: '向他人讲清楚自己的理解' },
    ],
  },
  {
    key: 'balance',
    name: '身心平衡',
    desc: '学习、抗压、身体、情绪、关系',
    axes: [
      { id: 'knowledge', name: '学习', description: '保持输入与好奇心' },
      { id: 'courage', name: '抗压', description: '面对压力与不确定' },
      { id: 'action', name: '身体', description: '运动、睡眠与日常行动' },
      { id: 'care', name: '情绪', description: '觉察并照顾自己的感受' },
      { id: 'expression', name: '关系', description: '与重要的人沟通和连接' },
    ],
  },
]
const thresholds = computed(() => growth.config?.thresholds || growth.config?.growth_thresholds || [])
const manualMin = computed(() => Number(growth.config?.manual_min ?? growth.config?.manualMin ?? NaN))
const manualMax = computed(() => Number(growth.config?.manual_max ?? growth.config?.manualMax ?? NaN))
const pointChoices = computed(() => Number.isInteger(manualMin.value) && Number.isInteger(manualMax.value)
  ? Array.from({ length: Math.max(0, Math.min(8, manualMax.value - manualMin.value + 1)) }, (_, i) => manualMin.value + i) : [])
const selectedAxis = computed(() => growth.axes.find(axis => axis.id === manualDimensionId.value))
const axisPoints = axis => Number(axis.total_points ?? axis.totalPoints ?? 0)
function stageProgress(axis) {
  const score = axisPoints(axis)
  const limits = thresholds.value.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  const next = limits.find(n => n > score)
  const previous = [...limits].reverse().find(n => n <= score) ?? 0
  return next ? Math.min(100, Math.max(0, (score - previous) / (next - previous) * 100)) : 100
}
function selectAxis(axis, event) {
  if (growth.saving) return
  previewDimensionId.value = ''
  if (manualDimensionId.value === axis.id) {
    entryAnchor.value = event.currentTarget
    entryOpen.value = true
    return
  }
  drafts.set(manualDimensionId.value, { points: manualPoints.value, reason: manualReason.value, requestId: requestId.value })
  const draft = drafts.get(axis.id)
  manualDimensionId.value = axis.id
  manualPoints.value = draft?.points ?? ''
  manualReason.value = draft?.reason ?? ''
  requestId.value = draft?.requestId || makeRequestId()
  receipt.value = null
}
const entries = computed(() => growth.entries || [])
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
  const confirmed = { name: selectedAxis.value?.name, points: Number(manualPoints.value), id: requestId.value }
  receipt.value = null
  const ok = await growth.addContribution({
    dimensionId: manualDimensionId.value,
    points: Number(manualPoints.value),
    reason: manualReason.value.trim(),
    requestId: requestId.value,
  })
  if (ok) {
    receipt.value = confirmed
    manualPoints.value = ''
    manualReason.value = ''
    requestId.value = makeRequestId()
  }
}
function openLedger() {
  ledgerOpen.value = true
  growth.fetchEntries().catch(() => {})
}
function onboardingKey() {
  return `mirror_growth_onboarded_${auth.user?.id || 'guest'}`
}
function finishOnboarding() {
  localStorage.setItem(onboardingKey(), '1')
  onboardingOpen.value = false
}
async function choosePreset(preset) {
  if (growth.saving) return
  const saved = await growth.saveAxes(preset.axes)
  if (saved) finishOnboarding()
}
function startCustomAxes() {
  finishOnboarding()
  startAxisEdit()
}
function dismissOnboarding() {
  finishOnboarding()
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
  ledgerOpen.value = false
}

function offerOnboarding() {
  if (!manualDimensionId.value) manualDimensionId.value = growth.axes[0]?.id || ''
  if (props.active && ready.value && !axesLocked.value && localStorage.getItem(onboardingKey()) !== '1') onboardingOpen.value = true
}
watch(() => props.active, active => { if (active) offerOnboarding() })
onMounted(() => { growth.refresh().then(offerOnboarding) })
</script>

<template>
  <section class="growth-panel" aria-labelledby="growth-panel-title">
    <header class="growth-heading">
      <div>
        <span class="growth-kicker" aria-hidden="true">BUILD YOURSELF / 05</span>
        <h2 id="growth-panel-title">五维成长</h2>
        <p>只记录你确认过的进展；不因停更扣分。</p>
      </div>
      <div class="growth-heading-actions">
        <button v-if="ready" type="button" class="growth-secondary" @click="openLedger">成长账本</button>
        <button v-if="ready && !axesLocked && !axesEditing" type="button" class="growth-secondary" @click="startAxisEdit">编辑五维</button>
        <slot name="actions" />
      </div>
    </header>

    <div v-if="growth.loading && !growth.overview" class="growth-status" role="status">正在读取成长账本…</div>
    <div v-else-if="growth.error && !ready" class="growth-status growth-error" role="alert">
      <span>{{ growth.error }}</span>
      <button type="button" class="growth-secondary" @click="growth.refresh">重新加载</button>
    </div>
    <div v-else-if="!ready" class="growth-status" role="status">成长分值配置暂不可用；当前不会展示或提交分数。<button type="button" class="growth-secondary" @click="growth.refresh">重新加载</button></div>
    <template v-else-if="ready">
      <div class="growth-overview">
        <GrowthRadar :axes="growth.axes" :selected-id="manualDimensionId" @preview-axis="previewDimensionId = $event" />
        <div class="growth-axis-list" aria-label="各维度累计分数">
          <p class="growth-select-hint">选中维度，再点一次记一笔 <span aria-hidden="true">＋</span></p>
          <button v-for="(axis, index) in growth.axes" :key="axis.id" type="button" class="growth-axis-row" :style="{ '--axis': index }" :class="{ 'is-selected': (previewDimensionId || manualDimensionId) === axis.id }" :aria-pressed="manualDimensionId === axis.id" aria-haspopup="dialog" :aria-expanded="entryOpen && manualDimensionId === axis.id" :disabled="growth.saving" @click="selectAxis(axis, $event)">
            <span class="growth-axis-index" aria-hidden="true">0{{ index + 1 }}</span>
            <div class="growth-axis-name"><strong>{{ axis.name }}</strong><small>{{ manualDimensionId === axis.id ? '再点一次，记一笔 ↗' : axis.description }}</small></div>
            <div class="growth-axis-score"><b :key="axisPoints(axis)">{{ axisPoints(axis) }}</b><span>PT</span><small>阶段 {{ axis.stage_index ?? axis.stageIndex ?? '—' }}</small></div>
            <span class="growth-axis-track" aria-hidden="true"><i :style="{ width: `${stageProgress(axis)}%` }" /></span>
          </button>
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

      <GrowthEntryDialog :open="entryOpen" :busy="growth.saving" :anchor="entryAnchor" :title="`给「${selectedAxis?.name || '成长'}」记一笔`" :subtitle="`累计 ${selectedAxis ? axisPoints(selectedAxis) : 0} 分 · 本次可记 ${manualMin}–${manualMax} 分`" @close="entryOpen = false">
      <form class="growth-manual-form growth-entry-form" @submit.prevent="addManualContribution">
        <fieldset class="growth-point-picker" :disabled="growth.saving"><legend>选择分值</legend><div class="growth-point-options"><button v-for="points in pointChoices" :key="points" type="button" :class="{ active: Number(manualPoints) === points && manualPoints !== '' }" :aria-pressed="Number(manualPoints) === points && manualPoints !== ''" :aria-label="`增加 ${points} 分`" @click="manualPoints = points">+{{ points }}</button></div></fieldset>
        <label v-if="manualMax - manualMin >= 8" class="growth-custom-points">自定义分值<input v-model="manualPoints" type="number" :min="manualMin" :max="manualMax" step="1" required :disabled="growth.saving"><span>{{ manualMin }}–{{ manualMax }} 分</span></label>
        <label class="growth-reason">进展原因<textarea v-model.trim="manualReason" maxlength="500" rows="2" placeholder="记下这次具体做了什么" required :disabled="growth.saving" /></label>
        <div class="growth-actions"><span v-if="growth.error" class="growth-inline-error" role="alert">{{ growth.error }}</span><span class="growth-confirm-note">确认后计入成长账本</span><button type="submit" class="growth-primary" :disabled="growth.saving || !canAddManual">{{ growth.saving ? '正在确认…' : '确认这一步' }} <span aria-hidden="true">↗</span></button></div>
        <div class="growth-receipt-slot" aria-live="polite" aria-atomic="true"><div v-if="receipt" :key="receipt.id" class="growth-receipt"><b>+{{ receipt.points }}</b><span><strong>{{ receipt.name }} · 进展已记下</strong><small>已计入成长账本。</small></span></div></div>
      </form>
      </GrowthEntryDialog>

    </template>

    <Teleport to="body">
      <Transition name="ledger-drawer">
        <div v-if="ledgerOpen" class="ledger-scrim" @click.self="ledgerOpen = false">
          <aside ref="ledgerDialog" class="ledger-drawer" role="dialog" aria-modal="true" aria-labelledby="growth-ledger-title">
            <header class="ledger-head">
              <div><h3 id="growth-ledger-title">成长账本</h3><span>累计记录 · 不按近期窗口扣减</span></div>
              <button type="button" class="ledger-close" aria-label="关闭成长账本" @click="ledgerOpen = false">×</button>
            </header>
            <div class="ledger-body">
              <div v-if="growth.loading && !entries.length" class="growth-status" role="status">正在读取账本…</div>
              <p v-else-if="!entries.length" class="growth-empty">还没有成长贡献。确认记录整理结果或手动记下一笔后，会从这里开始累计。</p>
              <ol v-else class="growth-entry-list">
                <li v-for="entry in entries" :key="entry.id" class="growth-entry">
                  <div class="growth-entry-points"><b>+{{ Number(entry.points || 0) }}</b><span>{{ entryDimension(entry) }}</span></div>
                  <div class="growth-entry-body"><p>{{ entry.reason || '未填写原因' }}</p><small>{{ sourceLabel(entry) }} · {{ formatDate(entry.created_at ?? entry.createdAt ?? entry.confirmed_at ?? entry.confirmedAt) }} · 定义版本 {{ entry.definition_version ?? entry.definitionVersion ?? '—' }}</small>
                    <button v-if="sourceRecordId(entry)" type="button" class="growth-source-link" @click="openSource(entry)">查看来源记录</button>
                  </div>
                </li>
              </ol>
              <p class="growth-note">记录删除时，只移除其关联贡献；永久移除记忆会保留已确认的成长账本。</p>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <div v-if="onboardingOpen" class="onboarding-scrim" @click.self="dismissOnboarding">
        <section ref="onboardingDialog" class="onboarding-panel" role="dialog" aria-modal="true" aria-labelledby="growth-onboarding-title">
          <header>
            <h3 id="growth-onboarding-title">先定义你的五维</h3>
            <p>选一套现成的，或者自己定义。开始记下第一笔成长后，五维定义会锁定。</p>
          </header>
          <div class="preset-list">
            <button v-for="preset in presets" :key="preset.key" type="button" class="preset-card" :disabled="growth.saving" @click="choosePreset(preset)">
              <b>{{ preset.name }}</b>
              <span>{{ preset.desc }}</span>
              <small>{{ preset.axes.map(axis => axis.name).join(' · ') }}</small>
            </button>
          </div>
          <footer>
            <button type="button" class="growth-secondary" @click="dismissOnboarding">以后再说</button>
            <button type="button" class="growth-primary" :disabled="growth.saving" @click="startCustomAxes">自定义五维</button>
          </footer>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.growth-panel{padding:20px clamp(16px,3vw,28px);background:#08276190;border:1px solid #88b6ff40;color:var(--on-dark,#eef4ff)}.growth-heading-actions{display:flex;gap:8px;flex-wrap:wrap}.growth-heading,.growth-ledger-heading,.growth-form-title,.growth-axis-row,.growth-entry{display:flex;align-items:center;justify-content:space-between;gap:14px}.growth-heading h2{margin:0;font-size:20px}.growth-heading p,.growth-help,.growth-note,.growth-ledger-heading span,.growth-form-title span{margin:5px 0 0;color:#b9ceef;font-size:12px;line-height:1.5}.growth-overview{display:grid;grid-template-columns:minmax(250px,350px) minmax(0,1fr);align-items:center;gap:clamp(18px,4vw,48px);padding:16px 0 22px}.growth-axis-list{display:grid;gap:0}.growth-axis-row{padding:12px 0;border-bottom:1px solid #88b6ff30}.growth-axis-name{display:grid;gap:4px}.growth-axis-name strong{font-size:14px}.growth-axis-name small,.growth-axis-score small{color:#adc4eb;font-size:11px;line-height:1.4}.growth-axis-score{text-align:right;min-width:60px;display:grid;grid-template-columns:auto auto;justify-content:end;align-items:baseline;column-gap:4px}.growth-axis-score b{font-size:23px;color:var(--cyan,#65ddff)}.growth-axis-score span{font-size:11px;color:#b9ceef}.growth-axis-score small{grid-column:1/3}.growth-stage{margin:14px 0 0;color:#c9dbf7;font-size:12px}.growth-editor,.growth-manual-form,.growth-action-slot{padding:16px 0;border-top:1px solid #88b6ff40}.growth-editor h3,.growth-manual-form h3,.growth-action-slot h3,.growth-ledger h3{margin:0;font-size:15px}.growth-axis-edit{display:grid;grid-template-columns:minmax(120px,.7fr) minmax(180px,1.5fr);gap:12px;margin-top:12px}.growth-panel label{display:grid;gap:6px;color:#d0e0fa;font-size:12px}.growth-panel input,.growth-panel textarea,.growth-panel select{box-sizing:border-box;width:100%;min-height:38px;padding:8px 10px;border:1px solid #88b6ff66;border-radius:5px;background:#061d50;color:#f5f8ff;font:inherit}.growth-panel textarea{resize:vertical}.growth-manual-form{display:grid;grid-template-columns:minmax(150px,.8fr) minmax(100px,.35fr) minmax(210px,1.7fr);align-items:end;gap:12px}.growth-form-title{grid-column:1/-1;justify-content:flex-start}.growth-form-title span{margin:0}.growth-reason{min-width:0}.growth-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;grid-column:1/-1}.growth-secondary,.growth-primary,.growth-correct,.growth-source-link{border:1px solid #8fb9ff70;border-radius:4px;min-height:34px;padding:6px 11px;background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:12px}.growth-primary{background:var(--cyan,#65ddff);border-color:var(--cyan,#65ddff);color:#051746;font-weight:800}.growth-secondary:hover,.growth-correct:hover,.growth-source-link:hover{border-color:var(--cyan,#65ddff);color:var(--cyan,#65ddff)}.growth-primary:disabled,.growth-secondary:disabled,.growth-correct:disabled{opacity:.55;cursor:wait}.growth-inline-error,.growth-error{color:#ffd4da;font-size:12px}.growth-ledger{padding-top:18px;border-top:1px solid #88b6ff40}.growth-ledger-heading{margin-bottom:8px}.growth-entry-list{list-style:none;padding:0;margin:0}.growth-entry{align-items:flex-start;padding:12px 0;border-bottom:1px solid #88b6ff25}.growth-entry-points{display:grid;min-width:76px;text-align:center}.growth-entry-points b{font-size:20px;color:var(--cyan,#65ddff)}.growth-entry-points span{font-size:10px;color:#c7d9f5}.growth-entry-body{flex:1;min-width:0}.growth-entry-body p{margin:0 0 5px;font-size:13px;line-height:1.45;overflow-wrap:anywhere}.growth-entry-body small{color:#adc4eb;font-size:10px;line-height:1.5}.growth-source-link{display:block;min-height:28px;margin-top:5px;padding:3px 8px;font-size:11px}.growth-correct{flex-shrink:0}.growth-empty,.growth-status{padding:18px 8px;color:#c0d4f2;font-size:12px;line-height:1.5}.growth-empty{margin:0}.growth-note{padding-top:12px;border-top:1px solid #88b6ff25}.growth-error{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ledger-scrim{position:fixed;inset:0;z-index:60;display:flex;justify-content:flex-end;background:#020a2399;backdrop-filter:blur(2px)}
.ledger-drawer{display:flex;flex-direction:column;width:min(460px,94vw);height:100%;background:#06123f;color:var(--on-dark,#eef4ff);border-left:1px solid #88b6ff66;box-shadow:-16px 0 48px #01030f99}
.ledger-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px;border-bottom:1px solid #88b6ff40}
.ledger-head h3{margin:0;font-size:17px}.ledger-head span{display:block;margin-top:4px;color:#b9ceef;font-size:11px}
.ledger-close{width:34px;height:34px;border:1px solid #8fb9ff70;border-radius:4px;background:transparent;color:inherit;font-size:20px;line-height:1;cursor:pointer}
.ledger-close:hover{border-color:var(--cyan,#65ddff);color:var(--cyan,#65ddff)}
.ledger-body{flex:1;min-height:0;overflow-y:auto;padding:16px 20px 28px}
.ledger-drawer-enter-active,.ledger-drawer-leave-active{transition:opacity .2s ease,transform .24s cubic-bezier(.22,.8,.3,1)}
.ledger-drawer-enter-from,.ledger-drawer-leave-to{opacity:0;transform:translateX(24px)}
.onboarding-scrim{position:fixed;inset:0;z-index:70;display:grid;place-items:center;padding:20px;background:#020a23cc;backdrop-filter:blur(3px)}
.onboarding-panel{width:min(560px,100%);max-height:90dvh;overflow-y:auto;padding:24px;background:#06123f;border:1px solid #88b6ff66;border-left:4px solid var(--cyan);box-shadow:16px 18px 0 #01030f66;color:var(--on-dark,#eef4ff)}
.onboarding-panel header h3{margin:0;font-size:21px}.onboarding-panel header p{margin:6px 0 18px;color:#b9ceef;font-size:12px;line-height:1.7}
.preset-list{display:grid;gap:10px}
.preset-card{display:grid;gap:4px;padding:14px;text-align:left;border:1px solid #8fb9ff55;background:#082761;color:inherit;cursor:pointer;transition:border-color .15s,transform .12s}
.preset-card:hover:not(:disabled){border-color:var(--cyan);transform:translateX(3px)}
.preset-card:disabled{opacity:.55;cursor:wait}
.preset-card b{font-size:14px}.preset-card span{color:#c7d9f5;font-size:12px}.preset-card small{color:#8fb2df;font-size:11px}
.onboarding-panel footer{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
@media(max-width:700px){.growth-overview{grid-template-columns:1fr;gap:10px}.growth-manual-form{grid-template-columns:1fr 100px}.growth-form-title,.growth-reason,.growth-actions{grid-column:1/-1}.growth-axis-edit{grid-template-columns:1fr}.growth-entry{gap:8px}.growth-entry-points{min-width:56px}.growth-entry-points b{font-size:17px}}


/* Ability menu: a quiet field, sharp selection, and a single confirmation beat. */
.growth-panel{position:relative;isolation:isolate;overflow:hidden;margin-top:24px;padding:28px clamp(16px,3vw,32px) 10px;background:#06142e;border:1px solid #6ca1db66;border-top:4px solid #68f2ff}
.growth-panel::before{content:'GROWTH';position:absolute;right:-8px;top:90px;z-index:-1;color:#10284c;font:italic 900 clamp(90px,12vw,170px)/1 var(--font-display);letter-spacing:-.04em;transform:rotate(-90deg);transform-origin:70% 80%;pointer-events:none}
.growth-kicker{color:#70edff;font:700 12px var(--font-display);letter-spacing:.16em}.growth-heading{align-items:flex-end;flex-wrap:wrap;gap:12px}.growth-heading h2{font-size:30px;font-weight:900;letter-spacing:-.05em;margin-top:5px}.growth-heading p{font-size:11px}.growth-heading-actions{margin-bottom:4px}.growth-secondary{border-radius:0;min-height:40px}.growth-overview{grid-template-columns:minmax(220px,1fr) minmax(230px,1fr);gap:28px;padding:30px 0}
.growth-select-hint{display:flex;justify-content:space-between;gap:8px;margin:0 0 13px;font-size:11px;color:#cae1f4}.growth-select-hint span{font:600 10px var(--font-display);letter-spacing:.06em;color:#8dabd0}
.growth-axis-list{min-width:0;gap:7px}.growth-axis-row{position:relative;isolation:isolate;width:100%;min-height:65px;padding:10px 15px 12px 12px;gap:12px;border:0;background:transparent;color:#dfebff;text-align:left;cursor:pointer;transition:transform .24s cubic-bezier(.2,.9,.2,1),color .15s}
.growth-axis-row::before{content:'';position:absolute;inset:0;z-index:-1;background:#11294e;clip-path:polygon(3% 0,100% 0,97% 100%,0 100%);transition:background .16s}
.growth-axis-row.is-selected{transform:translateX(-7px);color:#04182d}.growth-axis-row.is-selected::before{background:#78efff}.growth-axis-row:not(.is-selected):hover{transform:translateX(-4px)}.growth-axis-row:not(.is-selected):hover::before{background:#1b3f6b}
.growth-axis-index{font:italic 800 20px var(--font-display);color:#81a0c5}.is-selected .growth-axis-index{color:#156783}.growth-axis-name{flex:1;min-width:0}.growth-axis-name strong{font-size:16px;font-weight:850;overflow-wrap:anywhere}.growth-axis-name small{font-size:10px;overflow-wrap:anywhere}.is-selected .growth-axis-name small,.is-selected .growth-axis-score small,.is-selected .growth-axis-score span{color:#154a67}
.growth-axis-score b{font:italic 800 32px/.95 var(--font-display);animation:score-arrive .45s cubic-bezier(.16,1,.3,1)}.is-selected .growth-axis-score b{color:#031a36}.growth-axis-score span{font:600 10px var(--font-display)}.growth-axis-score small{font-size:9px;margin-top:3px}.growth-axis-track{position:absolute;bottom:0;height:2px;left:14px;right:15px;background:#6a96cb30}.growth-axis-track i{display:block;height:100%;background:#5de7ff;transition:width .65s cubic-bezier(.16,1,.3,1)}.is-selected .growth-axis-track i{background:#ef4187}.growth-stage{margin:7px 0 0;text-align:right;font-size:10px}
.growth-manual-form{grid-template-columns:1fr;gap:16px;border-top:1px solid #5588c866;padding:24px 0 0}.growth-form-title{justify-content:space-between;align-items:center;gap:12px}.growth-form-title h3{font-size:17px;margin-top:3px}.growth-form-kicker{font:italic 800 23px var(--font-display)!important;color:#76edff!important}.growth-form-title>span{font-size:10px;text-align:right}.growth-point-picker{border:0;margin:0;padding:0;min-width:0}.growth-point-picker legend{font-size:11px;color:#bcd4f0;margin-bottom:9px}.growth-point-options{display:flex;gap:8px;flex-wrap:wrap}.growth-point-options button{min-width:48px;min-height:44px;padding:5px 12px;background:#132c50;border:1px solid #4c709d;color:#dbecff;font:italic 700 24px var(--font-display);cursor:pointer;transition:transform .17s,background .17s}.growth-point-options button:hover{transform:translateY(-3px);border-color:#75efff}.growth-point-options button.active{transform:rotate(-4deg) translateY(-3px);background:#f04489;border-color:#ffa6c9;color:white;box-shadow:3px 4px 0 #021023}.growth-panel textarea,.growth-panel input{border-radius:0;background:#0c2140}.growth-panel textarea{min-height:65px}.growth-actions{flex-wrap:wrap}.growth-confirm-note{margin-right:auto;font-size:10px;color:#adc8e9}.growth-primary{min-height:44px;border-radius:0;box-shadow:4px 4px 0 #020a1b;padding:10px 18px}.growth-primary>span{margin-left:18px}.growth-primary:disabled{cursor:not-allowed}.growth-primary:not(:disabled):hover{background:#b2f7ff;transform:translateY(-2px)}
.growth-receipt-slot{min-height:62px;grid-column:1/-1}.growth-receipt{display:flex;align-items:center;gap:12px;min-height:58px;background:#64e9ff;color:#03172e;padding:8px 15px;animation:receipt-arrive .6s cubic-bezier(.16,1,.3,1)}.growth-receipt>b{font:italic 900 39px/1 var(--font-display)}.growth-receipt strong,.growth-receipt small{display:block}.growth-receipt strong{font-size:12px}.growth-receipt small{font-size:10px;margin-top:4px}.growth-receipt i{margin-left:auto;font:italic 800 23px var(--font-display);transform:rotate(-5deg);color:#0b4364}
.growth-panel button:focus-visible{outline:3px solid #ff9fc9;outline-offset:4px}.growth-panel textarea:focus-visible,.growth-panel input:focus-visible{outline:2px solid #78efff;outline-offset:2px}
@keyframes score-arrive{from{transform:translateY(7px);opacity:.3}to{transform:none;opacity:1}}@keyframes receipt-arrive{0%{transform:translateX(-35px) skewX(-12deg);opacity:0}60%{transform:translateX(4px) skewX(2deg);opacity:1}100%{transform:none}}
@media(max-width:800px){.growth-overview{grid-template-columns:1fr;gap:26px}.growth-axis-list{width:100%}.growth-panel::before{display:none}}
@media(max-width:420px){.growth-heading h2{font-size:26px}.growth-point-options{gap:6px}.growth-point-options button{min-width:36px;padding:5px 7px;flex:1}.growth-form-title{align-items:flex-start}.growth-form-title>span{max-width:100px}.growth-receipt i{display:none}.growth-axis-row{gap:8px}.growth-axis-name strong{font-size:14px}}
@media(prefers-reduced-motion:reduce){.growth-axis-row,.growth-axis-row::before,.growth-axis-track i,.growth-point-options button{transition:none}.growth-axis-score b,.growth-receipt{animation:none}}

</style>
<style scoped>
.growth-panel{border:0;border-top:0;background:transparent;padding-top:38px;overflow:hidden}
.growth-panel::after{content:'';position:absolute;inset:8px 0 0;z-index:-2;background:linear-gradient(145deg,#102e56,#071425 60%);clip-path:polygon(0 2%,95% 0,100% 8%,100% 98%,4% 100%,0 94%)}
.growth-panel::before{content:'ABILITY /';top:120px;right:-12px;font-size:130px;color:#3079c214;transform:rotate(-16deg);z-index:-1}
.growth-heading{padding:0 10px 15px;border-bottom:1px solid #62badc33;transform:rotate(-1.5deg)}.growth-heading h2{display:inline-block;padding:5px 18px 7px 5px;background:#eff8e9;color:#10243e;clip-path:polygon(3% 0,100% 5%,93% 100%,0 92%);font-size:33px;text-shadow:2px 2px #71dcec}.growth-kicker{display:block;font-style:italic;color:#eaff9c;letter-spacing:.1em}.growth-heading p{margin-top:10px}
.growth-overview{gap:25px;padding-top:27px}.growth-select-hint span{color:#d7e9a8}
.growth-axis-row{transform:translateX(calc(var(--axis)*-3px)) rotate(-2deg);min-height:69px;padding-inline:22px 18px;transition:transform .4s cubic-bezier(.34,1.56,.64,1),color .2s}.growth-axis-row::before{background:#203853;clip-path:polygon(6% 3%,100% 0,94% 93%,0 100%)}.growth-axis-row.is-selected{transform:translateX(-14px) rotate(-4deg) scale(1.025);color:#10243a}.growth-axis-row.is-selected::before{background:#e7ff9f}.growth-axis-row:not(.is-selected):hover{transform:translateX(-10px) rotate(1deg)}.growth-axis-row.is-selected .growth-axis-index{color:#456e52}.growth-axis-row.is-selected .growth-axis-name small,.growth-axis-row.is-selected .growth-axis-score small{color:#3a5d48}.growth-axis-row.is-selected .growth-axis-track i{background:#f34885}.growth-axis-index{font-size:25px}.growth-axis-track{left:26px;right:27px;bottom:5px}
.growth-point-options button{border:0;clip-path:polygon(8% 0,100% 8%,89% 100%,0 92%);transform:rotate(-4deg);transition:transform .3s cubic-bezier(.34,1.56,.64,1),background .2s}.growth-point-options button:nth-child(2n){transform:rotate(3deg)}.growth-point-options button:hover{transform:translateY(-6px) rotate(8deg)}.growth-point-options button.active{background:#eaff9c;color:#172c49;transform:translateY(-5px) rotate(-11deg) scale(1.12)}
.growth-primary{clip-path:polygon(5% 0,100% 5%,94% 100%,0 94%);padding-inline:24px;background:#ddfc98;transform:rotate(-2deg);transition:transform .25s}.growth-primary:not(:disabled):hover{transform:rotate(3deg) translateY(-4px);background:#6ff0ff}.growth-form-kicker{display:inline-block;transform:rotate(-4deg);font-size:29px!important}.growth-receipt{position:relative;isolation:isolate;background:transparent;color:#06162e;min-height:78px;padding:14px 25px;transform:rotate(-2deg);animation:point-up .85s cubic-bezier(.16,1,.3,1)}.growth-receipt::before{content:'';position:absolute;inset:0;z-index:-1;background:#eafd9b;clip-path:polygon(0 35%,20px 12%,45px 0,60px 10%,calc(100% - 25px) 0,calc(100% - 45px) 19%,100% 81%,calc(100% - 60px) 89%,calc(100% - 70px) 100%,12px 94%,20px 72%)}.growth-receipt i{font-size:35px;color:#e83479;transform:rotate(-8deg);text-shadow:2px 2px #fff}.growth-receipt>b{font-size:48px}.growth-receipt-slot{min-height:90px}
@keyframes point-up{0%{transform:translateX(-90px) rotate(-12deg) scale(.55);opacity:0}50%{transform:translateX(12px) rotate(4deg) scale(1.08);opacity:1}75%{transform:translateX(-4px) rotate(-4deg) scale(.98)}100%{transform:rotate(-2deg)}}
.growth-point-options button:focus-visible,.growth-primary:focus-visible{outline-offset:-4px;box-shadow:inset 0 0 0 3px #ff6bac;text-decoration:underline;text-underline-offset:3px}
@media(max-width:800px){.growth-axis-list{padding-left:12px}.growth-panel{padding-top:32px}.growth-overview{padding-top:13px;gap:28px}.growth-panel::after{clip-path:polygon(0 1%,91% 0,100% 4%,100% 99%,6% 100%,0 97%)}.growth-heading h2{font-size:29px}.growth-heading{padding-inline:0}.growth-axis-row.is-selected{transform:translateX(-9px) rotate(-3deg)}.growth-receipt i{font-size:24px}}
@media(prefers-reduced-motion:reduce){.growth-panel *{animation:none!important;transition:none!important}}
.growth-entry-form{border:0;margin:0;padding:0;gap:14px}
.growth-entry-form label{display:grid;gap:7px;color:#c5dcee;font-size:12px}
.growth-entry-form input,.growth-entry-form textarea{width:100%;box-sizing:border-box;min-height:38px;padding:9px 10px;border:1px solid #54718d;background:#102a46;color:#eff9ff;font:inherit;border-radius:0}
.growth-entry-form textarea{min-height:66px;resize:vertical;max-height:180px}
.growth-entry-form input:focus-visible,.growth-entry-form textarea:focus-visible{outline:2px solid #78efff;outline-offset:2px}
.growth-entry-form .growth-point-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(38px,1fr));gap:7px}
.growth-entry-form .growth-point-options button{min-width:0;min-height:40px;font-size:23px;padding:5px}
.growth-entry-form .growth-custom-points{display:flex;align-items:center;gap:12px}.growth-custom-points input{width:92px}.growth-custom-points>span{font-size:10px;color:#91aec4}
.growth-entry-form .growth-actions{gap:10px}.growth-entry-form .growth-confirm-note{font-size:10px}
.growth-entry-form .growth-receipt-slot{min-height:0}.growth-entry-form .growth-receipt-slot:empty{display:none}
.growth-entry-form .growth-receipt{min-height:46px;padding:10px 15px}.growth-entry-form .growth-receipt>b{font-size:32px}
.growth-heading-actions{align-items:center}.growth-overview{padding-bottom:12px}
@media(prefers-reduced-motion:reduce){.growth-entry-form *{animation:none!important;transition:none!important}}
</style>
