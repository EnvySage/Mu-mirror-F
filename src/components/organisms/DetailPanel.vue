<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useRecordsStore } from '@/stores/records'
import { useTodoStore } from '@/stores/todo'
import { useToastStore } from '@/stores/toast'
import ReviewPanel from '@/components/organisms/ReviewPanel.vue'

const ui = useUIStore()
const recordsStore = useRecordsStore()
const todoStore = useTodoStore()
const toast = useToastStore()

const record = computed(() => {
  if (!ui.selectedRecordId) return null
  return recordsStore.getById(ui.selectedRecordId)
})

// ---- 轮询（8.2：processing → 2.5s 轮询详情，直到终态） ----
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
    } else if (r.status === 'reviewing') {
      toast.success('AI 拆分完成，请审核')
    } else if (r.status === 'done') {
      toast.success('AI 整理完成')
    }
  }
  pollTimer = setTimeout(tick, 2500)
}

onBeforeUnmount(stopPolling)

/** 处理中三步动画（Clean → Classify → 生成片段） */
const processingStep = ref(0)
let stepTimers = []

function startStepAnimation() {
  clearStepTimers()
  processingStep.value = 0
  stepTimers.push(setTimeout(() => { processingStep.value = 1 }, 700))
  stepTimers.push(setTimeout(() => { processingStep.value = 2 }, 1400))
}

function clearStepTimers() {
  stepTimers.forEach(clearTimeout)
  stepTimers = []
}

function updateDetailMode(r) {
  if (!r) return
  stopPolling()
  clearStepTimers()
  if (r.status === 'processing') {
    ui.detailMode = 'processing'
    startStepAnimation()
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
  const r = await recordsStore.fetchRecord(id)
  if (!r) return
  updateDetailMode(r)
})

watch(record, (newRecord, oldRecord) => {
  if (!newRecord || !ui.selectedRecordId) return
  if (!oldRecord || newRecord.status !== oldRecord.status) {
    updateDetailMode(newRecord)
  }
})

const headerTitle = computed(() => {
  switch (ui.detailMode) {
    case 'processing': return 'AI 整理中'
    case 'review': return `审核 · ${(record.value?.chunks || []).length} 个片段`
    case 'failed': return '处理失败'
    default: return '记录详情（只读）'
  }
})

const showConfirm = computed(() => ui.detailMode === 'review')

function close() {
  stopPolling()
  clearStepTimers()
  ui.showDetail = false
  ui.selectedRecordId = null
  actionError.value = null
}

// ---- 确认入库（长时 loading 文案） ----
const confirming = ref(false)
const actionError = ref(null)

async function onConfirm() {
  if (confirming.value) return
  confirming.value = true
  actionError.value = null
  const updated = await recordsStore.confirmReview(ui.selectedRecordId)
  confirming.value = false
  if (updated) {
    toast.success('已入库，向量已生成')
    ui.detailMode = 'view'
    // 入库后可能产生待办登记行 / pending 状态建议（todo-registry-design.md §3.1/§3.2）：
    // 刷新建议缓存——侧栏角标/建议卡下一次打开记录页即为最新；不在此处弹建议 toast
    // （建议卡主体在侧栏，审核窗口保持轻量，取舍已在 F 日志声明）
    todoStore.fetch()
  } else {
    actionError.value = recordsStore.error || '确认失败，请重试'
  }
}

/** failed：重试 / 删除 */
const submitting = ref(false)

async function retryProcessing() {
  if (!record.value || submitting.value) return
  submitting.value = true
  const newRecord = await recordsStore.retryRecord(record.value.id)
  submitting.value = false
  if (newRecord) {
    toast.info('已重新提交，AI 处理中…')
    ui.selectedRecordId = newRecord.id
  } else {
    actionError.value = recordsStore.error || '重试失败，请重试'
  }
}

async function deleteRecord() {
  if (!record.value || submitting.value) return
  if (!window.confirm('确定删除这条记录？软删除后不可恢复。')) return
  submitting.value = true
  const ok = await recordsStore.deleteRecord(record.value.id)
  submitting.value = false
  if (ok) {
    toast.success('记录已删除')
    close()
  } else {
    actionError.value = recordsStore.error || '删除失败，请重试'
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="slide">
      <div v-if="ui.selectedRecordId && record" class="detail-page">
        <div class="detail-header">
          <button class="detail-back" @click="close">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
            返回
          </button>
          <span class="detail-title">{{ headerTitle }}</span>
          <button
            v-if="showConfirm"
            class="detail-confirm"
            :disabled="confirming"
            @click="onConfirm"
          >{{ confirming ? '补分类 → 向量化…' : '确认入库' }}</button>
          <span v-else class="detail-title" />
        </div>

        <div class="detail-content">
          <div v-if="actionError" class="detail-error">{{ actionError }}</div>

          <!-- 处理中：三步动画 -->
          <div v-if="ui.detailMode === 'processing'" class="processing-view">
            <div class="processing-ring" />
            <div class="processing-title">正在分析你的记录</div>
            <div class="processing-desc">Clean → Classify → 生成片段</div>
            <div class="processing-steps">
              <div :class="['processing-step', { active: processingStep === 0, done: processingStep > 0 }]">
                <div class="processing-step-dot" />文本清洗（Clean）
              </div>
              <div :class="['processing-step', { active: processingStep === 1, done: processingStep > 1 }]">
                <div class="processing-step-dot" />拆分与分类（Classify）
              </div>
              <div :class="['processing-step', { active: processingStep === 2 }]">
                <div class="processing-step-dot" />生成片段卡片
              </div>
            </div>
          </div>

          <!-- failed：原因 + 重试/删除 -->
          <div v-else-if="ui.detailMode === 'failed'" class="failed-view">
            <div class="review-original">
              <div class="review-label">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                原始内容 · 不可修改
              </div>
              <div class="review-original-text">{{ record.content }}</div>
            </div>
            <div class="status-failed-row" style="font-size:13px;justify-content:center;padding:10px 0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              {{ record.fail_reason || '处理失败（可能是模型配置问题或内容被判定无意义）' }}
            </div>
            <div class="failed-actions">
              <button class="chip chip-accent" :disabled="submitting" @click="retryProcessing">
                {{ submitting ? '重试中…' : '重试' }}
              </button>
              <button class="chip chip-danger" :disabled="submitting" @click="deleteRecord">删除</button>
            </div>
          </div>

          <!-- 审核 / 只读 -->
          <ReviewPanel v-else :record="record" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.detail-page {
  position: fixed; inset: 0; z-index: 30;
  background: var(--ink-2);
  display: flex; flex-direction: column;
}
@media (min-width: 900px) {
  .detail-page {
    left: var(--sidebar-width);
    box-shadow: -12px 0 32px rgba(20,20,15,.1);
    border-left: 1px solid var(--line);
  }
}

.slide-enter-active, .slide-leave-active { transition: transform .3s cubic-bezier(.32,.72,.28,1); }
.slide-enter-from, .slide-leave-to { transform: translateX(102%); }

.detail-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--card);
}
.detail-back {
  display: flex; align-items: center; gap: 4px;
  font-size: 14.5px; color: var(--text-mid); padding: 6px 8px;
}
.detail-back svg { width: 17px; height: 17px; stroke: currentColor; fill: none; }
.detail-title { font-size: 14px; color: var(--text-mid); }
.detail-confirm {
  font-size: 13.5px; font-weight: 600; color: #FFFFFF;
  background: var(--accent);
  padding: 7px 18px; border-radius: var(--radius-full);
  transition: background .15s, transform .1s;
}
.detail-confirm:hover { background: var(--accent-hover); }
.detail-confirm:active { transform: scale(.97); }
.detail-confirm:disabled { opacity: .55; cursor: not-allowed; }

.detail-content {
  flex: 1; overflow-y: auto;
  padding: 16px 18px calc(40px + var(--safe-bottom));
}
@media (min-width: 900px) { .detail-content { padding: 20px 32px 40px; } }

.detail-error {
  font-size: 12.5px; color: var(--danger);
  padding: 10px 14px; margin-bottom: 12px;
  border-radius: var(--radius-sm); background: var(--danger-bg);
}

/* 原文面板（"光源"）—— 审核组件内复用同款样式，这里给 failed 用 */
.review-original {
  position: relative; padding: 14px 16px; margin-bottom: 14px;
  border-radius: var(--radius);
  background: var(--accent-soft);
  border: 1px solid rgba(44,95,232,.18);
}
.review-label {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .16em;
  color: var(--accent); margin-bottom: 6px;
  display: flex; align-items: center; gap: 6px;
}
.review-label svg { width: 12px; height: 12px; stroke: var(--accent); fill: none; }
.review-original-text { font-size: 14px; line-height: 1.8; color: var(--text-hi); white-space: pre-wrap; word-break: break-word; }

/* 处理中视图 */
.processing-view { text-align: center; padding: 70px 20px; }
.processing-ring {
  width: 58px; height: 58px; margin: 0 auto 22px; border-radius: 50%;
  border: 2.5px solid var(--processing-bg); border-top-color: var(--processing);
  animation: spin 1.1s linear infinite;
}
.processing-title { font-family: var(--font-display); font-size: 17px; }
.processing-desc { font-size: 12.5px; color: var(--text-low); margin-top: 6px; }
.processing-steps { margin-top: 26px; display: inline-flex; flex-direction: column; gap: 12px; text-align: left; }
.processing-step {
  display: flex; align-items: center; gap: 10px;
  font-size: 13.5px; color: var(--text-low); transition: color .3s;
}
.processing-step-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--line-strong); transition: all .3s; }
.processing-step.active { color: var(--text-hi); }
.processing-step.active .processing-step-dot { background: var(--accent); animation: pulse 1s infinite alternate; }
.processing-step.done { color: var(--text-mid); }
.processing-step.done .processing-step-dot { background: var(--success); }

.failed-view { text-align: center; }
.failed-actions { display: flex; gap: 8px; justify-content: center; margin-top: 14px; }
.failed-actions .chip { cursor: pointer; }
.chip-accent { color: var(--accent); }
.chip-danger { color: var(--danger); }
</style>
