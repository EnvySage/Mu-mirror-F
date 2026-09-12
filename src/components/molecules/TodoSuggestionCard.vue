<script setup>
/**
 * 待办状态建议卡（todo-registry-design.md §3.3 裁决期 / §4 F 行）
 *
 * 两处宿主共用，共享同一份 todoStore.pendingSuggestions——任一处裁决后另一处同步消失：
 *  - 侧栏「待办速览」（auto 模式：无审核窗口，这里是唯一裁决动线）——
 *    点确认/忽略立即提交
 *  - 审核窗口片段列表下方（manual 模式）——**可调整，但只暂存不提交**：
 *    选三态 / 点拒绝都写进 todoStore.staged，等用户点「确认入库」时由
 *    commitStaged() 一次性提交。审核中的记录尚未入库，此时改状态没有记录支撑；
 *    用户不入库直接关掉，暂存自然作废。
 *
 * 用户主权：机器建议态只作 chip 预选，用户可改选（§3.3）。
 * 忽略/拒绝 = dismissed，永久静默同一证据（§1-5）——LLM 误判时（这条根本不是
 * 该待办的追踪）用户用它否掉。
 *
 * 文案口径（B4）：建议卡只描述"以前记下的事今天有进展"这一种情况，
 * 审核中的这条记录自己尚未登记为待办（要等确认入库），所以不能说"本条待办进度更新"。
 *
 * 字段口径（snake_case，见 stores/todo.js typedef）：
 * id / todo_id / title / current_status / suggested_status /
 * evidence_excerpt / evidence_record_id / created_at
 */
import { ref, computed } from 'vue'
import { useTodoStore } from '@/stores/todo'
import { useToastStore } from '@/stores/toast'
import { TASK_STATUSES, taskStatusMap } from '@/constants/tags'

const props = defineProps({
  suggestion: { type: Object, required: true },
  /** 宿主场景：review=审核窗口（"之前记下的"口径）；sidebar=侧栏（"检测到…可能…"口径） */
  context: { type: String, default: 'sidebar' },
})

const emit = defineEmits(['open-record'])

const todoStore = useTodoStore()
const toast = useToastStore()

/** 每张卡本地选中的状态（未改选时 = 机器建议态，用户可改） */
const pickedStatus = ref(null)
const picked = computed(() => pickedStatus.value || props.suggestion.suggested_status)
function pick(status) {
  pickedStatus.value = status
  // 审核窗口：选三态即暂存"入库后更新为该状态"（不发请求）
  if (stagedMode.value) {
    todoStore.stageResolution(props.suggestion.id, 'confirmed', status)
  }
}

/** 提交中（store 写锁，防双击） */
const busy = computed(() => todoStore.resolvingId === props.suggestion.id)

/** 审核窗口：可调整但只暂存，不在这里提交（见文件头说明） */
const stagedMode = computed(() => props.context === 'review')

/** 本卡暂存的裁决（审核窗口用；null = 未操作） */
const stagedItem = computed(() => todoStore.staged?.[props.suggestion.id] || null)
/** 已暂存为删除（LLM 误判：这条不是该待办的追踪）——删的是建议，todo 追踪本身不动 */
const willRemove = computed(() => stagedItem.value?.action === 'dismissed')

const headline = computed(() => {
  const s = props.suggestion
  return props.context === 'review'
    ? `这段日记看起来在推进你之前记下的「${s.title}」`
    : `检测到「${s.title}」可能${taskStatusMap[s.suggested_status] || s.suggested_status}`
})

/** 当前状态行（审核窗口专用：让用户看清机器要把它改成什么） */
const currentLabel = computed(() => taskStatusMap[props.suggestion.current_status] || '未开始')

/** 证据摘录截 40 字 */
function excerptShort(text) {
  const t = String(text || '')
  return t.length > 40 ? t.slice(0, 40) + '…' : t
}

/** 日期（x月x日） */
function shortDate(s) {
  const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${Number(m[2])}月${Number(m[3])}日` : ''
}

/** [确认更新]：带用户选定的状态提交（事务三写在 B 端点内，前端只发请求） */
async function onConfirm() {
  const s = props.suggestion
  const status = picked.value
  const ok = await todoStore.resolve(s, 'confirmed', status)
  if (ok) {
    // stats.open_items 镜像同步（侧栏待办行即时变状态）
    todoStore.syncStatsOpenItem(s.title, status)
    toast.success(`「${s.title}」已更新为${taskStatusMap[status] || status}`)
  } else {
    toast.error(todoStore.error || '确认失败，请重试')
  }
}

/**
 * 删掉这条建议（LLM 误判时用：这条并不是该待办的追踪）
 * 删的是建议本身，todo_registry 的追踪不受影响。
 * 侧栏立即提交；审核窗口只暂存，随确认入库一起提交。
 */
async function onRemove() {
  const s = props.suggestion
  if (stagedMode.value) {
    todoStore.stageResolution(s.id, 'dismissed')
    return
  }
  const ok = await todoStore.resolve(s, 'dismissed')
  if (ok) toast.info(`已删除「${s.title}」的这条建议`)
  else toast.error(todoStore.error || '操作失败，请重试')
}

/** 审核窗口：撤销暂存，回到未操作（仍按机器建议态等待入库） */
function onUndoStaged() {
  todoStore.unstageResolution(props.suggestion.id)
  pickedStatus.value = null
}

/** 证据行 → 打开证据所在记录详情 */
function openEvidence() {
  const rid = props.suggestion.evidence_record_id
  if (rid) emit('open-record', rid)
}
</script>

<template>
  <div :class="['sug-card', { 'sug-busy': busy, 'sug-removing': willRemove }]">
    <div class="sug-head">
      <svg class="sug-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z" />
      </svg>
      <span class="sug-title-line">{{ headline }}</span>
    </div>

    <div v-if="context === 'review'" class="sug-current">
      当前：{{ currentLabel }}
    </div>

    <!-- 证据行：excerpt 截 40 字 + 日期，点击跳证据记录详情 -->
    <button
      v-if="suggestion.evidence_excerpt"
      class="sug-evidence"
      :title="suggestion.evidence_excerpt"
      @click="openEvidence"
    >
      <span class="sug-evidence-text">"{{ excerptShort(suggestion.evidence_excerpt) }}"</span>
      <span class="sug-evidence-date">{{ shortDate(suggestion.created_at) }}</span>
    </button>

    <!-- 三态 chip（机器建议态预选；审核窗口里选了即暂存，不立即提交） -->
    <div class="sug-chips">
      <button
        v-for="st in TASK_STATUSES"
        :key="st.key"
        :class="['sug-chip', { selected: !willRemove && picked === st.key, suggested: suggestion.suggested_status === st.key }]"
        :disabled="busy || willRemove"
        @click="pick(st.key)"
      >{{ st.label }}</button>
    </div>

    <div class="sug-actions">
      <!-- 侧栏：立即提交 -->
      <template v-if="!stagedMode">
        <button class="sug-btn sug-btn-primary" :disabled="busy" @click="onConfirm">
          {{ busy ? '提交中…' : '确认' }}
        </button>
        <button class="sug-btn sug-btn-ghost" :disabled="busy" @click="onRemove">删除</button>
      </template>
      <!-- 审核窗口：暂存，随确认入库一起提交 -->
      <template v-else>
        <button
          v-if="!willRemove"
          class="sug-btn sug-btn-ghost"
          :disabled="busy"
          @click="onRemove"
        >删除</button>
        <button v-else class="sug-btn sug-btn-ghost" :disabled="busy" @click="onUndoStaged">撤销</button>
      </template>
    </div>

    <!-- 审核窗口提示：所选改动要等确认入库才真正生效 -->
    <div v-if="stagedMode" class="sug-staged-note">
      <template v-if="willRemove">删除这条建议 · 待办追踪保留</template>
      <template v-else-if="stagedItem">确认入库后更新为「{{ taskStatusMap[picked] || picked }}」</template>
      <template v-else>可调整进度 · 确认入库后生效</template>
    </div>
  </div>
</template>

<style scoped>
.sug-card {
  border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--ink-2); padding: 10px 11px;
  transition: opacity .2s ease;
}
.sug-busy { opacity: .6; pointer-events: none; }
.sug-head { display: flex; align-items: flex-start; gap: 6px; }
.sug-spark { width: 12px; height: 12px; flex-shrink: 0; margin-top: 3px; stroke: var(--accent); fill: none; }
.sug-title-line { font-size: 12.5px; line-height: 1.55; color: var(--text-hi); font-weight: 500; word-break: break-word; }
.sug-current { margin: 5px 0 0 18px; font-family: var(--font-mono); font-size: 10.5px; color: var(--text-low); }
/* 已暂存为删除（暂存 dismissed）：整卡淡出，与"待裁决"区分 */
.sug-removing { opacity: .55; }
.sug-staged-note {
  margin-top: 7px; font-size: 11px; color: var(--text-low);
  font-family: var(--font-mono); letter-spacing: .02em;
}

.sug-evidence {
  display: block; width: 100%; text-align: left; margin-top: 7px;
  padding: 6px 8px; border-radius: var(--radius-sm);
  background: var(--card); box-shadow: inset 0 0 0 1px var(--line);
  transition: box-shadow .15s;
}
.sug-evidence:hover { box-shadow: inset 0 0 0 1px var(--accent); }
.sug-evidence-text { display: block; font-size: 11.5px; line-height: 1.6; color: var(--text-mid); }
.sug-evidence-date { display: block; margin-top: 3px; font-family: var(--font-mono); font-size: 10px; color: var(--text-low); }

.sug-chips { display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap; }
.sug-chip {
  font-size: 11px; padding: 3px 10px; border-radius: var(--radius-full);
  color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong);
  transition: all .12s;
}
.sug-chip:hover:not(:disabled) { color: var(--text-hi); background: var(--card); }
/* 机器建议态：未改选时描边提示；选中 = 实心蓝 */
.sug-chip.suggested { box-shadow: inset 0 0 0 1px var(--accent); color: var(--accent); }
.sug-chip.selected { background: var(--accent); color: #FFFFFF; box-shadow: none; font-weight: 600; }
.sug-chip:disabled { opacity: .55; cursor: not-allowed; }

.sug-actions { display: flex; gap: 7px; margin-top: 9px; }
.sug-btn {
  font-size: 12px; padding: 4px 14px; border-radius: var(--radius-full);
  transition: background .15s, opacity .15s;
}
.sug-btn:disabled { opacity: .5; cursor: not-allowed; }
.sug-btn-primary { background: var(--accent); color: #FFFFFF; font-weight: 600; }
.sug-btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.sug-btn-ghost { color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong); }
.sug-btn-ghost:hover:not(:disabled) { background: var(--card); color: var(--text-hi); }
</style>
