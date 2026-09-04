<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { exportData } from '@/api/export'
import SettingsItem from '@/components/molecules/SettingsItem.vue'

const router = useRouter()
const settingsStore = useSettingsStore()
const auth = useAuthStore()
const toast = useToastStore()

const showEditModal = ref(false)
const editField = ref('')
const editLabel = ref('')
const editValue = ref('')
const editPlaceholder = ref('')
const editOptions = ref(null)

/** rag_half_life 滑块（7-365，默认 30，6.4） */
const halfLifeDraft = ref(30)
const halfLifeEditing = ref(false)
const halfLifeValue = computed(() => Number(settingsStore.settings.rag_half_life) || 30)
const effectiveHalfLife = computed(() => (halfLifeEditing.value ? halfLifeDraft.value : halfLifeValue.value))

onMounted(() => {
  settingsStore.fetchSettings()
})

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
            icon-bg="var(--accent-grad)"
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
            icon-bg="rgba(167,139,250,.8)"
            label="API 地址"
            :description="settingsStore.settings.ai_base_url || '使用默认'"
            action="edit"
            @click="openEdit('ai_base_url', settingsStore.settings.ai_base_url, 'API 地址', 'https://api.anthropic.com')"
          />
          <SettingsItem
            icon="zap"
            icon-bg="rgba(74,222,156,.8)"
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
            icon-bg="rgba(110,231,240,.8)"
            label="来源"
            :description="settingsStore.settings.embedding_source === 'api' ? '远程 API 服务' : '本地 BGE-m3（1024 维）'"
            action="toggle"
            :toggle-value="settingsStore.settings.embedding_source === 'api'"
            @toggle="toggleEmbeddingSource"
          />
          <SettingsItem
            icon="database"
            icon-bg="rgba(255,200,98,.8)"
            label="API 模式地址"
            :description="settingsStore.settings.embedding_base_url || '未启用'"
            action="edit"
            @click="openEdit('embedding_base_url', settingsStore.settings.embedding_base_url, 'Embedding API 地址', 'https://api.example.com/v1')"
          />
          <SettingsItem
            icon="lock"
            icon-bg="rgba(232,121,249,.8)"
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
            icon-bg="rgba(232,121,249,.8)"
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

      <!-- RAG 时间衰减 -->
      <div class="settings-group">
        <div class="settings-group-title">RAG 时间衰减</div>
        <div class="settings-card card">
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
      </div>

      <!-- 数据 -->
      <div class="settings-group">
        <div class="settings-group-title">数据</div>
        <div class="settings-card card">
          <SettingsItem
            icon="download"
            icon-bg="rgba(148,163,184,.8)"
            label="导出 JSON"
            description="结构化备份 · 不含向量"
            action="none"
          >
            <template #append><button class="test-btn" :disabled="exportingKind === 'JSON'" @click="handleExport('JSON')">{{ exportingKind === 'JSON' ? '导出中…' : '导出' }}</button></template>
          </SettingsItem>
          <SettingsItem
            icon="file"
            icon-bg="rgba(148,163,184,.8)"
            label="导出 Markdown"
            description="人可读 · 不含向量"
            action="none"
          >
            <template #append><button class="test-btn" :disabled="exportingKind === 'Markdown'" @click="handleExport('Markdown')">{{ exportingKind === 'Markdown' ? '导出中…' : '导出' }}</button></template>
          </SettingsItem>
          <SettingsItem
            icon="logout"
            icon-bg="rgba(255,107,129,.8)"
            :label="auth.user ? `退出登录（${auth.user.username}）` : '退出登录'"
            action="none"
          >
            <template #append>
              <button class="test-btn" style="color:var(--danger);box-shadow:inset 0 0 0 1px rgba(255,107,129,.35)" @click="handleLogout">退出</button>
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
              <button class="modal-close" @click="showEditModal = false">×</button>
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
  .page-content { padding: 18px 32px 40px; max-width: 760px; }
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
  font-size: 12.5px; color: var(--cyan);
  padding: 5px 13px; border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px rgba(110,231,240,.35);
  flex-shrink: 0; cursor: pointer;
}
.test-btn:disabled { opacity: .5; cursor: not-allowed; }

/* half-life */
.half-life-row { padding: 13px 16px; }
.half-life-header { display: flex; justify-content: space-between; align-items: baseline; }
.half-life-label { font-size: 14px; }
.half-life-value { font-family: var(--font-mono); font-size: 13px; color: var(--cyan); }
input[type="range"] { width: 100%; margin-top: 10px; accent-color: #A78BFA; background: transparent; }

/* 编辑弹窗（暗色玻璃） */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(5,7,15,.6);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 50; padding: 20px;
}
.modal-content {
  background: rgba(19,23,44,.96);
  backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
  border-radius: 22px; box-shadow: var(--shadow), inset 0 0 0 1px var(--line-strong);
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
  font-size: 18px; color: var(--text-mid);
  display: grid; place-items: center;
}
.modal-body { padding: 20px; overflow-y: auto; }
.modal-footer {
  display: flex; gap: 12px; padding: 16px 20px;
  border-top: 1px solid var(--line);
}
.btn-cancel {
  flex: 1; padding: 10px; border-radius: var(--radius-sm);
  font-size: 14px; color: var(--text-mid);
  box-shadow: inset 0 0 0 1px var(--line);
}
.btn-save {
  flex: 1; padding: 10px; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 600;
  background: var(--accent-grad); color: #0B0E1A;
}
.btn-save:disabled { opacity: .5; cursor: not-allowed; }

.modal-input {
  width: 100%; padding: 12px 14px; border: none;
  background: var(--glass); box-shadow: inset 0 0 0 1px var(--line);
  border-radius: var(--radius-sm); font-size: 14px; color: var(--text-hi);
}
.modal-input:focus { outline: none; box-shadow: inset 0 0 0 1px rgba(110,231,240,.4); }

.option-list { display: flex; flex-direction: column; gap: 8px; }
.option-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 16px; border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--line);
  cursor: pointer; transition: all .15s;
}
.option-item.active { box-shadow: inset 0 0 0 1.5px rgba(110,231,240,.5); background: rgba(110,231,240,.05); }
.option-radio {
  width: 18px; height: 18px; border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
  flex-shrink: 0; display: grid; place-items: center; margin-top: 2px;
}
.option-item.active .option-radio { box-shadow: inset 0 0 0 1.5px var(--cyan); }
.option-radio-checked { width: 9px; height: 9px; border-radius: 50%; background: var(--cyan); }
.option-label { font-size: 14px; font-weight: 600; }
.option-desc { font-size: 12px; color: var(--text-low); line-height: 1.4; margin-top: 2px; }
</style>
