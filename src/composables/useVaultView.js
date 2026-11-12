import PageMasthead from '@/components/molecules/PageMasthead.vue'
import { reportAchievementActivity } from '@/api/achievements'
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

export function useVaultView() {
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

return { PageMasthead, reportAchievementActivity, ref, AssetCard, FilePreviewModal, FileTypeIcon, VAULT_WHITELIST, categoryLabel, stableVariant, vault, vaultRoot, listMotion, folderEl, acceptanceEl, previewItem, previewOrigin, openPreview, FILTERS, busyIds, onAssetDraftChange, fileInput, dragOver, pendingUpload, isImagePending, canConfirmUpload, descPlaceholder, pickFile, onPickChange, onDragEnter, onDragOver, onDragLeave, onDrop, confirmUpload, cancelUpload, enterTask, leaveTask, cancelTask, onSave, onConfirm, setFilter, onRemove, onDownload, focusItem, digestSummary }
}
