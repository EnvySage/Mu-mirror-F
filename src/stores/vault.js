import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  getVaultItems as apiGetVaultItems,
  uploadVaultItem as apiUploadVaultItem,
  updateVaultItem as apiUpdateVaultItem,
  deleteVaultItem as apiDeleteVaultItem,
} from '@/api/vault'
import { VAULT_TOTAL_BYTES, deriveMockDisplayName, categoryOf } from '@/constants/fileTypes'

/**
 * Vault 资产 store（toolcalling-vault-design.md 3 / 任务书任务 6）
 *
 * 后端（B Agent）VaultService 未就绪：USE_MOCK=true 走 mock（otaku_it 人设：
 * 开题报告 PDF / 宿舍合照 jpg / 一首歌 mp3，贴设计稿第 8 节验收口径）。
 * 接口 ready 后把 USE_MOCK 置 false 即无缝切换，组件零改动。
 *
 * 字段口径（snake_case，与 request.js 拦截器输出一致；mock 同样给 snake_case）：
 * @typedef {Object} VaultItem
 * @property {number|string} id
 * @property {string} display_name     三层渐进名（元数据榨取 → LLM → 用户补正）
 * @property {string} original_name    清洗后原始文件名
 * @property {'document'|'image'|'audio'} category   大类（复用 contentType 口径）
 * @property {string} file_type        扩展名（pdf/jpg/mp3…）
 * @property {number} size_bytes
 * @property {'pending'|'done'|'failed'|'skipped'} digest_status
 * @property {string} description      LLM 理解 / 用户一句话提示
 * @property {number} [chunk_count]    已提取可检索段数（done 时有值）
 * @property {string} [quote]          AI 引用摘录（对话文件卡强引用用）
 * @property {boolean} deleted         前端边界态标记（真删后对话卡置灰演示）
 * @property {string} created_at
 */

/** mock 开关：B Agent /api/vault 就绪后置 false */
const USE_MOCK = true

/** mock 延迟（ms） */
const MOCK_DELAY = 200

/** mock 自增 id 起点（避开真 id） */
let mockSeq = 7000

/** 消化模拟时长（任务 3：上传后 2s 模拟消化完成 → 回执卡） */
export const MOCK_DIGEST_DELAY = 2000

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
 * mock 三件套（otaku_it 人设 · 设计稿第 8 节验收口径）
 * - 开题报告 PDF：done（已提取 12 段）——对话强引用 + 消化回执演示主体
 * - 宿舍合照 jpg：done 半消化——低信息置顶区演示（description 为空引导补描述）
 * - 一首歌 mp3：skipped 零消化——"仅保管"状态演示
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
      digest_status: 'done',
      description: 'RAG 检索方向的毕设开题报告 · 学习资料',
      chunk_count: 12,
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
      digest_status: 'done',
      description: '',
      chunk_count: 0,
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

  /** 已用字节（mock 态按 items 累计；真接口以 quota 为准） */
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

  /** 低信息文件置顶区（description 为空且未删除，"未能识别，请描述一下"） */
  const lowInfoItems = computed(() => items.value.filter(i => !i.deleted && !(i.description || '').trim()))

  /** 消化中数量（上传后 digest_status=pending） */
  const digesting = computed(() => items.value.filter(i => i.digest_status === 'pending').length)

  /**
   * 拉取资产列表（GET /api/vault）
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
        const data = res.data || {}
        items.value = (data.items || []).map(i => ({ ...i, deleted: false }))
        if (data.quota) {
          usedBytes.value = data.quota.used_bytes || 0
          totalBytes.value = data.quota.total_bytes || VAULT_TOTAL_BYTES
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
   * 上传文件（POST /api/vault multipart）
   * mock：validateVaultFile 已在调用侧把关，此处直接造条目进 pending（消化中），
   * 2s 后由 confirmDigest模拟 消化完成 → 消化回执卡。
   * @param {File} file
   * @param {string} [description]
   * @returns {Promise<{ ok: boolean, item?: VaultItem, error?: string }>}
   */
  async function upload(file, description) {
    uploading.value = true
    try {
      if (!USE_MOCK) {
        await apiUploadVaultItem(file, description)
        await fetch()
        return { ok: true }
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
        created_at: new Date().toISOString().slice(0, 10),
        deleted: false,
      }
      items.value.unshift(item)
      recalcQuota()
      source.value = 'mock'
      // mock 消化管道：2s 后完成（图片=半消化 done 0 段；音频=skipped；文本类=done N 段）
      setTimeout(() => {
        const cur = items.value.find(i => i.id === item.id)
        if (!cur || cur.digest_status !== 'pending') return
        if (cur.category === 'audio') {
          cur.digest_status = 'skipped'
          cur.description = cur.description || '音频保管（ID3 元数据）'
        } else if (cur.category === 'image') {
          cur.digest_status = 'done'
          cur.chunk_count = 0
        } else {
          cur.digest_status = 'done'
          cur.chunk_count = 12
        }
        // 消化完成 → 回执卡打开（ChatView 消息流末尾展示，三键纠错；
        // 用户处理（对的/改一改/删了）后由 ChatView 置 false 收卡）
        cur._receiptOpen = true
      }, MOCK_DIGEST_DELAY)
      return { ok: true, item }
    } catch (err) {
      console.error('Failed to upload vault item:', err)
      return { ok: false, error: err.message || '上传失败' }
    } finally {
      uploading.value = false
    }
  }

  /**
   * 更新资产（改一改 / 资产页编辑：display_name/description/category）
   * @param {number|string} id
   * @param {{ display_name?: string, description?: string, category?: string }} data
   * @returns {Promise<boolean>}
   */
  async function update(id, data) {
    try {
      if (!USE_MOCK) await apiUpdateVaultItem(id, data)
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
   * 删除资产（硬删除；级联清 chunks 由后端做）
   * @param {number|string} id
   * @returns {Promise<boolean>}
   */
  async function remove(id) {
    try {
      if (!USE_MOCK) await apiDeleteVaultItem(id)
      items.value = items.value.filter(i => i.id !== id)
      recalcQuota()
      return true
    } catch (err) {
      console.error('Failed to delete vault item:', err)
      error.value = err.message || '删除失败'
      return false
    }
  }

  /**
   * 消化回执确认（[对的] → 定稿；store 层仅标记，无独立端点）
   * @param {number|string} id
   * @returns {Promise<boolean>}
   */
  async function confirmDigest(id) {
    const item = items.value.find(i => i.id === id)
    if (!item) return false
    if (!USE_MOCK) {
      // 真接口：定稿=无字段变化则可不发；保留调用点为以后"确认"落库留位
      return true
    }
    return true
  }

  /** 设置类型筛选（vault 页 chips） */
  function setFilter(kind) {
    filter.value = kind
  }

  return {
    items, filter,
    loading, uploading, error, source,
    usedBytes, totalBytes, quotaPercent, quotaLabel,
    filteredItems, lowInfoItems, digesting,
    fetch, upload, update, remove, confirmDigest, setFilter,
  }
})
