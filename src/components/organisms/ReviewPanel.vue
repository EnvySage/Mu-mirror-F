<script setup>
import { computed, ref, watch } from 'vue'
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

// ---- 手动关联待办（用户主动挂载；数据源 GET /todos） ----

/** 手动关联行（审核态才渲染；切换记录/入库由 store 清理） */
const manualLinks = computed(() => (editable.value ? todoStore.manualLinks : []))

/** 选择面板开关 + 搜索词 + 行内提示 */
const pickerOpen = ref(false)
const pickerQuery = ref('')
const pickerHint = ref('')

/** 待办主键归一化（后端 TodoItemVO.id；兼容 todo_id/todoId） */
function todoId(t) {
  return t?.id ?? t?.todo_id ?? t?.todoId ?? null
}
function todoTitle(t) {
  return t?.title ?? t?.todo_title ?? t?.todoTitle ?? '未命名待办'
}
function todoStatus(t) {
  return t?.current_status ?? t?.currentStatus ?? t?.status ?? 'not_started'
}
function statusLabel(st) {
  return taskStatusMap[st] || '未开始'
}

/** 搜索过滤后的候选（保持后端"未完成在前"顺序） */
const pickerItems = computed(() => {
  const q = pickerQuery.value.trim().toLowerCase()
  const list = todoStore.registry || []
  if (!q) return list
  return list.filter(t => String(t.title ?? '').toLowerCase().includes(q))
})

/**
 * 已关联的 todo 主键集合 → 面板内对应项置灰（不可重复挂）。
 * 含：手动行 + 未被忽略的 AI 建议行（被忽略的建议允许手动覆盖，见 store.addManualLink）。
 */
const linkedTodoIds = computed(() => {
  const set = new Set()
  for (const m of manualLinks.value) set.add(String(m.todoId))
  for (const s of sugList.value) {
    const sid = sugId(s)
    const r = todoStore.resolutions[sid]
    if (r && r.action === 'dismissed') continue
    const tid = s.todo_id ?? s.todoId
    if (tid != null) set.add(String(tid))
  }
  return set
})
function isLinked(t) {
  const id = todoId(t)
  return id != null && linkedTodoIds.value.has(String(id))
}

/** 打开选择面板：按需拉取 GET /todos（store 内部去重，已加载不重复请求） */
async function openPicker() {
  pickerOpen.value = true
  pickerQuery.value = ''
  pickerHint.value = ''
  await todoStore.fetchRegistry()
}
function closePicker() {
  pickerOpen.value = false
  pickerQuery.value = ''
  pickerHint.value = ''
}
function pickTodo(t) {
  const res = todoStore.addManualLink(t)
  if (res === 'exists') pickerHint.value = `「${todoTitle(t)}」已在关联列表中`
  else if (res === 'already_suggested') pickerHint.value = `「${todoTitle(t)}」已由 AI 建议关联`
  else if (res === 'invalid') pickerHint.value = '该待办无法关联'
  else pickerHint.value = ''
}
function onManualStatus(m, st) {
  todoStore.setManualLinkStatus(m.todoId, st)
}
function removeManual(m) {
  todoStore.removeManualLink(m.todoId)
}

/** 切换记录关闭选择面板（关联行由 DetailPanel 侧 clearResolutions 清理） */
watch(() => props.record.id, closePicker)

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

      <!-- 关联待办：AI 建议（GET /records/{id}/suggestions）+ 手动挂载（GET /todos）。
           两类条目的状态选择都在「确认入库」时由 resolutionsPayload 组装进 todoResolutions 一起提交 -->
      <div class="review-sug">
        <div class="review-sug-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z"/></svg>
          关联待办 · 随确认入库生效
        </div>
        <div class="todo-res-list">
          <!-- AI 建议行（原有逻辑不变） -->
          <div
            v-for="s in sugList"
            :key="'sug-' + sugId(s)"
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

          <!-- 手动关联行（标注「手动」与 AI 建议区分；状态预填该 todo 当前状态 = 不改即仅关联） -->
          <div
            v-for="m in manualLinks"
            :key="'manual-' + m.todoId"
            class="todo-res manual"
          >
            <div class="todo-res-head">
              <span class="todo-res-title">
                <span class="todo-res-badge">手动</span>{{ m.title }}
              </span>
              <span class="todo-res-cur">当前 {{ statusLabel(m.currentStatus) }}</span>
            </div>
            <div class="todo-res-chips">
              <button
                v-for="st in TASK_STATUSES"
                :key="st.key"
                :class="['todo-res-chip', { selected: m.status === st.key }]"
                @click="onManualStatus(m, st.key)"
              >{{ st.label }}</button>
              <button class="todo-res-chip todo-res-remove" @click="removeManual(m)">移除</button>
            </div>
          </div>
        </div>

        <!-- 手动关联入口 / 选择面板 -->
        <button v-if="!pickerOpen" class="todo-link-add" @click="openPicker">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          手动关联待办
        </button>

        <div v-else class="todo-picker">
          <div class="todo-picker-head">
            <input
              v-model="pickerQuery"
              class="todo-picker-search"
              type="text"
              placeholder="搜索待办标题…"
            />
            <button class="todo-picker-close" @click="closePicker">关闭</button>
          </div>
          <div v-if="pickerHint" class="todo-picker-hint">{{ pickerHint }}</div>
          <div class="todo-picker-list">
            <div v-if="todoStore.registryLoading" class="todo-picker-state">加载中…</div>
            <div v-else-if="!pickerItems.length" class="todo-picker-state">
              {{ pickerQuery ? '没有匹配的待办' : '暂无已注册待办' }}
            </div>
            <template v-else>
              <button
                v-for="t in pickerItems"
                :key="todoId(t)"
                :class="['todo-picker-item', { linked: isLinked(t) }]"
                :disabled="isLinked(t)"
                @click="pickTodo(t)"
              >
                <span class="todo-picker-item-title">{{ todoTitle(t) }}</span>
                <span class="todo-picker-item-status">{{ statusLabel(todoStatus(t)) }}</span>
                <span v-if="isLinked(t)" class="todo-picker-item-tag">已关联</span>
              </button>
            </template>
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

/* 手动关联行：左侧强调 + 「手动」徽标，与 AI 建议行区分来源 */
.todo-res.manual { border-color: rgba(44,95,232,.32); background: var(--card); }
.todo-res-badge {
  display: inline-block; margin-right: 6px; padding: 1px 6px; vertical-align: 1px;
  border-radius: var(--radius-full); background: var(--accent-soft); color: var(--accent);
  font-size: 10px; font-weight: 600; letter-spacing: .04em;
}
.todo-res-remove { margin-left: auto; color: var(--text-low); }
.todo-res-remove:hover { color: var(--danger); background: var(--danger-bg); }

/* 「＋ 手动关联待办」入口（虚线，与新增片段按钮同族但更轻） */
.todo-link-add {
  width: 100%; margin-top: 8px; padding: 9px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  border-radius: var(--radius-sm);
  border: 1.5px dashed var(--line-strong);
  color: var(--text-low); font-size: 12.5px;
  transition: all .18s;
}
.todo-link-add:hover { color: var(--accent); border-color: var(--accent); }
.todo-link-add svg { width: 13px; height: 13px; stroke: currentColor; fill: none; }

/* 待办选择面板：搜索 + 列表（loading / 空态 / 已关联置灰） */
.todo-picker {
  margin-top: 8px; padding: 10px;
  border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--ink-2);
}
.todo-picker-head { display: flex; align-items: center; gap: 8px; }
.todo-picker-search {
  flex: 1; min-width: 0; padding: 7px 10px;
  border-radius: var(--radius-sm); border: 1px solid var(--line-strong);
  background: var(--card); color: var(--text-hi); font-size: 13px;
}
.todo-picker-search:focus { outline: none; border-color: var(--accent); }
.todo-picker-close { flex-shrink: 0; padding: 6px 4px; font-size: 12.5px; color: var(--text-low); }
.todo-picker-close:hover { color: var(--text-hi); }
.todo-picker-hint { margin-top: 8px; font-size: 12px; color: var(--warn); }
.todo-picker-list {
  margin-top: 8px; max-height: 240px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
}
.todo-picker-state { padding: 14px; text-align: center; font-size: 12.5px; color: var(--text-low); }
.todo-picker-item {
  display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
  padding: 8px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--line); background: var(--card);
  transition: border-color .15s;
}
.todo-picker-item:hover:not(:disabled) { border-color: var(--accent); }
.todo-picker-item.linked { opacity: .55; cursor: not-allowed; }
.todo-picker-item-title { flex: 1; min-width: 0; font-size: 12.5px; color: var(--text-hi); word-break: break-word; }
.todo-picker-item-status { flex-shrink: 0; font-family: var(--font-mono); font-size: 10.5px; color: var(--text-low); }
.todo-picker-item-tag {
  flex-shrink: 0; padding: 1px 7px; border-radius: var(--radius-full);
  background: var(--accent-soft); color: var(--accent); font-size: 10px;
}

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
