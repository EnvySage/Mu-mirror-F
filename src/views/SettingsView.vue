<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/organisms/PageHeader.vue'
import SettingsItem from '@/components/molecules/SettingsItem.vue'

const router = useRouter()
const settingsStore = useSettingsStore()
const auth = useAuthStore()

const showEditModal = ref(false)
const editField = ref('')
const editLabel = ref('')
const editValue = ref('')
const editPlaceholder = ref('')
const editOptions = ref(null)
const testResult = ref(null)

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
  }
}

function selectOption(value) {
  editValue.value = value
}

async function handleTestAi() {
  testResult.value = null
  const result = await settingsStore.testAiConnection()
  testResult.value = result
  setTimeout(() => { testResult.value = null }, 3000)
}

async function handleTestDb() {
  testResult.value = null
  const result = await settingsStore.testDbConnection()
  testResult.value = result
  setTimeout(() => { testResult.value = null }, 3000)
}

/** 切换审核模式 */
async function toggleReviewMode() {
  const newVal = settingsStore.settings.review_mode === 'auto' ? 'manual' : 'auto'
  await settingsStore.updateSettings({ review_mode: newVal })
}

/** 切换 Embedding 来源 */
async function toggleEmbeddingSource() {
  const newVal = settingsStore.settings.embedding_source === 'api' ? 'local' : 'api'
  await settingsStore.updateSettings({ embedding_source: newVal })
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
    <PageHeader title="设置" />
    <div class="page-content">
      <!-- 测试结果提示 -->
      <div v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'error']">
        {{ testResult.message }}
      </div>

      <div class="settings-grid">
        <!-- AI 模型配置 -->
        <div class="settings-group">
          <div class="settings-group-title">AI 模型</div>
          <div class="settings-card">
            <SettingsItem
              icon="zap"
              icon-bg="var(--accent)"
              label="模型协议"
              :description="settingsStore.settings.ai_protocol === 'anthropic' ? 'Anthropic 协议' : 'OpenAI 协议'"
              action="edit"
              @click="openEdit('ai_protocol', settingsStore.settings.ai_protocol, '模型协议', '', [
                { value: 'openai', label: 'OpenAI 协议', desc: '适用于 OpenAI、Deepseek、通义千问等' },
                { value: 'anthropic', label: 'Anthropic 协议', desc: '适用于 Claude 系列模型' },
              ])"
            />
            <SettingsItem
              icon="info"
              icon-bg="#8B5CF6"
              label="AI 提供商"
              :description="settingsStore.settings.ai_provider || '未配置'"
              action="edit"
              @click="openEdit('ai_provider', settingsStore.settings.ai_provider, 'AI 提供商', 'openai / zhipu / qwen')"
            />
            <SettingsItem
              icon="lock"
              icon-bg="#7C3AED"
              label="API Key"
              :description="settingsStore.settings.ai_api_key || '未配置'"
              action="edit"
              @click="openEdit('ai_api_key', '', 'API Key', '输入 API Key')"
            />
            <SettingsItem
              icon="chat"
              icon-bg="#10B981"
              label="模型"
              :description="settingsStore.settings.ai_model || '未配置'"
              action="edit"
              @click="openEdit('ai_model', settingsStore.settings.ai_model, '模型名称', 'gpt-4o / claude-3-5-sonnet')"
            />
            <SettingsItem
              icon="link"
              icon-bg="#6B7280"
              label="API 地址"
              :description="settingsStore.settings.ai_base_url || '使用默认'"
              action="edit"
              @click="openEdit('ai_base_url', settingsStore.settings.ai_base_url, 'API 地址', 'https://api.openai.com/v1')"
            />
            <div class="settings-action">
              <button
                class="btn-test"
                :disabled="settingsStore.testLoading"
                @click="handleTestAi"
              >
                {{ settingsStore.testLoading ? '测试中...' : '测试 AI 连接' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Embedding 配置 -->
        <div class="settings-group">
          <div class="settings-group-title">Embedding 模型</div>
          <div class="settings-card">
            <SettingsItem
              icon="database"
              icon-bg="#F59E0B"
              label="Embedding 来源"
              :description="settingsStore.settings.embedding_source === 'api' ? '远程 API 服务' : '本地服务'"
              action="toggle"
              :toggle-value="settingsStore.settings.embedding_source === 'api'"
              @toggle="toggleEmbeddingSource"
            />
            <SettingsItem
              icon="cpu"
              icon-bg="#EC4899"
              label="Embedding 模型"
              :description="settingsStore.settings.embedding_model || '未配置'"
              action="edit"
              @click="openEdit('embedding_model', settingsStore.settings.embedding_model, 'Embedding 模型', 'BAAI/bge-m3')"
            />
            <template v-if="settingsStore.settings.embedding_source === 'api'">
              <SettingsItem
                icon="link"
                icon-bg="#6B7280"
                label="Embedding API 地址"
                :description="settingsStore.settings.embedding_base_url || '使用默认'"
                action="edit"
                @click="openEdit('embedding_base_url', settingsStore.settings.embedding_base_url, 'Embedding API 地址', 'https://api.example.com/v1')"
              />
              <SettingsItem
                icon="lock"
                icon-bg="#7C3AED"
                label="Embedding API Key"
                :description="settingsStore.settings.embedding_api_key || '未配置'"
                action="edit"
                @click="openEdit('embedding_api_key', '', 'Embedding API Key', '输入 API Key')"
              />
            </template>
          </div>
        </div>

        <!-- 审核模式 -->
        <div class="settings-group">
          <div class="settings-group-title">审核模式</div>
          <div class="settings-card">
            <SettingsItem
              icon="eye"
              icon-bg="#EC4899"
              label="自动审核"
              :description="settingsStore.settings.review_mode === 'auto' ? 'AI 处理后自动保存' : 'AI 处理后需手动确认'"
              action="toggle"
              :toggle-value="settingsStore.settings.review_mode === 'auto'"
              @toggle="toggleReviewMode"
            />
          </div>
        </div>

        <!-- 数据库 -->
        <div class="settings-group">
          <div class="settings-group-title">数据库</div>
          <div class="settings-card">
            <SettingsItem
              icon="database"
              icon-bg="#F59E0B"
              label="数据库连接"
              description="点击测试连接"
              action="none"
            />
            <div class="settings-action">
              <button
                class="btn-test"
                :disabled="settingsStore.testLoading"
                @click="handleTestDb"
              >
                {{ settingsStore.testLoading ? '测试中...' : '测试数据库连接' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 关于 -->
        <div class="settings-group">
          <div class="settings-group-title">关于</div>
          <div class="settings-card">
            <SettingsItem
              icon="info"
              icon-bg="#6B7280"
              label="版本"
              description="v0.1.0"
              action="none"
            />
          </div>
        </div>

        <!-- 账号 -->
        <div class="settings-group">
          <div class="settings-group-title">账号</div>
          <div class="settings-card">
            <SettingsItem
              v-if="auth.user"
              icon="user"
              icon-bg="#3B82F6"
              label="当前用户"
              :description="auth.user.username"
              action="none"
            />
            <div class="logout-btn" @click="handleLogout">
              <span class="logout-text">退出登录</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 编辑弹窗 -->
      <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>{{ editLabel }}</h3>
            <button class="modal-close" @click="showEditModal = false">×</button>
          </div>

          <div class="modal-body">
            <!-- 选项模式 -->
            <div v-if="editOptions" class="option-list">
              <div
                v-for="opt in editOptions"
                :key="opt.value"
                :class="['option-item', { active: editValue === opt.value }]"
                @click="selectOption(opt.value)"
              >
                <div class="option-radio">
                  <div v-if="editValue === opt.value" class="option-radio-checked" />
                </div>
                <div class="option-content">
                  <div class="option-label">{{ opt.label }}</div>
                  <div v-if="opt.desc" class="option-desc">{{ opt.desc }}</div>
                </div>
              </div>
            </div>

            <!-- 输入模式 -->
            <input
              v-else
              v-model="editValue"
              :type="editField.includes('api_key') ? 'password' : 'text'"
              class="modal-input"
              :placeholder="editPlaceholder"
              @keyup.enter="saveEdit"
            />
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="showEditModal = false">取消</button>
            <button class="btn-save" @click="saveEdit" :disabled="settingsStore.loading">
              {{ settingsStore.loading ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: var(--bg); overflow-y: auto; overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.page-content { padding: 12px 16px 32px; }

.test-result {
  padding: 12px 16px; margin-bottom: 16px;
  border-radius: var(--radius-md); font-size: 14px;
}
.test-result.success {
  background: rgba(16, 185, 129, 0.1); color: #10B981;
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.test-result.error {
  background: rgba(239, 68, 68, 0.1); color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.settings-grid { display: flex; flex-direction: column; gap: 16px; }
.settings-group { margin-bottom: 0; }
.settings-group-title {
  font-size: 12px; font-weight: 600; color: var(--text-tertiary);
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-left: 4px;
}
.settings-card {
  background: var(--surface); border-radius: var(--radius-md);
  border: 0.5px solid var(--border); overflow: hidden;
}

.settings-action {
  padding: 12px 16px; border-top: 0.5px solid var(--border);
}
.btn-test {
  width: 100%; padding: 10px; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 500; border: 1px solid var(--border);
  background: var(--bg); color: var(--text-primary); cursor: pointer;
  transition: all 0.2s; font-family: var(--font);
}
.btn-test:hover { border-color: var(--accent); color: var(--accent); }
.btn-test:disabled { opacity: 0.5; cursor: not-allowed; }

@media (min-width: 900px) {
  .page-content { padding: 20px 36px 36px; }
  .settings-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
  .settings-group-title { margin-bottom: 10px; }
}

.logout-btn {
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.2s ease;
  border-top: 0.5px solid var(--border);
}
.logout-btn:hover { background: var(--bg-secondary); }
.logout-text { color: var(--error); font-size: 14px; font-weight: 500; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; backdrop-filter: blur(4px);
}
.modal-content {
  background: var(--surface); border-radius: var(--radius-lg);
  width: 90%; max-width: 400px; max-height: 80vh;
  display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 0.5px solid var(--border);
}
.modal-header h3 { font-size: 16px; font-weight: 600; }
.modal-close {
  width: 28px; height: 28px; border-radius: 50%;
  border: none; background: var(--bg); font-size: 18px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.modal-body { padding: 20px; overflow-y: auto; }
.modal-footer {
  display: flex; gap: 12px; padding: 16px 20px;
  border-top: 0.5px solid var(--border);
}
.btn-cancel {
  flex: 1; padding: 10px; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 500; border: 1px solid var(--border);
  background: var(--bg); cursor: pointer; font-family: var(--font);
}
.btn-save {
  flex: 1; padding: 10px; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 500; border: none;
  background: var(--accent); color: #fff; cursor: pointer;
  font-family: var(--font);
}
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-input {
  width: 100%; padding: 12px; border: 1.5px solid var(--border);
  border-radius: var(--radius-sm); font-size: 14px;
  font-family: var(--font); outline: none;
}
.modal-input:focus { border-color: var(--accent); }

/* 选项列表 */
.option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.option-item:hover {
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.02);
}

.option-item.active {
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.05);
}

.option-radio {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
  transition: border-color 0.2s;
}

.option-item.active .option-radio {
  border-color: var(--accent);
}

.option-radio-checked {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
}

.option-content {
  flex: 1;
}

.option-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.option-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.4;
}
</style>
