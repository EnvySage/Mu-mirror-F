<script setup>
import { reactive, computed, watch, ref, nextTick } from 'vue'
import { CONTENT_TYPES, ALL_MOODS, TASK_STATUSES, typeMap, taskStatusMap } from '@/constants/tags'
import { MOOD_COLOR } from '@/constants/moodColor'
import { useRecordsStore } from '@/stores/records'
import { useToastStore } from '@/stores/toast'
/**
 * 片段卡片（v2 原型版 —— "镜面反射"）
 * 左缘 3px accent-grad 光条；segment 可编辑；chips 编辑即保存（PUT /chunks/{id}）。
 * 新增的空片段保存时走 POST /records/{id}/chunks。
 */
const props = defineProps({
  chunk: { type: Object, required: true },
  index: { type: Number, default: 0 },
  editable: { type: Boolean, default: false },
  /** 只读态（done 记录）：所有编辑控件禁用/隐藏，一眼可见"不可修改" */
  readonly: { type: Boolean, default: false },
})

const recordsStore = useRecordsStore()
const toast = useToastStore()

/** 编辑可用 = 审核中 且 非只读（done） */
const canEdit = computed(() => props.editable && !props.readonly)

/** 仅本地占位片段（ReviewPanel 新增）走 POST /records/{id}/chunks */
const isNew = computed(() => String(props.chunk.id).startsWith('local_'))
const showTaskStatus = computed(() => ['todo', 'plan'].includes(edit.contentType))
const textEdited = ref(false)
const saving = ref(false)
const textareaEl = ref(null)

const edit = reactive({
  segment: '',
  contentType: '',
  mood: [],
  taskStatus: '',
  keywords: '',
})

function resetFrom(chunk) {
  edit.segment = chunk.segment || ''
  edit.contentType = chunk.metadata?.contentType || ''
  edit.mood = [...(chunk.metadata?.mood || [])]
  edit.taskStatus = chunk.metadata?.taskStatus || ''
  edit.keywords = (chunk.metadata?.keywords || []).join('，')
}

watch(() => props.chunk, resetFrom, { immediate: true })

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
  textEdited.value = true
  autoGrow(e.target)
}

async function onSegmentBlur() {
  if (!edit.segment.trim()) return
  if (!textEdited.value) return
  await save({ segment: edit.segment })
  textEdited.value = false
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
  save({ contentType: t, ...(showTaskStatus.value && edit.taskStatus ? { taskStatus: edit.taskStatus } : { taskStatus: null }) })
}

function selectTask(t) {
  if (!canEdit.value) return
  edit.taskStatus = edit.taskStatus === t ? '' : t
  save({ taskStatus: edit.taskStatus || null })
}

async function onKeywordsBlur() {
  const keywords = edit.keywords.split(/[，,]/).map(s => s.trim()).filter(Boolean)
  await save({ keywords })
}

/** 组装扁平 payload（ChunkDTO 契约） */
async function save(fields) {
  if (saving.value) return
  saving.value = true
  const payload = {
    segment: edit.segment,
    contentType: edit.contentType || undefined,
    mood: edit.mood,
    taskStatus: (showTaskStatus.value && edit.taskStatus) || undefined,
    keywords: edit.keywords.split(/[，,]/).map(s => s.trim()).filter(Boolean),
    ...fields,
  }
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
    if (ok) toast.success('片段已保存')
  }
  if (!ok) toast.error(recordsStore.error || '保存失败，请重试')
  saving.value = false
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
      <span class="chunk-index">#{{ String(index + 1).padStart(2, '0') }}{{ textEdited ? ' · 已改文本' : '' }}{{ readonly ? ' · 只读' : '' }}</span>
      <div class="chunk-actions">
        <button v-if="canEdit" class="chunk-icon-btn danger" title="删除片段" @click="removeChunk">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>
    </div>

    <!-- segment -->
    <textarea
      v-if="canEdit"
      ref="textareaEl"
      v-model="edit.segment"
      class="chunk-segment"
      rows="1"
      :disabled="saving"
      @input="onSegmentInput"
      @blur="onSegmentBlur"
    />
    <div v-else class="chunk-segment" style="padding:0">{{ chunk.segment }}</div>

    <!-- 标题/摘要（AI 生成展示） -->
    <div class="chunk-field">
      <div class="chunk-field-label">标题 / 摘要</div>
      <div style="font-size:13.5px;font-weight:600">{{ chunk.metadata?.title || '（待分类）' }}</div>
      <div style="font-size:12.5px;color:var(--text-mid)">{{ chunk.metadata?.summary || '确认时 AI 将自动补分类' }}</div>
    </div>

    <!-- 内容类型 chips（8 选 1） -->
    <div class="chunk-field">
      <div class="chunk-field-label">内容类型 TYPE · 8 选 1</div>
      <div class="chip-row">
        <button
          v-for="t in CONTENT_TYPES"
          :key="t.key"
          :class="['chip', { selected: edit.contentType === t.key }]"
          :disabled="!canEdit"
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
          :disabled="!canEdit"
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
          :disabled="!canEdit"
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
        @blur="onKeywordsBlur"
      >
      <div v-else class="record-keywords" style="margin-top:0">
        <span v-for="k in (chunk.metadata?.keywords || [])" :key="k" class="keyword">{{ k }}</span>
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

.chunk-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.chunk-index { font-family: var(--font-mono); font-size: 10.5px; color: var(--accent); letter-spacing: .1em; }
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
</style>
