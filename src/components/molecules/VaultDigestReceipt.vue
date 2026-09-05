<script setup>
/**
 * 消化回执卡（任务 3 · 设计稿 4.3，与词典确认同心智）
 *
 *   ✓ 已消化：{name}
 *   我理解它是：{desc} · 已提取 N 段可检索
 *   [对的] [改一改] [不是这个，删了]
 *
 * 对的 → confirmDigest 定稿 + toast；改一改 → 原地编辑 name/description/category；
 * 删了 → 内联二次确认（"确认删除？不可恢复"）→ remove + 淡出。
 * 由 store 触发（mock：上传后 2s 消化完成；真态：B digest 完成事件驱动）。
 */
import { ref, computed } from 'vue'
import FileTypeIcon from '@/components/atoms/FileTypeIcon.vue'
import { CATEGORY_LABELS } from '@/constants/fileTypes'

const props = defineProps({
  /**
   * 消化完成的 vault item（snake_case 口径，见 vault store typedef）
   * receipt 卡要求 digest_status='done' 且 description 非空
   */
  item: { type: Object, required: true },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'save', 'remove'])

const editing = ref(false)
const confirmingDelete = ref(false)
const leaving = ref(false)

const draft = ref({ display_name: '', description: '', category: 'document' })

const categoryLabel = computed(() => CATEGORY_LABELS[props.item.category] || '文件')
const chunkLine = computed(() => (props.item.chunk_count ? `已提取 ${props.item.chunk_count} 段可检索` : '按描述可找到'))

function startEdit() {
  draft.value = {
    display_name: props.item.display_name || '',
    description: props.item.description || '',
    category: props.item.category || 'document',
  }
  editing.value = true
}

function saveEdit() {
  if (!draft.value.display_name.trim() || !draft.value.description.trim()) return
  emit('save', {
    display_name: draft.value.display_name.trim(),
    description: draft.value.description.trim(),
    category: draft.value.category,
  })
  editing.value = false
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

function onConfirm() {
  emit('confirm')
}
</script>

<template>
  <div :class="['receipt-card', { 'receipt-leaving': leaving }]">
    <!-- 原地编辑态（改一改：name/description/category 三字段） -->
    <template v-if="editing">
      <div class="receipt-head">
        <span class="receipt-icon"><FileTypeIcon kind="file" /></span>
        <div class="receipt-edit-title">改一改</div>
      </div>
      <div class="receipt-fields">
        <label class="receipt-field">
          <span class="receipt-field-label">名称</span>
          <input v-model="draft.display_name" class="receipt-input" placeholder="显示名">
        </label>
        <label class="receipt-field">
          <span class="receipt-field-label">我理解它是</span>
          <textarea v-model="draft.description" class="receipt-input receipt-textarea" rows="2" placeholder="一句话说明它是什么" />
        </label>
        <div class="receipt-field">
          <span class="receipt-field-label">分类</span>
          <div class="receipt-cat-row">
            <button
              v-for="(label, key) in CATEGORY_LABELS"
              :key="key"
              :class="['receipt-cat', { selected: draft.category === key }]"
              @click="draft.category = key"
            >{{ label }}</button>
          </div>
        </div>
      </div>
      <div class="receipt-actions">
        <button class="receipt-btn receipt-btn-ghost" :disabled="busy" @click="editing = false">取消</button>
        <button class="receipt-btn receipt-btn-primary" :disabled="busy || !draft.display_name.trim() || !draft.description.trim()" @click="saveEdit">
          {{ busy ? '保存中…' : '保存' }}
        </button>
      </div>
    </template>

    <!-- 删除二次确认（内联，非弹窗） -->
    <template v-else-if="confirmingDelete">
      <div class="receipt-head">
        <span class="receipt-icon"><FileTypeIcon :kind="item.category || 'file'" /></span>
        <div class="receipt-title">{{ item.display_name }}</div>
      </div>
      <div class="receipt-delete-warn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
        确认删除？不可恢复，关联的可检索内容一并清除
      </div>
      <div class="receipt-actions">
        <button class="receipt-btn receipt-btn-ghost" :disabled="busy" @click="onCancelDelete">再想想</button>
        <button class="receipt-btn receipt-btn-danger" :disabled="busy" @click="onConfirmDelete">确认删除</button>
      </div>
    </template>

    <!-- 展示态 -->
    <template v-else>
      <div class="receipt-head">
        <span class="receipt-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </span>
        <div class="receipt-title">已消化：{{ item.display_name }}</div>
        <span class="receipt-icon receipt-icon-sm"><FileTypeIcon :kind="item.category || 'file'" /></span>
      </div>

      <div class="receipt-understand">
        我理解它是：{{ item.description || '（AI 未给出描述，建议改一改补充）' }}
      </div>
      <div class="receipt-meta">
        {{ categoryLabel }} · {{ chunkLine }}
      </div>

      <div class="receipt-actions">
        <button class="receipt-btn receipt-btn-primary" :disabled="busy" @click="onConfirm">对的</button>
        <button class="receipt-btn receipt-btn-ghost" :disabled="busy" @click="startEdit">改一改</button>
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
.receipt-check {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
  background: var(--success-bg); color: var(--success);
  display: grid; place-items: center;
}
.receipt-check svg { width: 10px; height: 10px; }
.receipt-title {
  font-size: 13.5px; font-weight: 600; color: var(--text-hi);
  flex: 1; min-width: 0; overflow-wrap: anywhere;
}
.receipt-edit-title { font-size: 13px; font-weight: 600; color: var(--text-hi); }
.receipt-icon { color: var(--text-low); flex-shrink: 0; }
.receipt-icon svg { width: 14px; height: 14px; }
.receipt-icon-sm { margin-left: auto; }

.receipt-understand { font-size: 12.5px; line-height: 1.7; color: var(--text-mid); margin-top: 8px; }
.receipt-meta { font-family: var(--font-mono); font-size: 10.5px; color: var(--text-low); margin-top: 3px; }

/* 编辑态字段 */
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

/* 删除二次确认 */
.receipt-delete-warn {
  display: flex; align-items: flex-start; gap: 7px;
  margin-top: 9px; padding: 8px 10px;
  border-radius: var(--radius-sm); background: var(--danger-bg);
  font-size: 11.5px; line-height: 1.6; color: var(--danger);
}
.receipt-delete-warn svg { width: 13px; height: 13px; flex-shrink: 0; margin-top: 2px; }

.receipt-actions { display: flex; gap: 8px; margin-top: 11px; flex-wrap: wrap; }
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
