import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  getGlossary as apiGetGlossary,
  addTerm as apiAddTerm,
  updateTerm as apiUpdateTerm,
  deleteTerm as apiDeleteTerm,
  confirmTerm as apiConfirmTerm,
  dismissTerm as apiDismissTerm,
  extractTerms as apiExtractTerms,
} from '@/api/glossary'

/**
 * 个人词典 store（lexicon-design.md 1/5a/5b/5c）
 *
 * 数据来源：B Agent 词典七端点（GET/POST/PUT/DELETE/confirm/dismiss/extract），
 * 见 api/glossary.js。
 *
 * 字段口径（snake_case，与 request.js 拦截器输出一致）：
 * @typedef {Object} Term
 * @property {number|string} id
 * @property {string} term            词条名（"论文"）
 * @property {string[]} aliases       别名（["毕设","那个设计"]）
 * @property {string} description     AI 理解（含来源依据，用户可判断）
 * @property {'new'|'evidence'|'update'} [kind]   候选分级（pending 专用）
 * @property {string} [evidence]      佐证摘要（"近 14 天出现 3 次"）
 * @property {number} [query_hit_count]  用户提问命中（注入优先级）
 * @property {number} [content_hit_count] 入库内容命中（活跃度）
 * @property {number|string|null} [source_chunk_id] 佐证来源 chunks 主键（不等同记录 id，勿用于跳详情）
 * @property {number|string|null} [source_record_id] 佐证所属记录 id（records 主键，跳记录详情用这个）
 * @property {string} [last_confirmed_at] 最后确认时间（ISO / yyyy-MM-dd）
 * @property {string} [last_seen_at]  最近一次语料出现
 * @property {'pending'|'confirmed'|'dismissed'} status
 */

export const useGlossaryStore = defineStore('glossary', () => {
  /** @type {import('vue').Ref<Term[]>} */
  const pending = ref([])
  /** @type {import('vue').Ref<Term[]>} */
  const confirmed = ref([])
  /** @type {import('vue').Ref<Term[]>} */
  const dismissed = ref([])

  const loading = ref(false)
  const extracting = ref(false)
  /** 加载/操作失败信息（透出给调用方 toast） */
  const error = ref(null)

  /** pending 数量（侧栏设置图标角标） */
  const pendingCount = computed(() => pending.value.length)

  /** 将词条移入对应分组（确认后从 pending 摘除，confirmed 插到最前） */
  function moveTo(term, to) {
    const fromList = { pending, confirmed, dismissed }[term.status] || pending
    const idx = fromList.value.findIndex(t => t.id === term.id)
    if (idx !== -1) fromList.value.splice(idx, 1)
    const target = { pending, confirmed, dismissed }[to]
    term.status = to
    if (target && !target.value.some(t => t.id === term.id)) {
      target.value.unshift(term)
    }
  }

  /**
   * 拉取词条三组（GET /api/glossary）
   * @returns {Promise<boolean>} 是否成功
   */
  async function fetch() {
    loading.value = true
    error.value = null
    try {
      const res = await apiGetGlossary()
      const data = res.data || {}
      pending.value = data.pending || []
      confirmed.value = data.confirmed || []
      dismissed.value = data.dismissed || []
      return true
    } catch (err) {
      console.error('Failed to fetch glossary:', err)
      error.value = err.message || '词典加载失败'
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 确认词条（pending/dismissed → confirmed）
   * @param {number|string} id
   * @returns {Promise<boolean>}
   */
  async function confirm(id) {
    const term = pending.value.find(t => t.id === id) || dismissed.value.find(t => t.id === id)
    try {
      await apiConfirmTerm(id)
      if (term) {
        term.last_confirmed_at = new Date().toISOString().slice(0, 10)
        moveTo(term, 'confirmed')
      }
      return true
    } catch (err) {
      console.error('Failed to confirm term:', err)
      error.value = err.message || '确认失败'
      return false
    }
  }

  /**
   * 忽略词条（→ dismissed，30 天后可重新浮现）
   * @param {number|string} id
   * @returns {Promise<boolean>}
   */
  async function dismiss(id) {
    const term = pending.value.find(t => t.id === id) || confirmed.value.find(t => t.id === id)
    try {
      await apiDismissTerm(id)
      if (term) moveTo(term, 'dismissed')
      return true
    } catch (err) {
      console.error('Failed to dismiss term:', err)
      error.value = err.message || '操作失败'
      return false
    }
  }

  /**
   * 编辑词条（改一改保存 / 已生效词更新解释）
   * @param {number|string} id
   * @param {{ term: string, aliases: string[], description: string }} data
   * @returns {Promise<boolean>}
   */
  async function update(id, data) {
    const all = [...pending.value, ...confirmed.value, ...dismissed.value]
    const term = all.find(t => t.id === id)
    try {
      await apiUpdateTerm(id, data)
      if (term) {
        term.term = data.term
        term.aliases = data.aliases || []
        term.description = data.description
      }
      return true
    } catch (err) {
      console.error('Failed to update term:', err)
      error.value = err.message || '保存失败'
      return false
    }
  }

  /**
   * 删除词条（已忽略组；dismissed 只沉底不删行，删除是显式清理）
   * @param {number|string} id
   * @returns {Promise<boolean>}
   */
  async function remove(id) {
    try {
      await apiDeleteTerm(id)
      for (const list of [pending, confirmed, dismissed]) {
        const idx = list.value.findIndex(t => t.id === id)
        if (idx !== -1) {
          list.value.splice(idx, 1)
          break
        }
      }
      return true
    } catch (err) {
      console.error('Failed to delete term:', err)
      error.value = err.message || '删除失败'
      return false
    }
  }

  /**
   * 手动新增词条（"教镜子一个词"，直接 confirmed）
   * @param {{ term: string, aliases: string[], description: string }} data
   * @returns {Promise<boolean>}
   */
  async function add(data) {
    try {
      const res = await apiAddTerm(data)
      if (res.data) {
        confirmed.value.unshift(res.data)
        return true
      }
      // 端点未回实体：重拉三组，以服务端为准
      await fetch()
      return true
    } catch (err) {
      console.error('Failed to add term:', err)
      error.value = err.message || '新增失败'
      return false
    }
  }

  /**
   * 手动触发抽取（POST /api/glossary/extract，懒人立即出候选）
   * 成功后用返回的新候选替换 pending（后端契约未定则重拉全量）
   * @returns {Promise<boolean>}
   */
  async function extract() {
    extracting.value = true
    error.value = null
    try {
      const res = await apiExtractTerms()
      const candidates = res.data?.candidates || res.data || []
      if (Array.isArray(candidates) && candidates.length) {
        pending.value = candidates
      } else {
        await fetch()
      }
      return true
    } catch (err) {
      console.error('Failed to extract terms:', err)
      error.value = err.message || '抽取失败'
      return false
    } finally {
      extracting.value = false
    }
  }

  return {
    pending, confirmed, dismissed,
    loading, extracting, error,
    pendingCount,
    fetch, confirm, dismiss, update, remove, add, extract,
  }
})
