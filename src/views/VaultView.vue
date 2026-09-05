<script setup>
/**
 * 「我的资产」页（任务 4 · 设计稿 4.4）
 *
 * - 时间倒序文件卡列表（AssetCard）：图标 / LLM 起的名可改 / 类型 / 大小 / 日期 /
 *   描述 / digest_status 透明（done绿 pending黄 failed红 skipped灰）
 * - 类型筛选 chips（全部/文档/图片/音频）
 * - 配额可视化条（已用 xMB / 500MB）
 * - 低信息文件置顶区（"未能识别，请描述一下"）——描述后归位普通列表
 * - 删除二次确认（AssetCard 内联）
 * - 上传：虚线投放入口（点击选文件 / 拖入），校验走 constants/fileTypes 白名单 + 20MB
 */
import { ref, computed, onMounted } from 'vue'
import { useVaultStore } from '@/stores/vault'
import { useToastStore } from '@/stores/toast'
import AssetCard from '@/components/molecules/AssetCard.vue'
import FileTypeIcon from '@/components/atoms/FileTypeIcon.vue'
import {
  validateVaultFile,
  VAULT_WHITELIST,
  deriveMockDisplayName,
  mockCategoryTag,
  VAULT_MAX_BYTES,
} from '@/constants/fileTypes'

const vault = useVaultStore()
const toast = useToastStore()

/** mock 门（B /api/vault 就绪后 store.source==='live' 自动解除） */
const mockGate = computed(() => vault.source === 'mock')

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'document', label: '文档' },
  { key: 'image', label: '图片' },
  { key: 'audio', label: '音频' },
]

/** 正在操作（保存/删除）的条目 id */
const busyId = ref(null)

onMounted(() => {
  vault.fetch()
})

// ==================== 上传（投放区 + 校验 + 上传卡） ====================

const fileInput = ref(null)
const dragOver = ref(false)

/** 待确认上传（上传卡挂载态） */
const pendingUpload = ref(null)

function pickFile() {
  fileInput.value?.click()
}

function onPickChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) acceptFile(file)
}

function onDragOver(e) {
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

function onDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) acceptFile(file)
}

/** 前端校验（20MB + 白名单 + 拒绝类专属理由）→ 通过弹上传卡 */
function acceptFile(file) {
  const v = validateVaultFile(file)
  if (!v.ok) {
    toast.error(v.reason, 4200)
    return
  }
  pendingUpload.value = {
    file,
    displayName: deriveMockDisplayName(file.name),
    category: v.category,
    file_type: v.ext,
  }
}

/** 上传卡 [就这样存] */
async function confirmUpload({ description, displayName }) {
  if (!pendingUpload.value) return
  const file = pendingUpload.value.file
  const res = await vault.upload(file, description)
  if (!res.ok) {
    toast.error(res.error || '上传失败')
    return
  }
  if (displayName) {
    await vault.update(res.item.id, { display_name: displayName })
    res.item.display_name = displayName
  }
  pendingUpload.value = null
  toast.success('已存入 · 消化中，稍后给你回执')
}

function cancelUpload() {
  pendingUpload.value = null
}

// ==================== 卡片操作 ====================

/** 保存编辑（回执改一改/资产卡编辑共用） */
async function onSave(item, data) {
  busyId.value = item.id
  const ok = await vault.update(item.id, data)
  busyId.value = null
  if (ok) toast.success('已更新')
  else toast.error(vault.error || '保存失败')
}

/** 删除（AssetCard 内联二次确认后触发） */
async function onRemove(item) {
  busyId.value = item.id
  const ok = await vault.remove(item.id)
  busyId.value = null
  if (ok) toast.success(`「${item.display_name}」已删除`)
  else toast.error(vault.error || '删除失败')
}

/** 下载（mock 态按钮已置灰，此处防御性兜底） */
function onDownload(item) {
  if (mockGate.value) {
    toast.info('下载将在 B 接口就绪后可用')
    return
  }
  window.open(`/api/vault/${item.id}/download`, '_blank')
}

/** 置顶区"去描述"→ 直接展开对应卡编辑（滚动到普通列表的该卡） */
function focusItem(item) {
  vault.setFilter('all')
  // 描述引导走卡片编辑；置顶区展示的是同一数据源，编辑保存后自动归位
  toast.info(`在下方列表找到「${item.display_name}」点编辑补一句描述`)
}

/** 消化状态摘要行（配额条下） */
const digestSummary = computed(() => {
  const n = vault.items.length
  const done = vault.items.filter(i => i.digest_status === 'done').length
  if (!n) return ''
  return `${n} 个文件 · ${done} 个可检索`
})
</script>

<template>
  <div class="page vault-page">
    <div class="page-header">
      <div class="page-title">我的资产</div>
      <div class="page-subtitle">文件交给镜子保管 · 该记住的它记得</div>
    </div>

    <div class="page-content">
      <!-- 配额条 -->
      <div class="card quota-card">
        <div class="quota-row">
          <span class="quota-label">{{ vault.quotaLabel }}</span>
          <span v-if="digestSummary" class="quota-sub">{{ digestSummary }}</span>
        </div>
        <div class="quota-bar">
          <div class="quota-fill" :style="{ width: vault.quotaPercent + '%' }" />
        </div>
      </div>

      <!-- 上传投放区（点击/拖拽，dragover 高亮） -->
      <div
        :class="['dropzone', { over: dragOver }]"
        role="button"
        tabindex="0"
        @click="pickFile"
        @keydown.enter="pickFile"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <FileTypeIcon kind="file" />
        <div class="dropzone-text">
          拖文件进来，或点击选择
          <span class="dropzone-hint">单文件 20MB 内 · {{ VAULT_WHITELIST.join(' / ') }}</span>
        </div>
        <input ref="fileInput" type="file" hidden @change="onPickChange">
      </div>

      <!-- 上传卡（选文件后弹出，确认才上传） -->
      <div v-if="pendingUpload" class="upload-wrap">
        <div class="up-mini">
          <span class="up-mini-icon"><FileTypeIcon :kind="pendingUpload.category || 'file'" /></span>
          <div class="up-mini-body">
            <div class="up-mini-name">{{ pendingUpload.displayName }}</div>
            <div class="up-mini-meta">AI 已识别：{{ mockCategoryTag(pendingUpload.category) }}</div>
          </div>
        </div>
        <input
          v-model="pendingUpload.editName"
          class="up-mini-input"
          placeholder="以后想怎么找到它？（可不填）"
          maxlength="100"
        >
        <div class="up-mini-actions">
          <button class="as-btn as-btn-ghost" :disabled="vault.uploading" @click="cancelUpload">取消</button>
          <button class="as-btn as-btn-primary" :disabled="vault.uploading" @click="confirmUpload(pendingUpload)">
            {{ vault.uploading ? '存入中…' : '就这样存' }}
          </button>
        </div>
      </div>

      <!-- 低信息文件置顶区 -->
      <div v-if="vault.lowInfoItems.length" class="lowinfo-zone">
        <div class="lowinfo-head">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          未能识别，请描述一下（{{ vault.lowInfoItems.length }}）
        </div>
        <button
          v-for="item in vault.lowInfoItems"
          :key="`low-${item.id}`"
          class="lowinfo-row"
          @click="focusItem(item)"
        >
          <FileTypeIcon :kind="item.category || 'file'" />
          <span class="lowinfo-name">{{ item.display_name }}</span>
          <span class="lowinfo-hint">请描述一下，方便日后找它</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      <!-- 类型筛选 chips -->
      <div class="filter-row">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          :class="['chip', { selected: vault.filter === f.key }]"
          @click="vault.setFilter(f.key)"
        >{{ f.label }}</button>
      </div>

      <!-- 加载中 -->
      <div v-if="vault.loading" class="vault-empty"><span class="spinner" /> 加载中…</div>

      <!-- 文件卡列表（时间倒序） -->
      <template v-else-if="vault.filteredItems.length">
        <AssetCard
          v-for="item in vault.filteredItems"
          :key="item.id"
          :item="item"
          :busy="busyId === item.id"
          :mock-gate="mockGate"
          @save="(d) => onSave(item, d)"
          @remove="() => onRemove(item)"
          @download="onDownload"
        />
      </template>

      <!-- 空态 / 筛选空 -->
      <div v-else-if="vault.items.length" class="vault-empty">这个分类下还没有文件</div>
      <div v-else class="vault-empty">还没有文件 · 传一个试试，镜子会替你记住它</div>

      <!-- 加载失败兜底 -->
      <div v-if="vault.error" class="vault-error">{{ vault.error }}</div>
    </div>
  </div>
</template>

<style scoped>
.page { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.page-header { display: none; padding: 26px 32px 0; align-items: baseline; gap: 14px; }
@media (min-width: 900px) { .page-header { display: flex; } }
.page-title { font-family: var(--font-display); font-size: 26px; font-weight: 600; }
.page-subtitle { font-size: 13px; color: var(--text-low); }

.page-content {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 10px 18px calc(96px + var(--safe-bottom));
  -webkit-overflow-scrolling: touch;
}
@media (min-width: 900px) {
  .page-content { padding: 18px 32px 40px; max-width: 760px; margin: 0 auto; }
}

/* 配额条 */
.quota-card { padding: 13px 16px; margin-bottom: 12px; }
.quota-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.quota-label { font-family: var(--font-mono); font-size: 12.5px; color: var(--text-mid); }
.quota-sub { font-size: 11px; color: var(--text-low); }
.quota-bar {
  height: 6px; border-radius: var(--radius-full);
  background: var(--ink-2); margin-top: 9px; overflow: hidden;
}
.quota-fill {
  height: 100%; border-radius: var(--radius-full);
  background: var(--accent); transition: width .4s ease;
}

/* 投放区 */
.dropzone {
  display: flex; align-items: center; gap: 12px;
  border: 1.5px dashed var(--line-strong);
  border-radius: var(--radius);
  padding: 16px 18px; margin-bottom: 14px;
  color: var(--text-mid); cursor: pointer;
  transition: border-color .18s, background .18s;
  background: transparent;
}
.dropzone:hover, .dropzone.over { border-color: var(--accent); background: var(--accent-soft); }
.dropzone > svg { width: 20px; height: 20px; flex-shrink: 0; color: var(--text-low); }
.dropzone.over > svg { color: var(--accent); }
.dropzone-text { font-size: 13px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dropzone-hint { font-family: var(--font-mono); font-size: 10px; color: var(--text-low); overflow-wrap: anywhere; }

/* 上传卡（复用上传卡视觉，精简版挂列表顶部） */
.upload-wrap {
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: #FFFFFF;
  padding: 12px;
  margin-bottom: 14px;
  animation: cardIn .25s ease;
}
.up-mini { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
.up-mini-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  background: var(--ink-2); border: 1px solid var(--line);
  display: grid; place-items: center; color: var(--text-mid);
}
.up-mini-icon svg { width: 18px; height: 18px; }
.up-mini-body { min-width: 0; flex: 1; }
.up-mini-name { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.up-mini-meta { font-size: 12px; color: var(--text-mid); margin-top: 2px; }
.up-mini-input {
  width: 100%; margin-top: 9px; padding: 8px 11px;
  border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--ink-2); font-size: 13px;
}
.up-mini-input:focus { outline: none; border-color: var(--accent); background: #FFFFFF; }
.up-mini-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }

/* 低信息置顶区 */
.lowinfo-zone {
  border: 1px solid var(--warn);
  border-radius: var(--radius-sm);
  background: #FFFFFF;
  padding: 11px 13px;
  margin-bottom: 14px;
}
.lowinfo-head {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em;
  color: var(--warn); margin-bottom: 8px;
}
.lowinfo-head svg { width: 13px; height: 13px; }
.lowinfo-row {
  display: flex; align-items: center; gap: 8px;
  width: 100%; text-align: left;
  padding: 7px 9px; border-radius: var(--radius-sm);
  font-size: 12.5px; color: var(--text-mid);
  transition: background .15s;
}
.lowinfo-row:hover { background: var(--warn-bg); }
.lowinfo-row > svg { width: 14px; height: 14px; flex-shrink: 0; color: var(--text-low); }
.lowinfo-name { font-weight: 600; color: var(--text-hi); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lowinfo-hint { font-size: 11px; color: var(--warn); margin-left: auto; flex-shrink: 0; }
.lowinfo-row > svg:last-child { width: 12px; height: 12px; margin-left: 0; flex-shrink: 0; }

/* 筛选 */
.filter-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }

/* 空态 / 错误 */
.vault-empty {
  font-size: 12.5px; color: var(--text-low); line-height: 1.6;
  padding: 14px; border-radius: var(--radius-sm); background: var(--ink-2);
  display: flex; align-items: center; gap: 8px;
  margin-top: 4px;
}
.vault-error {
  margin-top: 10px; font-size: 12px; color: var(--danger);
  padding: 9px 12px; border-radius: var(--radius-sm); background: var(--danger-bg);
}

/* 上传卡/资产卡按钮样式复用（scoped 隔离，此处声明同名类） */
.as-btn {
  font-size: 12.5px; padding: 5px 14px; border-radius: var(--radius-full);
  transition: background .15s, opacity .15s;
}
.as-btn:disabled { opacity: .5; cursor: not-allowed; }
.as-btn-primary { background: var(--accent); color: #FFFFFF; font-weight: 600; }
.as-btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.as-btn-ghost { color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong); }
.as-btn-ghost:hover:not(:disabled) { background: var(--ink-2); color: var(--text-hi); }
</style>
