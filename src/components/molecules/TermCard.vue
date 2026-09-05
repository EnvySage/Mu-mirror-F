<script setup>
/**
 * 词条卡（词典 UI 共用分子组件，lexicon-design.md 5a/5b）
 *
 * 两种形态：
 *  - 候选态（SummarySheet 词条候选分区）：term 大字 + 状态行 + AI 理解 +
 *    依据跳原文 + 固定警示语 + [确认][改一改][不要]
 *  - 管理态（设置页词典卡）：同卡复用，操作按分组给
 *    （待确认：确认/改一改/不要 · 已生效：编辑/删除 · 已忽略：恢复/删除）
 *
 * 编辑 = 卡片原地展开（term / aliases / description 三字段），保存走 PUT。
 */
import { ref, computed } from 'vue'

const props = defineProps({
  /** 词条对象（snake_case 字段口径，见 glossary store typedef） */
  term: { type: Object, required: true },
  /** 分组：pending / confirmed / dismissed —— 决定显示哪些操作 */
  group: { type: String, default: 'pending' },
  /** 编辑/确认进行中（禁用按钮防双击） */
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'dismiss', 'save', 'open-source'])

// ==================== 展示字段 ====================

/** 状态行文案：待确认 · 证据 3 条（近 14 天）/ 最后确认于x月x日 · 近30天相关记录n条 */
const statusLine = computed(() => {
  if (props.group === 'pending') {
    const n = props.term.content_hit_count ?? props.term.contentHitCount
    const ev = props.term.evidence || (n ? `证据 ${n} 条（近 14 天）` : '近 14 天语料')
    return `待确认 · ${ev}`
  }
  if (props.group === 'confirmed') {
    const d = shortDate(props.term.last_confirmed_at)
    const n = props.term.content_hit_count ?? props.term.contentHitCount ?? 0
    return `最后确认于${d || '—'} · 近 30 天相关记录 ${n} 条`
  }
  return '已忽略 · 30 天后可重新浮现'
})

/** x月x日（兼容 yyyy-MM-dd 与 ISO） */
function shortDate(s) {
  if (!s) return ''
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${Number(m[2])}月${Number(m[3])}日` : ''
}

/** kind 分支标记（设计稿 5a：new / evidence / update） */
const kindMark = computed(() => {
  if (props.group !== 'pending') return null
  const map = {
    new: { label: '新词候选', cls: 'kind-new' },
    evidence: { label: '证据 +1', cls: 'kind-evidence' },
    update: { label: '建议更新解释', cls: 'kind-update' },
  }
  return map[props.term.kind] || map.new
})

/** 依据行可跳转（有 source_chunk_id 才显示） */
const hasSource = computed(() => props.term.source_chunk_id != null)

/** 别名展示（空数组不渲染） */
const aliases = computed(() => props.term.aliases || [])

// ==================== 原地编辑 ====================

const editing = ref(false)
const draft = ref({ term: '', aliasesText: '', description: '' })

function startEdit() {
  draft.value = {
    term: props.term.term || '',
    aliasesText: (props.term.aliases || []).join('、'),
    description: props.term.description || '',
  }
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

function saveEdit() {
  if (!draft.value.term.trim() || !draft.value.description.trim()) return
  emit('save', {
    term: draft.value.term.trim(),
    aliases: draft.value.aliasesText
      .split(/[、,，\s]+/)
      .map(s => s.trim())
      .filter(Boolean),
    description: draft.value.description.trim(),
  })
  editing.value = false
}

/** 卡片淡出（dismiss 后） */
const leaving = ref(false)
function onDismiss() {
  leaving.value = true
  setTimeout(() => emit('dismiss'), 220)
}
</script>

<template>
  <div :class="['term-card', `term-${group}`, { 'term-leaving': leaving, 'term-evidence': group === 'pending' && term.kind === 'evidence' }]">
    <!-- 原地编辑态 -->
    <template v-if="editing">
      <div class="term-edit">
        <label class="term-field">
          <span class="term-field-label">词条</span>
          <input v-model="draft.term" class="term-input" placeholder="词或短语">
        </label>
        <label class="term-field">
          <span class="term-field-label">别名</span>
          <input v-model="draft.aliasesText" class="term-input" placeholder="多个用顿号分隔，如：毕设、那个设计">
        </label>
        <label class="term-field">
          <span class="term-field-label">AI 理解</span>
          <textarea v-model="draft.description" class="term-input term-textarea" rows="3" placeholder="这个词指的是什么" />
        </label>
        <div class="term-actions">
          <button class="term-btn term-btn-ghost" @click="cancelEdit">取消</button>
          <button class="term-btn term-btn-primary" :disabled="busy" @click="saveEdit">
            {{ busy ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </template>

    <!-- 展示态 -->
    <template v-else>
      <div class="term-head">
        <span class="term-name">{{ term.term }}</span>
        <span v-if="kindMark" :class="['term-kind', kindMark.cls]">{{ kindMark.label }}</span>
      </div>

      <div class="term-status">{{ statusLine }}</div>

      <div v-if="aliases.length" class="term-aliases">
        <span v-for="a in aliases" :key="a" class="term-alias">{{ a }}</span>
      </div>

      <p class="term-desc">{{ term.description }}</p>

      <button v-if="hasSource" class="term-source" @click="emit('open-source', term)">
        依据：查看原文
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      <!-- 固定警示语（设计稿 5a 固定文案，非 LLM 生成；⚠ 用 SVG） -->
      <div v-if="group === 'pending'" class="term-warn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>
        </svg>
        <span>确认后对话会按此理解检索你的记录；理解过时会导致偏差，可随时在设置页修改</span>
      </div>

      <div class="term-actions">
        <!-- 待确认：确认 / 改一改 / 不要 -->
        <template v-if="group === 'pending'">
          <button class="term-btn term-btn-primary" :disabled="busy" @click="emit('confirm')">确认</button>
          <button class="term-btn term-btn-ghost" :disabled="busy" @click="startEdit">改一改</button>
          <button class="term-btn term-btn-ghost term-btn-danger" :disabled="busy" @click="onDismiss">不要</button>
        </template>
        <!-- 已生效：编辑 / 删除 -->
        <template v-else-if="group === 'confirmed'">
          <button class="term-btn term-btn-ghost" :disabled="busy" @click="startEdit">编辑</button>
          <button class="term-btn term-btn-ghost term-btn-danger" :disabled="busy" @click="onDismiss">删除</button>
        </template>
        <!-- 已忽略：恢复 / 删除 -->
        <template v-else>
          <button class="term-btn term-btn-ghost" :disabled="busy" @click="emit('confirm')">恢复</button>
          <button class="term-btn term-btn-ghost term-btn-danger" :disabled="busy" @click="emit('dismiss')">删除</button>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.term-card {
  padding: 13px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--card);
  transition: opacity .22s ease, transform .22s ease, box-shadow .12s ease;
}
.term-card + .term-card { margin-top: 8px; }
.term-leaving { opacity: 0; transform: translateY(-4px); }
/* evidence 弱化（设计稿 5a：已有词证据+1，样式弱化） */
.term-card.term-evidence { background: var(--ink-2); }
.term-evidence .term-name { font-size: 14px; }

.term-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.term-name { font-family: var(--font-display); font-size: 16px; font-weight: 600; color: var(--text-hi); }
.term-kind {
  font-size: 10.5px; padding: 2px 8px; border-radius: var(--radius-full); flex-shrink: 0;
}
.kind-new { color: var(--accent); background: var(--accent-soft); }
.kind-evidence { color: var(--text-mid); background: var(--ink-2); box-shadow: inset 0 0 0 1px var(--line); }
.kind-update { color: var(--warn); background: var(--warn-bg); }

.term-status { font-family: var(--font-mono); font-size: 11px; color: var(--text-low); margin-top: 4px; }

.term-aliases { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
.term-alias {
  font-size: 11px; color: var(--text-mid); padding: 1.5px 8px;
  border-radius: var(--radius-full); box-shadow: inset 0 0 0 1px var(--line);
}

.term-desc { font-size: 13px; line-height: 1.7; color: var(--text-mid); margin-top: 8px; }

.term-source {
  display: inline-flex; align-items: center; gap: 2px;
  margin-top: 8px; font-size: 12px; color: var(--accent); padding: 0;
}
.term-source:hover { text-decoration: underline; }
.term-source svg { width: 12px; height: 12px; }

.term-warn {
  display: flex; gap: 7px; align-items: flex-start;
  margin-top: 9px; padding: 8px 10px;
  border-radius: var(--radius-sm); background: var(--warn-bg);
  font-size: 11.5px; line-height: 1.6; color: var(--warn);
}
.term-warn svg { width: 13px; height: 13px; flex-shrink: 0; margin-top: 2px; }

.term-actions { display: flex; gap: 8px; margin-top: 11px; flex-wrap: wrap; }
.term-btn {
  font-size: 12.5px; padding: 5px 14px; border-radius: var(--radius-full);
  transition: background .15s, opacity .15s;
}
.term-btn:disabled { opacity: .5; cursor: not-allowed; }
.term-btn-primary { background: var(--accent); color: #FFFFFF; font-weight: 600; }
.term-btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.term-btn-ghost { color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong); }
.term-btn-ghost:hover:not(:disabled) { background: var(--ink-2); color: var(--text-hi); }
.term-btn-danger { color: var(--danger); }
.term-btn-danger:hover:not(:disabled) { background: var(--danger-bg); }

/* 原地编辑 */
.term-edit { display: flex; flex-direction: column; gap: 9px; }
.term-field { display: flex; flex-direction: column; gap: 4px; }
.term-field-label {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em;
  color: var(--text-low);
}
.term-input {
  width: 100%; padding: 8px 11px;
  background: var(--ink-2); border: 1px solid var(--line);
  border-radius: var(--radius-sm); font-size: 13px; color: var(--text-hi);
  resize: vertical;
}
.term-input:focus { outline: none; border-color: var(--accent); background: var(--card); }
.term-textarea { line-height: 1.6; min-height: 64px; }
</style>
