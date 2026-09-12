<script setup>
/**
 * 上传卡（任务 2 · 设计稿 4.2）
 *
 * 选文件后先弹此卡再上传（上传=显式动作免确认红线以用户点[就这样存]为准）：
 *   [类型图标] 显示名（本地清洗 original；B 侧的元数据榨取名随上传返回覆盖）
 *   类型行：显示名 · 大类（按扩展名判；description 由后端消化管道给出）
 *   可空描述框（placeholder「以后想怎么找到它？」——key 三层渐进第 3 层用户补正）
 *   [就这样存] [改个名]
 *
 * 改个名 = 原地显示名编辑（display_name 可覆盖），保存后随上传提交 description。
 */
import { ref, computed } from 'vue'
import FileTypeIcon from '@/components/atoms/FileTypeIcon.vue'
import { formatBytes, categoryLabel } from '@/constants/fileTypes'

const props = defineProps({
  /**
   * 待上传文件上下文（ChatView 选文件后构造）：
   * @property {File} file
   * @property {string} displayName  本地兜底显示名（清洗文件名）
   * @property {'document'|'image'|'audio'|null} category
   */
  pending: { type: Object, required: true },
  uploading: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

const editing = ref(false)
const draftName = ref('')
const description = ref('')

const displayName = computed(() => (editing.value ? draftName.value.trim() : props.pending.displayName) || props.pending.file.name)
const sizeLabel = computed(() => formatBytes(props.pending.file.size))

/** 图片类必须写一句描述（任务 4 / Y4：图片无内容可索引，描述是可检索的唯一途径） */
const isImage = computed(() => props.pending.category === 'image')
const descPlaceholder = computed(() => (isImage.value
  ? '图片必须写一句描述，否则无法被找到'
  : '以后想怎么找到它？（可不填）'))
/** 确认按钮禁用：图片空描述 → 「就这样存」禁用 */
const canConfirm = computed(() => !isImage.value || description.value.trim().length > 0)

function startRename() {
  draftName.value = props.pending.displayName || props.pending.file.name
  editing.value = true
}

function saveRename() {
  if (!draftName.value.trim()) return
  editing.value = false
}

function confirm() {
  if (!canConfirm.value) return
  emit('confirm', {
    description: description.value.trim(),
    displayName: editing.value ? draftName.value.trim() : '',
  })
  description.value = ''
  editing.value = false
}

function cancel() {
  emit('cancel')
  description.value = ''
  editing.value = false
}
</script>

<template>
  <div class="up-card">
    <div class="up-head">
      <span class="up-icon">
        <FileTypeIcon :kind="pending.category || 'file'" />
      </span>
      <div class="up-title-wrap">
        <!-- 显示名（可改名） -->
        <input
          v-if="editing"
          v-model="draftName"
          class="up-name-input"
          placeholder="显示名"
          @keyup.enter="saveRename"
        >
        <div v-else class="up-name">{{ displayName }}</div>
        <div class="up-meta">{{ pending.file_type.toUpperCase() }} · {{ sizeLabel }}</div>
      </div>
    </div>

    <!-- 类型识别行（按扩展名判大类，真实 description 由后端消化管道给出） -->
    <div class="up-recognized">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
      <span>{{ displayName }} · {{ categoryLabel(pending.category) }}</span>
    </div>

    <!-- 描述框（图片必填强提示；非图片可空轻口径——key 三层第 3 层：用户补正） -->
    <input
      v-model="description"
      :class="['up-desc-input', { 'up-desc-required': isImage }]"
      :placeholder="descPlaceholder"
      maxlength="100"
    >
    <div v-if="isImage" class="up-desc-note">图片内容镜子读不到，一句描述是它被找到的唯一途径</div>

    <div class="up-actions">
      <button class="up-btn up-btn-ghost" :disabled="uploading" @click="editing ? (editing = false) : cancel()">
        {{ editing ? '取消' : '取消' }}
      </button>
      <button v-if="!editing" class="up-btn up-btn-ghost" :disabled="uploading" @click="startRename">改个名</button>
      <button
        v-else
        class="up-btn up-btn-primary"
        :disabled="!draftName.trim()"
        @click="saveRename"
      >用这个名字</button>
      <button v-if="!editing" class="up-btn up-btn-primary" :disabled="uploading || !canConfirm" @click="confirm">
        {{ uploading ? '存入中…' : '就这样存' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.up-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: #FFFFFF;
  padding: 12px;
  margin-top: 10px;
  animation: cardIn .25s ease;
  max-width: 100%;
}

.up-head { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
.up-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  background: var(--ink-2); border: 1px solid var(--line);
  display: grid; place-items: center; color: var(--text-mid);
}
.up-icon svg { width: 18px; height: 18px; }
.up-title-wrap { min-width: 0; flex: 1; }
.up-name { font-size: 14px; font-weight: 600; color: var(--text-hi); overflow-wrap: anywhere; line-height: 1.45; }
.up-name-input {
  width: 100%; padding: 5px 9px;
  border: 1px solid var(--accent); border-radius: var(--radius-sm);
  background: var(--ink-2); font-size: 13.5px; font-weight: 600;
}
.up-name-input:focus { outline: none; }
.up-meta { font-family: var(--font-mono); font-size: 10.5px; color: var(--text-low); margin-top: 3px; }

.up-recognized {
  display: flex; align-items: center; gap: 6px;
  margin-top: 9px; font-size: 12px; color: var(--text-mid);
  padding: 6px 10px; border-radius: var(--radius-sm); background: var(--ink-2);
}
.up-recognized svg { width: 12px; height: 12px; color: var(--accent); flex-shrink: 0; }

.up-desc-input {
  width: 100%; margin-top: 9px; padding: 8px 11px;
  border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--ink-2); font-size: 13px;
}
.up-desc-input:focus { outline: none; border-color: var(--accent); background: #FFFFFF; }
.up-desc-required { border-color: var(--warn); background: var(--warn-bg); }
.up-desc-note { margin-top: 6px; font-size: 11px; line-height: 1.6; color: var(--warn); }

.up-actions { display: flex; gap: 8px; margin-top: 11px; justify-content: flex-end; flex-wrap: wrap; }
.up-btn {
  font-size: 12.5px; padding: 5.5px 15px; border-radius: var(--radius-full);
  transition: background .15s, opacity .15s;
}
.up-btn:disabled { opacity: .5; cursor: not-allowed; }
.up-btn-primary { background: var(--accent); color: #FFFFFF; font-weight: 600; }
.up-btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.up-btn-ghost { color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong); }
.up-btn-ghost:hover:not(:disabled) { background: var(--ink-2); color: var(--text-hi); }
</style>
