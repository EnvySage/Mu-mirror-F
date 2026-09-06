<script setup>
/**
 * 消化回执卡（任务 2 · 确认门禁版，与词典确认同心智）
 *
 * 上传消化完成后不再直接"已消化✓"：extracted 态回执卡展示提取结果，
 * key/description 是可编辑字段 + 「确认，让它可被检索」主按钮 + 「仅保管，不检索」次按钮：
 *
 *   已提取：{name}
 *   {description 可编辑} · {category 可选}
 *   [确认，让它可被检索] [仅保管，不检索] [不是这个，删了]
 *
 * 确认 → POST /vault/{id}/confirm（key/description/category）→ 后端生成 key chunk 进
 * embedding → confirmed（已可检索）+ toast；仅保管 → skipped（可下载预览检索不到）；
 * 删了 → 内联二次确认（带文件名）→ remove。
 *
 * 提取失败态（failed）：key/description 留空输入框 + 引导文案"告诉镜子这是什么，
 * 才能被找到"——同样走确认动作（填完才可检索）。
 */
import { ref, computed } from 'vue'
import FileTypeIcon from '@/components/atoms/FileTypeIcon.vue'
import { CONTENT_TYPES } from '@/constants/tags'

const props = defineProps({
  /**
   * 消化完成（extracted / failed）的 vault item（snake_case 口径，见 vault store typedef）
   */
  item: { type: Object, required: true },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'skip', 'remove'])

const confirmingDelete = ref(false)
const leaving = ref(false)

/** 表单：key=展示名 / description=一句话 / category=contentType 口径（学习/随记等） */
const draft = ref({
  key: props.item.display_name || '',
  description: props.item.description || '',
  category: props.item.category === 'image' || props.item.category === 'audio'
    ? 'note'
    : (CONTENT_TYPES.some(t => t.key === props.item.category) ? props.item.category : 'learning'),
})

/** category 选择集（图片/音频默认随记，文档默认学习） */
const categoryOptions = CONTENT_TYPES.filter(t => ['learning', 'note', 'work', 'thought'].includes(t.key))

/** 提取失败态：描述留空 + 引导文案 */
const isFailed = computed(() => props.item.digest_status === 'failed')

/** 可确认：名字非空 + 图片必须有一句描述（任务 4 Y4 联动：回执侧同样卡空描述） */
const canConfirm = computed(() =>
  draft.value.key.trim().length > 0 && draft.value.description.trim().length > 0
)

/** 确认按钮文案（失败态强调补全） */
const confirmLabel = computed(() => {
  if (props.busy) return '确认中…'
  return isFailed.value ? '补全并让它可被检索' : '确认，让它可被检索'
})

function onConfirm() {
  if (!canConfirm.value) return
  emit('confirm', {
    key: draft.value.key.trim(),
    description: draft.value.description.trim(),
    category: draft.value.category,
  })
}

/** 仅保管，不检索（skipped 路径） */
function onSkip() {
  emit('skip', { description: draft.value.description.trim() })
}

/** 删了：内联二次确认 → 确认后淡出再 emit remove */
function askDelete() {
  confirmingDelete.value = true
}

function onConfirmDelete() {
  leaving.value = true
  setTimeout(() => emit('remove'), 220)
}

function onCancelDelete() {
  confirmingDelete.value = false
}
</script>

<template>
  <div :class="['receipt-card', { 'receipt-leaving': leaving }]">
    <!-- 删除二次确认（内联，非弹窗；Q2 对话内路径：带文件名确认卡，免后四位） -->
    <template v-if="confirmingDelete">
      <div class="receipt-head">
        <span class="receipt-icon"><FileTypeIcon :kind="item.category || 'file'" /></span>
        <div class="receipt-title">{{ item.display_name }}</div>
      </div>
      <div class="receipt-delete-warn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
        确认删除「{{ item.display_name }}」？此操作不可恢复，关联的可检索内容一并清除
      </div>
      <div class="receipt-actions">
        <button class="receipt-btn receipt-btn-ghost" :disabled="busy" @click="onCancelDelete">再想想</button>
        <button class="receipt-btn receipt-btn-danger" :disabled="busy" @click="onConfirmDelete">确认删除</button>
      </div>
    </template>

    <!-- 展示 / 确认态 -->
    <template v-else>
      <div class="receipt-head">
        <span :class="['receipt-badge', isFailed ? 'receipt-badge-failed' : 'receipt-badge-extracted']">
          {{ isFailed ? '读取失败' : '已提取' }}
        </span>
        <span class="receipt-icon receipt-icon-sm"><FileTypeIcon :kind="item.category || 'file'" /></span>
      </div>

      <!-- 提取失败引导（认知边界透明） -->
      <div v-if="isFailed" class="receipt-failed-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
        未能读懂这份文件的内容——告诉镜子这是什么，它才能被找到
      </div>

      <!-- key / description 可编辑字段 -->
      <div class="receipt-fields">
        <label class="receipt-field">
          <span class="receipt-field-label">它叫什么</span>
          <input v-model="draft.key" class="receipt-input" placeholder="给它起个以后想用的名字" maxlength="120">
        </label>
        <label class="receipt-field">
          <span class="receipt-field-label">这是什么</span>
          <textarea
            v-model="draft.description"
            class="receipt-input receipt-textarea"
            rows="2"
            :placeholder="isFailed ? '告诉镜子这是什么，才能被找到' : '一句话说明它是什么，照着这个找'"
            maxlength="200"
          />
        </label>
        <div class="receipt-field">
          <span class="receipt-field-label">属于哪类</span>
          <div class="receipt-cat-row">
            <button
              v-for="t in categoryOptions"
              :key="t.key"
              :class="['receipt-cat', { selected: draft.category === t.key }]"
              @click="draft.category = t.key"
            >{{ t.label }}</button>
          </div>
        </div>
      </div>

      <div class="receipt-note">确认后镜子才能凭描述找到它；未确认只是保管，检索不到</div>

      <div class="receipt-actions">
        <button class="receipt-btn receipt-btn-primary" :disabled="busy || !canConfirm" @click="onConfirm">
          {{ confirmLabel }}
        </button>
        <button class="receipt-btn receipt-btn-ghost" :disabled="busy" @click="onSkip">仅保管，不检索</button>
        <button class="receipt-btn receipt-btn-ghost receipt-btn-danger" :disabled="busy" @click="askDelete">不是这个，删了</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.receipt-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: #FFFFFF;
  padding: 12px;
  margin-top: 10px;
  max-width: 100%;
  animation: cardIn .28s ease;
  transition: opacity .22s ease, transform .22s ease;
}
.receipt-leaving { opacity: 0; transform: translateY(-4px); }

.receipt-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.receipt-badge {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em;
  padding: 2px 9px; border-radius: var(--radius-full);
}
.receipt-badge-extracted { background: var(--accent-soft); color: var(--accent); }
.receipt-badge-failed { background: var(--danger-bg); color: var(--danger); }
.receipt-title {
  font-size: 13.5px; font-weight: 600; color: var(--text-hi);
  flex: 1; min-width: 0; overflow-wrap: anywhere;
}
.receipt-icon { color: var(--text-low); flex-shrink: 0; }
.receipt-icon svg { width: 14px; height: 14px; }
.receipt-icon-sm { margin-left: auto; }

.receipt-failed-hint {
  display: flex; align-items: flex-start; gap: 7px;
  margin-top: 9px; padding: 8px 10px;
  border-radius: var(--radius-sm); background: var(--danger-bg);
  font-size: 11.5px; line-height: 1.6; color: var(--danger);
}
.receipt-failed-hint svg { width: 13px; height: 13px; flex-shrink: 0; margin-top: 2px; }

/* 可编辑字段 */
.receipt-fields { display: flex; flex-direction: column; gap: 9px; margin-top: 10px; }
.receipt-field { display: flex; flex-direction: column; gap: 4px; }
.receipt-field-label {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; color: var(--text-low);
}
.receipt-input {
  width: 100%; padding: 8px 11px;
  border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--ink-2); font-size: 13px; color: var(--text-hi);
  resize: vertical;
}
.receipt-input:focus { outline: none; border-color: var(--accent); background: #FFFFFF; }
.receipt-textarea { line-height: 1.6; min-height: 56px; }
.receipt-cat-row { display: flex; gap: 6px; flex-wrap: wrap; }
.receipt-cat {
  font-size: 11.5px; padding: 3px 11px; border-radius: var(--radius-full);
  color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line);
  transition: all .15s;
}
.receipt-cat.selected { background: var(--accent); color: #FFFFFF; box-shadow: none; font-weight: 600; }

.receipt-note {
  margin-top: 9px; font-size: 11px; line-height: 1.6; color: var(--text-low);
}

.receipt-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.receipt-btn {
  font-size: 12.5px; padding: 5px 14px; border-radius: var(--radius-full);
  transition: background .15s, opacity .15s;
}
.receipt-btn:disabled { opacity: .5; cursor: not-allowed; }
.receipt-btn-primary { background: var(--accent); color: #FFFFFF; font-weight: 600; }
.receipt-btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.receipt-btn-ghost { color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong); }
.receipt-btn-ghost:hover:not(:disabled) { background: var(--ink-2); color: var(--text-hi); }
.receipt-btn-danger { color: var(--danger); }
.receipt-btn-danger:hover:not(:disabled) { background: var(--danger-bg); }
</style>
