<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordsStore } from '@/stores/records'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['close', 'created'])

const router = useRouter()
const recordsStore = useRecordsStore()
const settingsStore = useSettingsStore()
const toast = useToastStore()

// 表单数据 - 用户只需输入内容
const content = ref('')
const loading = ref(false)
const error = ref('')

// 字数统计
const contentLength = computed(() => content.value.length)

// 表单验证
const isValid = computed(() => {
  return content.value.trim().length > 0
})

// 提交表单
async function handleSubmit() {
  if (!isValid.value || loading.value) return

  // 检查模型配置是否完整
  if (!settingsStore.isModelConfigComplete) {
    const msg = settingsStore.getModelConfigMissingMessage()
    toast.warning(msg || '请先完成 AI 模型配置后再写日记')
    handleClose()
    setTimeout(() => {
      router.push({ name: 'settings' })
    }, 300)
    return
  }

  loading.value = true
  error.value = ''

  try {
    const newRecord = await recordsStore.createRecord(content.value.trim())
    emit('created', newRecord)
    handleClose()
  } catch (err) {
    error.value = err.message || '创建失败，请重试'
  } finally {
    loading.value = false
  }
}

// 关闭并重置
function handleClose() {
  content.value = ''
  error.value = ''
  emit('close')
}

// 监听 show 变化，重置表单
watch(() => props.show, (val) => {
  if (!val) {
    handleClose()
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-wrapper">
      <div class="modal-overlay" @click="handleClose" />
      <div class="record-modal">
        <!-- 头部 -->
        <div class="modal-header">
          <button class="modal-close" @click="handleClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <h2 class="modal-title">写日记</h2>
          <button
            :class="['modal-submit', { disabled: !isValid || loading }]"
            :disabled="!isValid || loading"
            @click="handleSubmit"
          >
            <span v-if="loading" class="loading-spinner"></span>
            {{ loading ? '保存中...' : '保存' }}
          </button>
        </div>

        <!-- 内容区域 -->
        <div class="modal-body">
          <!-- 错误提示 -->
          <div v-if="error" class="error-banner">{{ error }}</div>

          <!-- 输入提示 -->
          <div class="input-hint">
            <span class="hint-icon">💡</span>
            <span class="hint-text">写下你的想法，AI 会自动整理标题、摘要和标签</span>
          </div>

          <!-- 内容输入 -->
          <div class="content-section">
            <textarea
              v-model="content"
              class="content-input"
              placeholder="今天发生了什么？学了什么？心情如何？"
              maxlength="2000"
              autofocus
            />
            <div class="char-count">{{ contentLength }}/2000</div>
          </div>

          <!-- AI 处理说明 -->
          <div class="ai-notice">
            <div class="notice-title">AI 将自动为你生成：</div>
            <div class="notice-items">
              <span class="notice-item">📌 标题</span>
              <span class="notice-item">📝 摘要</span>
              <span class="notice-item">🏷️ 类型</span>
              <span class="notice-item">😊 心情</span>
              <span class="notice-item">🔑 关键词</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-wrapper {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}

.modal-overlay {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.record-modal {
  position: relative;
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 头部 */
.modal-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--bg-secondary);
}

.modal-close svg {
  width: 18px;
  height: 18px;
}

.modal-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  text-align: center;
}

.modal-submit {
  padding: 8px 20px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--accent);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.modal-submit:hover:not(.disabled) {
  background: var(--accent-hover);
}

.modal-submit.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 内容区域 */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.error-banner {
  padding: 12px 16px;
  margin-bottom: 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md);
  color: #ef4444;
  font-size: 13px;
}

/* 输入提示 */
.input-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.hint-icon {
  font-size: 16px;
}

.hint-text {
  font-size: 13px;
  color: var(--text-secondary);
}

/* 内容输入 */
.content-section {
  min-height: 200px;
}

.content-input {
  width: 100%;
  min-height: 180px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 16px;
  line-height: 1.7;
  color: var(--text-primary);
  background: var(--bg-primary);
  outline: none;
  resize: vertical;
  font-family: var(--font);
  transition: border-color 0.2s;
}

.content-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.content-input::placeholder {
  color: var(--text-tertiary);
}

.char-count {
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: right;
  margin-top: 8px;
}

/* AI 处理说明 */
.ai-notice {
  margin-top: 20px;
  padding: 16px;
  background: linear-gradient(135deg, var(--accent-light), rgba(124, 58, 237, 0.05));
  border-radius: var(--radius-md);
  border: 1px solid var(--accent-light);
}

.notice-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 10px;
}

.notice-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.notice-item {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: var(--radius-full);
}

/* 响应式 */
@media (max-width: 480px) {
  .notice-items {
    gap: 6px;
  }

  .notice-item {
    font-size: 11px;
    padding: 3px 8px;
  }
}
</style>
