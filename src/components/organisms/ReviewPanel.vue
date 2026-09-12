<script setup>
import { computed } from 'vue'
import { useRecordsStore } from '@/stores/records'
import { useTodoStore } from '@/stores/todo'
import ChunkCard from '@/components/organisms/ChunkCard.vue'
import { TASK_STATUSES, taskStatusMap } from '@/constants/tags'

/**
 * 审核面板（v2 原型版）
 * 上：review-original「光源」面板（只读原文）
 * 中：chunk-card「镜面反射」卡片列表 + add-chunk-btn 虚线按钮
 * 下：关联待办区块（todoStore.recordSuggestions）+ review-hint 引导
 * chips 编辑即保存（PUT /chunks/{id}），编排逻辑在 ChunkCard/store 内。
 */
const props = defineProps({
  record: { type: Object, required: true },
})

const emit = defineEmits(['open-record'])

const recordsStore = useRecordsStore()
const todoStore = useTodoStore()

const editable = computed(() => props.record.status === 'reviewing')
/** done 记录只读：控件禁用而非点击报错 */
const readonly = computed(() => props.record.status === 'done')
const chunks = computed(() => props.record.chunks || [])

/**
 * 审核态「关联待办」区块（本轮交互重构：状态变更唯一入口）
 *
 * 数据源：todoStore.recordSuggestions（GET /records/{id}/suggestions，由宿主 DetailPanel
 * 在进入审核态时拉取）。每项：todo 标题 + 当前状态 + 状态选择器（未开始/进行中/完成）+ 忽略。
 *
 * 用户选择暂存在 todoStore.resolutions（拉取时按机器建议态预填），点「确认入库」时
 * 由 DetailPanel 组装进 confirm body 的 todoResolutions 一起提交：
 * 已忽略 → action=dismissed；选了状态 → action=confirmed+status。
 */
const sugList = computed(() => (editable.value ? todoStore.recordSuggestions : []))

const sugId = s => s.suggestion_id ?? s.suggestionId

/** 该项的当前裁决（默认已在拉取时预填；未操作则 null） */
function resolutionOf(s) {
  return todoStore.resolutions[sugId(s)] || null
}
function isIgnored(s) {
  return resolutionOf(s)?.action === 'dismissed'
}
function selectedStatus(s) {
  return resolutionOf(s)?.status || s.suggested_status || s.suggestedStatus || ''
}
function selectStatus(s, st) {
  todoStore.setSuggestionResolution(sugId(s), 'confirmed', st)
}
function ignoreSug(s) {
  todoStore.setSuggestionResolution(sugId(s), 'dismissed')
}
function undoIgnore(s) {
  todoStore.setSuggestionResolution(sugId(s), 'confirmed', s.suggested_status ?? s.suggestedStatus)
}

/** 新增片段：本地空占位，用户输入文本失焦时 POST /records/{id}/chunks */
function onAddChunk() {
  const placeholder = {
    id: `local_${Date.now()}`,
    recordId: props.record.id,
    segment: '',
    metadata: {},
  }
  if (!props.record.chunks) props.record.chunks = []
  props.record.chunks.push(placeholder)
}
</script>

<template>
  <div class="review-panel">
    <!-- 原文面板 —— "光源" -->
    <div class="review-original">
      <div class="review-label">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        原始内容 · 不可修改
      </div>
      <div class="review-original-text">{{ record.content }}</div>
    </div>

    <!-- 片段卡片列表 -->
    <div class="review-list-label">
      <span>{{ readonly ? '片段卡片 · CHUNKS（已入库，只读）' : '片段卡片 · CHUNKS' }}</span>
      <span>{{ chunks.length }}</span>
    </div>

    <ChunkCard
      v-for="(chunk, i) in chunks"
      :key="chunk.id"
      :chunk="chunk"
      :index="i"
      :editable="editable"
      :readonly="readonly"
    />

    <div v-if="chunks.length === 0" class="chunks-empty">
      已无片段。新增至少 1 个片段后才能确认入库。
    </div>

    <template v-if="editable">
      <button class="add-chunk-btn" @click="onAddChunk">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        新增片段（AI 自动单段分类）
      </button>

      <!-- 关联待办（GET /records/{id}/suggestions）：状态选择随「确认入库」一起提交 -->
      <div v-if="sugList.length" class="review-sug">
        <div class="review-sug-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z"/></svg>
          关联待办 · 随确认入库生效
        </div>
        <div class="todo-res-list">
          <div
            v-for="s in sugList"
            :key="sugId(s)"
            :class="['todo-res', { ignored: isIgnored(s) }]"
          >
            <div class="todo-res-head">
              <span class="todo-res-title">{{ s.todo_title ?? s.todoTitle }}</span>
              <span class="todo-res-cur">当前 {{ taskStatusMap[s.todo_status ?? s.todoStatus] || '未开始' }}</span>
            </div>
            <div class="todo-res-chips">
              <button
                v-for="st in TASK_STATUSES"
                :key="st.key"
                :class="['todo-res-chip', { selected: !isIgnored(s) && selectedStatus(s) === st.key, suggested: (s.suggested_status ?? s.suggestedStatus) === st.key }]"
                :disabled="isIgnored(s)"
                @click="selectStatus(s, st.key)"
              >{{ st.label }}</button>
              <button v-if="!isIgnored(s)" class="todo-res-chip todo-res-ignore" @click="ignoreSug(s)">忽略</button>
              <button v-else class="todo-res-chip todo-res-undo" @click="undoIgnore(s)">撤销忽略</button>
            </div>
          </div>
        </div>
      </div>

      <div class="review-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5"/></svg>
        合并：把 A 的文本改成合并内容，再删掉 B。拆分：把 A 改成前半句，再点「新增片段」补后半。改动文本的片段会在确认时自动重新分类。
      </div>
    </template>
  </div>
</template>

<style scoped>
.review-panel { animation: fadeIn .3s ease; }

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

.review-list-label {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .16em;
  color: var(--text-low); margin: 4px 2px 10px;
  display: flex; justify-content: space-between; align-items: center;
}

.chunks-empty {
  padding: 24px; text-align: center; font-size: 13px; color: var(--text-low);
  border: 1.5px dashed var(--line-strong); border-radius: var(--radius);
}

.add-chunk-btn {
  width: 100%; padding: 13px; margin-top: 4px;
  border-radius: var(--radius);
  border: 1.5px dashed var(--line-strong);
  color: var(--text-low); font-size: 13.5px;
  display: flex; align-items: center; justify-content: center; gap: 7px;
  transition: all .18s;
}
.add-chunk-btn:hover { color: var(--accent); border-color: var(--accent); }
.add-chunk-btn svg { width: 15px; height: 15px; stroke: currentColor; fill: none; }

/* 待办状态建议卡区（审核窗口） */
.review-sug { margin-top: 14px; }
.review-sug-label {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .16em;
  color: var(--accent); margin: 0 2px 8px;
  display: flex; align-items: center; gap: 6px;
}
.review-sug-label svg { width: 12px; height: 12px; stroke: var(--accent); fill: none; }

/* 关联待办：每项 = 标题 + 当前状态 + 状态选择器 + 忽略 */
.todo-res-list { display: flex; flex-direction: column; gap: 8px; }
.todo-res {
  border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--ink-2); padding: 10px 11px;
  transition: opacity .2s ease;
}
.todo-res.ignored { opacity: .55; }
.todo-res-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.todo-res-title { font-size: 12.5px; font-weight: 500; color: var(--text-hi); word-break: break-word; }
.todo-res-cur { flex-shrink: 0; font-family: var(--font-mono); font-size: 10.5px; color: var(--text-low); }
.todo-res-chips { display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap; }
.todo-res-chip {
  font-size: 11px; padding: 3px 10px; border-radius: var(--radius-full);
  color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong);
  transition: all .12s;
}
.todo-res-chip:hover:not(:disabled) { color: var(--text-hi); background: var(--card); }
.todo-res-chip.suggested { box-shadow: inset 0 0 0 1px var(--accent); color: var(--accent); }
.todo-res-chip.selected { background: var(--accent); color: #FFFFFF; box-shadow: none; font-weight: 600; }
.todo-res-chip:disabled { opacity: .55; cursor: not-allowed; }
.todo-res-ignore { margin-left: auto; }
.todo-res-undo { margin-left: auto; color: var(--text-low); }

.review-hint {
  display: flex; gap: 8px; align-items: flex-start;
  font-size: 12px; color: var(--text-low); line-height: 1.6;
  padding: 12px 14px; margin-top: 10px;
  border-radius: var(--radius-sm);
  background: var(--warn-bg);
  box-shadow: inset 0 0 0 1px rgba(201,138,27,.2);
}
.review-hint svg { width: 14px; height: 14px; stroke: var(--warn); fill: none; flex-shrink: 0; margin-top: 2px; }
</style>
