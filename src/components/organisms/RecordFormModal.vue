<script setup>
import { ref, computed, watch } from 'vue'
import { createRecord, CONTENT_TYPES, MOOD_OPTIONS } from '@/api/records'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['close', 'created'])

// 表单数据
const form = ref({
  title: '',
  content: '',
  summary: '',
  contentType: 'note',
  mood: [],
  keywords: [],
  status: 'processing',
})

// 关键词输入
const keywordInput = ref('')
const loading = ref(false)
const error = ref('')

// 字数统计
const contentLength = computed(() => form.value.content.length)
const titleLength = computed(() => form.value.title.length)

// 表单验证
const isValid = computed(() => {
  return form.value.content.trim().length > 0
})

// 切换心情选择
function toggleMood(mood) {
  const idx = form.value.mood.indexOf(mood)
  if (idx === -1) {
    form.value.mood.push(mood)
  } else {
    form.value.mood.splice(idx, 1)
  }
}

// 添加关键词
function addKeyword() {
  const kw = keywordInput.value.trim()
  if (kw && !form.value.keywords.includes(kw)) {
    form.value.keywords.push(kw)
  }
  keywordInput.value = ''
}

// 删除关键词
function removeKeyword(index) {
  form.value.keywords.splice(index, 1)
}

// 关键词回车添加
function onKeywordKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addKeyword()
  }
}

// 提交表单
async function handleSubmit() {
  if (!isValid.value || loading.value) return

  loading.value = true
  error.value = ''

  try {
    const data = {
      content: form.value.content.trim(),
      contentType: form.value.contentType,
      status: form.value.status,
    }

    // 可选字段
    if (form.value.title.trim()) {
      data.title = form.value.title.trim()
    }
    if (form.value.summary.trim()) {
      data.summary = form.value.summary.trim()
    }
    if (form.value.mood.length > 0) {
      data.mood = form.value.mood
    }
    if (form.value.keywords.length > 0) {
      data.keywords = form.value.keywords
    }

    const res = await createRecord(data)
    emit('created', res.data)
    handleClose()
  } catch (err) {
    error.value = err.message || '创建失败，请重试'
  } finally {
    loading.value = false
  }
}

// 关闭并重置
function handleClose() {
  form.value = {
    title: '',
    content: '',
    summary: '',
    contentType: 'note',
    mood: [],
    keywords: [],
    status: 'processing',
  }
  keywordInput.value = ''
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
          <h2 class="modal-title">新建记录</h2>
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

          <!-- 标题 -->
          <div class="form-section">
            <input
              v-model="form.title"
              class="title-input"
              placeholder="标题（可选）"
              maxlength="200"
            />
            <div class="char-count">{{ titleLength }}/200</div>
          </div>

          <!-- 内容 -->
          <div class="form-section content-section">
            <textarea
              v-model="form.content"
              class="content-input"
              placeholder="记录你的想法、待办、学习内容..."
              maxlength="2000"
              autofocus
            />
            <div class="char-count">{{ contentLength }}/2000</div>
          </div>

          <!-- 摘要 -->
          <div class="form-section">
            <label class="section-label">摘要（可选）</label>
            <textarea
              v-model="form.summary"
              class="summary-input"
              placeholder="简单总结一下..."
              maxlength="500"
              rows="2"
            />
          </div>

          <!-- 内容类型 -->
          <div class="form-section">
            <label class="section-label">类型</label>
            <div class="type-grid">
              <button
                v-for="type in CONTENT_TYPES"
                :key="type.value"
                :class="['type-btn', { active: form.contentType === type.value }]"
                @click="form.contentType = type.value"
              >
                <span class="type-icon">{{ type.icon }}</span>
                <span class="type-label">{{ type.label }}</span>
              </button>
            </div>
          </div>

          <!-- 心情 -->
          <div class="form-section">
            <label class="section-label">心情</label>
            <div class="mood-grid">
              <button
                v-for="mood in MOOD_OPTIONS"
                :key="mood.value"
                :class="['mood-btn', { active: form.mood.includes(mood.value) }]"
                @click="toggleMood(mood.value)"
              >
                <span class="mood-emoji">{{ mood.emoji }}</span>
                <span class="mood-label">{{ mood.label }}</span>
              </button>
            </div>
          </div>

          <!-- 关键词 -->
          <div class="form-section">
            <label class="section-label">关键词</label>
            <div class="keywords-container">
              <div v-for="(kw, idx) in form.keywords" :key="idx" class="keyword-tag">
                {{ kw }}
                <button class="keyword-remove" @click="removeKeyword(idx)">×</button>
              </div>
              <input
                v-model="keywordInput"
                class="keyword-input"
                placeholder="输入后回车添加"
                @keydown="onKeywordKeydown"
              />
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

/* 表单区块 */
.form-section {
  margin-bottom: 20px;
}

.section-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.char-count {
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: right;
  margin-top: 4px;
}

/* 标题输入 */
.title-input {
  width: 100%;
  padding: 12px 0;
  border: none;
  border-bottom: 1px solid var(--border);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  background: transparent;
  outline: none;
  transition: border-color 0.2s;
}

.title-input:focus {
  border-color: var(--accent);
}

.title-input::placeholder {
  color: var(--text-tertiary);
}

/* 内容输入 */
.content-section {
  min-height: 150px;
}

.content-input {
  width: 100%;
  min-height: 120px;
  padding: 12px 0;
  border: none;
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary);
  background: transparent;
  outline: none;
  resize: vertical;
  font-family: var(--font);
}

.content-input::placeholder {
  color: var(--text-tertiary);
}

/* 摘要输入 */
.summary-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--bg-secondary);
  outline: none;
  resize: none;
  transition: border-color 0.2s;
}

.summary-input:focus {
  border-color: var(--accent);
}

.summary-input::placeholder {
  color: var(--text-tertiary);
}

/* 类型选择 */
.type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.type-btn:hover {
  border-color: var(--accent);
}

.type-btn.active {
  background: var(--accent-light);
  border-color: var(--accent);
}

.type-icon {
  font-size: 18px;
}

.type-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.type-btn.active .type-label {
  color: var(--accent);
  font-weight: 600;
}

/* 心情选择 */
.mood-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mood-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.mood-btn:hover {
  border-color: var(--accent);
}

.mood-btn.active {
  background: var(--accent-light);
  border-color: var(--accent);
}

.mood-emoji {
  font-size: 16px;
}

.mood-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.mood-btn.active .mood-label {
  color: var(--accent);
  font-weight: 600;
}

/* 关键词 */
.keywords-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  min-height: 42px;
  transition: border-color 0.2s;
}

.keywords-container:focus-within {
  border-color: var(--accent);
}

.keyword-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--accent-light);
  border-radius: var(--radius-full);
  font-size: 12px;
  color: var(--accent);
}

.keyword-remove {
  width: 14px;
  height: 14px;
  border: none;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  opacity: 0.6;
}

.keyword-remove:hover {
  opacity: 1;
}

.keyword-input {
  flex: 1;
  min-width: 100px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
}

.keyword-input::placeholder {
  color: var(--text-tertiary);
}

/* 响应式 */
@media (max-width: 480px) {
  .type-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .type-btn {
    padding: 8px 4px;
  }

  .type-icon {
    font-size: 16px;
  }

  .type-label {
    font-size: 10px;
  }
}
</style>
