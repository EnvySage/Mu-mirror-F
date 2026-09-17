import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getSummaries as apiGetSummaries,
  regenerateSummary as apiRegenerateSummary,
  backfillSummaries as apiBackfillSummaries,
  getMissingSummaries as apiGetMissingSummaries,
} from '@/api/summary'

/**
 * 每日总结 store（GET /api/summaries，设计文档 6.7）
 *
 * 日报按天无限累积，接口已改为游标分页（limit + before），禁止全量拉取：
 *  - 记录页侧栏只需要最近 7 篇 → fetchList({ limit: 7 })
 *  - 「全部」弹窗按 10 篇一屏 + 触底 fetchMore 向下翻
 *
 * 列表（不带 date）：content 为空、highlights 为前 3 行摘要。
 * 单篇（带 date）：含全文 content，拉回后合并进列表。
 *
 * @typedef {Object} DailySummary
 * @property {number} record_id - 系统记录 ID（records.id，source='system'）
 * @property {string} summary_date - 日报锚定日期（YYYY-MM-DD）
 * @property {string|null} content - 日报全文（列表接口为 null）
 * @property {Record<string, any>} stats - 统计信息（metadata：recordCount 等）
 * @property {string} created_at - 生成时间（yyyy-MM-dd HH:mm:ss）
 * @property {string[]|null} highlights - 摘要行（单篇接口为 null）
 */

/** 侧栏口径：默认只取最近 7 篇 */
const DEFAULT_LIMIT = 7

export const useSummariesStore = defineStore('summaries', () => {
  /** @type {import('vue').Ref<DailySummary[]>} */
  const list = ref([])
  const loading = ref(false)
  const detailLoading = ref(false)
  /** 加载失败信息（后端未起时透出兜底文案，不白屏） */
  const error = ref(null)
  /** 是否还有更早的日报（上一页返回条数 < limit 即到底） */
  const hasMore = ref(true)
  /** 正在加载下一页 */
  const loadingMore = ref(false)
  /** 正在补生成/重生成的日期（YYYY-MM-DD），空串表示没有 */
  const regeneratingDate = ref('')
  /** 正在回溯补生成 */
  const backfilling = ref(false)
  /** 「有记录但缺日报」的日期（yyyy-MM-dd，新→旧）——补生成入口的数据源 */
  const missingDates = ref([])
  /** 当前页大小（fetchMore 沿用，保证前后页同口径） */
  let pageSize = DEFAULT_LIMIT

  /**
   * 拉取日报列表（覆盖式，新→旧）
   * @param {Object} [opts]
   * @param {number} [opts.limit=7] - 每页条数
   */
  async function fetchList({ limit = DEFAULT_LIMIT } = {}) {
    pageSize = limit
    loading.value = true
    error.value = null
    try {
      const res = await apiGetSummaries(null, { limit })
      const items = res.data || []
      list.value = items
      hasMore.value = items.length >= limit
    } catch (err) {
      console.error('Failed to fetch summaries:', err)
      list.value = []
      hasMore.value = false
      error.value = err.message || '每日总结加载失败 · 请检查服务是否可用'
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载更早的一页（游标 = 当前最后一篇的 summary_date）
   * @param {number} [limit] - 页大小，默认沿用 fetchList 的 limit
   */
  async function fetchMore(limit) {
    const size = limit || pageSize
    if (!hasMore.value || loadingMore.value || loading.value) return
    const cursor = list.value.length ? list.value[list.value.length - 1].summary_date : null
    if (!cursor) return
    loadingMore.value = true
    try {
      const res = await apiGetSummaries(null, { limit: size, before: cursor })
      const items = res.data || []
      // 游标为严格早于，理论上无重复；防御并发/重复点击造成的重复追加
      const seen = new Set(list.value.map(s => s.summary_date))
      list.value = list.value.concat(items.filter(s => !seen.has(s.summary_date)))
      hasMore.value = items.length >= size
    } catch (err) {
      console.error('Failed to fetch more summaries:', err)
    } finally {
      loadingMore.value = false
    }
  }

  /**
   * 补生成 / 重生成指定日期的日报（定时任务只跑"昨天"，失败那天不会自愈）
   *
   * 调用方拿到结果后自行 fetchList 刷新（生成本身阻塞数秒，列表要重拉才准确）。
   * @param {string} date - YYYY-MM-DD
   * @param {boolean} [force=false] - true 覆盖已有日报
   * @returns {Promise<Object|null>} 生成的日报；null = 无需生成（无记录/未配置模型/已存在）
   */
  async function regenerate(date, force = false) {
    regeneratingDate.value = date
    error.value = null
    try {
      const res = await apiRegenerateSummary(date, force)
      return res.data || null
    } catch (err) {
      error.value = err.response?.data?.message || err.message || '重新生成失败'
      console.error('Failed to regenerate summary:', err)
      return null
    } finally {
      regeneratingDate.value = ''
    }
  }

  /**
   * 回溯补生成最近 N 天缺失的日报（阻塞：每天一次 LLM 调用）
   * @param {number} [days=3] - 回溯天数
   * @returns {Promise<{ count: number, message: string }>}
   */
  async function backfill(days = 3) {
    backfilling.value = true
    error.value = null
    try {
      const res = await apiBackfillSummaries(days)
      return { count: res.data ?? 0, message: res.message || '' }
    } catch (err) {
      error.value = err.response?.data?.message || err.message || '补生成失败'
      console.error('Failed to backfill summaries:', err)
      return { count: 0, message: '' }
    } finally {
      backfilling.value = false
    }
  }

  /**
   * 拉取「有记录但缺日报」的日期（失败/未生成的日子，渲染成流里的「未生成」行）
   * @param {number} [days=7]
   */
  async function fetchMissing(days = 7) {
    try {
      const res = await apiGetMissingSummaries(days)
      missingDates.value = res.data || []
    } catch (err) {
      console.error('Failed to fetch missing summaries:', err)
      missingDates.value = []
    }
  }

  /**
   * 拉取单篇全文并合并进列表
   * @param {string} date - YYYY-MM-DD
   */
  async function fetchDetail(date) {
    detailLoading.value = true
    try {
      const res = await apiGetSummaries(date)
      const item = (res.data || []).find(s => s.summary_date === date)
      if (!item) {
        // 该日无日报：不中断，正文留空由调用方展示"加载失败"
        return null
      }
      const index = list.value.findIndex(s => s.summary_date === date)
      if (index !== -1) {
        // 单篇接口 highlights 为 null（后端 toVO withContent=true 不填摘要行），
        // 直接展开合并会把列表已有摘要冲掉（其他卡片变「暂无摘要」）→ 只合并非空字段
        const merged = { ...list.value[index] }
        for (const [k, v] of Object.entries(item)) {
          if (v !== null && v !== undefined) merged[k] = v
        }
        list.value[index] = merged
      } else {
        list.value.push(item)
      }
      return item
    } catch (err) {
      console.error('Failed to fetch summary detail:', err)
      return null
    } finally {
      detailLoading.value = false
    }
  }

  return {
    list, loading, detailLoading, error, hasMore, loadingMore, regeneratingDate, backfilling,
    missingDates,
    fetchList, fetchMore, fetchDetail, regenerate, backfill, fetchMissing,
  }
})
