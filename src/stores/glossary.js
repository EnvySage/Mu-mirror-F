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
 * 后端（B Agent）接口未就绪：USE_MOCK=true 走 mock（otaku_it 人设，
 * mock 数据贴合设计稿第 7 节验收口径——"论文/毕设/RAG/游戏"词条）。
 * 接口 ready 后把 USE_MOCK 置 false 即无缝切换，组件与两处 UI 零改动。
 *
 * 字段口径（snake_case，与 request.js 拦截器输出一致；mock 路径同样给 snake_case）：
 * @typedef {Object} Term
 * @property {number|string} id
 * @property {string} term            词条名（"论文"）
 * @property {string[]} aliases       别名（["毕设","那个设计"]）
 * @property {string} description     AI 理解（含来源依据，用户可判断）
 * @property {'new'|'evidence'|'update'} [kind]   候选分级（pending 专用）
 * @property {string} [evidence]      佐证摘要（"近 14 天出现 3 次"）
 * @property {number} [query_hit_count]  用户提问命中（注入优先级）
 * @property {number} [content_hit_count] 入库内容命中（活跃度）
 * @property {number|string|null} [source_chunk_id] 佐证来源记录 id（跳记录详情）
 * @property {string} [last_confirmed_at] 最后确认时间（ISO / yyyy-MM-dd）
 * @property {string} [last_seen_at]  最近一次语料出现
 * @property {'pending'|'confirmed'|'dismissed'} status
 */

/** mock 开关：B Agent 接口就绪（GET /api/glossary 返回 200）后置 false */
const USE_MOCK = true

/** mock 延迟（ms），模拟网络 + 让 loading 态可见 */
const MOCK_DELAY = 160

/** mock 自增 id 起点（避开与真 id 混淆） */
let mockSeq = 9000

/**
 * mock 三组数据（otaku_it 人设 · 验收口径词条）
 * last_confirmed_at / last_seen_at 相对今天生成，卡片文案随日期滚动
 */
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildMockGroups() {
  return {
    pending: [
      {
        id: ++mockSeq,
        term: '论文',
        aliases: ['毕设', '那个设计'],
        description: '你的毕业设计《AI 日记镜子系统》，RAG 检索方向，最近在补检索评测。',
        kind: 'new',
        evidence: '近 14 天出现 5 次',
        query_hit_count: 0,
        content_hit_count: 5,
        source_chunk_id: 93,
        last_seen_at: daysAgo(1),
        status: 'pending',
      },
      {
        id: ++mockSeq,
        term: '游戏',
        aliases: ['FGO'],
        description: '8 月起多指 FGO，3-7 月指明日方舟——解释已漂移，建议按新含义更新。',
        kind: 'update',
        evidence: '近 14 天出现 3 次',
        query_hit_count: 2,
        content_hit_count: 3,
        source_chunk_id: 92,
        last_seen_at: daysAgo(2),
        status: 'pending',
      },
      {
        id: ++mockSeq,
        term: '面试',
        aliases: [],
        description: 'AI 公司的前端岗面试，你说"那边"时通常指这家。',
        kind: 'evidence',
        evidence: '已有候选 · 证据 +1（近 14 天出现 2 次）',
        query_hit_count: 0,
        content_hit_count: 2,
        source_chunk_id: 91,
        last_seen_at: daysAgo(3),
        status: 'pending',
      },
    ],
    confirmed: [
      {
        id: ++mockSeq,
        term: 'RAG',
        aliases: ['检索增强'],
        description: '检索增强生成：先从你的记录里捞相关片段，再让模型按片段回答。',
        kind: 'new',
        query_hit_count: 7,
        content_hit_count: 9,
        source_chunk_id: 93,
        last_confirmed_at: daysAgo(6),
        last_seen_at: daysAgo(1),
        status: 'confirmed',
      },
      {
        id: ++mockSeq,
        term: 'book',
        aliases: ['那本书'],
        description: '你正在读的《置身事内》，最近在读第 4 章。',
        kind: 'new',
        query_hit_count: 3,
        content_hit_count: 4,
        source_chunk_id: 91,
        last_confirmed_at: daysAgo(20),
        last_seen_at: daysAgo(4),
        status: 'confirmed',
      },
    ],
    dismissed: [
      {
        id: ++mockSeq,
        term: '周报',
        aliases: [],
        description: '每周五写的工作周报（此前被忽略，30 天后可重新浮现）。',
        kind: 'new',
        query_hit_count: 0,
        content_hit_count: 1,
        source_chunk_id: null,
        last_seen_at: daysAgo(12),
        status: 'dismissed',
      },
    ],
  }
}

/** 深拷贝（mock 增删改作用于副本，页面刷新即还原） */
function cloneGroups() {
  return JSON.parse(JSON.stringify(buildMockGroups()))
}

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

  /** 数据来源标记（mock / live） */
  const source = ref(null)

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
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, MOCK_DELAY))
        const groups = cloneGroups()
        pending.value = groups.pending
        confirmed.value = groups.confirmed
        dismissed.value = groups.dismissed
        source.value = 'mock'
      } else {
        const res = await apiGetGlossary()
        const data = res.data || {}
        pending.value = data.pending || []
        confirmed.value = data.confirmed || []
        dismissed.value = data.dismissed || []
        source.value = 'live'
      }
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
      if (!USE_MOCK) await apiConfirmTerm(id)
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
      if (!USE_MOCK) await apiDismissTerm(id)
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
      if (!USE_MOCK) await apiUpdateTerm(id, data)
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
      if (!USE_MOCK) await apiDeleteTerm(id)
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
      if (!USE_MOCK) {
        const res = await apiAddTerm(data)
        if (res.data) {
          confirmed.value.unshift(res.data)
          return true
        }
      }
      confirmed.value.unshift({
        id: ++mockSeq,
        term: data.term,
        aliases: data.aliases || [],
        description: data.description,
        kind: 'new',
        query_hit_count: 0,
        content_hit_count: 0,
        source_chunk_id: null,
        last_confirmed_at: new Date().toISOString().slice(0, 10),
        last_seen_at: new Date().toISOString().slice(0, 10),
        status: 'confirmed',
      })
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
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 600))
        // mock：没有更多新词可抽——原样保留（抽取任务的噪音兜底是去重窗，
        // 30 天内已处理词不重复提，所以多数时候 extract 不新增候选）
        source.value = 'mock'
        return true
      }
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
    loading, extracting, error, source,
    pendingCount,
    fetch, confirm, dismiss, update, remove, add, extract,
  }
})
