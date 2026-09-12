import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  getVaultItems as apiGetVaultItems,
  uploadVaultItem as apiUploadVaultItem,
  updateVaultItem as apiUpdateVaultItem,
  deleteVaultItem as apiDeleteVaultItem,
  confirmVaultItem as apiConfirmVaultItem,
} from '@/api/vault'
import { VAULT_TOTAL_BYTES } from '@/constants/fileTypes'

/**
 * Vault 资产 store（toolcalling-vault-design.md 3/§3.3b + fix-batch 第十四轮）
 *
 * 确认门禁（§3.3b 用户定稿）：上传 → 自动提取 → extracted（待确认）→ 用户确认
 * （POST /vault/{id}/confirm，key/description/category 可改）→ 才生成 key chunk 进
 * embedding → confirmed（已可检索）。未确认：保管完整可下载预览，检索不到。
 *
 * digest_status 五态（fix-batch B7，done 已被后端迁移）：
 *   pending    排队中（消化管道进行时）
 *   extracted  待确认 · 检索不到（提取完成，等用户确认/补描述）
 *   confirmed  已可检索（用户确认 + 已 embed）
 *   skipped    仅保管（音视频零消化）
 *   failed     读取失败（只按文件名可找）
 *
 * 上传后的消化由后端 @Async 完成：新条目 pending 起步，前端 2s 首查 + 最多 4 次重拉，
 * 到 extracted 时开回执卡（音频 skipped 不开）。
 *
 * 字段口径（snake_case，与 request.js 拦截器输出一致）：
 * @typedef {Object} VaultItem
 * @property {number|string} id
 * @property {string} display_name     展示名（B 契约：originalName 的 snake_case 归一名）
 * @property {string} original_name    清洗后原始文件名
 * @property {'document'|'image'|'audio'} category   大类（后端 kind；category 现为 contentType 口径）
 * @property {string} file_type        扩展名（pdf/jpg/mp3…）
 * @property {number} size_bytes
 * @property {'pending'|'extracted'|'confirmed'|'skipped'|'failed'} digest_status
 * @property {string} description      LLM 理解 / 用户一句话提示
 * @property {number} [chunk_count]    已提取可检索段数（confirmed 后有值）
 * @property {string} [quote]          AI 引用摘录（对话文件卡强引用用）
 * @property {boolean} deleted         前端边界态标记（真删后对话卡置灰演示）
 * @property {string} created_at
 */

/** 消化轮询首查延迟（ms）：后端 digest @Async 秒级，给一次机会再确认 */
const DIGEST_POLL_DELAY = 2000

/** 消化轮询最多重拉次数（超出则停手，回执卡由下次 fetch 驱动） */
const DIGEST_MAX_TRIES = 4

/**
 * 后端 VO → 前端渲染口径归一（camelCase 已被 request.js 拦截器转 snake_case；
 * kind→category 大类、originalName→display_name/original_name、digestChunkCount→chunk_count）
 * @param {Object} raw
 * @returns {VaultItem}
 */
function normalizeItem(raw) {
  return {
    id: raw.id,
    display_name: raw.display_name ?? raw.original_name ?? raw.originalName ?? '未命名文件',
    original_name: raw.original_name ?? raw.originalName ?? '',
    category: raw.kind ?? raw.category ?? 'document',
    file_type: raw.file_type ?? raw.fileType ?? 'file',
    size_bytes: Number(raw.size_bytes ?? raw.sizeBytes ?? 0),
    digest_status: raw.digest_status ?? raw.digestStatus ?? 'pending',
    description: raw.description ?? '',
    chunk_count: raw.chunk_count ?? raw.digestChunkCount ?? 0,
    quota_used_bytes: Number(raw.quota_used_bytes ?? raw.quotaUsedBytes ?? 0),
    quota_bytes: Number(raw.quota_bytes ?? raw.quotaBytes ?? 0),
    created_at: raw.created_at ?? raw.createdAt ?? '',
    deleted: false,
  }
}

export const useVaultStore = defineStore('vault', () => {
  /** @type {import('vue').Ref<VaultItem[]>} */
  const items = ref([])
  const loading = ref(false)
  const uploading = ref(false)
  const error = ref(null)

  /** 已用字节（真接口以每条目 quota_used_bytes 最新值为准） */
  const usedBytes = ref(0)
  /** 总配额 */
  const totalBytes = ref(VAULT_TOTAL_BYTES)

  /** 配额占比（0-100，条形宽度） */
  const quotaPercent = computed(() => {
    const total = Number(totalBytes.value) || 1
    return Math.min(100, Math.round((Number(usedBytes.value) / total) * 1000) / 10)
  })

  /** 已用配额展示行（`已用 15.4MB / 500MB`） */
  const quotaLabel = computed(() => {
    const f = (n) => {
      if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`
      return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)}MB`
    }
    return `已用 ${f(Number(usedBytes.value) || 0)} / ${f(Number(totalBytes.value) || 0)}`
  })

  /** 类型筛选：all / document / image / audio */
  const filter = ref('all')

  /** 筛选后列表（时间倒序） */
  const filteredItems = computed(() => {
    const list = filter.value === 'all'
      ? items.value
      : items.value.filter(i => i.category === filter.value)
    return [...list].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  })

  /** 低信息文件置顶区（未确认且 description 空：extracted 待补描述 / failed 只按名可找） */
  const lowInfoItems = computed(() => items.value.filter(i =>
    !i.deleted
    && !(i.description || '').trim()
    && (i.digest_status === 'extracted' || i.digest_status === 'failed')
  ))

  /** 补确认入口（extracted 态：含描述已填的——确认门禁要求显式确认才可检索） */
  const unconfirmedItems = computed(() => items.value.filter(i =>
    !i.deleted && i.digest_status === 'extracted'
  ))

  /** 消化中数量（上传后 digest_status=pending） */
  const digesting = computed(() => items.value.filter(i => i.digest_status === 'pending').length)

  /**
   * 拉取资产列表（GET /api/vault，裸数组 + 每条带 quota）
   * @returns {Promise<boolean>}
   */
  async function fetch() {
    loading.value = true
    error.value = null
    try {
      const res = await apiGetVaultItems()
      const list = Array.isArray(res.data) ? res.data : (res.data?.items || [])
      items.value = list.map(normalizeItem)
      // 配额：后端在每条目上带最新值，取最大（未上传过时回退本地累计=0）
      const withQuota = items.value.find(i => i.quota_bytes > 0)
      if (withQuota) {
        usedBytes.value = withQuota.quota_used_bytes
        totalBytes.value = withQuota.quota_bytes
      } else {
        recalcQuota()
      }
      return true
    } catch (err) {
      console.error('Failed to fetch vault:', err)
      error.value = err.message || '资产加载失败'
      return false
    } finally {
      loading.value = false
    }
  }

  /** 按 items 重算已用（后端未回 quota 时的兜底，真值以后端 quota 为准） */
  function recalcQuota() {
    usedBytes.value = items.value.reduce((s, i) => s + (Number(i.size_bytes) || 0), 0)
  }

  /**
   * 上传文件（POST /api/vault/upload）
   * 上传返回新条目（pending），消化异步进行 → extracted 时由轮询/重拉呈现回执卡。
   * @param {File} file
   * @param {string} [description]
   * @returns {Promise<{ ok: boolean, item?: VaultItem, error?: string }>}
   */
  async function upload(file, description) {
    uploading.value = true
    try {
      const res = await apiUploadVaultItem(file, description)
      const item = normalizeItem(res.data || {})
      // 上传卡里用户已给的一句话描述立即呈现（后端会落库，本地同步防闪烁）
      if (description && !item.description) item.description = description
      items.value.unshift(item)
      usedBytes.value = item.quota_used_bytes || (usedBytes.value + item.size_bytes)
      if (item.quota_bytes) totalBytes.value = item.quota_bytes
      pollDigestUntilDone(item)
      return { ok: true, item }
    } catch (err) {
      console.error('Failed to upload vault item:', err)
      return { ok: false, error: err.message || '上传失败' }
    } finally {
      uploading.value = false
    }
  }

  /**
   * 上传后等待消化完成（B digest @Async 秒级，但批量上传/SSE 高峰可能滞后，
   * 2s 首查 + 最多 4 次重拉）。状态离开 pending 且 extracted 时开回执卡
   * （音频 skipped 不开）。
   * @param {VaultItem} item
   */
  function pollDigestUntilDone(item) {
    if (item.digest_status !== 'pending') return
    const wait = (delay) => new Promise(r => setTimeout(r, delay))
    ;(async () => {
      await wait(DIGEST_POLL_DELAY)
      for (let i = 0; i < DIGEST_MAX_TRIES; i += 1) {
        const cur = items.value.find(i => i.id === item.id)
        if (!cur || cur.digest_status !== 'pending') {
          if (cur && cur.digest_status === 'extracted') cur._receiptOpen = true
          return
        }
        await fetch()
      }
      // 多次重拉后仍 pending：停止（回执卡由下次 fetch/确认页刷新驱动）
    })()
  }

  /**
   * 更新资产（资产页编辑：description/category；display_name 走 confirm 的 key）
   * @param {number|string} id
   * @param {{ display_name?: string, description?: string, category?: string }} data
   * @returns {Promise<boolean>}
   */
  async function update(id, data) {
    try {
      // B 契约：PUT /vault/{id} 只吃 description/category（display_name 属 confirm 的 key）
      const payload = {}
      if (data.description !== undefined) payload.description = data.description
      if (data.category !== undefined) payload.category = data.category
      await apiUpdateVaultItem(id, payload)
      const item = items.value.find(i => i.id === id)
      if (item) {
        if (data.display_name !== undefined) item.display_name = data.display_name
        if (data.description !== undefined) item.description = data.description
        if (data.category !== undefined) item.category = data.category
      }
      return true
    } catch (err) {
      console.error('Failed to update vault item:', err)
      error.value = err.message || '保存失败'
      return false
    }
  }

  /**
   * 确认消化（§3.3b 确认门禁核心动作；任务 2）
   * POST /vault/{id}/confirm {key, description, category} → 元数据更新 + key chunk embed
   * + 全文 chunks embed → confirmed（HTTP 202 异步；此处以返回的文件卡口径立即更新，
   * embed 落库由后端异步完成）。
   * @param {number|string} id
   * @param {{ key?: string, description?: string, category?: string }} [data] key=展示名可空=保持现名
   * @returns {Promise<boolean>}
   */
  async function confirmDigest(id, data = {}) {
    const item = items.value.find(i => i.id === id)
    try {
      const payload = {}
      if (data.key) payload.key = data.key
      if (data.description !== undefined) payload.description = data.description
      if (data.category) payload.category = data.category
      const res = await apiConfirmVaultItem(id, payload)
      if (res.data) {
        const fresh = normalizeItem(res.data)
        const idx = items.value.findIndex(i => i.id === id)
        if (idx > -1) {
          fresh._receiptOpen = items.value[idx]._receiptOpen
          items.value.splice(idx, 1, fresh)
        }
      } else if (item) {
        item.digest_status = 'confirmed'
      }
      return true
    } catch (err) {
      console.error('Failed to confirm vault item:', err)
      error.value = err.message || '确认失败，稍后可重试'
      return false
    }
  }

  /**
   * 删除资产（Q2 三层防误删；硬删除 + 级联清 chunks 由后端做）
   * @param {number|string} id
   * @param {{ confirmName?: string, inline?: boolean }} [opts]
   *   资产页路径传 confirmName（文件名后四位）；对话内路径传 inline:true
   * @returns {Promise<boolean>}
   */
  async function remove(id, opts = {}) {
    try {
      await apiDeleteVaultItem(id, opts)
      items.value = items.value.filter(i => i.id !== id)
      await fetch()
      return true
    } catch (err) {
      console.error('Failed to delete vault item:', err)
      error.value = err.message || '删除失败'
      return false
    }
  }

  /** 设置类型筛选（vault 页 chips） */
  function setFilter(kind) {
    filter.value = kind
  }

  return {
    items, filter,
    loading, uploading, error,
    usedBytes, totalBytes, quotaPercent, quotaLabel,
    filteredItems, lowInfoItems, unconfirmedItems, digesting,
    fetch, upload, update, remove, confirmDigest, setFilter,
  }
})
