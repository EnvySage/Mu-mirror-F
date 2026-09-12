<script setup>
/**
 * 待办两层证据链卡（R17；RecordsSidebar 待办速览 与 MirrorView「未完成的事」共用）
 *
 * 数据源：todoStore.chains（GET /todos/open-chain）。契约（后端 camelCase 经 request.js
 * 转 snake_case，组件保留 camelCase 兜底防御）：
 *   { todo_id, title, current_status, created_at,
 *     origin: { chunk_id, record_id, excerpt, date } | null,
 *     evidence: [{ chunk_id, record_id, excerpt, date, confirmed_at }],
 *     pending_suggestion_count }
 *
 * 两层结构：
 *  L1 外层行：状态圈（只读指示）+ title + origin.excerpt 单行截断 + 证据芯片 + pending 蓝点；
 *     整行点击 → 跳转"创建它的记录"（origin.record_id），无 origin 时退化为展开/收起。
 *  L2 卡片内展开（非模态）垂直时间线：origin（实线圆点，"起于"）→ evidence 按 date ASC
 *     → pending 计数提示（只读）。每个节点右箭头 emit('open-record', record_id)，由宿主打开记录。
 *
 * 本轮交互重构（用户定稿）：
 *  - 移除状态圈三态直调浮层：状态变更唯一入口 = 记录审核页（随「确认入库」生效）
 *  - 移除链尾 pending 节点的三态 chip / 确认 / 忽略直调（裁决走对应记录的审核页）
 *  - 删除为特例（管理层操作）：宿主传 deletable 时 L1 显示删除按钮 → 影响清单弹框确认
 *    → DELETE /todos/{id} → 从清单消失
 */
import { ref, computed } from 'vue'
import { useTodoStore } from '@/stores/todo'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { taskStatusMap } from '@/constants/tags'

const props = defineProps({
  chain: { type: Object, required: true },
  /** 是否显示删除按钮（管理层操作；仅侧栏宿主传 true，镜子页不显示） */
  deletable: { type: Boolean, default: false },
})

const emit = defineEmits(['open-record'])

const todoStore = useTodoStore()
const settingsStore = useSettingsStore()
const toast = useToastStore()

// ---- 字段口径兼容（snake 为主，camel 兜底；同 RecordsSidebar open_items 防御风格） ----
const todoId = computed(() => props.chain.todo_id ?? props.chain.todoId ?? null)
const title = computed(() => props.chain.title || '')
const status = computed(() => props.chain.current_status ?? props.chain.currentStatus ?? 'not_started')
const origin = computed(() => props.chain.origin || null)
/** origin 指向的来源记录 id（L1 点击跳转目标 = "创建它的记录"） */
const originRecordId = computed(() =>
  origin.value ? (origin.value.record_id ?? origin.value.recordId ?? null) : null)
/** evidence 按 date ASC（契约只保证 chains 层 DESC，节点顺序前端排稳） */
const evidence = computed(() => {
  const list = Array.isArray(props.chain.evidence) ? props.chain.evidence : []
  return [...list].sort((a, b) =>
    String(a.date ?? a.confirmedAt ?? a.confirmed_at ?? '').localeCompare(
      String(b.date ?? b.confirmedAt ?? b.confirmed_at ?? '')))
})

/** pending 蓝点/计数只在 auto 模式出现（manual 模式裁决走审核窗口，与旧口径一致） */
const showPending = computed(() => settingsStore.settings.review_mode === 'auto')
/** 计数：join 到的明细优先，否则用契约里的 pending_suggestion_count */
const pendingCount = computed(() => {
  const joined = todoStore.pendingSuggestions.filter(s =>
    String(s.todo_id ?? s.todoId ?? '') === String(todoId.value ?? '')).length
  return joined || Number(props.chain.pending_suggestion_count ?? props.chain.pendingSuggestionCount ?? 0)
})

/** 状态圈视觉键（复用侧栏 SVG：未开始空心 / 进行中半圆 / 已完成勾） */
function statusKind(s) {
  return s === 'completed' ? 'done' : (s === 'in_progress' ? 'doing' : 'todo')
}

// ---- L1/L2 展开收起（卡片内，非模态；各卡独立） ----
const expanded = ref(false)
function toggleExpand() {
  expanded.value = !expanded.value
}

/** L1 点击：跳"创建它的记录"；无 origin 时退化为展开/收起（重排位/来源缺失兜底） */
function onOpenOrigin() {
  if (originRecordId.value) {
    emit('open-record', originRecordId.value)
    return
  }
  toggleExpand()
}

// ---- 删除（特例：侧栏直点，影响清单弹框确认） ----
const confirmOpen = ref(false)
const removing = computed(() => String(todoStore.removingId ?? '') === String(todoId.value ?? ''))
function openDeleteConfirm() {
  confirmOpen.value = true
}
function cancelDelete() {
  if (!removing.value) confirmOpen.value = false
}
async function confirmDelete() {
  if (removing.value) return
  const ok = await todoStore.removeTodo(todoId.value)
  if (ok) {
    confirmOpen.value = false
    toast.success(`已删除「${title.value}」这条待办`)
  } else {
    toast.error(todoStore.error || '删除失败，请重试')
  }
}

// ---- 文案小工具 ----
/** excerpt 截 40 字（同建议卡口径） */
function excerptShort(text) {
  const t = String(text || '')
  return t.length > 40 ? t.slice(0, 40) + '…' : t
}
/** "yyyy-MM-dd HH:mm:ss" → "MM-dd" */
function fmtDate(s) {
  const str = String(s || '')
  return str.length >= 10 ? str.slice(5, 10) : str
}
</script>

<template>
  <div class="chain-card">
    <!-- ==================== L1 ==================== -->
    <div class="chain-l1">
      <div
        class="chain-row"
        role="button"
        tabindex="0"
        :title="originRecordId ? '打开创建这条待办的记录' : (expanded ? '收起证据链' : '展开证据链')"
        @click="onOpenOrigin"
        @keydown.enter="onOpenOrigin"
      >
        <!-- 状态圈：只读指示（状态变更唯一入口 = 记录审核页，随「确认入库」生效） -->
        <span class="chain-circle-btn" :title="`当前状态 · ${taskStatusMap[status] || '未开始'}`">
          <svg v-if="statusKind(status) === 'done'" class="chain-circle" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="var(--success)" stroke-width="1.5" />
            <path d="M5.2 8.3l1.9 1.9 3.7-4.2" stroke="var(--success)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else-if="statusKind(status) === 'doing'" class="chain-circle" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="var(--accent)" stroke-width="1.5" opacity=".35" />
            <path d="M8 1.5a6.5 6.5 0 0 1 0 13" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <svg v-else class="chain-circle" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="var(--text-low)" stroke-width="1.5" />
          </svg>
        </span>
        <span class="chain-title">{{ title }}</span>
        <span v-if="evidence.length" class="chain-chip" :title="`后续证据 ${evidence.length} 条`">·{{ evidence.length }} 条后续</span>
        <!-- 删除（管理层操作；仅侧栏宿主启用） -->
        <button
          v-if="deletable"
          class="chain-del-btn"
          type="button"
          title="删除这条待办"
          @click.stop="openDeleteConfirm"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
        <button
          class="chain-caret-btn"
          type="button"
          :title="expanded ? '收起证据链' : '展开证据链'"
          @click.stop="toggleExpand"
        >
          <svg :class="['chain-caret', { open: expanded }]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <span v-if="showPending && pendingCount" class="chain-pendot" :title="`${pendingCount} 条状态建议待裁决`" />
      </div>
      <!-- origin excerpt：L1 内第二行单行截断（320px 侧栏与 title 挤一行会双双截没） -->
      <div v-if="origin && origin.excerpt" class="chain-origin-line" :title="origin.excerpt">
        "{{ origin.excerpt }}"
      </div>
    </div>

    <!-- ==================== L2（卡片内展开） ==================== -->
    <div v-if="expanded" class="chain-l2">
      <div v-if="!origin && !evidence.length && !pendingCount" class="tl-empty">
        还没有登记来源证据
      </div>

      <!-- origin 节点："起于" -->
      <div v-if="origin" class="tl-node">
        <span class="tl-dot" />
        <div class="tl-body">
          <div class="tl-meta">
            <span class="tl-tag">起于</span>
            <span class="tl-date">{{ fmtDate(origin.date) }}</span>
          </div>
          <div class="tl-excerpt" :title="origin.excerpt">"{{ origin.excerpt }}"</div>
        </div>
        <button
          v-if="origin.record_id ?? origin.recordId"
          class="tl-arrow"
          title="打开这条记录"
          @click="emit('open-record', origin.record_id ?? origin.recordId)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </button>
      </div>

      <!-- evidence 节点（date ASC） -->
      <div v-for="(ev, i) in evidence" :key="ev.chunk_id ?? ev.chunkId ?? i" class="tl-node">
        <span class="tl-dot" />
        <div class="tl-body">
          <div class="tl-meta">
            <span class="tl-tag">后续</span>
            <span class="tl-date">{{ fmtDate(ev.date) }}</span>
          </div>
          <div class="tl-excerpt" :title="ev.excerpt">"{{ ev.excerpt }}"</div>
        </div>
        <button
          v-if="ev.record_id ?? ev.recordId"
          class="tl-arrow"
          title="打开这条记录"
          @click="emit('open-record', ev.record_id ?? ev.recordId)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </button>
      </div>

      <!-- pending 建议：只读计数提示（本轮重构移除直调；裁决走对应记录的审核页） -->
      <div v-if="pendingCount" class="tl-node tl-node-pending">
        <span class="tl-dot tl-dot-dashed" />
        <div class="tl-body">
          <div class="tl-pending-text">
            有 {{ pendingCount }} 条状态建议待裁决（在对应记录的审核页处理）
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 删除确认弹框（影响清单，把代价说清） ==================== -->
    <Teleport to="body">
      <div v-if="confirmOpen" class="todo-del-mask" @click.self="cancelDelete">
        <div class="todo-del-modal" role="dialog" aria-modal="true">
          <div class="todo-del-title">确认删除「{{ title }}」这条待办？</div>
          <div class="todo-del-list">
            <div class="todo-del-line">· 将从待办清单和 AI 语境中移除</div>
            <div class="todo-del-line">· 原始记录会保留，并标记该待办“已删除”（可追溯）</div>
            <div class="todo-del-line">· 相关证据链与建议将不再显示</div>
          </div>
          <div class="todo-del-actions">
            <button class="todo-del-btn ghost" type="button" :disabled="removing" @click="cancelDelete">取消</button>
            <button class="todo-del-btn danger" type="button" :disabled="removing" @click="confirmDelete">
              {{ removing ? '删除中…' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.chain-card { border-bottom: 1px dashed var(--line); }
.chain-card:last-child { border-bottom: none; }

/* ==================== L1 ==================== */
.chain-l1 { position: relative; }
.chain-row {
  display: flex; align-items: center; gap: 8px;
  width: 100%; text-align: left; padding: 7px 0; cursor: pointer;
}
.chain-row:hover .chain-title { color: var(--accent); }
/* 状态圈：只读指示（本轮移除直调；不再有 hover 点击反馈） */
.chain-circle-btn { display: grid; place-items: center; width: 17px; height: 17px; flex-shrink: 0; }
.chain-circle { width: 15px; height: 15px; }
.chain-title {
  flex-shrink: 1; min-width: 0; font-size: 12.5px; color: var(--text-hi); font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color .15s;
}
/* 证据芯片「·N 条后续」（mono 小字） */
.chain-chip {
  flex-shrink: 0; font-family: var(--font-mono); font-size: 10px; color: var(--text-low);
  letter-spacing: .01em;
}
/* 删除按钮（管理层操作）：hover 才显红，克制不喧宾 */
.chain-del-btn {
  flex-shrink: 0; width: 20px; height: 20px; display: grid; place-items: center;
  border-radius: 6px; color: var(--text-low); transition: color .12s, background .12s;
}
.chain-del-btn svg { width: 12px; height: 12px; }
.chain-del-btn:hover { color: var(--danger); background: var(--danger-bg); }
.chain-caret-btn {
  flex-shrink: 0; width: 16px; height: 16px; display: grid; place-items: center;
  color: var(--text-low); border-radius: 4px;
}
.chain-caret {
  width: 11px; height: 11px; flex-shrink: 0; color: var(--text-low);
  transition: transform .18s ease;
}
.chain-caret.open { transform: rotate(90deg); }
/* pending 蓝点（复用侧栏角标语言：实心 accent 小圆点） */
.chain-pendot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0;
  margin-left: 1px;
}
/* origin excerpt 单行截断（L1 第二行，缩进对齐 title） */
.chain-origin-line {
  padding: 0 0 7px 25px; font-size: 11.5px; line-height: 1.5; color: var(--text-low);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ==================== L2 时间线 ==================== */
.chain-l2 {
  display: flex; flex-direction: column; gap: 11px;
  margin: 0 0 10px 14px; padding: 2px 0 2px 17px;
  border-left: 1.5px solid var(--line-strong);
}
.tl-empty { font-size: 11.5px; color: var(--text-low); padding: 2px 0 6px; }
.tl-node { position: relative; display: flex; align-items: flex-start; gap: 6px; }
/* 实线圆点骑在时间线轴上 */
.tl-dot {
  position: absolute; left: -21.5px; top: 4px;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent);
}
/* pending 建议：虚线圆点（节点整体虚线感） */
.tl-dot-dashed {
  background: var(--card);
  box-shadow: inset 0 0 0 1.5px var(--text-low);
  border: 1px dashed var(--accent);
  width: 8px; height: 8px; left: -22.5px;
}
.tl-body { flex: 1; min-width: 0; }
.tl-meta { display: flex; align-items: baseline; gap: 7px; }
.tl-tag {
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .08em;
  color: var(--text-low); flex-shrink: 0;
}
.tl-tag-pending { color: var(--accent); }
.tl-date { font-family: var(--font-mono); font-size: 10px; color: var(--accent); font-variant-numeric: tabular-nums; }
.tl-excerpt {
  margin-top: 2px; font-size: 11.5px; line-height: 1.6; color: var(--text-mid);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* pending 建议节点主体框（虚线，区别于实线证据；只读提示） */
.tl-node-pending .tl-body {
  border: 1px dashed var(--line-strong); border-radius: var(--radius-sm);
  background: var(--ink-2); padding: 7px 9px;
}
.tl-pending-text { font-size: 11.5px; line-height: 1.6; color: var(--text-hi); margin-top: 1px; }

/* 节点右箭头（跳记录详情） */
.tl-arrow {
  flex-shrink: 0; width: 22px; height: 22px; margin-top: 2px;
  display: grid; place-items: center; border-radius: 6px;
  color: var(--text-low); transition: color .12s, background .12s;
}
.tl-arrow svg { width: 11px; height: 11px; }
.tl-arrow:hover { color: var(--accent); background: var(--ink-2); }

/* ==================== 删除确认弹框 ==================== */
.todo-del-mask {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(20, 20, 15, .38);
  display: grid; place-items: center; padding: 24px;
  animation: todoDelFade .14s ease;
}
@keyframes todoDelFade { from { opacity: 0; } to { opacity: 1; } }
.todo-del-modal {
  width: 100%; max-width: 360px;
  background: var(--card); border: 1px solid var(--line);
  border-radius: var(--radius); box-shadow: var(--shadow-float);
  padding: 18px 18px 14px;
}
.todo-del-title { font-size: 14.5px; font-weight: 600; color: var(--text-hi); line-height: 1.5; }
.todo-del-list { margin: 10px 0 4px; display: flex; flex-direction: column; gap: 5px; }
.todo-del-line { font-size: 12.5px; line-height: 1.6; color: var(--text-mid); }
.todo-del-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.todo-del-btn {
  font-size: 13px; padding: 6px 16px; border-radius: var(--radius-full);
  transition: background .15s, opacity .15s;
}
.todo-del-btn:disabled { opacity: .55; cursor: not-allowed; }
.todo-del-btn.ghost { color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong); }
.todo-del-btn.ghost:hover:not(:disabled) { background: var(--ink-2); color: var(--text-hi); }
.todo-del-btn.danger { background: var(--danger); color: #FFFFFF; font-weight: 600; }
.todo-del-btn.danger:hover:not(:disabled) { background: #C43A50; }
</style>
