import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { dateLabel } from '@/utils/time'
import {
  getRecords as apiGetRecords,
  getRecord as apiGetRecord,
  createRecord as apiCreateRecord,
  updateRecord as apiUpdateRecord,
  deleteRecord as apiDeleteRecord,
  confirmReview as apiConfirmReview,
} from '@/api/records'

/** @typedef {'processing' | 'reviewing' | 'done' | 'failed'} RecordStatus */

/**
 * @typedef {Object} Record
 * @property {string|number} id
 * @property {string} content
 * @property {string} [title]
 * @property {string} [summary]
 * @property {string} [content_type]
 * @property {string[]} [mood]
 * @property {string[]} [keywords]
 * @property {RecordStatus} status
 * @property {boolean} [user_reviewed]
 * @property {string} created_at
 * @property {string} [updated_at]
 */

export const useRecordsStore = defineStore('records', () => {
  /** @type {import('vue').Ref<Record[]>} */
  const records = ref([])

  const loading = ref(false)
  const error = ref(null)

  const totalCount = computed(() => records.value.length)

  /** 按日期分组的记录 */
  const groupedRecords = computed(() => {
    const groups = {}
    records.value.forEach(r => {
      const key = dateLabel(r.created_at)
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })
    return Object.entries(groups).map(([date, items]) => ({ date, items }))
  })

  /** 待审核记录 */
  const pendingRecords = computed(() =>
    records.value.filter(r => r.status === 'reviewing')
  )

  /** 处理中的记录 */
  const processingRecords = computed(() =>
    records.value.filter(r => r.status === 'processing')
  )

  /** 已完成的记录 */
  const doneRecords = computed(() =>
    records.value.filter(r => r.status === 'done')
  )

  /**
   * 从后端获取记录列表
   * @param {Object} [params] - 可选查询参数
   * @returns {Promise<void>}
   */
  async function fetchRecords(params) {
    loading.value = true
    error.value = null
    try {
      const res = await apiGetRecords(params)
      records.value = res.data || []
    } catch (err) {
      error.value = err.message || '获取记录失败'
      console.error('Failed to fetch records:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据 ID 获取记录详情
   * @param {string|number} id
   * @returns {Promise<Record|null>}
   */
  async function fetchRecord(id) {
    try {
      const res = await apiGetRecord(id)
      // 更新本地缓存
      const index = records.value.findIndex(r => r.id === id)
      if (index !== -1) {
        records.value[index] = res.data
      }
      return res.data
    } catch (err) {
      console.error('Failed to fetch record:', err)
      return null
    }
  }

  /**
   * 创建新记录
   * @param {string} content
   * @returns {Promise<Record>}
   */
  async function createRecord(content) {
    const res = await apiCreateRecord({ content })
    const newRecord = res.data
    // 添加到本地列表开头
    records.value.unshift(newRecord)
    return newRecord
  }

  /**
   * 更新记录（仅审查状态下）
   * @param {string|number} id
   * @param {Object} data - 更新数据（title, summary, contentType, mood, keywords）
   * @returns {Promise<boolean>}
   */
  async function updateRecord(id, data) {
    try {
      const res = await apiUpdateRecord(id, data)
      // 更新本地记录
      const index = records.value.findIndex(r => r.id === id)
      if (index !== -1) {
        records.value[index] = res.data
      }
      return true
    } catch (err) {
      console.error('Failed to update record:', err)
      return false
    }
  }

  /**
   * 删除记录（软删除）
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  async function deleteRecord(id) {
    try {
      await apiDeleteRecord(id)
      // 从本地列表移除
      records.value = records.value.filter(r => r.id !== id)
      return true
    } catch (err) {
      console.error('Failed to delete record:', err)
      return false
    }
  }

  /**
   * 确认审查完成
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  async function confirmReview(id) {
    try {
      const res = await apiConfirmReview(id)
      // 更新本地记录
      const index = records.value.findIndex(r => r.id === id)
      if (index !== -1) {
        records.value[index] = res.data
      }
      return true
    } catch (err) {
      console.error('Failed to confirm review:', err)
      return false
    }
  }

  /**
   * 根据 ID 获取本地记录
   * @param {string|number} id
   * @returns {Record|undefined}
   */
  function getById(id) {
    return records.value.find(r => r.id === id)
  }

  /**
   * 根据日期过滤记录
   * @param {Date} date
   * @returns {Record[]}
   */
  function getByDate(date) {
    return records.value.filter(r => {
      const d = new Date(r.created_at)
      return d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate()
    })
  }

  /**
   * 获取有记录的日期集合（用于日历标记）
   * @param {number} year
   * @param {number} month
   * @returns {Set<number>}
   */
  function getRecordDates(year, month) {
    const dates = new Set()
    records.value.forEach(r => {
      const d = new Date(r.created_at)
      if (d.getFullYear() === year && d.getMonth() === month) {
        dates.add(d.getDate())
      }
    })
    return dates
  }

  return {
    records,
    loading,
    error,
    totalCount,
    groupedRecords,
    pendingRecords,
    processingRecords,
    doneRecords,
    fetchRecords,
    fetchRecord,
    createRecord,
    updateRecord,
    deleteRecord,
    confirmReview,
    getById,
    getByDate,
    getRecordDates,
  }
})
