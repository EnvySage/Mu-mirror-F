<script setup>
import { reactive, computed, watch } from 'vue'
import { CONTENT_TYPES, ALL_MOODS, TASK_STATUSES, typeMap, moodMap, taskStatusMap } from '@/constants/tags'
import MButton from '@/components/atoms/MButton.vue'

/**
 * 片段卡片（8.3 审核交互模型的原子单元）
 *
 * 每张卡片：segment 文本编辑 + metadata 编辑
 * （title / summary / contentType 下拉 / mood 多选 / keywords / taskStatus）。
 * 本组件只负责编辑态维护与事件上报，不发请求——
 * 端点序列（PUT/DELETE/POST 按序 await）由父级 ReviewPanel 编排。
 */
const props = defineProps({
  chunk: { type: Object, required: true },
  index: { type: Number, default: 0 },
  total: { type: Number, default: 1 },
  submitting: { type: Boolean, default: false },
  /** 本卡片是否有未保存修改 */
  dirty: { type: Boolean, default: false },
})

const emit = defineEmits(['save', 'remove', 'mergeUp', 'splitRequest'])

const isPlaceholder = computed(() => String(props.chunk.id).startsWith('local_'))

/** 仅 todo/plan 显示任务状态（8.4） */
const showTaskStatus = computed(() => ['todo', 'plan'].includes(edit.contentType))

const edit = reactive({
  segment: '',
  title: '',
  summary: '',
  contentType: 'note',
  mood: [],
  keywords: '',
  taskStatus: '',
})

/** 用后端 chunk 数据重置编辑态 */
function resetFrom(chunk) {
  edit.segment = chunk.segment || ''
  edit.title = chunk.metadata?.title || ''
  edit.summary = chunk.metadata?.summary || ''
  edit.contentType = chunk.metadata?.contentType || 'note'
  edit.mood = [...(chunk.metadata?.mood || [])]
  edit.keywords = (chunk.metadata?.keywords || []).join(', ')
  edit.taskStatus = chunk.metadata?.taskStatus || ''
}

watch(() => props.chunk, resetFrom, { immediate: true, deep: false })

function toggleMood(mood) {
  const idx = edit.mood.indexOf(mood)
  if (idx >= 0) edit.mood.splice(idx, 1)
  else edit.mood.push(mood)
}

/** 组装扁平结构 payload（后端 ChunkDTO 契约：非嵌套 metadata） */
function buildPayload() {
  return {
    segment: edit.segment,
    title: edit.title,
    summary: edit.summary,
    contentType: edit.contentType,
    mood: edit.mood,
    keywords: edit.keywords.split(/[,，]/).map(k => k.trim()).filter(Boolean),
    ...(showTaskStatus.value && edit.taskStatus ? { taskStatus: edit.taskStatus } : {}),
  }
}

const canSave = computed(() => edit.segment.trim().length > 0)
</script>

<template>
  <div :class="['chunk-card', { dirty }]">
    <div class="chunk-card-header">
      <span class="chunk-index">{{ index + 1 }}</span>
      <span class="chunk-card-title">{{ edit.title || '未生成标题' }}</span>
      <span v-if="isPlaceholder" class="chunk-placeholder-tag">新片段</span>
      <div class="chunk-card-actions">
        <!-- 拆分：先由父级弹出拆分模式 -->
        <button
          class="chunk-btn"
          :disabled="submitting || !edit.segment.trim()"
          title="拆分为两个片段"
          @click="emit('splitRequest', { chunk, payload: buildPayload(), segment: edit.segment })"
        >拆分</button>
        <!-- 合并：本卡并入上一卡 -->
        <button
          v-if="index > 0"
          class="chunk-btn"
          :disabled="submitting"
          title="合并到上一片段"
          @click="emit('mergeUp', { chunk, payload: buildPayload() })"
        >并入上段</button>
        <button
          class="chunk-btn danger"
          :disabled="submitting"
          @click="emit('remove', { chunk })"
        >删除</button>
      </div>
    </div>

    <div class="review-field">
      <div class="section-label">片段文本</div>
      <textarea v-model="edit.segment" class="review-textarea" rows="3" :disabled="submitting" />
    </div>

    <div class="review-field">
      <div class="section-label">标题</div>
      <input v-model="edit.title" class="review-input" :disabled="submitting" placeholder="AI 生成，可修改" />
    </div>

    <div class="review-field">
      <div class="section-label">摘要</div>
      <textarea v-model="edit.summary" class="review-textarea" rows="2" :disabled="submitting" placeholder="AI 生成，可修改" />
    </div>

    <div class="review-field">
      <div class="section-label">内容类型</div>
      <select v-model="edit.contentType" class="review-select" :disabled="submitting">
        <option v-for="t in CONTENT_TYPES" :key="t.key" :value="t.key">{{ t.label }}</option>
      </select>
    </div>

    <div v-if="showTaskStatus" class="review-field">
      <div class="section-label">任务状态</div>
      <div class="review-field-tags">
        <span
          v-for="t in TASK_STATUSES"
          :key="t.key"
          :class="['review-tag', { selected: edit.taskStatus === t.key }]"
          @click="edit.taskStatus = t.key"
        >{{ t.label }}</span>
      </div>
    </div>

    <div class="review-field">
      <div class="section-label">情绪状态（多选）</div>
      <div class="review-field-tags">
        <span
          v-for="m in ALL_MOODS"
          :key="m.key"
          :class="['review-tag', { selected: edit.mood.includes(m.key) }]"
          @click="toggleMood(m.key)"
        >{{ m.label }}</span>
      </div>
    </div>

    <div class="review-field">
      <div class="section-label">关键词</div>
      <input v-model="edit.keywords" class="review-input" :disabled="submitting" placeholder="用逗号分隔关键词" />
    </div>

    <div class="chunk-card-footer">
      <MButton
        variant="primary"
        size="sm"
        :disabled="!canSave"
        :loading="submitting"
        @click="emit('save', { chunk, payload: buildPayload() })"
      >保存修改</MButton>
    </div>
  </div>
</template>

<style scoped>
.chunk-card {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 14px;
  border: 0.5px solid var(--border);
  box-shadow: var(--shadow-sm);
}
.chunk-card.dirty { border-color: var(--warning); }

.chunk-card-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
}
.chunk-index {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: #fff; font-size: 12px; font-weight: 700;
  border-radius: 50%; flex-shrink: 0;
}
.chunk-card-title {
  font-size: 15px; font-weight: 600; flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.chunk-placeholder-tag {
  font-size: 11px; color: var(--warning); background: var(--warning-light);
  padding: 2px 8px; border-radius: var(--radius-full); flex-shrink: 0;
}
.chunk-card-actions { display: flex; gap: 6px; flex-shrink: 0; }
.chunk-btn {
  padding: 5px 10px; border-radius: var(--radius-sm); font-size: 12px;
  border: 1px solid var(--border); background: var(--bg); color: var(--text-secondary);
  cursor: pointer; transition: all 0.15s; font-family: var(--font);
}
.chunk-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.chunk-btn.danger:hover:not(:disabled) { border-color: var(--danger); color: var(--danger); }
.chunk-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.chunk-card-footer { margin-top: 4px; display: flex; justify-content: flex-end; }
.chunk-card-footer :deep(.m-btn) { width: auto; }

.review-field { margin-bottom: 16px; }
.review-field:last-child { margin-bottom: 0; }
.review-field-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.review-tag {
  padding: 6px 14px; border-radius: var(--radius-full); font-size: 13px; font-weight: 500;
  border: 1.5px solid var(--border); background: var(--surface); color: var(--text-secondary);
  cursor: pointer; transition: all 0.15s ease; font-family: var(--font);
}
.review-tag:hover { border-color: var(--text-tertiary); }
.review-tag.selected { border-color: var(--accent); background: var(--accent-light); color: var(--accent); }

.review-input, .review-select {
  width: 100%; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
  font-size: 14px; font-family: var(--font); color: var(--text-primary); outline: none;
  transition: border-color 0.2s; background: var(--surface);
}
.review-input:focus, .review-select:focus { border-color: var(--accent); }
.review-input:disabled, .review-select:disabled { opacity: 0.6; }
.review-textarea {
  width: 100%; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
  font-size: 14px; font-family: var(--font); color: var(--text-primary); outline: none;
  transition: border-color 0.2s; resize: vertical; min-height: 60px; line-height: 1.6;
  background: var(--surface);
}
.review-textarea:focus { border-color: var(--accent); }
.review-textarea:disabled { opacity: 0.6; }

.section-label {
  font-size: 11px; font-weight: 600; color: var(--text-tertiary);
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;
}
</style>
