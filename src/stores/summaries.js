import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getSummaries as apiGetSummaries } from '@/api/summary'

/**
 * 每日总结 store（GET /api/summaries，设计文档 6.7）
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

export const useSummariesStore = defineStore('summaries', () => {
  /** @type {import('vue').Ref<DailySummary[]>} */
  const list = ref([])
  const loading = ref(false)
  const detailLoading = ref(false)
  /** 加载失败信息（后端未起时透出兜底文案，不白屏） */
  const error = ref(null)

  /**
   * 拉取全部日报列表（新→旧）
   */
  async function fetchList() {
    loading.value = true
    error.value = null
    try {
      const res = await apiGetSummaries()
      list.value = res.data || []
    } catch (err) {
      console.error('Failed to fetch summaries:', err)
      list.value = []
      error.value = err.message || '每日总结加载失败 · 请检查服务是否可用'
    } finally {
      loading.value = false
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
        list.value[index] = { ...list.value[index], ...item }
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

  return { list, loading, detailLoading, error, fetchList, fetchDetail }
})
