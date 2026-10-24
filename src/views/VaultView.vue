<script setup>
import PageMasthead from '@/components/molecules/PageMasthead.vue'
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
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useVaultStore } from '@/stores/vault'
import { useUIStore } from '@/stores/ui'
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
import { findObjectSource } from '@/composables/useObjectTransition'
import { stableVariant, gsap, duration, createMotionScope, prefersReducedMotion } from '@/motion/core'
import { useListMotion } from '@/motion/useListMotion'

const vault = useVaultStore()
const ui = useUIStore()
const toast = useToastStore()
const vaultRoot = ref(null)
const listMotion = useListMotion(vaultRoot, () => JSON.stringify(vault.filteredItems.map(item => [item.id, item.digest_status, item.description, item.display_name])))
let motionScope
const taskAnimations = new Map()
const folderEl = ref(null)
const acceptanceEl = ref(null)
const reducedMql = window.matchMedia('(prefers-reduced-motion: reduce)')
function settleTaskMotion() {
  if (!reducedMql.matches) return
  taskAnimations.forEach(task => task.animation?.progress(1))
  gsap.killTweensOf([folderEl.value, acceptanceEl.value])
  gsap.set(folderEl.value, { y: dragOver.value ? -9 : 0, rotation: dragOver.value ? 0 : -9 })
  gsap.set(acceptanceEl.value, { opacity: dragOver.value ? 1 : 0, xPercent: dragOver.value ? 0 : -100 })
}

/** 下载中的条目 id（防重复点击） */
const downloadingId = ref(null)

/** 预览模态当前条目（null=关闭；资产卡文件名点击 → FilePreviewModal） */
const previewItem = ref(null)
const previewOrigin = ref(null)

/** 资产卡文件名点击 → 预览（deleted 置灰；digest 状态不拦——保管完整就可看 §3.3b） */
function openPreview(item) {
  if (item.deleted) return
  const source = findObjectSource('asset', item.id)
  const rect = source?.getBoundingClientRect?.()
  previewOrigin.value = rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
  previewItem.value = item
}

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'document', label: '文档' },
  { key: 'image', label: '图片' },
  { key: 'audio', label: '音频' },
]

/** 正在操作（保存/删除/确认）的条目 id */
const busyIds = ref(new Set())
const dirtyAssetIds = ref(new Set())
let uploadBaseline = null
const isUploadDirty = computed(() => !!pendingUpload.value && !!uploadBaseline &&
  JSON.stringify({ description: pendingUpload.value.description, displayName: pendingUpload.value.displayName, category: pendingUpload.value.category }) !== JSON.stringify(uploadBaseline))

function confirmVaultDrafts({ discardAssetIds = null, discardUpload = true } = {}) {
  if (vault.uploading) { toast.info('文件正在上传，完成后再离开'); return false }
  const discardIds = discardAssetIds == null ? new Set(dirtyAssetIds.value) : new Set([...discardAssetIds].map(String))
  const discardPendingUpload = discardUpload && isUploadDirty.value
  if (!discardIds.size && !discardPendingUpload) return true
  if (!window.confirm('资产信息尚未保存。放弃修改并离开吗？')) return false
  const remaining = new Set(dirtyAssetIds.value)
  for (const id of discardIds) remaining.delete(String(id))
  dirtyAssetIds.value = remaining
  if (discardPendingUpload) {
    pendingUpload.value = null
    uploadBaseline = null
  }
  return true
}
const unregisterVaultGuard = ui.registerNavigationGuard('vault-drafts', confirmVaultDrafts)
function onAssetDraftChange({ id, dirty }) {
  const next = new Set(dirtyAssetIds.value)
  dirty ? next.add(String(id)) : next.delete(String(id))
  dirtyAssetIds.value = next
}
function updateBusy(id, value) {
  const next = new Set(busyIds.value)
  value ? next.add(String(id)) : next.delete(String(id))
  busyIds.value = next
}

onMounted(() => {
  motionScope = createMotionScope(vaultRoot.value)
  reducedMql.addEventListener('change', settleTaskMotion)
  vault.fetch()
})

onBeforeUnmount(() => {
  // 离开页面时撤销窗里的延迟删除立即执行（不丢删除意图）
  flushAllPendingDeletes()
  unregisterVaultGuard()
  taskAnimations.forEach(task => { task.animation?.kill(); task.finish() })
  taskAnimations.clear()
  motionScope?.dispose()
  window.removeEventListener('dragend', resetDrag)
  window.removeEventListener('blur', resetDrag)
  reducedMql.removeEventListener('change', settleTaskMotion)
})

// ==================== 上传（投放区 + 校验 + 上传卡） ====================

const fileInput = ref(null)
const dragOver = ref(false)
let dragDepth = 0
function resetDrag() { dragDepth = 0; dragOver.value = false }
onMounted(() => {
  window.addEventListener('dragend', resetDrag)
  window.addEventListener('blur', resetDrag)
})
watch(dragOver, over => {
  motionScope?.run(() => {
    gsap.to(folderEl.value, { y: over ? -9 : 0, rotation: over ? 0 : -9, duration: duration(220), ease: 'power2.out', overwrite: 'auto' })
    gsap.to(acceptanceEl.value, { opacity: over ? 1 : 0, xPercent: over ? 0 : -100, duration: duration(200), ease: 'power2.out', overwrite: 'auto' })
  })
})

/** 待确认上传（上传卡挂载态） */
const pendingUpload = ref(null)
watch(() => !!pendingUpload.value, listMotion.capture, { flush: 'pre' })

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
  if (vault.uploading) return
  fileInput.value?.click()
}

function onPickChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) acceptFile(file)
}

function onDragEnter(e) {
  if (vault.uploading) return
  if (e.dataTransfer?.types && !Array.from(e.dataTransfer.types).includes('Files')) return
  dragDepth += 1
  dragOver.value = true
}

function onDragOver(e) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = vault.uploading ? 'none' : 'copy'
  if (vault.uploading) { resetDrag(); return }
  if (Array.from(e.dataTransfer?.types || []).includes('Files')) dragOver.value = true
}

function onDragLeave(e) {
  dragDepth = Math.max(0, dragDepth - 1)
  if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return
  if (e.relatedTarget || dragDepth === 0) resetDrag()
}

function onDrop(e) {
  resetDrag()
  if (vault.uploading) return
  const file = e.dataTransfer?.files?.[0]
  if (file) acceptFile(file)
}

/** 前端校验（20MB + 白名单 + 拒绝类专属理由）→ 通过弹上传卡 */
function acceptFile(file) {
  if (vault.uploading) return
  if (isUploadDirty.value && !window.confirm('当前上传说明尚未保存。放弃并替换文件吗？')) return
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
  uploadBaseline = { description: '', displayName: deriveDisplayName(file.name), category: v.category }
}

/** 上传卡 [就这样存]（图片空描述按钮禁用，此处防御性双保险） */
async function confirmUpload() {
  if (vault.uploading || !pendingUpload.value || !canConfirmUpload.value) return
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
  uploadBaseline = null
  toast.success('已存入 · 提取后回执卡等你确认', 4200)
}

function cancelUpload() {
  if (vault.uploading) return
  if (isUploadDirty.value && !window.confirm('上传说明尚未保存。放弃这次上传吗？')) return
  pendingUpload.value = null
  uploadBaseline = null
}

function animateTask(element, done, entering) {
  const previous = taskAnimations.get(element)
  previous?.animation?.kill()
  previous?.finish()
  let finished = false
  const task = { finish: () => {
    if (finished) return
    finished = true
    if (taskAnimations.get(element) === task) taskAnimations.delete(element)
    if (!entering && element.classList.contains('upload-wrap')) listMotion.capture()
    done()
  } }
  taskAnimations.set(element, task)
  if (!motionScope || prefersReducedMotion()) { task.finish(); return }
  motionScope.run(() => {
    if (entering) gsap.set(element, { opacity: 0, y: 10 })
    task.animation = gsap.to(element, {
      opacity: entering ? 1 : 0, y: entering ? 0 : -8,
      duration: duration(entering ? 220 : 160), ease: 'power2.out', overwrite: 'auto',
      onComplete: () => { if (entering) gsap.set(element, { clearProps: 'opacity,transform' }); task.finish() },
      onInterrupt: task.finish,
    })
  })
}
const enterTask = (element, done) => animateTask(element, done, true)
const leaveTask = (element, done) => animateTask(element, done, false)
function cancelTask(element) { const task = taskAnimations.get(element); task?.animation?.kill(); task?.finish() }

// ==================== 卡片操作 ====================

/** 保存编辑（confirmed/skipped 卡） */
async function onSave(item, data, done = () => {}) {
  updateBusy(item.id, true)
  const ok = await vault.update(item.id, data)
  updateBusy(item.id, false)
  if (ok) toast.success('已更新')
  else toast.error(vault.error || '保存失败')
  done(ok)
}

/** 补确认（extracted/failed 卡：确认 = key/description/category 提交 confirm 门禁） */
async function onConfirm(item, data, done = () => {}) {
  updateBusy(item.id, true)
  const ok = await vault.confirmDigest(item.id, data)
  updateBusy(item.id, false)
  if (ok) toast.success('已可检索', 3600)
  else toast.error(vault.error || '确认失败')
  done(ok)
}

function setFilter(key) {
  if (key === vault.filter) return
  const matches = item => key === 'all' || item.category === key
  const hiddenDraftIds = [...dirtyAssetIds.value].filter(id => {
    const item = vault.items.find(asset => String(asset.id) === String(id))
    return item && !matches(item)
  })
  if (!confirmVaultDrafts({ discardAssetIds: hiddenDraftIds, discardUpload: false })) return
  vault.setFilter(key)
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
  updateBusy(item.id, true)
  // 从列表移出（视觉上已删），真删推迟到撤销窗结束
  const snapshot = { ...item }
  vault.items = vault.items.filter(i => i.id !== item.id)
  updateBusy(item.id, false)

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
async function focusItem(item) {
  if (!confirmVaultDrafts()) return
  vault.setFilter('all')
  await nextTick()
  const el = vaultRoot.value?.querySelector(`[data-asset-id="${CSS.escape(String(item.id))}"]`)
  if (el) {
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
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
    <div ref="vaultRoot" class="page-content">
      <PageMasthead title="记忆资产" english="MEMORY ARCHIVE" description="把文件与灵感，留在自己的记忆里" />
      <!-- 配额条 -->
      <div class="card quota-card">
        <div class="quota-row">
          <span class="quota-label">{{ vault.quotaLabel }}</span>
          <span v-if="digestSummary" class="quota-sub">{{ digestSummary }}</span>
        </div>
        <div class="quota-bar">
          <div class="quota-fill" :style="{ transform: `scaleX(${vault.quotaPercent / 100})` }" />
        </div>
      </div>

      <!-- 上传投放区（点击/拖拽，dragover 高亮） -->
      <div
        :class="['dropzone', { over: dragOver }]"
        role="button"
        aria-label="上传文件"
        tabindex="0"
        @click="pickFile"
        @keydown.enter="pickFile"
        @keydown.space.prevent="pickFile"
        @dragover.prevent="onDragOver"
        @dragenter.prevent="onDragEnter"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <span ref="acceptanceEl" class="dropzone-acceptance" aria-hidden="true" /><div ref="folderEl" class="vault-folder" aria-hidden="true"><svg viewBox="0 0 120 100" fill="none"><path d="M8 18h36l12 13h54v60H8z" fill="#0b2370" stroke="#50edfa" stroke-width="3"/><path d="M18 43h97L96 91H8z" fill="#50edfa"/><path d="M28 14h47v45H28z" fill="white" transform="rotate(-9 28 14)"/><path d="M18 43h97L96 91H8z" fill="#50edfa" fill-opacity=".85"/></svg></div>
        <div class="dropzone-text"><span class="dropzone-title">让灵感，有处可寻。</span>
          {{ dragOver ? '松开文件，交给 Mirror 整理' : '拖文件进来，或点击选择' }}
          <span class="dropzone-hint">单文件 20MB 内 · {{ VAULT_WHITELIST.join(' / ') }}</span>
        </div>
        <span class="dropzone-plus" aria-hidden="true">＋</span>
        <input ref="fileInput" type="file" hidden @change="onPickChange">
      </div>

      <!-- 上传卡（选文件后弹出，确认才上传；图片必填描述） -->
      <div class="upload-task-slot" :class="{ occupied: pendingUpload }">
      <Transition :css="false" @enter="enterTask" @leave="leaveTask" @enter-cancelled="cancelTask" @leave-cancelled="cancelTask">
      <div v-if="pendingUpload" key="upload-task" class="upload-wrap" :aria-busy="vault.uploading">
        <div class="up-mini">
          <span class="up-mini-icon"><FileTypeIcon :kind="pendingUpload.category || 'file'" /></span>
          <div class="up-mini-body">
            <div class="up-mini-name">{{ pendingUpload.displayName }}</div>
            <div class="up-mini-meta">识别为：{{ categoryLabel(pendingUpload.category) }}</div>
          </div>
        </div>
        <input
          v-model="pendingUpload.description"
          :disabled="vault.uploading"
          :class="['up-mini-input', { 'up-mini-input-required': isImagePending }]"
          :placeholder="descPlaceholder"
          maxlength="100"
        >
        <div v-if="isImagePending" class="up-mini-note">图片内容镜子读不到，一句描述是它被找到的唯一途径</div>
        <div class="upload-task-status" role="status" aria-live="polite"><Transition :css="false" mode="out-in" @enter="enterTask" @leave="leaveTask" @enter-cancelled="cancelTask" @leave-cancelled="cancelTask"><span :key="vault.uploading ? 'uploading' : 'ready'"><span v-if="vault.uploading" class="spinner" />{{ vault.uploading ? '正在存入文件，请稍候…' : '确认信息后存入，提取完成后可补确认' }}</span></Transition></div>
        <div class="up-mini-actions">
          <button class="as-btn as-btn-ghost" :disabled="vault.uploading" @click="cancelUpload">取消</button>
          <button class="as-btn as-btn-primary" :disabled="vault.uploading || !canConfirmUpload" @click="confirmUpload">
            {{ vault.uploading ? '存入中…' : '就这样存' }}
          </button>
        </div>
      </div>

      </Transition>
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
      <div class="archive-heading"><div><span>THE PERSONAL COLLECTION</span><h2>收集，也是生活。</h2></div><strong>{{ String(vault.items.length).padStart(2, '0') }}<small>份记忆资产</small></strong></div>
      <div class="filter-row">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          :class="['chip', { selected: vault.filter === f.key }]"
          :aria-pressed="vault.filter === f.key"
          @click="setFilter(f.key)"
        >{{ f.label }}</button>
      </div>

      <!-- 首次加载才替换卡架；消化轮询保留卡片和未保存编辑。 -->
      <div v-if="vault.loading && !vault.items.length" class="vault-empty"><span class="spinner" /> 加载中…</div>

      <!-- 文件卡列表（时间倒序） -->
      <div v-else-if="vault.filteredItems.length" class="assets-grid">
        <AssetCard
          v-for="item in vault.filteredItems"
          :key="item.id"
          :data-asset-id="item.id"
          :item="item"
          :shelf-variant="['lead', 'cut-a', 'cut-b', 'cut-c'][stableVariant(item.id, 4)]"
          :busy="busyIds.has(String(item.id))"
          @draft-change="onAssetDraftChange"
          @layout-change="listMotion.capture"
          @preview="openPreview"
          @save="(d, done) => onSave(item, d, done)"
          @confirm="(d, done) => onConfirm(item, d, done)"
          @remove="() => onRemove(item)"
          @download="onDownload"
        />
      </div>

      <!-- 空态 / 筛选空 -->
      <div v-else-if="vault.items.length" class="vault-empty">这个分类下还没有文件</div>
      <div v-else class="vault-empty">还没有文件 · 传一个试试，镜子会替你记住它</div>

      <!-- 加载失败兜底 -->
      <div v-if="vault.error" class="vault-error">{{ vault.error }}</div>

      <!-- 文件预览模态（Teleport to body；资产卡预览入口） -->
      <FilePreviewModal
        v-if="previewItem"
        :key="previewItem.id"
        :item="previewItem"
        :origin="previewOrigin"
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
  padding: 10px 18px var(--page-bottom-clearance);
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
  background: var(--accent); width:100%; transform-origin:left center; transition:transform .24s ease;
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

.dropzone-acceptance { position:absolute; inset:0; pointer-events:none; opacity:0; transform:translateX(-100%); background:linear-gradient(110deg,#50edfa22,#50edfa08 68%,transparent); }
.upload-task-slot { position:relative; }
.upload-task-slot.occupied { min-height:236px; }
.upload-wrap { min-height:220px; }
.upload-task-status { min-height:30px; display:flex; align-items:center; color:var(--text-mid); font-size:11px; margin-top:6px; }
.upload-task-status > span { display:inline-flex; align-items:center; gap:7px; }
.upload-task-status .spinner { width:12px; height:12px; }
@media(prefers-reduced-motion:reduce){.quota-fill,.dropzone{transition:none}.vault-folder,.dropzone-acceptance{transition:none}}

/* 上传卡（复用上传卡视觉，精简版挂列表顶部） */
.upload-wrap {
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: #FFFFFF;
  padding: 12px;
  margin-bottom: 14px;
  clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,0 100%);
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

.vault-page .page-content { padding:0 clamp(18px,3vw,48px) 40px; max-width:1440px; width:100%; margin:0 auto; }
.quota-card { background:#0a245f; border:1px solid #629bdf40; box-shadow:none; color:white; padding:14px 20px; margin-bottom:18px; }
.quota-label { color:#d0e5ff; font-family:var(--font); font-size:11px; }.quota-sub{color:#9ebde9}.quota-bar{background:#264578;height:4px;border-radius:0}.quota-fill{background:var(--cyan);border-radius:0}
.dropzone { position:relative; min-height:170px; padding:14px 24px; gap:18px; border:1px solid #7dd8ff80; border-left:5px solid var(--cyan); border-radius:2px; color:white; background:#0a3aab; overflow:hidden; clip-path:polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,0 100%); transition:border-color .2s,background .2s,box-shadow .2s; }
.dropzone.over { box-shadow:10px 12px 0 #50edfa55,-6px 5px 0 #f03c8a55; }
.dropzone::before { content:''; position:absolute; inset:0; background:url('/art/water-surface.webp') center / cover; opacity:.22; pointer-events:none; }
.dropzone:hover,.dropzone.over { background:#1049c1; border-color:var(--cyan); }
.vault-folder { position:relative; width:76px; flex-shrink:0; transform:rotate(-9deg); }.vault-folder svg{display:block;width:100%}
.dropzone-text { position:relative; font-size:12px; gap:5px; }.dropzone-title{font-size:22px;font-weight:900;letter-spacing:-.035em;margin-bottom:2px}.dropzone-hint{font:10px/1.5 var(--font);color:#b5d8ff}
.dropzone-plus{position:relative;margin-left:auto;color:var(--cyan);font:42px/1 var(--font-display);padding:10px}
.filter-row{margin:22px 0 18px;padding-bottom:16px;border-bottom:1px solid #80b9ff45}.filter-row .chip{border-radius:2px;background:#0b275f;color:#c4dbff;box-shadow:none;border:1px solid #6893ce60;padding:7px 17px}.filter-row .chip.selected{background:var(--cyan);color:var(--night);border-color:var(--cyan);font-weight:800;transform:skew(-7deg)}
.vault-empty { color:#bed4f5; }.confirm-zone,.lowinfo-zone{border-radius:2px}.quota-card + .dropzone{margin-top:0}
.assets-grid :deep(.asset-layout) { min-width:0; margin:0; }
.assets-grid { position:relative; display:grid; grid-template-columns:minmax(0,1fr); gap:18px 22px; align-items:start; }
.assets-grid :deep(.asset-card) { min-width:0; margin:0; min-height:220px; padding:22px; position:relative; background:#f8fbff; border:1px solid #d4e2ff; border-top:4px solid #50edfa; box-shadow:7px 9px 0 #50edfa38,-5px 5px 0 #f03c8a40; transition:box-shadow .2s,border-color .2s,opacity .2s; clip-path:polygon(0 0,calc(100% - 28px) 0,100% 28px,100% 100%,15px 100%,0 calc(100% - 15px)); }
.assets-grid :deep(.asset-card::before) { content:''; position:absolute; top:0; right:0; width:45px; height:42px; background:linear-gradient(135deg,#50edfa,#ee246a); clip-path:polygon(0 0,100% 0,100% 100%); opacity:.85; pointer-events:none; }
.assets-grid :deep(.asset-layout.shelf-lead) { grid-column:span 7; }
.assets-grid :deep(.asset-card.shelf-lead) { min-height:276px; padding:26px 30px; border-top-color:#ee246a; background:linear-gradient(118deg,#f8fbff 0 84%,#dbfaff 84% 100%); clip-path:polygon(0 0,calc(100% - 54px) 0,100% 54px,100% 100%,24px 100%,0 calc(100% - 24px)); box-shadow:10px 13px 0 #50edfa48,-7px 7px 0 #f03c8a60; }
.assets-grid :deep(.asset-layout.shelf-cut-a) { grid-column:span 5; margin-top:34px; }
.assets-grid :deep(.asset-card.shelf-cut-a) { clip-path:polygon(25px 0,100% 0,100% calc(100% - 30px),calc(100% - 30px) 100%,0 100%,0 25px); }
.assets-grid :deep(.asset-layout.shelf-cut-b) { grid-column:span 4; margin-left:8%; margin-top:12px; }
.assets-grid :deep(.asset-card.shelf-cut-b) { background:#e9f2ff; clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%); }
.assets-grid :deep(.asset-layout.shelf-cut-c) { grid-column:span 4; margin-right:8%; margin-top:38px; }
.assets-grid :deep(.asset-card.shelf-cut-c) { border-top-color:#ee246a; clip-path:polygon(0 0,100% 0,100% calc(100% - 24px),calc(100% - 24px) 100%,0 100%); }
.assets-grid :deep(.asset-card:hover) { box-shadow:11px 15px 0 #50edfa75,-8px 8px 0 #f03c8a70; border-color:#50edfa; }
.assets-grid :deep(.asset-layout.is-editing) { grid-column:1/-1; margin:0; }
.assets-grid :deep(.asset-card.is-editing) { min-height:unset; clip-path:none; box-shadow:8px 10px 0 #50edfa40,-6px 5px 0 #f03c8a35; }
.assets-grid :deep(.as-name) { white-space:normal; overflow-wrap:anywhere; line-height:1.5; }
@media(min-width:700px) and (max-width:1279px){.assets-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.assets-grid :deep(.asset-layout.shelf-lead){grid-column:span 2}.assets-grid :deep(.asset-card.shelf-lead){min-height:240px}.assets-grid :deep(.asset-layout.shelf-cut-a){grid-column:span 1;margin-top:0}.assets-grid :deep(.asset-layout.shelf-cut-b),.assets-grid :deep(.asset-layout.shelf-cut-c){grid-column:span 1;margin:20px 0 0}.assets-grid :deep(.asset-layout.is-editing){grid-column:1/-1;margin:0}}
@media(min-width:1280px){.assets-grid{grid-template-columns:repeat(12,minmax(0,1fr))}}
@media(max-width:699px){.assets-grid :deep(.asset-layout){grid-column:1/-1!important;margin:0!important;width:100%}.assets-grid :deep(.asset-card){width:100%;min-height:unset;padding:18px 17px}.assets-grid :deep(.asset-card.shelf-lead){min-height:210px}}
@media(max-width:599px){.dropzone{padding:24px 18px;gap:15px;min-height:170px}.vault-folder{width:65px}.dropzone-title{font-size:20px}.dropzone-plus{display:none}.dropzone-text{font-size:11px}.filter-row .chip{padding:7px 12px}.quota-card{padding:13px 16px}.dropzone-hint{font-size:9px}}
</style>
<style scoped src="@/assets/styles/persona-vault.css"></style>
