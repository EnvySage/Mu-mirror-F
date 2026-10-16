<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useRecordsStore } from '@/stores/records'
import { useStatsStore } from '@/stores/stats'
import { useTodoStore } from '@/stores/todo'
import { useToastStore } from '@/stores/toast'
import ReviewPanel from '@/components/organisms/ReviewPanel.vue'

const ui = useUIStore()
const recordsStore = useRecordsStore()
const statsStore = useStatsStore()
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

/** 处理中三步动画（正在整理原文、识别主题并生成片段。） */
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
    // 建议在处理过程中生成（不在审核时）：点进来时记录可能还是 processing，
    // 那时拉到的建议是空的；轮询到审核态必须重拉一次，否则只有整页刷新才看得到
    todoStore.fetch()
    // 审核页「关联待办」数据源（GET /records/{id}/suggestions，拉到时预填裁决）
    todoStore.fetchRecordSuggestions(r.id)
  } else if (r.status === 'failed') {
    ui.detailMode = 'failed'
  } else if (r.status === 'record_only') {
    ui.detailMode = 'view'
  } else {
    ui.detailMode = 'view'
  }
}

watch(() => ui.selectedRecordId, async (id) => {
  if (!id) return
  actionError.value = null
  // 切记录 = 放弃上一张的关联待办裁决（未入库，不该带过来）
  todoStore.clearResolutions()
  // 建议随"写日记分类"生成（不在审核时），打开记录时重拉一次，
  // 保证审核窗口的建议卡是最新（刚写完日记就来审核的场景）
  todoStore.fetch()
  const r = await recordsStore.fetchRecord(id)
  if (!r) return
  updateDetailMode(r)
  // immediate：DetailPanel 在 MainLayout 常驻，若 mounted 时 selectedRecordId 已有值
  // （刷新后恢复/路由直达），watch 不会触发，首次进入就漏掉建议刷新
}, { immediate: true })

/** 建议卡证据行 → 切到证据所在记录（同 id 时组件内已拦截，不会走到这） */
function openRecord(id) {
  ui.selectedRecordId = id
}

watch(record, (newRecord, oldRecord) => {
  if (!newRecord || !ui.selectedRecordId) return
  if (!oldRecord || newRecord.status !== oldRecord.status) {
    updateDetailMode(newRecord)
  }
})

const headerTitle = computed(() => {
  switch (ui.detailMode) {
    case 'processing': return 'AI 整理中'
    case 'review': return `片段确认 · ${(record.value?.chunks || []).length} 个片段`
    case 'failed': return '处理失败'
    case 'view': return record.value?.status === 'record_only' ? '仅记录' : '片段记忆授权'
    default: return '记录详情'
  }
})

const showConfirm = computed(() => ['reviewing', 'done'].includes(record.value?.status))

function close() {
  stopPolling()
  clearStepTimers()
  // 未入库 → 关联待办裁决一并作废
  todoStore.clearResolutions()
  ui.showDetail = false
  ui.selectedRecordId = null
  actionError.value = null
}

// ---- 确认入库（长时 loading 文案） ----
const confirming = ref(false)
const actionError = ref(null)
const aiMemoryChunkIds = ref([])
const todoChunkIds = ref([])

function onAuthorizationChange(value) {
  aiMemoryChunkIds.value = value.aiMemoryChunkIds
  todoChunkIds.value = value.todoChunkIds
}

async function onConfirm() {
  if (confirming.value) return
  confirming.value = true
  actionError.value = null
  // 关联待办（AI 建议裁决 + 手动挂载）随「确认入库」一起提交（todoResolutions）；
  // 无任何关联项时不带该字段（body 可选扩展，契约见 api/records.js）
  const todoResolutions = todoStore.resolutionsPayload
  const payload = {
    aiMemoryChunkIds: aiMemoryChunkIds.value,
    todoChunkIds: todoChunkIds.value,
    ...(todoResolutions.length ? { todoResolutions } : {}),
  }
  const updated = await recordsStore.confirmReview(ui.selectedRecordId, payload)
  confirming.value = false
  if (updated) {
    toast.success('片段授权已更新')
    ui.detailMode = 'view'
    // 裁决已随 confirm 落库 → 清掉本地暂存
    todoStore.clearResolutions()
    // 入库后可能产生待办登记行 / pending 状态建议（todo-registry-design.md §3.1/§3.2）：
    // 刷建议 + 证据链 + 强制刷 stats（侧栏待办读 stats.todo.open_items，30s 缓存会挡住新登记项）
    todoStore.fetch()
    todoStore.fetchChains()
    statsStore.fetchStats(30, true)
  } else {
    actionError.value = recordsStore.error || '确认失败，请重试'
  }
}

const rawEditing = ref(false)
const rawDraft = ref('')
watch(() => record.value?.id, () => {
  rawDraft.value = record.value?.content || ''
  rawEditing.value = false
})

async function saveRaw() {
  const updated = await recordsStore.updateRawRecord(record.value.id, rawDraft.value)
  if (updated) {
    rawEditing.value = false
    toast.success('仅记录已更新')
  } else actionError.value = recordsStore.error || '更新原文失败'
}

async function organizeSavedRecord() {
  const updated = await recordsStore.organizeRecord(record.value.id)
  if (updated) {
    ui.detailMode = 'processing'
    startStepAnimation()
    startPolling(updated.id)
    toast.info('已请求 Mirror 整理')
  } else actionError.value = recordsStore.error || '请求整理失败'
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
          >{{ confirming ? '保存授权…' : record.status === 'reviewing' ? '确认所选片段' : '更新记忆授权' }}</button>
          <button v-else-if="record.status === 'record_only'" class="detail-confirm" @click="organizeSavedRecord">让 Mirror 整理</button>
          <span v-else class="detail-title" />
        </div>

        <div class="detail-content">
          <div v-if="actionError" class="detail-error">{{ actionError }}</div>

          <!-- 处理中：三步动画 -->
          <div v-if="ui.detailMode === 'processing'" class="processing-view">
            <div class="processing-ring" />
            <div class="processing-title">正在分析你的记录</div>
            <div class="processing-desc">正在整理原文、识别主题并生成片段。</div>
            <div class="processing-steps">
              <div :class="['processing-step', { active: processingStep === 0, done: processingStep > 0 }]">
                <div class="processing-step-dot" />整理原文
              </div>
              <div :class="['processing-step', { active: processingStep === 1, done: processingStep > 1 }]">
                <div class="processing-step-dot" />识别主题
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

          <div v-else-if="record.status === 'record_only'" class="record-only-view">
            <p class="record-only-note">这条内容只保存在你的记录里，Mirror 尚未读取。</p>
            <textarea v-if="rawEditing" v-model="rawDraft" class="record-only-editor" aria-label="编辑仅记录原文" />
            <div v-else class="review-original-text">{{ record.content }}</div>
            <div class="failed-actions">
              <button v-if="!rawEditing" class="chip chip-accent" @click="rawEditing = true">编辑原文</button>
              <button v-else class="chip chip-accent" @click="saveRaw">保存修改</button>
              <button v-if="rawEditing" class="chip" @click="rawEditing = false; rawDraft = record.content">取消</button>
              <button class="chip chip-danger" @click="deleteRecord">删除记录</button>
            </div>
          </div>

          <!-- 审核 / 只读（审核态内含待办建议卡，证据行可切记录） -->
          <ReviewPanel v-else :record="record" @open-record="openRecord" @authorization-change="onAuthorizationChange" />
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
.record-only-view{padding:16px;border:1px solid var(--line);background:var(--card);border-radius:var(--radius)}.record-only-note{font-size:12px;color:var(--text-mid);margin-bottom:14px}.record-only-editor{width:100%;min-height:220px;padding:14px;border:1px solid var(--line);font:14px/1.8 var(--font);color:var(--text-hi);background:var(--card)}
.failed-actions { display: flex; gap: 8px; justify-content: center; margin-top: 14px; }
.failed-actions .chip { cursor: pointer; }
.chip-accent { color: var(--accent); }
.chip-danger { color: var(--danger); }

.detail-header { background:#071b50; border-bottom:3px solid var(--cyan); color:white; min-height:64px; }
.detail-back,.detail-title { color:#d4e7ff; }.detail-title{font-weight:800}.detail-back:hover{color:var(--cyan)}
.detail-confirm { background:var(--cyan); color:var(--night); border-radius:2px; font-weight:800; min-height:38px; }.detail-confirm:hover{background:white}
.detail-page { background:#eaf1ff; }.review-original{border-radius:2px}.processing-title{font-family:var(--font);font-weight:800}
</style>
