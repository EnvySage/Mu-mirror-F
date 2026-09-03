<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useRecordsStore } from '@/stores/records'
import { useToastStore } from '@/stores/toast'
import { typeMap, moodMap, MOOD_COLOR_MAP, taskStatusMap } from '@/constants/tags'
import ReviewPanel from '@/components/organisms/ReviewPanel.vue'

const ui = useUIStore()
const recordsStore = useRecordsStore()
const toast = useToastStore()

const record = computed(() => {
  if (!ui.selectedRecordId) return null
  return recordsStore.getById(ui.selectedRecordId)
})

const isSplit = computed(() => record.value && recordsStore.isSplitRecord(record.value))
const displayContent = computed(() => record.value ? recordsStore.getDisplayContent(record.value) : '')

// ---- 轮询（8.2：processing → 2-3s 轮询详情，直到终态） ----
let pollTimer = null

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function startPolling(recordId) {
  stopPolling()
  const tick = async () => {
    if (ui.selectedRecordId !== recordId) return
    const r = await recordsStore.fetchRecord(recordId)
    if (!r) return
    if (r.status === 'processing') {
      pollTimer = setTimeout(tick, 2500)
    } else if (r.status === 'done') {
      toast.success('AI 整理完成')
    }
    // reviewing / failed：状态由 watch(record) 驱动 UI，停止轮询
  }
  pollTimer = setTimeout(tick, 2500)
}

onBeforeUnmount(stopPolling)

// ---- 详情模式 ----
function updateDetailMode(r) {
  if (!r) return
  stopPolling()
  if (r.status === 'processing') {
    ui.detailMode = 'processing'
    startPolling(r.id)
  } else if (r.status === 'reviewing') {
    ui.detailMode = 'review'
  } else if (r.status === 'failed') {
    ui.detailMode = 'failed'
  } else {
    ui.detailMode = 'view'
  }
}

watch(() => ui.selectedRecordId, async (id) => {
  if (!id) return
  actionError.value = null
  dirtyMap.value = {}
  notice.value = ''
  const r = await recordsStore.fetchRecord(id)
  if (!r) return
  updateDetailMode(r)
})

// 监听记录数据变化（轮询回写、操作回写），同步模式；reviewing 中不重置编辑态
watch(record, (newRecord, oldRecord) => {
  if (!newRecord || !ui.selectedRecordId) return
  if (!oldRecord || newRecord.status !== oldRecord.status) {
    updateDetailMode(newRecord)
  }
})

function close() {
  stopPolling()
  ui.showDetail = false
  ui.selectedRecordId = null
  actionError.value = null
  dirtyMap.value = {}
  notice.value = ''
}

// ---- 片段编辑状态 ----
const submitting = ref(false)
const confirming = ref(false)
const actionError = ref(null)
const notice = ref('')
/** { [chunkId]: true } 有未保存修改 */
const dirtyMap = ref({})

function markDirty(chunkId) {
  dirtyMap.value = { ...dirtyMap.value, [chunkId]: true }
}

/**
 * 保存单个片段：PUT /chunks/{id}（8.3 改片段）
 */
async function onSaveChunk({ chunk, payload }) {
  if (submitting.value) return
  submitting.value = true
  actionError.value = null
  const ok = await recordsStore.updateChunk(chunk.id, payload)
  if (ok) {
    dirtyMap.value = { ...dirtyMap.value, [chunk.id]: false }
    toast.success('片段已保存')
  } else {
    actionError.value = recordsStore.error || '保存失败，请重试'
  }
  submitting.value = false
}

/**
 * 删除片段：DELETE /chunks/{id}（8.3 删片段）
 */
async function onRemoveChunk({ chunk }) {
  if (submitting.value) return
  submitting.value = true
  actionError.value = null
  const ok = await recordsStore.deleteChunk(chunk.id)
  if (ok) {
    toast.success('片段已删除')
    notice.value = recordsStore.records.find(r => r.id === ui.selectedRecordId)?.chunks?.length
      ? ''
      : '片段已全部删除，新增片段后才能确认'
  } else {
    // 后端未实现该端点时给出可继续操作的提示
    actionError.value = recordsStore.error || '删除片段失败（后端端点未就绪时无法删除）'
  }
  submitting.value = false
}

/**
 * 新增片段：POST /records/{id}/chunks（8.3 补一段）
 */
async function onAddChunk() {
  if (submitting.value) return
  const text = window.prompt('输入新片段内容：')
  if (!text || !text.trim()) return
  submitting.value = true
  actionError.value = null
  const chunk = await recordsStore.addChunk(ui.selectedRecordId, text.trim())
  submitting.value = false
  if (chunk) {
    toast.success('片段已新增' + (chunk.metadata && Object.keys(chunk.metadata).length ? '' : '（AI 分类失败，metadata 留空，确认时兜底）'))
  } else {
    actionError.value = '新增片段失败，请重试'
  }
}

/**
 * 合并：① PUT /chunks/A（segment=合并文本）→ ② DELETE /chunks/B（8.3，按序 await）
 */
async function onMergeChunks({ chunk: chunkB, payload, targetIndex }) {
  if (submitting.value) return
  const chunks = record.value?.chunks || []
  const chunkA = chunks[targetIndex]
  if (!chunkA) return
  const mergedText = window.prompt(
    '合并片段：请确认合并后的文本（A 段 + B 段）',
    `${chunkA.segment || ''}\n${chunkB.segment || ''}`
  )
  if (mergedText === null || !mergedText.trim()) return
  submitting.value = true
  actionError.value = null
  // ① 改 A
  const okA = await recordsStore.updateChunk(chunkA.id, { ...payload, segment: mergedText })
  if (!okA) {
    actionError.value = recordsStore.error || '合并第一步失败（改 A），未删除 B，可重试'
    submitting.value = false
    return
  }
  // ② 删 B
  const okB = await recordsStore.deleteChunk(chunkB.id)
  if (okB) {
    dirtyMap.value = { ...dirtyMap.value, [chunkA.id]: false }
    toast.success('片段已合并')
  } else {
    actionError.value = recordsStore.error || 'A 已更新但删除 B 失败，请手动删除 B（无脏状态，可直接重试）'
  }
  submitting.value = false
}

/**
 * 拆分：① PUT /chunks/A（segment=前半）→ ② POST /records/{id}/chunks（segment=后半）
 */
async function onSplitChunk({ chunk, payload, segment }) {
  if (submitting.value) return
  const text = segment || chunk.segment || ''
  const cut = Math.floor(text.length / 2)
  const head = window.prompt('拆分片段：前半部分（保留在原片段）', text.slice(0, cut))
  if (head === null || !head.trim()) return
  const tail = window.prompt('拆分片段：后半部分（新建片段）', text.slice(cut))
  if (tail === null || !tail.trim()) return
  submitting.value = true
  actionError.value = null
  // ① 改 A 为前半
  const okA = await recordsStore.updateChunk(chunk.id, { ...payload, segment: head })
  if (!okA) {
    actionError.value = recordsStore.error || '拆分第一步失败（改 A），未新增 B，可重试'
    submitting.value = false
    return
  }
  // ② 新增 B
  const newChunk = await recordsStore.addChunk(ui.selectedRecordId, tail)
  if (newChunk) {
    dirtyMap.value = { ...dirtyMap.value, [chunk.id]: false }
    toast.success('片段已拆分')
  } else {
    actionError.value = recordsStore.error || 'A 已改为前半，但新增后半失败，可手动新增（无脏状态）'
  }
  submitting.value = false
}

/**
 * 确认：PUT /records/{id}/confirm（阻塞数秒——补分类 + Embedding，loading 态）
 */
async function onConfirm() {
  if (confirming.value || submitting.value) return
  confirming.value = true
  actionError.value = null
  const updated = await recordsStore.confirmReview(ui.selectedRecordId)
  confirming.value = false
  if (updated) {
    toast.success('确认完成，已入向量库')
    ui.detailMode = 'view'
  } else {
    actionError.value = recordsStore.error || '确认失败，请重试'
  }
}

/**
 * 丢弃：DELETE /records/{id}
 */
async function onDiscard() {
  if (!window.confirm('确定丢弃这条记录？软删除后不可恢复。')) return
  if (submitting.value) return
  submitting.value = true
  actionError.value = null
  const ok = await recordsStore.deleteRecord(ui.selectedRecordId)
  submitting.value = false
  if (ok) close()
  else actionError.value = recordsStore.error || '删除失败，请重试'
}

// ---- failed 模式：重试（POST /records/{id}/retry）与删除 ----
async function retryProcessing() {
  if (!record.value || submitting.value) return
  submitting.value = true
  actionError.value = null
  const newRecord = await recordsStore.retryRecord(record.value.id)
  submitting.value = false
  if (newRecord) {
    toast.success('已重新提交处理')
    ui.selectedRecordId = newRecord.id
    updateDetailMode(newRecord)
  } else {
    actionError.value = recordsStore.error || '重试失败，请重试'
  }
}

async function deleteRecord() {
  if (!record.value || submitting.value) return
  submitting.value = true
  actionError.value = null
  const ok = await recordsStore.deleteRecord(record.value.id)
  submitting.value = false
  if (ok) close()
  else actionError.value = recordsStore.error || '删除失败，请重试'
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
        {{ ui.detailMode === 'processing' ? 'AI 整理中' : ui.detailMode === 'review' ? '审核片段' : ui.detailMode === 'failed' ? '处理失败' : '记录详情' }}
      </span>
      <span class="detail-status">
        <span v-if="ui.detailMode === 'processing'" class="tag tag-processing">整理中</span>
        <span v-else-if="ui.detailMode === 'reviewing' || ui.detailMode === 'review'" class="tag tag-pending">待审核</span>
        <span v-else-if="ui.detailMode === 'failed'" class="tag tag-failed">失败</span>
        <span v-else class="tag tag-done">已完成</span>
      </span>
    </div>

    <div class="detail-content">
      <!-- 错误提示 -->
      <div v-if="actionError" class="error-banner">{{ actionError }}</div>

      <!-- Processing View：转圈 + 轮询驱动（8.2） -->
      <div v-if="ui.detailMode === 'processing'" class="processing-view">
        <div class="processing-ring" />
        <div class="processing-title">正在分析你的记录</div>
        <div class="processing-desc">AI 正在理解你的内容，通常需要几秒钟。完成后自动进入审核。</div>
      </div>

      <!-- Failed View：错误 + 重试/删除 -->
      <div v-else-if="ui.detailMode === 'failed'" class="failed-view">
        <div class="failed-icon">⚠️</div>
        <div class="failed-title">处理失败</div>
        <div class="failed-desc">{{ record.fail_reason || 'AI 处理过程中出现错误（可能是模型配置问题或内容被判定无意义），可重试或删除' }}</div>
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

      <!-- Review View：片段卡片（8.3） -->
      <ReviewPanel
        v-else-if="ui.detailMode === 'review'"
        :record="record"
        :dirty-map="dirtyMap"
        :submitting="submitting"
        :confirming="confirming"
        :notice="notice"
        @save-chunk="onSaveChunk"
        @remove-chunk="onRemoveChunk"
        @add-chunk="onAddChunk"
        @merge-chunks="onMergeChunks"
        @split-chunk="onSplitChunk"
        @confirm="onConfirm"
        @discard="onDiscard"
      />

      <!-- Done/View：只读展示全部 chunks -->
      <div v-else class="view-panel">
        <div class="review-original">
          <div class="section-label">原始内容</div>
          <div class="review-original-text">{{ record.content }}</div>
        </div>
        <div v-for="(chunk, i) in (record.chunks || [])" :key="chunk.id" class="review-card">
          <div class="review-card-header">
            <span class="chunk-index">{{ i + 1 }}</span>
            <div class="review-card-title">{{ chunk.metadata?.title || '未生成标题' }}</div>
          </div>
          <div v-if="chunk.segment" class="review-field">
            <div class="section-label">片段</div>
            <div class="chunk-text">{{ chunk.segment }}</div>
          </div>
          <div v-if="chunk.metadata?.summary" class="review-field">
            <div class="section-label">摘要</div>
            <div class="chunk-text">{{ chunk.metadata.summary }}</div>
          </div>
          <div class="review-field">
            <div class="section-label">类型</div>
            <div class="review-field-tags">
              <span class="tag tag-type">{{ typeMap[chunk.metadata?.contentType] || chunk.metadata?.contentType || '—' }}</span>
              <span
                v-if="['todo', 'plan'].includes(chunk.metadata?.contentType) && chunk.metadata?.taskStatus"
                class="tag tag-task"
              >{{ taskStatusMap[chunk.metadata.taskStatus] || chunk.metadata.taskStatus }}</span>
            </div>
          </div>
          <div class="review-field">
            <div class="section-label">情绪</div>
            <div class="review-field-tags">
              <span
                v-for="m in (chunk.metadata?.mood || [])"
                :key="m"
                :class="['tag', 'tag-mood', MOOD_COLOR_MAP[m] || '']"
              >{{ moodMap[m] || m }}</span>
              <span v-if="!(chunk.metadata?.mood || []).length" class="muted">—</span>
            </div>
          </div>
          <div v-if="chunk.metadata?.keywords?.length" class="review-field">
            <div class="section-label">关键词</div>
            <div class="review-field-tags">
              <span v-for="k in chunk.metadata.keywords" :key="k" class="keyword">#{{ k }}</span>
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
.detail-content { padding: 16px; max-width: 640px; }

@media (min-width: 900px) {
  .detail-header { padding: 16px 36px; }
  .detail-content { padding: 24px 36px; max-width: 700px; }
}

/* 状态标签 */
.tag { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: var(--radius-full); font-size: 11px; font-weight: 500; }
.tag-processing { background: var(--processing-light); color: var(--processing); animation: tagPulse 2s ease-in-out infinite; }
.tag-pending { background: var(--warning-light); color: var(--warning); }
.tag-failed { background: var(--danger-light); color: var(--danger); }
.tag-done { background: var(--success-light); color: var(--success); }
.tag-type { background: var(--accent-light); color: var(--accent); }
.tag-task { background: #F3F0FF; color: #7C3AED; }
.tag-mood { background: var(--success-light); color: var(--success); }
.tag-mood.anxious { background: var(--warning-light); color: var(--warning); }
.tag-mood.sad { background: var(--danger-light); color: var(--danger); }
.tag-mood.tired { background: #F3F0FF; color: #7C3AED; }
@keyframes tagPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

/* Error banner */
.error-banner {
  padding: 12px 16px; margin-bottom: 16px;
  background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md); color: #ef4444; font-size: 13px;
}

/* Processing */
.processing-view { padding: 60px 20px; text-align: center; }
.processing-ring { width: 64px; height: 64px; margin: 0 auto 24px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.processing-title { font-size: 17px; font-weight: 600; margin-bottom: 8px; }
.processing-desc { font-size: 14px; color: var(--text-secondary); }

/* Failed */
.failed-view { text-align: center; padding: 40px 0; }
.failed-view .review-original { text-align: left; }
.failed-icon { font-size: 48px; margin-bottom: 16px; }
.failed-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; color: var(--danger); }
.failed-desc { font-size: 14px; color: var(--text-secondary); margin-bottom: 24px; }
.failed-actions { display: flex; gap: 12px; justify-content: center; margin-top: 24px; }
.btn-retry {
  padding: 10px 24px; border-radius: var(--radius-full); font-size: 14px; font-weight: 600;
  border: none; cursor: pointer; background: var(--accent); color: #fff;
  transition: all 0.15s; font-family: var(--font);
}
.btn-retry:hover:not(:disabled) { background: var(--accent-hover); }
.btn-retry:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-delete {
  padding: 10px 24px; border-radius: var(--radius-full); font-size: 14px; font-weight: 600;
  border: 1.5px solid var(--danger); cursor: pointer; background: transparent; color: var(--danger);
  transition: all 0.15s; font-family: var(--font);
}
.btn-delete:hover:not(:disabled) { background: var(--danger-light); }
.btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }

/* View（done 只读） */
.view-panel { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.review-original { background: var(--surface); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px; border: 0.5px solid var(--border); }
.review-original-text { font-size: 14px; color: var(--text-primary); line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.review-card { background: var(--surface); border-radius: var(--radius-md); padding: 20px; margin-bottom: 12px; border: 0.5px solid var(--border); }
.review-card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.chunk-index {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: #fff; font-size: 12px; font-weight: 700; border-radius: 50%; flex-shrink: 0;
}
.review-card-title { font-size: 16px; font-weight: 600; flex: 1; }
.review-field { margin-bottom: 16px; }
.review-field:last-child { margin-bottom: 0; }
.review-field-tags { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.chunk-text { font-size: 14px; color: var(--text-primary); line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.muted { font-size: 13px; color: var(--text-tertiary); }
.keyword { font-size: 11px; color: var(--text-tertiary); background: var(--bg); padding: 2px 8px; border-radius: var(--radius-full); }

.section-label { font-size: 11px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
</style>
