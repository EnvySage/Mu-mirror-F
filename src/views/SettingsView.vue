<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { useGlossaryStore } from '@/stores/glossary'
import { useUIStore } from '@/stores/ui'
import { exportData } from '@/api/export'
import SettingsItem from '@/components/molecules/SettingsItem.vue'
import TermCard from '@/components/molecules/TermCard.vue'

const router = useRouter()
const settingsStore = useSettingsStore()
const auth = useAuthStore()
const toast = useToastStore()
const glossary = useGlossaryStore()
const ui = useUIStore()

// ==================== 个人词典（lexicon-design.md 5b） ====================

/** 已忽略组折叠态 */
const dismissedOpen = ref(false)
/** 「教镜子一个词」空表单展开态 */
const addOpen = ref(false)
const addDraft = ref({ term: '', aliasesText: '', description: '' })
/** 正在操作（确认/保存）的词条 id */
const busyTermId = ref(null)

onMounted(() => {
  settingsStore.fetchSettings()
  // 词条三组：设置图标角标 + 词典卡共用同一 store（MainLayout 不重复拉）
  glossary.fetch()
})

/** 词条操作统一收口：成功 toast 分文案，失败透 store.error */
async function runTermAction(id, action, payload, successMsg) {
  busyTermId.value = id
  const ok = action === 'update' ? await glossary.update(id, payload) : await glossary[action](id)
  busyTermId.value = null
  if (ok) toast.success(successMsg)
  else toast.error(glossary.error || '操作失败')
  return ok
}

/** 待确认：确认（词条卡确认按钮） */
function onTermConfirm(term) {
  runTermAction(term.id, 'confirm', null, `「${term.term}」已生效 · 下次对话开始使用`)
}

/** 改一改/编辑：保存（原地展开编辑框，PUT） */
function onTermSave(term, data) {
  runTermAction(term.id, 'update', data, '已更新')
}

/** 不要/删除按钮：待确认与已生效 = 忽略（dismiss 沉底不删行），已忽略组 = 真删除 */
function onTermDismiss(term) {
  if (term.status === 'dismissed') {
    runTermAction(term.id, 'remove', null, `「${term.term}」已删除`)
  } else {
    runTermAction(term.id, 'dismiss', null, `「${term.term}」已忽略 · 30 天后可能重新浮现`)
  }
}

/** 已忽略 → 恢复（重新确认进已生效） */
function onTermRestore(term) {
  runTermAction(term.id, 'confirm', null, `「${term.term}」已恢复生效`)
}

/** 「依据：查看原文」（设置页确认弹窗里该行隐藏，防御性兜底） */
function onTermOpenSource(term) {
  if (term.source_chunk_id == null) return
  ui.selectedRecordId = term.source_chunk_id
  ui.showDetail = true
}

/** 教镜子一个词：空表单新增（POST，直接 confirmed） */
async function submitAdd() {
  const { term, aliasesText, description } = addDraft.value
  if (!term.trim() || !description.trim()) {
    toast.warning('词条和理解说明都要填')
    return
  }
  const aliases = aliasesText.split(/[、,，\s]+/).map(s => s.trim()).filter(Boolean)
  const ok = await glossary.add({ term: term.trim(), aliases, description: description.trim() })
  if (ok) {
    toast.success(`「${term.trim()}」已教给镜子 · 下次对话开始使用`)
    addOpen.value = false
    addDraft.value = { term: '', aliasesText: '', description: '' }
  } else {
    toast.error(glossary.error || '新增失败')
  }
}

/** 手动触发抽取（懒人立即出候选，POST /glossary/extract） */
async function handleExtract() {
  const ok = await glossary.extract()
  if (ok) {
    toast.success(glossary.pending.length
      ? `抽取完成 · ${glossary.pending.length} 条候选待确认`
      : '抽取完成 · 近 14 天语料没有新候选')
  } else {
    toast.error(glossary.error || '抽取失败')
  }
}

/** rag_half_life 滑块（7-365，默认 30，6.4） */
const halfLifeDraft = ref(30)
const halfLifeEditing = ref(false)
const halfLifeValue = computed(() => Number(settingsStore.settings.rag_half_life) || 30)
const effectiveHalfLife = computed(() => (halfLifeEditing.value ? halfLifeDraft.value : halfLifeValue.value))

/** mirror_lookback 回看深度（0-3，默认 1，rolling-mirror-design.md §2）：select 即时保存（同 chips/toggle 模式） */
const lookbackOptions = [
  { value: 0, label: '只继承上月镜子', desc: '最省 · 生成时只带上月镜子全文，不翻原文' },
  { value: 1, label: '带上月原文', desc: '推荐 · 上月镜子 + 上月原文一起给 AI' },
  { value: 2, label: '带近三月原文', desc: '上月镜子 + 近三个月的原文' },
  { value: 3, label: '全部原文', desc: '慢 · 带全部历史原文，记录多时消耗大' },
]
const lookbackSaving = ref(false)
const lookbackValue = computed(() => {
  const raw = settingsStore.settings.mirror_lookback
  if (raw == null) return 1 // Number(null)=0 的坑：null/undefined 直接走默认，不进数值判定
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n <= 3 ? n : 1
})

async function saveLookback(e) {
  const val = Number(e.target.value)
  if (val === lookbackValue.value || lookbackSaving.value) return
  lookbackSaving.value = true
  const ok = await settingsStore.updateSettings({ mirror_lookback: val })
  lookbackSaving.value = false
  if (ok) toast.success('已保存回看深度')
  else toast.error(settingsStore.error || '保存失败')
}

const showEditModal = ref(false)
const editField = ref('')
const editLabel = ref('')
const editValue = ref('')
const editPlaceholder = ref('')
const editOptions = ref(null)

function openEdit(field, currentValue, label, placeholder, options = null) {
  editField.value = field
  editValue.value = currentValue || ''
  editLabel.value = label || field
  editPlaceholder.value = placeholder || ''
  editOptions.value = options
  showEditModal.value = true
}

async function saveEdit() {
  const data = {}
  data[editField.value] = editValue.value
  const success = await settingsStore.updateSettings(data)
  if (success) {
    showEditModal.value = false
    toast.success('已保存')
  } else {
    toast.error(settingsStore.error || '保存失败')
  }
}

function selectOption(value) {
  editValue.value = value
}

async function handleTestAi() {
  const result = await settingsStore.testAiConnection()
  result.success ? toast.success(result.message) : toast.error(result.message)
}

/** 模型协议 chips（anthropic / openai 二选一） */
async function selectProtocol(protocol) {
  if (settingsStore.settings.ai_protocol === protocol) return
  const ok = await settingsStore.updateSettings({ ai_protocol: protocol })
  if (ok) toast.success(protocol === 'anthropic' ? '已切换 Anthropic 协议' : '已切换 OpenAI 兼容协议')
  else toast.error(settingsStore.error || '保存失败')
}

/** 切换审核模式（5.5：auto 无审核窗口，权衡警告） */
async function toggleReviewMode() {
  const toAuto = settingsStore.settings.review_mode !== 'auto'
  if (toAuto && !window.confirm('开启自动审核后，AI 处理完成将直接确认入库，你没有手动调整片段和标签的机会。确定开启？')) {
    return
  }
  const newVal = toAuto ? 'auto' : 'manual'
  const ok = await settingsStore.updateSettings({ review_mode: newVal })
  if (ok) {
    if (toAuto) toast.info('已开启 auto：新记录将跳过审核直接入库')
    else toast.success('已切换为手动审核')
  } else {
    toast.error(settingsStore.error || '保存失败')
  }
}

/** 切换 Embedding 来源（1024 维硬约束说明见下方 note） */
async function toggleEmbeddingSource() {
  const newVal = settingsStore.settings.embedding_source === 'api' ? 'local' : 'api'
  const ok = await settingsStore.updateSettings({ embedding_source: newVal })
  if (ok) toast.success(newVal === 'api' ? '已切换为远程 API 服务' : '已切换为本地服务')
  else toast.error(settingsStore.error || '保存失败')
}

async function saveHalfLife() {
  const ok = await settingsStore.updateSettings({ rag_half_life: halfLifeDraft.value })
  if (ok) {
    toast.success('已保存检索时间衰减参数')
    halfLifeEditing.value = false
  } else {
    toast.error(settingsStore.error || '保存失败')
  }
}

/** 衰减权重预览 final_score = 相似度 × 1/(1 + 天数差/half_life) */
const halfLifePreview = computed(() =>
  `final_score = 相似度 × 1/(1 + 天数差/${effectiveHalfLife.value})`
)

/** 导出（GET /api/export/json | /api/export/markdown，blob 下载） */
const exportingKind = ref('')
async function handleExport(kind) {
  if (exportingKind.value) return
  exportingKind.value = kind
  const result = await exportData(kind === 'JSON' ? 'json' : 'markdown')
  exportingKind.value = ''
  result.ok ? toast.success(result.message) : toast.error(result.message)
}

function handleLogout() {
  if (confirm('确定要退出登录吗？')) {
    auth.logout()
    router.push('/auth/login')
  }
}
</script>

<template>
  <div class="page settings-page">
    <div class="page-header">
      <div class="page-title">设置</div>
      <div class="page-subtitle">模型 · 审核 · RAG · 数据</div>
    </div>
    <div class="page-content">
      <!-- AI 模型 -->
      <div class="settings-group">
        <div class="settings-group-title">AI 模型（加密存储 · 脱敏返回）</div>
        <div class="settings-card card">
          <SettingsItem
            icon="chat"
            icon-bg="var(--accent)"
            label="API Key"
            :description="settingsStore.settings.ai_api_key || '未配置'"
            action="edit"
            @click="openEdit('ai_api_key', '', 'API Key', '输入 API Key')"
          />
          <div class="protocol-chips">
            <button
              :class="['chip', { selected: settingsStore.settings.ai_protocol === 'anthropic' }]"
              @click="selectProtocol('anthropic')"
            >Anthropic 协议</button>
            <button
              :class="['chip', { selected: settingsStore.settings.ai_protocol === 'openai' }]"
              @click="selectProtocol('openai')"
            >OpenAI 兼容</button>
          </div>
          <SettingsItem
            icon="link"
            icon-bg="#8B5CF6"
            label="API 地址"
            :description="settingsStore.settings.ai_base_url || '使用默认'"
            action="edit"
            @click="openEdit('ai_base_url', settingsStore.settings.ai_base_url, 'API 地址', 'https://api.anthropic.com')"
          />
          <SettingsItem
            icon="zap"
            icon-bg="var(--success)"
            label="模型"
            :description="settingsStore.settings.ai_model || '未配置'"
            action="edit"
            @click="openEdit('ai_model', settingsStore.settings.ai_model, '模型名称', 'claude-sonnet-5 / gpt-4o')"
          />
          <div class="settings-item" style="cursor:default">
            <span />
            <button class="test-btn" :disabled="settingsStore.testLoading" @click="handleTestAi">
              {{ settingsStore.testLoading ? '测试中…' : '测试连接' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Embedding -->
      <div class="settings-group">
        <div class="settings-group-title">Embedding（维度硬约束 1024）</div>
        <div class="settings-card card">
          <SettingsItem
            icon="sparkle"
            icon-bg="var(--processing)"
            label="来源"
            :description="settingsStore.settings.embedding_source === 'api' ? '远程 API 服务' : '本地 BGE-m3（1024 维）'"
            action="toggle"
            :toggle-value="settingsStore.settings.embedding_source === 'api'"
            @toggle="toggleEmbeddingSource"
          />
          <SettingsItem
            icon="database"
            icon-bg="var(--warn)"
            label="API 模式地址"
            :description="settingsStore.settings.embedding_base_url || '未启用'"
            action="edit"
            @click="openEdit('embedding_base_url', settingsStore.settings.embedding_base_url, 'Embedding API 地址', 'https://api.example.com/v1')"
          />
          <SettingsItem
            icon="lock"
            icon-bg="var(--danger)"
            label="API 模式 Key"
            :description="settingsStore.settings.embedding_api_key || '未配置'"
            action="edit"
            @click="openEdit('embedding_api_key', '', 'Embedding API Key', '输入 Embedding API Key')"
          />
        </div>
        <div class="settings-note">
          切换 API 模式后，保存/测试连接时将调用 GetModelInfo 校验维度，非 1024 维模型会被拒绝。
        </div>
      </div>

      <!-- 审核 -->
      <div class="settings-group">
        <div class="settings-group-title">审核</div>
        <div class="settings-card card">
          <SettingsItem
            icon="eye"
            icon-bg="var(--processing)"
            label="自动审核（auto）"
            :description="settingsStore.settings.review_mode === 'auto' ? '已开启：跳过审核窗口，AI 直接入库' : '关闭：AI 处理后需手动确认'"
            action="toggle"
            :toggle-value="settingsStore.settings.review_mode === 'auto'"
            @toggle="toggleReviewMode"
          />
        </div>
        <div class="settings-note warn">
          开启后将没有手动调整片段的机会——AI 拆错了也无法纠正。默认建议保持手动。
        </div>
      </div>

      <!-- 个人词典（lexicon-design.md 5b：全量管理入口） -->
      <div class="settings-group">
        <div class="settings-group-title">个人词典 · 镜子这样理解你的话</div>
        <div class="settings-card card glossary-card">
          <!-- 顶部操作行：教镜子一个词 + 手动抽取 -->
          <div class="glossary-toolbar">
            <span class="glossary-hint">从你的日记里学"论文=毕设 RAG"这类个人指代</span>
            <div class="glossary-toolbar-btns">
              <button class="test-btn" :disabled="glossary.extracting" @click="handleExtract">
                {{ glossary.extracting ? '抽取中…' : '重新抽取' }}
              </button>
              <button class="glossary-add-btn" @click="addOpen = !addOpen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                教镜子一个词
              </button>
            </div>
          </div>

          <!-- 新增表单（空表单展开，直接 confirmed） -->
          <div v-if="addOpen" class="glossary-add-form">
            <label class="glossary-field">
              <span class="glossary-field-label">词条</span>
              <input v-model="addDraft.term" class="glossary-input" placeholder="比如：那个设计" @keyup.enter="submitAdd">
            </label>
            <label class="glossary-field">
              <span class="glossary-field-label">别名</span>
              <input v-model="addDraft.aliasesText" class="glossary-input" placeholder="可选 · 多个用顿号分隔，如：毕设、那个设计" @keyup.enter="submitAdd">
            </label>
            <label class="glossary-field">
              <span class="glossary-field-label">它指的是什么</span>
              <textarea v-model="addDraft.description" class="glossary-input glossary-textarea" rows="2" placeholder="镜子会按这句话理解你的记录" />
            </label>
            <div class="glossary-add-actions">
              <button class="term-btn-ghost glossary-cancel" @click="addOpen = false">取消</button>
              <button class="glossary-submit" @click="submitAdd">加入词典</button>
            </div>
          </div>

          <!-- 加载中 -->
          <div v-if="glossary.loading" class="glossary-empty"><span class="spinner" /> 加载中…</div>

          <template v-else>
            <!-- 1. 待确认（badge 计数） -->
            <div class="glossary-group-head">
              <span>待确认</span>
              <span v-if="glossary.pendingCount" class="glossary-badge">{{ glossary.pendingCount }}</span>
            </div>
            <template v-if="glossary.pending.length">
              <TermCard
                v-for="t in glossary.pending"
                :key="t.id"
                :term="t"
                group="pending"
                :busy="busyTermId === t.id"
                @confirm="onTermConfirm(t)"
                @save="data => onTermSave(t, data)"
                @dismiss="onTermDismiss(t)"
                @open-source="onTermOpenSource"
              />
            </template>
            <div v-else class="glossary-empty">没有待确认的候选 · 凌晨任务会从近 14 天日记里学新词</div>

            <!-- 2. 已生效 -->
            <div class="glossary-group-head">
              <span>已生效</span>
              <span v-if="glossary.confirmed.length" class="glossary-badge glossary-badge-mid">{{ glossary.confirmed.length }}</span>
            </div>
            <template v-if="glossary.confirmed.length">
              <TermCard
                v-for="t in glossary.confirmed"
                :key="t.id"
                :term="t"
                group="confirmed"
                :busy="busyTermId === t.id"
                @confirm="onTermConfirm(t)"
                @save="data => onTermSave(t, data)"
                @dismiss="onTermDismiss(t)"
                @open-source="onTermOpenSource"
              />
            </template>
            <div v-else class="glossary-empty">还没有已生效的词 · 确认候选或点上方「教镜子一个词」</div>

            <!-- 3. 已忽略（折叠） -->
            <template v-if="glossary.dismissed.length">
              <button class="glossary-group-head glossary-group-toggle" @click="dismissedOpen = !dismissedOpen">
                <span>已忽略</span>
                <span class="glossary-badge glossary-badge-low">{{ glossary.dismissed.length }}</span>
                <svg :class="['glossary-caret', { open: dismissedOpen }]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <template v-if="dismissedOpen">
                <TermCard
                  v-for="t in glossary.dismissed"
                  :key="t.id"
                  :term="t"
                  group="dismissed"
                  :busy="busyTermId === t.id"
                  @confirm="onTermRestore(t)"
                  @dismiss="onTermDismiss(t)"
                />
              </template>
            </template>
          </template>
        </div>
        <div class="settings-note">
          确认后对话会按词条理解检索你的记录；理解过时会导致偏差，可在这里随时修改。被忽略的词 30 天后可能重新浮现。
        </div>
      </div>

      <!-- 镜子引擎（rolling-mirror-design.md §2：回看深度 + 时间衰减同组） -->
      <div class="settings-group">
        <div class="settings-group-title">镜子引擎（RAG · 回看深度）</div>
        <div class="settings-card card">
          <div class="lookback-row">
            <div class="lookback-head">
              <span class="lookback-label">原文回看深度</span>
              <span class="lookback-value">{{ lookbackValue }}</span>
            </div>
            <select
              class="lookback-select"
              aria-label="生成镜子时带多少原文回看"
              :value="lookbackValue"
              :disabled="lookbackSaving"
              @change="saveLookback"
            >
              <option v-for="opt in lookbackOptions" :key="opt.value" :value="opt.value">{{ opt.value }} = {{ opt.label }}</option>
            </select>
            <div v-if="lookbackValue === 3" class="lookback-warn">记录多时生成会变慢且消耗更多 token</div>
          </div>
          <div class="half-life-row">
            <div class="half-life-header">
              <span class="half-life-label">半衰期</span>
              <span class="half-life-value">{{ effectiveHalfLife }} 天</span>
            </div>
            <input
              v-model.number="halfLifeDraft"
              type="range"
              min="7"
              max="365"
              value="30"
              @input="halfLifeEditing = true"
              @change="saveHalfLife"
            >
            <div class="settings-note" style="padding:8px 0 0">{{ halfLifePreview }}</div>
          </div>
        </div>
        <div class="settings-note">
          生成镜子时带多少原文回看：0=只继承上月镜子（最省） / 1=上月原文（推荐，默认） / 2=近三月原文 / 3=全部原文（慢，消耗大）。
        </div>
      </div>

      <!-- 数据 -->
      <div class="settings-group">
        <div class="settings-group-title">数据</div>
        <div class="settings-card card">
          <SettingsItem
            icon="download"
            icon-bg="#8A8F9C"
            label="导出 JSON"
            description="结构化备份 · 不含向量"
            action="none"
          >
            <template #append><button class="test-btn" :disabled="exportingKind === 'JSON'" @click="handleExport('JSON')">{{ exportingKind === 'JSON' ? '导出中…' : '导出' }}</button></template>
          </SettingsItem>
          <SettingsItem
            icon="file"
            icon-bg="#8A8F9C"
            label="导出 Markdown"
            description="人可读 · 不含向量"
            action="none"
          >
            <template #append><button class="test-btn" :disabled="exportingKind === 'Markdown'" @click="handleExport('Markdown')">{{ exportingKind === 'Markdown' ? '导出中…' : '导出' }}</button></template>
          </SettingsItem>
          <SettingsItem
            icon="logout"
            icon-bg="var(--danger)"
            :label="auth.user ? `退出登录（${auth.user.username}）` : '退出登录'"
            action="none"
          >
            <template #append>
              <button class="test-btn danger-btn" @click="handleLogout">退出</button>
            </template>
          </SettingsItem>
        </div>
      </div>

      <!-- 编辑弹窗 -->
      <Teleport to="body">
        <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
          <div class="modal-content">
            <div class="modal-header">
              <h3>{{ editLabel }}</h3>
              <button class="modal-close" title="关闭" @click="showEditModal = false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div class="modal-body">
              <div v-if="editOptions" class="option-list">
                <div
                  v-for="opt in editOptions"
                  :key="opt.value"
                  :class="['option-item', { active: editValue === opt.value }]"
                  @click="selectOption(opt.value)"
                >
                  <div class="option-radio"><div v-if="editValue === opt.value" class="option-radio-checked" /></div>
                  <div class="option-content">
                    <div class="option-label">{{ opt.label }}</div>
                    <div v-if="opt.desc" class="option-desc">{{ opt.desc }}</div>
                  </div>
                </div>
              </div>
              <input
                v-else
                v-model="editValue"
                :type="editField.includes('api_key') ? 'password' : 'text'"
                class="modal-input"
                :placeholder="editPlaceholder"
                @keyup.enter="saveEdit"
              >
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" @click="showEditModal = false">取消</button>
              <button class="btn-save" :disabled="settingsStore.loading" @click="saveEdit">
                {{ settingsStore.loading ? '保存中…' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
.page { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.page-header { display: none; padding: 26px 32px 0; align-items: baseline; gap: 14px; }
@media (min-width: 900px) { .page-header { display: flex; } }
.page-title { font-family: var(--font-display); font-size: 26px; font-weight: 600; }
.page-subtitle { font-size: 13px; color: var(--text-low); }

.page-content {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 10px 18px calc(96px + var(--safe-bottom));
  -webkit-overflow-scrolling: touch;
}
@media (min-width: 900px) {
  .page-content { padding: 18px 32px 40px; max-width: 760px; margin: 0 auto; }
}

.settings-group { margin-bottom: 20px; }
.settings-group-title {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .18em;
  color: var(--text-low); margin: 0 4px 8px;
}
.settings-card { overflow: hidden; }

.settings-note {
  font-size: 11.5px; color: var(--text-low); line-height: 1.6;
  padding: 10px 16px 14px;
}
.settings-note.warn { color: var(--warn); }

.protocol-chips { display: flex; gap: 8px; padding: 4px 16px 14px; }

.test-btn {
  font-size: 12.5px; color: var(--accent);
  padding: 5px 13px; border-radius: var(--radius-full);
  border: 1px solid var(--accent);
  flex-shrink: 0; cursor: pointer;
  transition: background .15s;
}
.test-btn:hover { background: var(--accent-soft); }
.test-btn:disabled { opacity: .5; cursor: not-allowed; }
.danger-btn { color: var(--danger); border-color: var(--danger); }
.danger-btn:hover { background: var(--danger-bg); }

/* half-life */
.half-life-row { padding: 13px 16px; }
.half-life-header { display: flex; justify-content: space-between; align-items: baseline; }
.half-life-label { font-size: 14px; }
.half-life-value { font-family: var(--font-mono); font-size: 13px; color: var(--accent); }
input[type="range"] { width: 100%; margin-top: 10px; accent-color: var(--accent); background: transparent; }

/* lookback（回看深度，rolling-mirror-design.md §2） */
.lookback-row {
  padding: 13px 16px; border-bottom: 1px solid var(--line);
  display: flex; flex-direction: column; gap: 10px;
}
.lookback-head { display: flex; justify-content: space-between; align-items: baseline; }
.lookback-label { font-size: 14px; }
.lookback-value { font-family: var(--font-mono); font-size: 13px; color: var(--accent); }
.lookback-select {
  width: 100%; font-size: 13px; color: var(--text-hi);
  padding: 8px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong); background: var(--card);
}
.lookback-select:focus { outline: none; border-color: var(--accent); }
.lookback-select:disabled { opacity: .55; }
.lookback-warn {
  font-size: 11.5px; color: var(--warn); line-height: 1.6;
  padding: 8px 10px; border-radius: var(--radius-sm);
  background: var(--ink-2); border: 1px solid var(--line);
}

/* 编辑弹窗（白卡） */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(26,26,23,.35);
  display: flex; align-items: center; justify-content: center;
  z-index: 50; padding: 20px;
}
.modal-content {
  background: #FFFFFF;
  border: 1px solid var(--line);
  border-radius: var(--radius); box-shadow: var(--shadow-float);
  width: 100%; max-width: 400px; max-height: 80dvh;
  display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid var(--line);
}
.modal-header h3 { font-family: var(--font-display); font-size: 16px; font-weight: 600; }
.modal-close {
  width: 28px; height: 28px; border-radius: 50%;
  color: var(--text-mid);
  display: grid; place-items: center;
}
.modal-close svg { width: 14px; height: 14px; }
.modal-body { padding: 20px; overflow-y: auto; }
.modal-footer {
  display: flex; gap: 12px; padding: 16px 20px;
  border-top: 1px solid var(--line);
}
.btn-cancel {
  flex: 1; padding: 10px; border-radius: var(--radius-sm);
  font-size: 14px; color: var(--text-mid);
  border: 1px solid var(--line);
}
.btn-save {
  flex: 1; padding: 10px; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 600;
  background: var(--accent); color: #FFFFFF;
}
.btn-save:hover:not(:disabled) { background: var(--accent-hover); }
.btn-save:disabled { opacity: .5; cursor: not-allowed; }

.modal-input {
  width: 100%; padding: 12px 14px;
  background: var(--card); border: 1px solid var(--line);
  border-radius: var(--radius-sm); font-size: 14px; color: var(--text-hi);
}
.modal-input:focus { outline: none; border-color: var(--accent); }

.option-list { display: flex; flex-direction: column; gap: 8px; }
.option-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 16px; border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  cursor: pointer; transition: all .15s;
}
.option-item.active { border: 1.5px solid var(--accent); background: var(--accent-soft); }
.option-radio {
  width: 18px; height: 18px; border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
  flex-shrink: 0; display: grid; place-items: center; margin-top: 2px;
}
.option-item.active .option-radio { box-shadow: inset 0 0 0 1.5px var(--accent); }
.option-radio-checked { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); }
.option-label { font-size: 14px; font-weight: 600; }
.option-desc { font-size: 12px; color: var(--text-low); line-height: 1.4; margin-top: 2px; }

/* ===== 个人词典卡（lexicon-design.md 5b） ===== */
.glossary-card { padding: 14px 16px 16px; }

.glossary-toolbar {
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
  padding-bottom: 12px; margin-bottom: 4px;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
}
.glossary-hint { font-size: 12px; color: var(--text-low); min-width: 0; }
.glossary-toolbar-btns { display: flex; gap: 8px; flex-shrink: 0; }

.glossary-add-btn {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12.5px; font-weight: 600; color: #FFFFFF;
  background: var(--accent); padding: 5px 13px; border-radius: var(--radius-full);
  transition: background .15s;
}
.glossary-add-btn:hover { background: var(--accent-hover); }
.glossary-add-btn svg { width: 12px; height: 12px; }

/* 新增表单 */
.glossary-add-form {
  display: flex; flex-direction: column; gap: 9px;
  margin: 12px 0 4px; padding: 12px;
  border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--ink-2);
  animation: cardIn .25s ease;
}
.glossary-field { display: flex; flex-direction: column; gap: 4px; }
.glossary-field-label {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; color: var(--text-low);
}
.glossary-input {
  width: 100%; padding: 8px 11px;
  background: var(--card); border: 1px solid var(--line);
  border-radius: var(--radius-sm); font-size: 13px; color: var(--text-hi);
  resize: vertical;
}
.glossary-input:focus { outline: none; border-color: var(--accent); }
.glossary-textarea { line-height: 1.6; min-height: 56px; }
.glossary-add-actions { display: flex; justify-content: flex-end; gap: 8px; }
.glossary-cancel {
  font-size: 12.5px; padding: 5px 14px; border-radius: var(--radius-full);
  color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong);
}
.glossary-cancel:hover { background: var(--card); color: var(--text-hi); }
.glossary-submit {
  font-size: 12.5px; font-weight: 600; padding: 5px 14px;
  border-radius: var(--radius-full); background: var(--accent); color: #FFFFFF;
}
.glossary-submit:hover { background: var(--accent-hover); }

/* 分组标题行 */
.glossary-group-head {
  display: flex; align-items: center; gap: 7px;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .16em;
  color: var(--text-low);
  margin: 14px 0 8px;
  text-align: left; width: 100%;
}
.glossary-group-toggle { cursor: pointer; }
.glossary-group-toggle:hover { color: var(--text-mid); }
.glossary-caret { width: 12px; height: 12px; margin-left: auto; transition: transform .2s; }
.glossary-caret.open { transform: rotate(90deg); }
.glossary-badge {
  min-width: 17px; height: 17px; padding: 0 5px; border-radius: var(--radius-full);
  background: var(--accent); color: #FFFFFF;
  font-size: 10.5px; line-height: 17px; text-align: center; letter-spacing: 0;
}
.glossary-badge-mid { background: var(--line-strong); color: var(--text-mid); }
.glossary-badge-low { background: var(--ink-2); color: var(--text-low); box-shadow: inset 0 0 0 1px var(--line); }

.glossary-empty {
  font-size: 12.5px; color: var(--text-low); line-height: 1.6;
  padding: 10px 12px; border-radius: var(--radius-sm); background: var(--ink-2);
  display: flex; align-items: center; gap: 8px;
}
.glossary-card .glossary-empty { margin-bottom: 2px; }
</style>
