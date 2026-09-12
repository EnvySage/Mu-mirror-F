<script setup>
/**
 * 「我的资产」页（任务 1/3/4 · 设计稿 4.4 + §3.3b 确认门禁 + Q2 防误删）
 *
 * - 时间倒序文件卡列表（AssetCard）：图标 / 显示名可改 / 类型 / 大小 / 日期 /
 *   描述 / digest_status 五态透明（pending 灰排队中 · extracted 蓝待确认 ·
 *   confirmed 绿已可检索 · skipped 灰仅保管 · failed 红读取失败）
 * - 补确认入口（低信息/未确认置顶区）——确认门禁的资产页入口
 * - 删除 = 输文件名后四位（Q2）+ toast 5 秒撤销窗（真删推迟 5 秒执行）
 * - 上传：图片类 description 必填（任务 4/Y4），placeholder 强提示
 * - 类型筛选 chips（全部/文档/图片/音频）+ 配额可视化条
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useVaultStore } from '@/stores/vault'
import { useToastStore } from '@/stores/toast'
import AssetCard from '@/components/molecules/AssetCard.vue'
import FilePreviewModal from '@/components/organisms/FilePreviewModal.vue'
import FileTypeIcon from '@/components/atoms/FileTypeIcon.vue'
import {
  validateVaultFile,
  VAULT_WHITELIST,
  deriveDisplayName,
  categoryLabel,
} from '@/constants/fileTypes'
import request from '@/api/request'

const vault = useVaultStore()
const toast = useToastStore()

/** 下载中的条目 id（防重复点击） */
const downloadingId = ref(null)

/** 预览模态当前条目（null=关闭；资产卡文件名点击 → FilePreviewModal） */
const previewItem = ref(null)

/** 资产卡文件名点击 → 预览（deleted 置灰；digest 状态不拦——保管完整就可看 §3.3b） */
function openPreview(item) {
  if (item.deleted) return
  previewItem.value = item
}

/** mock 门（B /api/vault 已就绪；store.source==='mock' 时下载置灰） */
const mockGate = computed(() => vault.source === 'mock')

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'document', label: '文档' },
  { key: 'image', label: '图片' },
  { key: 'audio', label: '音频' },
]

/** 正在操作（保存/删除/确认）的条目 id */
const busyId = ref(null)

onMounted(() => {
  vault.fetch()
})

onBeforeUnmount(() => {
  // 离开页面时撤销窗里的延迟删除立即执行（不丢删除意图）
  flushAllPendingDeletes()
})

// ==================== 上传（投放区 + 校验 + 上传卡） ====================

const fileInput = ref(null)
const dragOver = ref(false)

/** 待确认上传（上传卡挂载态） */
const pendingUpload = ref(null)

/** 图片类必须写描述（任务 4 / Y4：图片无内容可索引，描述是它可检索的唯一途径） */
const isImagePending = computed(() => pendingUpload.value?.category === 'image')
const canConfirmUpload = computed(() =>
  !!pendingUpload.value && !(isImagePending.value && !(pendingUpload.value.description || '').trim())
)

/** 图片类 placeholder 强提示；非图片保持"可不填"轻口径（extracted 后回执卡仍可补） */
const descPlaceholder = computed(() => (isImagePending.value
  ? '图片必须写一句描述，否则无法被找到'
  : '以后想怎么找到它？（可不填）'))

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
    description: '',
    displayName: deriveDisplayName(file.name),
    category: v.category,
    file_type: v.ext,
  }
}

/** 上传卡 [就这样存]（图片空描述按钮禁用，此处防御性双保险） */
async function confirmUpload() {
  if (!pendingUpload.value || !canConfirmUpload.value) return
  const { file, description, displayName } = pendingUpload.value
  const res = await vault.upload(file, description)
  if (!res.ok) {
    toast.error(res.error || '上传失败')
    return
  }
  // 注意：上传卡里改的名只更新本地显示，不发 PUT——B 的 PUT /vault/{id} 是全字段
  // updateById，会把并发消化管道刚写的 digest_status 用过期快照覆盖回 pending
  //（实测复现）。用户改的名字在回执卡确认时作为 key 提交（confirm 契约支持改名）。
  if (displayName && res.item) res.item.display_name = displayName
  pendingUpload.value = null
  toast.success('已存入 · 提取后回执卡等你确认', 4200)
}

function cancelUpload() {
  pendingUpload.value = null
}

// ==================== 卡片操作 ====================

/** 保存编辑（confirmed/skipped 卡） */
async function onSave(item, data) {
  busyId.value = item.id
  const ok = await vault.update(item.id, data)
  busyId.value = null
  if (ok) toast.success('已更新')
  else toast.error(vault.error || '保存失败')
}

/** 补确认（extracted/failed 卡：确认 = key/description/category 提交 confirm 门禁） */
async function onConfirm(item, data) {
  busyId.value = item.id
  const ok = await vault.confirmDigest(item.id, data)
  busyId.value = null
  if (ok) toast.success('已可检索', 3600)
  else toast.error(vault.error || '确认失败')
}

/**
 * 删除（Q2：AssetCard 后四位确认通过后触发）
 * toast 5 秒撤销窗：立即移出列表 + 挂起真删 5 秒；点撤销恢复卡片取消 DELETE；
 * 5 秒到才真正发 DELETE（前端本地预校验已拦错，后端 confirm_name 是最终防线）
 */
const UNDO_WINDOW_MS = 5000

/** @type {import('vue').Ref<Map<string|number, {item: Object, timer: number}>>} */
const pendingDeletes = ref(new Map())

async function onRemove(item) {
  busyId.value = item.id
  // 从列表移出（视觉上已删），真删推迟到撤销窗结束
  const snapshot = { ...item }
  vault.items = vault.items.filter(i => i.id !== item.id)
  busyId.value = null

  const entry = { item: snapshot, timer: 0, restore: false }
  pendingDeletes.value.set(item.id, entry)

  toast.undoable(`「${snapshot.display_name}」已删除 · 撤销`, UNDO_WINDOW_MS, () => {
    // 撤销：恢复卡片，不发 DELETE
    entry.restore = true
    clearTimeout(entry.timer)
    pendingDeletes.value.delete(item.id)
    vault.items = [...vault.items, snapshot].sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || '')))
  })

  entry.timer = setTimeout(async () => {
    pendingDeletes.value.delete(item.id)
    const ok = await vault.remove(item.id, { confirmName: tail4Of(snapshot) })
    if (!ok) {
      toast.error(`「${snapshot.display_name}」删除失败，已恢复`, 4200)
      vault.items = [...vault.items, snapshot].sort((a, b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')))
    }
  }, UNDO_WINDOW_MS)
}

/** 文件名后四位（不足四位取全名——与 B tail4 口径一致） */
function tail4Of(item) {
  const name = String(item.original_name || item.display_name || '')
  return name.length <= 4 ? name : name.slice(-4)
}

/** 卸载前把未决的延迟删除全部立刻执行（含已撤销的跳过） */
function flushAllPendingDeletes() {
  for (const [, entry] of pendingDeletes.value) {
    clearTimeout(entry.timer)
    if (!entry.restore) vault.remove(entry.item.id, { confirmName: tail4Of(entry.item) })
  }
  pendingDeletes.value = new Map()
}

/** 下载（AssetCard 下载按钮；blob fetch 走 request 封装带鉴权，触发保存） */
async function onDownload(item) {
  if (mockGate.value) {
    toast.info('下载将在 mock 关闭后可用')
    return
  }
  downloadingId.value = item.id
  try {
    // 拦截器 return response.data —— responseType:'blob' 时直接就是 Blob
    const blob = await request.get(`/vault/${item.id}/download`, { responseType: 'blob', timeout: 60000 })
    const realBlob = blob instanceof Blob ? blob : new Blob([blob])
    const name = item.original_name || item.display_name || `file-${item.id}`
    const url = URL.createObjectURL(realBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  } catch (err) {
    console.error('Download failed:', err)
    toast.error(err?.message || '下载失败')
  } finally {
    downloadingId.value = null
  }
}

/** 置顶区"去描述"→ 直接展开对应卡补确认（同卡就地编辑，保存后归位） */
function focusItem(item) {
  vault.setFilter('all')
  const el = document.querySelector(`[data-asset-id="${item.id}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.querySelector('.as-btn-ghost')?.click()
  }
}

/** 消化状态摘要行（配额条下；五态口径） */
const digestSummary = computed(() => {
  const n = vault.items.length
  if (!n) return ''
  const confirmed = vault.items.filter(i => i.digest_status === 'confirmed').length
  const unconfirmed = vault.items.filter(i => i.digest_status === 'extracted').length
  const extra = unconfirmed ? ` · ${unconfirmed} 个待确认` : ''
  return `${n} 个文件 · ${confirmed} 个可检索${extra}`
})
</script>

<template>
  <div class="page vault-page">
    <div class="page-header">
      <div class="page-title">我的资产</div>
      <div class="page-subtitle">文件交给镜子保管 · 确认过的才进记忆</div>
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

      <!-- 上传卡（选文件后弹出，确认才上传；图片必填描述） -->
      <div v-if="pendingUpload" class="upload-wrap">
        <div class="up-mini">
          <span class="up-mini-icon"><FileTypeIcon :kind="pendingUpload.category || 'file'" /></span>
          <div class="up-mini-body">
            <div class="up-mini-name">{{ pendingUpload.displayName }}</div>
            <div class="up-mini-meta">AI 已识别：{{ mockCategoryTag(pendingUpload.category) }}</div>
          </div>
        </div>
        <input
          v-model="pendingUpload.description"
          :class="['up-mini-input', { 'up-mini-input-required': isImagePending }]"
          :placeholder="descPlaceholder"
          maxlength="100"
        >
        <div v-if="isImagePending" class="up-mini-note">图片内容镜子读不到，一句描述是它被找到的唯一途径</div>
        <div class="up-mini-actions">
          <button class="as-btn as-btn-ghost" :disabled="vault.uploading" @click="cancelUpload">取消</button>
          <button class="as-btn as-btn-primary" :disabled="vault.uploading || !canConfirmUpload" @click="confirmUpload">
            {{ vault.uploading ? '存入中…' : '就这样存' }}
          </button>
        </div>
      </div>

      <!-- 低信息/待确认置顶区（§3.3b 补确认入口） -->
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
          <span class="lowinfo-hint">请描述一下，它才能被找到</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      <!-- 补确认提示（有描述但还没确认的 extracted 文件——确认门禁漏斗第二级） -->
      <div v-if="vault.unconfirmedItems.filter(i => (i.description || '').trim()).length" class="confirm-zone">
        <div class="confirm-head">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          这些文件还没确认 · 确认后才能被检索到（{{ vault.unconfirmedItems.filter(i => (i.description || '').trim()).length }}）
        </div>
        <button
          v-for="item in vault.unconfirmedItems.filter(i => (i.description || '').trim())"
          :key="`uc-${item.id}`"
          class="lowinfo-row"
          @click="focusItem(item)"
        >
          <FileTypeIcon :kind="item.category || 'file'" />
          <span class="lowinfo-name">{{ item.display_name }}</span>
          <span class="lowinfo-hint lowinfo-hint-accent">补确认 · 让它可检索</span>
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
          :data-asset-id="item.id"
          :item="item"
          :busy="busyId === item.id"
          :mock-gate="mockGate"
          @preview="openPreview"
          @save="(d) => onSave(item, d)"
          @confirm="(d) => onConfirm(item, d)"
          @remove="() => onRemove(item)"
          @download="onDownload"
        />
      </template>

      <!-- 空态 / 筛选空 -->
      <div v-else-if="vault.items.length" class="vault-empty">这个分类下还没有文件</div>
      <div v-else class="vault-empty">还没有文件 · 传一个试试，镜子会替你记住它</div>

      <!-- 加载失败兜底 -->
      <div v-if="vault.error" class="vault-error">{{ vault.error }}</div>

      <!-- 文件预览模态（Teleport to body；资产卡预览入口） -->
      <FilePreviewModal
        v-if="previewItem"
        :item="previewItem"
        @close="previewItem = null"
      />
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
.up-mini-input-required { border-color: var(--warn); background: var(--warn-bg); }
.up-mini-note { margin-top: 6px; font-size: 11px; line-height: 1.6; color: var(--warn); }
.up-mini-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }

/* 低信息置顶区 */
.lowinfo-zone, .confirm-zone {
  border: 1px solid var(--warn);
  border-radius: var(--radius-sm);
  background: #FFFFFF;
  padding: 11px 13px;
  margin-bottom: 14px;
}
.confirm-zone { border-color: var(--accent); }
.lowinfo-head, .confirm-head {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em;
  color: var(--warn); margin-bottom: 8px;
}
.confirm-head { color: var(--accent); }
.lowinfo-head svg, .confirm-head svg { width: 13px; height: 13px; }
.lowinfo-row {
  display: flex; align-items: center; gap: 8px;
  width: 100%; text-align: left;
  padding: 7px 9px; border-radius: var(--radius-sm);
  font-size: 12.5px; color: var(--text-mid);
  transition: background .15s;
}
.lowinfo-row:hover { background: var(--warn-bg); }
.confirm-zone .lowinfo-row:hover { background: var(--accent-soft); }
.lowinfo-row > svg { width: 14px; height: 14px; flex-shrink: 0; color: var(--text-low); }
.lowinfo-name { font-weight: 600; color: var(--text-hi); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lowinfo-hint { font-size: 11px; color: var(--warn); margin-left: auto; flex-shrink: 0; }
.lowinfo-hint-accent { color: var(--accent); }
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
