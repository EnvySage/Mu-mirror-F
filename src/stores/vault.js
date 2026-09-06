import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  getVaultItems as apiGetVaultItems,
  uploadVaultItem as apiUploadVaultItem,
  updateVaultItem as apiUpdateVaultItem,
  deleteVaultItem as apiDeleteVaultItem,
  confirmVaultItem as apiConfirmVaultItem,
} from '@/api/vault'
import { VAULT_TOTAL_BYTES, deriveMockDisplayName, categoryOf } from '@/constants/fileTypes'

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
 * mock 态（USE_MOCK=true）保留同构演示流：上传 pending → 2s extracted →
 * confirm 1s → confirmed；接真接口开关置 false 组件零改动。
 *
 * 字段口径（snake_case，与 request.js 拦截器输出一致；mock 同样给 snake_case）：
 * @typedef {Object} VaultItem
 * @property {number|string} id
 * @property {string} display_name     展示名（B 契约：originalName 的 snake_case 归一名；
 *                                     mock 与真接口统一用 display_name 渲染）
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

/** mock 开关：B vault REST + 确认端点已上线（fix-batch B6/B7），置 false 走真接口 */
const USE_MOCK = false

/** mock 延迟（ms） */
const MOCK_DELAY = 200

/** mock 自增 id 起点（避开真 id） */
let mockSeq = 7000

/** mock 消化时长（上传后 pending，2s 后转 extracted 出回执卡） */
export const MOCK_DIGEST_DELAY = 2000

/** mock 确认时长（confirm 1s 延迟改状态，任务 2 口径） */
export const MOCK_CONFIRM_DELAY = 1000

/**
 * x天前的 ISO 日期串（yyyy-MM-dd）
 * @param {number} n
 * @returns {string}
 */
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

/**
 * mock 三件套（otaku_it 人设 · 五态演示口径）
 * - 开题报告 PDF：confirmed（已确认可检索 12 段）——对话强引用主体
 * - 宿舍合照 jpg：extracted 描述为空——低信息置顶区 + 确认门禁演示
 * - 一首歌 mp3：skipped 零消化——"仅保管"状态
 * - 扫描件 PDF：failed——读取失败演示
 */
function buildMockItems() {
  return [
    {
      id: ++mockSeq,
      display_name: '毕业论文-开题报告',
      original_name: 'a3f9c2e1-开题报告_final_v2.pdf',
      category: 'document',
      file_type: 'pdf',
      size_bytes: 2.1 * 1024 * 1024,
      digest_status: 'confirmed',
      description: 'RAG 检索方向的毕设开题报告 · 学习资料',
      chunk_count: 12,
      quota_used_bytes: 0,
      quota_bytes: 0,
      created_at: daysAgo(4),
      deleted: false,
    },
    {
      id: ++mockSeq,
      display_name: 'IMG_0901 宿舍合照',
      original_name: 'IMG_20260901_2214.jpg',
      category: 'image',
      file_type: 'jpg',
      size_bytes: 3.4 * 1024 * 1024,
      digest_status: 'extracted',
      description: '',
      chunk_count: 0,
      quota_used_bytes: 0,
      quota_bytes: 0,
      created_at: daysAgo(3),
      deleted: false,
    },
    {
      id: ++mockSeq,
      display_name: '夜空中最亮的星 (Live)',
      original_name: 'song_09.mp3',
      category: 'audio',
      file_type: 'mp3',
      size_bytes: 8.7 * 1024 * 1024,
      digest_status: 'skipped',
      description: '逃跑计划 · 音频保管（ID3 元数据）',
      chunk_count: 0,
      quota_used_bytes: 0,
      quota_bytes: 0,
      created_at: daysAgo(9),
      deleted: false,
    },
    {
      id: ++mockSeq,
      display_name: '扫描件_0042',
      original_name: 'scan_0042.pdf',
      category: 'document',
      file_type: 'pdf',
      size_bytes: 1.2 * 1024 * 1024,
      digest_status: 'failed',
      description: '',
      chunk_count: 0,
      quota_used_bytes: 0,
      quota_bytes: 0,
      created_at: daysAgo(6),
      deleted: false,
    },
  ]
}

export const useVaultStore = defineStore('vault', () => {
  /** @type {import('vue').Ref<VaultItem[]>} */
  const items = ref([])
  const loading = ref(false)
  const uploading = ref(false)
  const error = ref(null)
  /** 数据来源标记（mock / live） */
  const source = ref(null)

  /** 已用字节（真接口以每条目 quota_used_bytes 最新值为准；mock 按 items 累计） */
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
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, MOCK_DELAY))
        items.value = buildMockItems()
        recalcQuota()
        source.value = 'mock'
      } else {
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
        source.value = 'live'
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

  /** mock 态按 items 重算已用（真接口以后端 quota 为准） */
  function recalcQuota() {
    usedBytes.value = items.value.reduce((s, i) => s + (Number(i.size_bytes) || 0), 0)
  }

  /**
   * 上传文件（POST /api/vault/upload）
   * 真接口：上传返回新条目（pending），消化异步进行 → extracted 时由轮询/重拉呈现回执卡；
   * mock：本地造条目 pending，2s 后转 extracted 开回执卡。
   * @param {File} file
   * @param {string} [description]
   * @returns {Promise<{ ok: boolean, item?: VaultItem, error?: string }>}
   */
  async function upload(file, description) {
    uploading.value = true
    try {
      if (!USE_MOCK) {
        const res = await apiUploadVaultItem(file, description)
        const item = normalizeItem(res.data || {})
        // 上传卡里用户已给的一句话描述立即呈现（后端会落库，本地同步防闪烁）
        if (description && !item.description) item.description = description
        items.value.unshift(item)
        usedBytes.value = item.quota_used_bytes || (usedBytes.value + item.size_bytes)
        if (item.quota_bytes) totalBytes.value = item.quota_bytes
        source.value = 'live'
        scheduleMockDigestIfAny(item)
        return { ok: true, item }
      }
      await new Promise(r => setTimeout(r, MOCK_DELAY))
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      const item = {
        id: ++mockSeq,
        display_name: deriveMockDisplayName(file.name),
        original_name: file.name,
        category: categoryOf(ext) || 'document',
        file_type: ext,
        size_bytes: file.size,
        digest_status: 'pending',
        description: description || '',
        chunk_count: 0,
        quota_used_bytes: 0,
        quota_bytes: 0,
        created_at: new Date().toISOString().slice(0, 10),
        deleted: false,
      }
      items.value.unshift(item)
      recalcQuota()
      source.value = 'mock'
      scheduleMockDigestIfAny(item)
      return { ok: true, item }
    } catch (err) {
      console.error('Failed to upload vault item:', err)
      return { ok: false, error: err.message || '上传失败' }
    } finally {
      uploading.value = false
    }
  }

  /**
   * 上传后等待消化完成（真接口：B digest @Async 秒级，但批量上传/SSE 高峰可能滞后，
   * 2s 首查 + 最多 4 次重拉；mock：2s 后本地翻转状态）。状态离开 pending 且
   * extracted 时开回执卡（音频 skipped 不开）。
   * @param {VaultItem} item
   */
  function scheduleMockDigestIfAny(item) {
    if (!USE_MOCK && item.digest_status !== 'pending') return
    const waitAndCheck = (delay) => new Promise(r => setTimeout(r, delay))
    ;(async () => {
      await waitAndCheck(MOCK_DIGEST_DELAY)
      const maxTries = USE_MOCK ? 1 : 4
      for (let i = 0; i < maxTries; i += 1) {
        const cur = items.value.find(i => i.id === item.id)
        if (!cur || cur.digest_status !== 'pending') {
          if (cur && cur.digest_status === 'extracted') cur._receiptOpen = true
          return
        }
        if (USE_MOCK) {
          if (cur.category === 'audio') {
            cur.digest_status = 'skipped'
            cur.description = cur.description || '音频保管（ID3 元数据）'
          } else {
            // 文本/图片如实 extracted：等用户确认才可检索（§3.3b）
            cur.digest_status = 'extracted'
          }
          cur._receiptOpen = true
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
      if (!USE_MOCK) {
        // B 契约：PUT /vault/{id} 只吃 description/category（display_name 属 confirm 的 key）
        const payload = {}
        if (data.description !== undefined) payload.description = data.description
        if (data.category !== undefined) payload.category = data.category
        await apiUpdateVaultItem(id, payload)
      }
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
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, MOCK_CONFIRM_DELAY))
        if (item) {
          if (data.key) item.display_name = data.key
          if (data.description !== undefined) item.description = data.description
          if (data.category) item.category = data.category
          if (item.digest_status !== 'skipped') {
            item.digest_status = 'confirmed'
            item.chunk_count = item.chunk_count || 12
          } else {
            item.digest_status = 'confirmed'
          }
        }
        return true
      }
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
      if (!USE_MOCK) await apiDeleteVaultItem(id, opts)
      items.value = items.value.filter(i => i.id !== id)
      if (USE_MOCK) recalcQuota()
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
    loading, uploading, error, source,
    usedBytes, totalBytes, quotaPercent, quotaLabel,
    filteredItems, lowInfoItems, unconfirmedItems, digesting,
    fetch, upload, update, remove, confirmDigest, setFilter,
  }
})
