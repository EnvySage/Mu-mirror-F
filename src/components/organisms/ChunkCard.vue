<script setup>
import { reactive, computed, watch, ref, nextTick } from 'vue'
import { CONTENT_TYPES, ALL_MOODS, TASK_STATUSES, typeMap, taskStatusMap } from '@/constants/tags'
import { MOOD_COLOR } from '@/constants/moodColor'
import { useRecordsStore } from '@/stores/records'
import { useToastStore } from '@/stores/toast'
import { renderMarkdown } from '@/utils/mdPreview'
import { createChunkDraft, discardChunkDraft, hasChunkDraftChanges, updateChunkDraft } from '@/utils/chunkDraft'
/**
 * 片段卡片（v2 原型版 —— "镜面反射"）
 * 左缘 3px accent-grad 光条；segment 作为本地草稿，显式保存后才 PUT /chunks/{id}。
 * 元数据 chips 独立自动保存；新增的空片段用显式保存按钮走 POST /records/{id}/chunks。
 * 只读态 segment 用 renderMarkdown 渲染（vault key chunk / 用户日记 md 源文本
 * 带 # ** ` 标记时正常排版；纯文本日记输出 <p> 包裹视觉差异小；审核态 textarea 不动）。
 */
const props = defineProps({
  chunk: { type: Object, required: true },
  index: { type: Number, default: 0 },
  editable: { type: Boolean, default: false },
  /** 只读态（done 记录）：所有编辑控件禁用/隐藏，一眼可见"不可修改" */
  readonly: { type: Boolean, default: false },
})
const emit = defineEmits(['dirty-change'])

const recordsStore = useRecordsStore()
const toast = useToastStore()

/** 编辑可用 = 审核中 且 非只读（done） */
const canEdit = computed(() => props.editable && !props.readonly)

/** 仅本地占位片段（ReviewPanel 新增）走 POST /records/{id}/chunks */
const isNew = computed(() => String(props.chunk.id).startsWith('local_'))
const showTaskStatus = computed(() => ['todo', 'plan'].includes(edit.contentType))
const textDraft = ref(createChunkDraft(''))
const textEdited = computed(() => hasChunkDraftChanges(textDraft.value))
const saving = ref(false)
const saveError = ref('')
const failedFields = ref(null)
const textareaEl = ref(null)
// Detail opens as a reading surface; keep the full taxonomy behind an explicit edit action.
const attributesExpanded = ref(false)
const selectedTypeLabel = computed(() => CONTENT_TYPES.find(t => t.key === edit.contentType)?.label || '未分类')
const selectedMoodItems = computed(() => ALL_MOODS.filter(m => edit.mood.includes(m.key)))
watch(() => props.chunk.id, () => { attributesExpanded.value = false })

const edit = reactive({
  segment: '',
  contentType: '',
  mood: [],
  taskStatus: '',
  keywords: '',
})

/** 只读态 md 渲染（renderMarkdown escape-first：用户内容永远以纯文本形态出现，防 XSS） */
const segmentHtml = computed(() => renderMarkdown(props.chunk.segment || ''))

function resetFrom(chunk) {
  const segment = chunk.segment || ''
  textDraft.value = createChunkDraft(segment)
  edit.segment = segment
  edit.contentType = chunk.metadata?.contentType || ''
  edit.mood = [...(chunk.metadata?.mood || [])]
  edit.taskStatus = chunk.metadata?.taskStatus || ''
  edit.keywords = (chunk.metadata?.keywords || []).join('，')
}

watch(() => props.chunk.id, () => resetFrom(props.chunk), { immediate: true })
watch(() => props.chunk.segment, (segment) => {
  const committed = segment || ''
  if (committed === edit.segment) {
    textDraft.value = createChunkDraft(committed)
  } else if (!textEdited.value) {
    textDraft.value = createChunkDraft(committed)
    edit.segment = committed
  }
})
watch(() => props.chunk.metadata, (metadata) => {
  edit.contentType = metadata?.contentType || ''
  edit.mood = [...(metadata?.mood || [])]
  edit.taskStatus = metadata?.taskStatus || ''
  edit.keywords = (metadata?.keywords || []).join('，')
})

/** 新增空片段自动聚焦 */
watch(textareaEl, async (el) => {
  if (el && isNew.value && !edit.segment) {
    await nextTick()
    el.focus()
    el.placeholder = '写下新片段…（保存后 AI 自动单段分类）'
  }
})

function autoGrow(el) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function onSegmentInput(e) {
  textDraft.value = updateChunkDraft(textDraft.value, edit.segment)
  saveError.value = ''
  failedFields.value = null
  notifyDirty()
  autoGrow(e.target)
}

function notifyDirty() {
  emit('dirty-change', { id: props.chunk.id, dirty: textEdited.value || saving.value || !!saveError.value })
}

async function saveSegment() {
  if (!textEdited.value || !edit.segment.trim()) return
  await save({ segment: edit.segment })
}

function cancelSegmentEdit() {
  textDraft.value = discardChunkDraft(textDraft.value)
  edit.segment = textDraft.value.value
  saveError.value = ''
  failedFields.value = null
  notifyDirty()
}

function toggleMood(m) {
  if (!canEdit.value) return
  const i = edit.mood.indexOf(m)
  if (i >= 0) edit.mood.splice(i, 1)
  else edit.mood.push(m)
  save({ mood: [...edit.mood] })
}

function selectType(t) {
  if (!canEdit.value) return
  edit.contentType = t
  if (!showTaskStatus.value) edit.taskStatus = ''
  // taskStatus 清空语义 = 空串 ""（null 被 Jackson 忽略，B 侧 taskStatus 为空串时清空）
  save({ contentType: t, ...(showTaskStatus.value && edit.taskStatus ? { taskStatus: edit.taskStatus } : { taskStatus: '' }) })
}

function selectTask(t) {
  if (!canEdit.value) return
  edit.taskStatus = edit.taskStatus === t ? '' : t
  save({ taskStatus: edit.taskStatus || '' })
}

async function onKeywordsBlur() {
  const keywords = edit.keywords.split(/[，,]/).map(s => s.trim()).filter(Boolean)
  await save({ keywords })
}

/** 组装扁平 payload（ChunkDTO 契约） */
async function save(fields) {
  if (saving.value) return
  saving.value = true
  notifyDirty()
  saveError.value = ''
  failedFields.value = null
  // Existing chunks persist only the field the user changed. This keeps metadata
  // autosave from accidentally committing an unsubmitted segment draft.
  const payload = isNew.value ? {
    segment: edit.segment,
    contentType: edit.contentType || undefined,
    mood: edit.mood,
    taskStatus: (showTaskStatus.value && edit.taskStatus) || undefined,
    keywords: edit.keywords.split(/[，,]/).map(s => s.trim()).filter(Boolean),
    ...fields,
  } : { ...fields }
  let ok
  if (isNew.value && edit.segment.trim()) {
    // 新片段：POST /records/{id}/chunks；成功后以返回 chunk 替换本地占位
    ok = await recordsStore.createChunkForRecord(props.chunk, payload)
    if (ok) toast.success('片段已新增，AI 将自动单段分类')
  } else if (isNew.value) {
    // 占位但还没写文本：不触发请求
    ok = true
  } else {
    ok = await recordsStore.updateChunk(props.chunk.id, payload)
    if (ok) {
      if (Object.hasOwn(fields, 'segment')) {
        textDraft.value = createChunkDraft(fields.segment)
        toast.success('文本已保存；如需加入 Mirror 记忆，请重新授权')
      } else toast.success('片段属性已保存')
    }
  }
  if (!ok) {
    saveError.value = recordsStore.error || '保存失败，请重试'
    failedFields.value = fields
    toast.error(saveError.value)
    notifyDirty()
  } else {
    notifyDirty()
  }
  saving.value = false
  notifyDirty()
  return !!ok
}

async function retryFailedSave() {
  if (!failedFields.value || saving.value) return
  const fields = failedFields.value
  if (await save(fields)) {
    if (Object.hasOwn(fields, 'segment')) textDraft.value = createChunkDraft(edit.segment)
  }
}

async function retryEmbedding() {
  const ok = await recordsStore.retryChunkEmbedding(props.chunk.id)
  if (ok) toast.info('已重新加入向量重建队列')
  else toast.error(recordsStore.error || '重试失败，请稍后再试')
}

async function removeChunk() {
  const ok = await recordsStore.deleteChunk(props.chunk.id)
  if (ok) toast.success('片段已删除')
  else toast.error(recordsStore.error || '删除片段失败')
}
</script>

<template>
  <div :class="['chunk-card', 'card', { 'chunk-readonly': readonly }]">
    <div class="chunk-top">
      <span class="chunk-top-left">
      <span class="chunk-index">#{{ String(index + 1).padStart(2, '0') }}{{ saving ? ' · 保存中' : saveError ? ' · 未保存' : textEdited ? ' · 草稿未保存' : '' }}{{ readonly ? ' · 只读' : '' }}</span>
        <!-- 待办终态徽标：待办已删除优先于待办已完成（todoRemoved 由后端软删待办时回写 metadata；记录内容完整保留） -->
        <span v-if="chunk.metadata?.todoRemoved === true" class="chunk-badge chunk-badge-removed" title="关联待办已被删除，记录内容保留">待办已删除</span>
        <span v-else-if="chunk.metadata?.taskStatus === 'completed'" class="chunk-badge chunk-badge-done" title="关联待办已完成，记录内容保留">待办已完成</span>
      </span>
      <div class="chunk-actions">
        <button v-if="canEdit" class="chunk-icon-btn danger" title="删除片段" @click="removeChunk">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
        <button v-if="saveError && canEdit" class="chunk-retry" :disabled="saving" @click="retryFailedSave">重试保存</button>
      </div>
    </div>

    <!-- segment：审核态 textarea 可编辑；只读态 md 渲染（vault key chunk / 日记 md 源文本） -->
    <textarea
      v-if="canEdit"
      ref="textareaEl"
      v-model="edit.segment"
      class="chunk-segment"
      rows="1"
      :disabled="saving"
      @input="onSegmentInput"
    />
    <div v-else class="chunk-segment chunk-segment-md" v-html="segmentHtml" />
    <div v-if="canEdit && textEdited" class="chunk-draft-actions">
      <span>草稿尚未保存；当前记忆向量保持不变</span>
      <button type="button" class="chunk-draft-cancel" :disabled="saving" @click="cancelSegmentEdit">取消</button>
      <button type="button" class="chunk-draft-save" :disabled="saving || !edit.segment.trim()" @click="saveSegment">{{ saving ? '保存中…' : '保存修改' }}</button>
    </div>
    <div v-if="chunk.ai_memory_approved ?? chunk.aiMemoryApproved" class="chunk-embedding-status" :data-status="chunk.embedding_status ?? chunk.embeddingStatus ?? (chunk.has_embedding ?? chunk.hasEmbedding ? 'ready' : 'pending')">
      <span v-if="(chunk.embedding_status ?? chunk.embeddingStatus) === 'pending' || (!(chunk.embedding_status ?? chunk.embeddingStatus) && !(chunk.has_embedding ?? chunk.hasEmbedding))">◌ 向量重建中，完成后即可用于记忆检索</span>
      <span v-else-if="(chunk.embedding_status ?? chunk.embeddingStatus) === 'failed'">向量重建失败：{{ chunk.embedding_error ?? chunk.embeddingError ?? '暂时无法生成' }}</span>
      <span v-else-if="(chunk.embedding_status ?? chunk.embeddingStatus) === 'ready' || (chunk.has_embedding ?? chunk.hasEmbedding)">✓ 已可用于记忆检索</span>
      <span v-else>尚未生成向量</span>
      <button v-if="(chunk.embedding_status ?? chunk.embeddingStatus) === 'failed' || (!(chunk.has_embedding ?? chunk.hasEmbedding) && (chunk.embedding_status ?? chunk.embeddingStatus) === 'not_requested')" type="button" :disabled="saving" @click="retryEmbedding">重试生成</button>
    </div>

    <!-- 标题/摘要（AI 生成展示） -->
    <div class="chunk-field">
      <div class="chunk-field-label">标题 / 摘要</div>
      <div style="font-size:13.5px;font-weight:600">{{ chunk.metadata?.title || '（待分类）' }}</div>
      <div style="font-size:12.5px;color:var(--text-mid)">{{ chunk.metadata?.summary || '确认时 AI 将自动补分类' }}</div>
    </div>

    <div class="attribute-toolbar">
      <span class="attribute-summary" aria-label="已选属性">
        <span class="attribute-summary-type">{{ selectedTypeLabel }}</span>
        <span v-for="mood in selectedMoodItems" :key="mood.key" class="attribute-summary-mood" :style="{ '--mood-color': MOOD_COLOR[mood.key] }">{{ mood.label }}</span>
      </span>
      <button type="button" class="attribute-toggle" :aria-expanded="attributesExpanded" @click="attributesExpanded = !attributesExpanded">
        {{ attributesExpanded ? '收起属性' : canEdit ? '编辑属性' : '查看属性' }}
      </button>
    </div>

    <!-- 内容类型 chips（8 选 1） -->
    <div v-show="attributesExpanded" class="chunk-attributes">
    <div class="chunk-field">
      <div class="chunk-field-label">内容类型 TYPE · 8 选 1</div>
      <div class="chip-row">
        <button
          v-for="t in CONTENT_TYPES"
          :key="t.key"
          :class="['chip', { selected: edit.contentType === t.key }]"
          :disabled="!canEdit || saving"
          @click="selectType(t.key)"
        >{{ t.label }}</button>
      </div>
    </div>

    <!-- 情绪 chips（13 色多选，已选可点取消） -->
    <div class="chunk-field">
      <div class="chunk-field-label">情绪 MOOD · 多选</div>
      <div class="chip-row">
        <button
          v-for="m in ALL_MOODS"
          :key="m.key"
          :class="['chip', 'mood-chip', { selected: edit.mood.includes(m.key) }]"
          :style="{ color: edit.mood.includes(m.key) ? MOOD_COLOR[m.key] : undefined }"
          :disabled="!canEdit || saving"
          @click="toggleMood(m.key)"
        ><span class="dot" />{{ m.label }}</button>
      </div>
    </div>

    <!-- 任务状态（仅 todo/plan；点已选项清空该字段） -->
    <div v-if="showTaskStatus" class="chunk-field">
      <div class="chunk-field-label">任务状态 TASK</div>
      <div class="chip-row">
        <button
          v-for="t in TASK_STATUSES"
          :key="t.key"
          :class="['chip', { selected: edit.taskStatus === t.key }]"
          :disabled="!canEdit || saving"
          @click="selectTask(t.key)"
        >{{ t.label }}</button>
      </div>
    </div>

    <!-- 关键词 -->
    <div class="chunk-field">
      <div class="chunk-field-label">关键词 KEYWORDS · 3-5 个</div>
      <input
        v-if="canEdit"
        v-model="edit.keywords"
        class="keywords-input"
        placeholder="用逗号分隔"
        :disabled="saving"
        @input="notifyDirty"
        @blur="onKeywordsBlur"
      >
      <div v-else class="record-keywords" style="margin-top:0">
        <span v-for="k in (chunk.metadata?.keywords || [])" :key="k" class="keyword">{{ k }}</span>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.chunk-card {
  position: relative;
  padding: 16px 16px 14px 20px; margin-bottom: 12px;
}
/* 左缘墨蓝实线条 */
.chunk-card::before {
  content: ""; position: absolute; left: 0; top: 14px; bottom: 14px;
  width: 3px; border-radius: 2px; background: var(--accent); opacity: .9;
}
.chunk-card.adding { animation: chunkIn .3s ease; }
.chunk-draft-actions { display:flex; align-items:center; justify-content:flex-end; gap:10px; flex-wrap:wrap; margin:-4px 0 14px; padding:10px 12px; border-left:3px solid var(--cyan); background:#eaf7ff; color:var(--text-mid); font-size:12px; }
.chunk-draft-actions span { margin-right:auto; }
.chunk-draft-actions button,.chunk-embedding-status button { border:1px solid var(--line); background:white; color:var(--text-hi); padding:6px 12px; cursor:pointer; font:inherit; font-weight:700; }
.chunk-draft-actions .chunk-draft-save { background:var(--cyan); border-color:var(--cyan); color:var(--night); }
.chunk-draft-actions button:disabled,.chunk-embedding-status button:disabled { opacity:.55; cursor:not-allowed; }
.chunk-embedding-status { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:10px 0 14px; padding:9px 12px; border-left:3px solid var(--cyan); background:#eaf7ff; color:var(--text-mid); font-size:12px; }
.chunk-embedding-status[data-status="failed"] { border-color:#ff477e; background:#fff0f4; color:#8b173c; }
.chunk-embedding-status[data-status="ready"] { border-color:#3eb27d; background:#effaf4; color:#246648; }

.chunk-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px; }
.chunk-top-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
.chunk-index { font-family: var(--font-mono); font-size: 10.5px; color: var(--accent); letter-spacing: .1em; }
/* 待办终态徽标（待办已删除 / 待办已完成）：形状跟随标签语言 */
.chunk-badge {
  flex-shrink: 0; font-size: 10.5px; font-weight: 600;
  padding: 1px 8px; border-radius: var(--radius-full);
}
.chunk-badge-done { color: var(--success); background: var(--success-bg); }
.chunk-badge-removed { color: var(--danger); background: var(--danger-bg); }
.chunk-actions { display: flex; gap: 4px; }
.chunk-icon-btn { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; transition: background .15s; }
.chunk-icon-btn svg { width: 14px; height: 14px; stroke: var(--text-low); fill: none; }
.chunk-icon-btn:hover { background: var(--ink-2); }
.chunk-icon-btn.danger:hover svg { stroke: var(--danger); }

.chunk-segment {
  width: 100%; background: transparent; border: none; resize: none;
  font-size: 14.5px; line-height: 1.75; min-height: 44px;
  border-radius: 8px; padding: 2px 0; color: var(--text-hi);
  overflow: hidden;
}
.chunk-segment:focus { outline: none; }

/* 只读态 md 渲染（fpm-md 同思路按卡片尺寸收敛：标题 --ink→--text-hi 加粗、
   代码 --ink-2 等宽背景块；字号比模态小一档，卡片内层级不喧宾夺主） */
.chunk-segment-md { overflow-wrap: anywhere; }
.chunk-segment-md :deep(h1),
.chunk-segment-md :deep(h2),
.chunk-segment-md :deep(h3),
.chunk-segment-md :deep(h4),
.chunk-segment-md :deep(h5),
.chunk-segment-md :deep(h6) {
  font-family: var(--font-display); color: var(--text-hi); font-weight: 600;
  margin: 10px 0 5px; line-height: 1.4;
}
.chunk-segment-md :deep(h1) { font-size: 16.5px; }
.chunk-segment-md :deep(h2) { font-size: 15.5px; }
.chunk-segment-md :deep(h3) { font-size: 14.5px; }
.chunk-segment-md :deep(h4), .chunk-segment-md :deep(h5), .chunk-segment-md :deep(h6) { font-size: 13.5px; color: var(--text-mid); }
.chunk-segment-md :deep(h1:first-child), .chunk-segment-md :deep(h2:first-child),
.chunk-segment-md :deep(h3:first-child), .chunk-segment-md :deep(p:first-child) { margin-top: 0; }
.chunk-segment-md :deep(p) { margin: 5px 0; }
.chunk-segment-md :deep(strong) { font-weight: 600; }
.chunk-segment-md :deep(a) { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
.chunk-segment-md :deep(ul), .chunk-segment-md :deep(ol) { margin: 5px 0; padding-left: 20px; }
.chunk-segment-md :deep(li) { margin: 2px 0; }
.chunk-segment-md :deep(blockquote) {
  margin: 7px 0; padding: 5px 10px;
  border-left: 2px solid var(--accent);
  background: var(--ink-2); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--text-mid);
}
.chunk-segment-md :deep(code) {
  font-family: var(--font-mono); font-size: 12px;
  background: var(--ink-2); border: 1px solid var(--line);
  padding: 1px 5px; border-radius: 4px;
}
.chunk-segment-md :deep(pre) {
  margin: 7px 0; padding: 8px 10px;
  background: var(--ink-2); border: 1px solid var(--line);
  border-radius: var(--radius-sm); overflow-x: auto;
}
.chunk-segment-md :deep(pre code) { background: none; border: none; padding: 0; font-size: 11.5px; line-height: 1.7; }
.chunk-segment-md :deep(hr) { border: none; border-top: 1px solid var(--line); margin: 10px 0; }

.chunk-field { margin-top: 12px; }
.chunk-field-label {
  font-family: var(--font-mono); font-size: 10px; letter-spacing: .14em;
  color: var(--text-low); margin-bottom: 6px;
}

.keywords-input {
  width: 100%; background: var(--card); border: none;
  border-radius: var(--radius-sm); box-shadow: inset 0 0 0 1px var(--line);
  padding: 8px 12px; font-size: 13px; color: var(--text-hi);
}
.keywords-input:focus { outline: none; box-shadow: inset 0 0 0 1px var(--accent); }

.record-keywords { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }

/* 只读态（done 记录）：控件禁用 + 弱化视觉，"不可修改"一眼可见 */
.chunk-card.chunk-readonly { opacity: .72; }
.chunk-card.chunk-readonly .chip,
.chunk-card.chunk-readonly .chunk-segment {
  opacity: .55;
  cursor: not-allowed;
}
.chunk-card.chunk-readonly .chip:hover {
  background: var(--card);
  border-color: var(--line-strong);
  color: var(--text-mid);
}
.chunk-card.chunk-readonly .chunk-index { color: var(--text-low); }
.attribute-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:14px 0 0;padding-top:12px;border-top:1px solid var(--line)}
.attribute-summary{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;overflow-wrap:anywhere}
.attribute-summary-type,.attribute-summary-mood{display:inline-flex;align-items:center;min-height:36px;padding:7px 15px;font-size:15px;font-weight:800;line-height:1.2;letter-spacing:.015em}
.attribute-summary-type{color:#073e9d;background:#dceaff;border-left:4px solid var(--cyan);clip-path:polygon(0 0,100% 0,calc(100% - 5px) 100%,0 100%)}
.attribute-summary-mood{color:var(--mood-color);background:#fff;border:1px solid color-mix(in srgb,var(--mood-color) 48%,white);box-shadow:inset 0 -3px color-mix(in srgb,var(--mood-color) 28%,white)}
.attribute-toggle{font-size:11px;color:#0756ce;padding:5px 9px;border:1px solid #afc7ee;background:#f4f8ff;flex-shrink:0;transition:background .16s,color .16s}
.attribute-toggle:hover,.attribute-toggle:focus-visible{background:var(--cyan);color:var(--night)}
.chunk-attributes{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;animation:attribute-open .24s var(--motion-enter)}
.chunk-attributes .chunk-field{min-width:0;margin-top:0}
@keyframes attribute-open{from{opacity:.3;transform:translateY(-5px)}to{opacity:1;transform:none}}
</style>
