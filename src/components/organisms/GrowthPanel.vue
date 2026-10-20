<script setup>
import { computed, onMounted, ref } from 'vue'
import { useGrowthStore } from '@/stores/growth'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import GrowthRadar from '@/components/charts/GrowthRadar.vue'
import { createPrepareKey } from '@/api/actions'

const growth = useGrowthStore()
const ui = useUIStore()
const auth = useAuthStore()
const axesEditing = ref(false)
const axesDraft = ref([])
const manualDimensionId = ref('')
const manualPoints = ref('')
const manualReason = ref('')
const requestId = ref(makeRequestId())
const ledgerOpen = ref(false)
const onboardingOpen = ref(false)
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

onMounted(() => {
  growth.refresh().then(() => {
    if (!manualDimensionId.value) manualDimensionId.value = growth.axes[0]?.id || ''
    if (!axesLocked.value && localStorage.getItem(onboardingKey()) !== '1') onboardingOpen.value = true
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
      <div class="growth-heading-actions">
        <button v-if="ready" type="button" class="growth-secondary" @click="openLedger">成长账本</button>
        <button v-if="ready && !axesLocked && !axesEditing" type="button" class="growth-secondary" @click="startAxisEdit">编辑五维</button>
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

    </template>

    <Teleport to="body">
      <Transition name="ledger-drawer">
        <div v-if="ledgerOpen" class="ledger-scrim" @click.self="ledgerOpen = false">
          <aside class="ledger-drawer" role="dialog" aria-modal="true" aria-labelledby="growth-ledger-title">
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
        <section class="onboarding-panel" role="dialog" aria-modal="true" aria-labelledby="growth-onboarding-title">
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
</style>
