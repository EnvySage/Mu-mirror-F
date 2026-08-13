<script setup>
import { ref, computed, watch } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useRecordsStore } from '@/stores/records'
import { typeMap, moodMap, MOOD_COLOR_MAP, CONTENT_TYPES, ALL_MOODS } from '@/constants/tags'

const ui = useUIStore()
const recordsStore = useRecordsStore()

const record = computed(() => {
  if (!ui.selectedRecordId) return null
  return recordsStore.getById(ui.selectedRecordId)
})

// 拆分相关
const isSplit = computed(() => record.value && recordsStore.isSplitRecord(record.value))
const splitGroup = computed(() => {
  if (!record.value) return []
  const rootId = recordsStore.getSplitRootId(record.value)
  return recordsStore.getSplitGroup(rootId)
})
const isSplitRoot = computed(() => record.value && recordsStore.isSplitRoot(record.value))

// 当前选中的拆分记录索引
const activeSplitIndex = ref(0)
const activeSplitRecord = computed(() => splitGroup.value[activeSplitIndex.value] || null)

// 拆分组的编辑数据
const splitEditData = ref([])

// Review state
const reviewData = ref(null)
const reviewKeywords = ref('')
const submitting = ref(false)
const actionError = ref(null)

// Processing animation
const processingStep = ref(-1)
let processingTimer = null

function startProcessing() {
  processingStep.value = 0
  processingTimer = setTimeout(() => { processingStep.value = 1 }, 800)
  setTimeout(() => { processingStep.value = 2 }, 1600)
}

// 初始化拆分组编辑数据
function initSplitEditData() {
  splitEditData.value = splitGroup.value.map(r => ({
    id: r.id,
    title: r.title || '',
    content_type: r.content_type || 'note',
    mood: r.mood || ['calm'],
    keywords: (r.keywords || []).join(', '),
  }))
}

watch(() => ui.selectedRecordId, (id) => {
  if (!id) return
  const r = recordsStore.getById(id)
  if (!r) return
  actionError.value = null
  activeSplitIndex.value = 0

  // 判断是否为拆分组（原记录或子记录）
  const isSplit = recordsStore.isSplitRecord(r)
  const isRoot = recordsStore.isSplitRoot(id)

  if (isRoot || isSplit) {
    // 如果是子记录，需要切换到原记录
    if (isSplit) {
      const rootId = recordsStore.getSplitRootId(r)
      ui.selectedRecordId = rootId
      return
    }
    ui.detailMode = 'split'
    initSplitEditData()
  } else if (r.status === 'processing') {
    ui.detailMode = 'processing'
    startProcessing()
  } else if (r.status === 'reviewing') {
    reviewData.value = {
      title: r.title || '',
      content_type: r.content_type || 'note',
      mood: r.mood || ['calm'],
    }
    reviewKeywords.value = (r.keywords || []).join(', ')
    ui.detailMode = 'review'
  } else if (r.status === 'failed') {
    ui.detailMode = 'failed'
  } else {
    ui.detailMode = 'view'
  }
})

function close() {
  ui.showDetail = false
  ui.selectedRecordId = null
  reviewData.value = null
  actionError.value = null
  splitEditData.value = []
  if (processingTimer) clearTimeout(processingTimer)
}

// 切换拆分记录
function switchSplitRecord(index) {
  activeSplitIndex.value = index
}

// 获取当前编辑数据
const currentEditData = computed(() => splitEditData.value[activeSplitIndex.value] || null)

// 切换情绪
function toggleSplitMood(mood) {
  if (!currentEditData.value) return
  const idx = currentEditData.value.mood.indexOf(mood)
  if (idx >= 0) currentEditData.value.mood.splice(idx, 1)
  else currentEditData.value.mood.push(mood)
}

// 批量确认所有拆分记录
async function confirmAllSplit() {
  if (submitting.value) return
  submitting.value = true
  actionError.value = null

  try {
    // 先更新每条记录的标签
    for (const editData of splitEditData.value) {
      const keywords = editData.keywords.split(/[,，]/).map(k => k.trim()).filter(Boolean)
      const modifications = {
        title: editData.title,
        contentType: editData.content_type,
        mood: editData.mood,
        keywords,
      }
      const updateSuccess = await recordsStore.updateRecord(editData.id, modifications)
      if (!updateSuccess) {
        actionError.value = '更新失败，请重试'
        submitting.value = false
        return
      }
    }

    // 再批量确认
    for (const editData of splitEditData.value) {
      const confirmSuccess = await recordsStore.confirmReview(editData.id)
      if (!confirmSuccess) {
        actionError.value = '确认失败，请重试'
        submitting.value = false
        return
      }
    }

    close()
  } catch (err) {
    actionError.value = '操作失败，请重试'
  }
  submitting.value = false
}

// 批量拒绝所有拆分记录
async function rejectAllSplit() {
  if (submitting.value) return
  submitting.value = true
  actionError.value = null

  try {
    for (const editData of splitEditData.value) {
      const success = await recordsStore.deleteRecord(editData.id)
      if (!success) {
        actionError.value = '删除失败，请重试'
        submitting.value = false
        return
      }
    }
    close()
  } catch (err) {
    actionError.value = '操作失败，请重试'
  }
  submitting.value = false
}

// 单条记录审核相关
function selectType(type) {
  if (reviewData.value) reviewData.value.content_type = type
}

function toggleMood(mood) {
  if (!reviewData.value) return
  const idx = reviewData.value.mood.indexOf(mood)
  if (idx >= 0) reviewData.value.mood.splice(idx, 1)
  else reviewData.value.mood.push(mood)
}

async function confirmReview() {
  if (!reviewData.value || !record.value || submitting.value) return
  submitting.value = true
  actionError.value = null

  const keywords = reviewKeywords.value.split(/[,，]/).map(k => k.trim()).filter(Boolean)
  const modifications = {
    title: reviewData.value.title,
    contentType: reviewData.value.content_type,
    mood: reviewData.value.mood,
    keywords,
  }

  const updateSuccess = await recordsStore.updateRecord(record.value.id, modifications)
  if (!updateSuccess) {
    actionError.value = '更新失败，请重试'
    submitting.value = false
    return
  }

  const confirmSuccess = await recordsStore.confirmReview(record.value.id)
  if (confirmSuccess) {
    reviewData.value = null
    ui.detailMode = 'view'
  } else {
    actionError.value = '确认失败，请重试'
  }
  submitting.value = false
}

async function rejectReview() {
  if (!record.value || submitting.value) return
  submitting.value = true
  actionError.value = null

  const success = await recordsStore.deleteRecord(record.value.id)
  if (success) {
    close()
  } else {
    actionError.value = '操作失败，请重试'
  }
  submitting.value = false
}

async function retryProcessing() {
  if (!record.value || submitting.value) return
  submitting.value = true
  actionError.value = null

  const content = record.value.content
  await recordsStore.deleteRecord(record.value.id)
  await recordsStore.createRecord(content)
  close()
  submitting.value = false
}

async function deleteRecord() {
  if (!record.value || submitting.value) return
  submitting.value = true
  actionError.value = null

  const success = await recordsStore.deleteRecord(record.value.id)
  if (success) {
    close()
  } else {
    actionError.value = '删除失败，请重试'
  }
  submitting.value = false
}
</script>

<template>
  <div v-if="ui.selectedRecordId && record" class="detail-page" :class="{ show: ui.showDetail }">
    <div class="detail-header">
      <button class="detail-back" @click="close">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        返回
      </button>
      <span class="detail-title">
        {{ ui.detailMode === 'split' ? '拆分记录' : ui.detailMode === 'processing' ? 'AI 整理中' : ui.detailMode === 'review' ? '审核标签' : ui.detailMode === 'failed' ? '处理失败' : '记录详情' }}
      </span>
      <button
        v-if="ui.detailMode === 'review'"
        class="detail-action show"
        :disabled="submitting"
        @click="confirmReview"
      >{{ submitting ? '提交中...' : '通过' }}</button>
    </div>

    <div class="detail-content">
      <!-- 错误提示 -->
      <div v-if="actionError" class="error-banner">{{ actionError }}</div>

      <!-- Split View - 拆分组 -->
      <div v-if="ui.detailMode === 'split'" class="split-view">
        <!-- 原始内容 -->
        <div class="review-original">
          <div class="section-label">原始内容</div>
          <div class="review-original-text">{{ record.content }}</div>
        </div>

        <!-- 序号切换栏 -->
        <div v-if="splitGroup.length > 0" class="split-tabs">
          <button
            v-for="(r, i) in splitGroup"
            :key="r.id"
            :class="['split-tab', { active: i === activeSplitIndex }]"
            @click="switchSplitRecord(i)"
          >
            <span class="split-tab-index">{{ i + 1 }}</span>
            <span class="split-tab-title">{{ splitEditData[i]?.title || '未生成标题' }}</span>
          </button>
        </div>

        <!-- 当前记录编辑区 -->
        <div v-if="currentEditData" class="split-edit-card">
          <!-- 摘要内容（只读） -->
          <div class="review-field">
            <div class="section-label">摘要</div>
            <div class="split-content-preview">{{ activeSplitRecord?.summary || '暂无摘要' }}</div>
          </div>

          <div class="review-field">
            <div class="section-label">标题</div>
            <input v-model="currentEditData.title" class="review-keywords-input" />
          </div>
          <div class="review-field">
            <div class="section-label">内容类型</div>
            <div class="review-field-tags">
              <span
                v-for="t in CONTENT_TYPES"
                :key="t.key"
                :class="['review-tag', { selected: currentEditData.content_type === t.key }]"
                @click="currentEditData.content_type = t.key"
              >{{ t.label }}</span>
            </div>
          </div>
          <div class="review-field">
            <div class="section-label">情绪状态</div>
            <div class="review-field-tags">
              <span
                v-for="m in ALL_MOODS"
                :key="m.key"
                :class="['review-tag', { selected: currentEditData.mood.includes(m.key) }]"
                @click="toggleSplitMood(m.key)"
              >{{ m.label }}</span>
            </div>
          </div>
          <div class="review-field">
            <div class="section-label">关键词</div>
            <input v-model="currentEditData.keywords" class="review-keywords-input" placeholder="用逗号分隔关键词" />
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="split-actions">
          <button class="btn-approve" :disabled="submitting" @click="confirmAllSplit">
            {{ submitting ? '提交中...' : '✅ 全部通过' }}
          </button>
          <button class="btn-reject" :disabled="submitting" @click="rejectAllSplit">
            ❌ 全部拒绝
          </button>
        </div>
      </div>

      <!-- Processing View -->
      <div v-else-if="ui.detailMode === 'processing'" class="processing-view">
        <div class="processing-ring" />
        <div class="processing-title">正在分析你的记录</div>
        <div class="processing-desc">AI 正在理解你的内容，通常需要几秒钟</div>
        <div class="processing-steps">
          <div :class="['processing-step', { active: processingStep === 0, done: processingStep > 0 }]">
            <div class="processing-step-dot" />文本清洗
          </div>
          <div :class="['processing-step', { active: processingStep === 1, done: processingStep > 1 }]">
            <div class="processing-step-dot" />内容分类
          </div>
          <div :class="['processing-step', { active: processingStep === 2, done: processingStep > 2 }]">
            <div class="processing-step-dot" />生成标签
          </div>
        </div>
      </div>

      <!-- Failed View -->
      <div v-else-if="ui.detailMode === 'failed'" class="failed-view">
        <div class="failed-icon">⚠️</div>
        <div class="failed-title">处理失败</div>
        <div class="failed-desc">AI 处理过程中出现错误，请重试或删除该记录</div>
        <div class="review-original">
          <div class="section-label">原始内容</div>
          <div class="review-original-text">{{ record.content }}</div>
        </div>
        <div class="failed-actions">
          <button class="btn-retry" :disabled="submitting" @click="retryProcessing">
            {{ submitting ? '处理中...' : '重新尝试' }}
          </button>
          <button class="btn-delete" :disabled="submitting" @click="deleteRecord">
            删除记录
          </button>
        </div>
      </div>

      <!-- Review View -->
      <div v-else-if="ui.detailMode === 'review' && reviewData" class="review-view">
        <div class="review-original">
          <div class="section-label">原始内容</div>
          <div class="review-original-text">{{ record.content }}</div>
        </div>
        <div class="review-card">
          <div class="review-field">
            <div class="section-label">标题</div>
            <input v-model="reviewData.title" class="review-keywords-input" />
          </div>
          <div class="review-field">
            <div class="section-label">内容类型</div>
            <div class="review-field-tags">
              <span
                v-for="t in CONTENT_TYPES"
                :key="t.key"
                :class="['review-tag', { selected: reviewData.content_type === t.key }]"
                @click="selectType(t.key)"
              >{{ t.label }}</span>
            </div>
          </div>
          <div class="review-field">
            <div class="section-label">情绪状态</div>
            <div class="review-field-tags">
              <span
                v-for="m in ALL_MOODS"
                :key="m.key"
                :class="['review-tag', { selected: reviewData.mood.includes(m.key) }]"
                @click="toggleMood(m.key)"
              >{{ m.label }}</span>
            </div>
          </div>
          <div class="review-field">
            <div class="section-label">关键词</div>
            <input v-model="reviewKeywords" class="review-keywords-input" placeholder="用逗号分隔关键词" />
          </div>
        </div>
        <div class="review-actions">
          <button class="btn-approve" :disabled="submitting" @click="confirmReview">
            {{ submitting ? '提交中...' : '✅ 通过' }}
          </button>
          <button class="btn-reject" :disabled="submitting" @click="rejectReview">
            ❌ 拒绝
          </button>
        </div>
      </div>

      <!-- Done/View -->
      <div v-else-if="ui.detailMode === 'view'">
        <div class="review-original">
          <div class="section-label">原始内容</div>
          <div class="review-original-text">{{ record.content }}</div>
        </div>
        <div class="review-card">
          <div class="review-card-title">{{ record.title }}</div>
          <div class="review-field">
            <div class="section-label">类型</div>
            <div class="review-field-tags">
              <span class="tag tag-type">{{ typeMap[record.content_type] || record.content_type }}</span>
            </div>
          </div>
          <div class="review-field">
            <div class="section-label">情绪</div>
            <div class="review-field-tags">
              <span
                v-for="m in (record.mood || [])"
                :key="m"
                :class="['tag', 'tag-mood', MOOD_COLOR_MAP[m] || '']"
              >{{ moodMap[m] || m }}</span>
            </div>
          </div>
          <div v-if="record.keywords && record.keywords.length" class="review-field">
            <div class="section-label">关键词</div>
            <div class="review-field-tags">
              <span v-for="k in record.keywords" :key="k" class="keyword">#{{ k }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-page {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: var(--bg); z-index: 220;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.detail-page.show { transform: translateX(0); }

.detail-header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px;
  background: rgba(245,245,247,0.92);
  backdrop-filter: blur(20px);
  position: sticky; top: 0; z-index: 5;
  border-bottom: 0.5px solid var(--border);
}
.detail-back { display: flex; align-items: center; font-size: 15px; color: var(--accent); background: none; border: none; cursor: pointer; padding: 4px 0; font-family: var(--font); }
.detail-back svg { width: 18px; height: 18px; stroke: var(--accent); }
.detail-title { font-size: 16px; font-weight: 600; flex: 1; }
.detail-action {
  font-size: 14px; font-weight: 600; color: #fff; background: var(--accent);
  border: none; cursor: pointer; padding: 8px 20px;
  border-radius: var(--radius-full); opacity: 0; pointer-events: none;
  transition: all 0.2s; font-family: var(--font);
}
.detail-action.show { opacity: 1; pointer-events: auto; }
.detail-action.show:hover { background: var(--accent-hover); }
.detail-action:disabled { opacity: 0.5; cursor: not-allowed; }
.detail-content { padding: 16px; max-width: 640px; }

@media (min-width: 900px) {
  .detail-header { padding: 16px 36px; }
  .detail-content { padding: 24px 36px; max-width: 700px; }
}

/* Error banner */
.error-banner {
  padding: 12px 16px; margin-bottom: 16px;
  background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md); color: #ef4444; font-size: 13px;
}

/* Split View */
.split-view {
  animation: fadeIn 0.3s ease;
}

/* 序号切换栏 */
.split-tabs {
  display: flex;
  gap: 10px;
  margin: 20px 0;
  overflow-x: auto;
  padding-bottom: 6px;
}

.split-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  font-family: var(--font);
  box-shadow: var(--shadow-sm);
}

.split-tab:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.split-tab.active {
  background: linear-gradient(135deg, var(--accent), #6366f1);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.split-tab-index {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-light);
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  border-radius: 50%;
  flex-shrink: 0;
}

.split-tab.active .split-tab-index {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.split-tab-title {
  font-size: 14px;
  font-weight: 500;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 原文内容预览 */
.split-content-preview {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.7;
  padding: 14px 16px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 编辑卡片 */
.split-edit-card {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 24px;
  margin-bottom: 24px;
  border: 0.5px solid var(--border);
  box-shadow: var(--shadow-sm);
  animation: fadeIn 0.25s ease;
}

/* 操作按钮 */
.split-actions {
  display: flex;
  gap: 12px;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

/* Processing */
.processing-view { padding: 60px 20px; text-align: center; }
.processing-ring { width: 64px; height: 64px; margin: 0 auto 24px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.processing-title { font-size: 17px; font-weight: 600; margin-bottom: 8px; }
.processing-desc { font-size: 14px; color: var(--text-secondary); }
.processing-steps { margin-top: 32px; text-align: left; max-width: 200px; margin-left: auto; margin-right: auto; }
.processing-step { display: flex; align-items: center; gap: 12px; padding: 10px 0; font-size: 14px; color: var(--text-tertiary); transition: color 0.3s; }
.processing-step.active { color: var(--accent); }
.processing-step.done { color: var(--success); }
.processing-step-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border); flex-shrink: 0; transition: background 0.3s; }
.processing-step.active .processing-step-dot { background: var(--accent); animation: dotPulse 1s ease infinite; }
.processing-step.done .processing-step-dot { background: var(--success); }
@keyframes dotPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }

/* Failed */
.failed-view { text-align: center; padding: 40px 20px; }
.failed-icon { font-size: 48px; margin-bottom: 16px; }
.failed-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; color: var(--danger); }
.failed-desc { font-size: 14px; color: var(--text-secondary); margin-bottom: 24px; }
.failed-actions { display: flex; gap: 12px; justify-content: center; margin-top: 24px; }
.btn-retry {
  padding: 10px 24px; border-radius: var(--radius-full); font-size: 14px; font-weight: 600;
  border: none; cursor: pointer; background: var(--accent); color: #fff;
  transition: all 0.15s; font-family: var(--font);
}
.btn-retry:hover { background: var(--accent-hover); }
.btn-retry:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-delete {
  padding: 10px 24px; border-radius: var(--radius-full); font-size: 14px; font-weight: 600;
  border: 1.5px solid var(--danger); cursor: pointer; background: transparent; color: var(--danger);
  transition: all 0.15s; font-family: var(--font);
}
.btn-delete:hover { background: var(--danger-light); }
.btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }

/* Review */
.review-view { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.review-original { background: var(--surface); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px; border: 0.5px solid var(--border); }
.review-original-text { font-size: 14px; color: var(--text-primary); line-height: 1.7; }
.review-card { background: var(--surface); border-radius: var(--radius-md); padding: 20px; margin-bottom: 12px; border: 0.5px solid var(--border); }
.review-card-title { font-size: 16px; font-weight: 600; margin-bottom: 18px; }
.review-field { margin-bottom: 18px; }
.review-field:last-child { margin-bottom: 0; }
.review-field-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.review-tag {
  padding: 7px 16px; border-radius: var(--radius-full); font-size: 13px; font-weight: 500;
  border: 1.5px solid var(--border); background: var(--surface); color: var(--text-secondary);
  cursor: pointer; transition: all 0.15s ease; font-family: var(--font);
}
.review-tag:hover { border-color: var(--text-tertiary); }
.review-tag:active { transform: scale(0.95); }
.review-tag.selected { border-color: var(--accent); background: var(--accent-light); color: var(--accent); }
.review-keywords-input {
  width: 100%; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
  font-size: 14px; font-family: var(--font); color: var(--text-primary); outline: none; transition: border-color 0.2s;
}
.review-keywords-input:focus { border-color: var(--accent); }

/* Review actions */
.review-actions { display: flex; gap: 12px; margin-top: 24px; }
.btn-approve {
  flex: 1; padding: 12px 24px; border-radius: var(--radius-full); font-size: 15px; font-weight: 600;
  border: none; cursor: pointer; background: var(--success); color: #fff;
  transition: all 0.15s; font-family: var(--font);
}
.btn-approve:hover { opacity: 0.9; }
.btn-approve:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-reject {
  flex: 1; padding: 12px 24px; border-radius: var(--radius-full); font-size: 15px; font-weight: 600;
  border: 1.5px solid var(--danger); cursor: pointer; background: transparent; color: var(--danger);
  transition: all 0.15s; font-family: var(--font);
}
.btn-reject:hover { background: var(--danger-light); }
.btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }

/* Tags */
.tag { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: var(--radius-full); font-size: 11px; font-weight: 500; }
.tag-type { background: var(--accent-light); color: var(--accent); }
.tag-mood { background: var(--success-light); color: var(--success); }
.tag-mood.anxious { background: var(--warning-light); color: var(--warning); }
.tag-mood.sad { background: var(--danger-light); color: var(--danger); }
.tag-mood.tired { background: #F3F0FF; color: #7C3AED; }
.keyword { font-size: 11px; color: var(--text-tertiary); background: var(--bg); padding: 2px 8px; border-radius: var(--radius-full); }

/* Section label */
.section-label { font-size: 11px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
</style>
