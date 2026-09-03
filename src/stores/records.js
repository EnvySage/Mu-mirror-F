import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { dateLabel } from '@/utils/time'
import {
  getRecords as apiGetRecords,
  getRecord as apiGetRecord,
  createRecord as apiCreateRecord,
  updateChunk as apiUpdateChunk,
  deleteChunk as apiDeleteChunk,
  createChunk as apiCreateChunk,
  deleteRecord as apiDeleteRecord,
  confirmReview as apiConfirmReview,
  retryRecord as apiRetryRecord,
  getCalendarMarks as apiGetCalendarMarks,
} from '@/api/records'

/** @typedef {'processing' | 'reviewing' | 'done' | 'failed'} RecordStatus */

/**
 * @typedef {Object} ChunkMetadata
 * @property {string} title
 * @property {string} summary
 * @property {string} contentType
 * @property {string[]} mood
 * @property {string[]} keywords
 */

/**
 * @typedef {Object} ChunkVO
 * @property {number} id
 * @property {number} recordId
 * @property {string} segment
 * @property {ChunkMetadata} metadata
 * @property {boolean} hasEmbedding
 */

/**
 * @typedef {Object} Record
 * @property {string|number} id
 * @property {string} content
 * @property {string[]} [segment]
 * @property {ChunkVO[]} [chunks]
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

  /**
   * 日历标记数据 { "2026-08": { "1": 2, "5": 1, ... } }
   * @type {import('vue').Ref<Record<string, Record<string, number>>>}
   */
  const calendarMarks = ref({})

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
      } else {
        records.value.unshift(res.data)
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
    if (!records.value.some(r => r.id === newRecord.id)) {
      records.value.unshift(newRecord)
    }
    return newRecord
  }

  /**
   * 更新 Chunk（扁平结构：segment + 元数据字段，仅 REVIEWING）
   * @param {string|number} chunkId
   * @param {Object} data - { segment, title, summary, contentType, mood, keywords }
   * @returns {Promise<boolean>}
   */
  async function updateChunk(chunkId, data) {
    try {
      await apiUpdateChunk(chunkId, data)
      // 后端返回的 ChunkVO 不含完整状态，直接按参数更新本地缓存
      applyChunkEdit(chunkId, data)
      return true
    } catch (err) {
      console.error('Failed to update chunk:', err)
      error.value = err.message || '更新片段失败'
      return false
    }
  }

  /**
   * 将扁平字段合并进本地缓存的 chunk.metadata
   * @param {string|number} chunkId
   * @param {Object} data
   */
  function applyChunkEdit(chunkId, data) {
    for (const record of records.value) {
      if (!record.chunks) continue
      const chunk = record.chunks.find(c => c.id === chunkId)
      if (!chunk) continue
      if (data.segment !== undefined) chunk.segment = data.segment
      const meta = { ...(chunk.metadata || {}) }
      for (const key of ['title', 'summary', 'contentType', 'mood', 'keywords']) {
        if (data[key] !== undefined) meta[key] = data[key]
      }
      chunk.metadata = meta
      return
    }
  }

  /**
   * 删除 Chunk（仅 REVIEWING；后端实现前会失败）
   * @param {string|number} chunkId
   * @returns {Promise<boolean>}
   */
  async function deleteChunk(chunkId) {
    try {
      await apiDeleteChunk(chunkId)
      for (const record of records.value) {
        if (!record.chunks) continue
        if (record.chunks.some(c => c.id === chunkId)) {
          record.chunks = record.chunks.filter(c => c.id !== chunkId)
          return true
        }
      }
      return true
    } catch (err) {
      console.error('Failed to delete chunk:', err)
      error.value = err.message || '删除片段失败'
      return false
    }
  }

  /**
   * 新增 Chunk（后端同步单段分类回填 metadata，失败不阻断）
   * @param {string|number} recordId
   * @param {string} segment
   * @returns {Promise<Object|null>} 新建的 ChunkVO（后端未实现时返回占位对象）
   */
  async function addChunk(recordId, segment) {
    try {
      const res = await apiCreateChunk(recordId, { segment })
      const chunk = res.data
      const record = records.value.find(r => r.id === recordId)
      if (record) {
        if (!record.chunks) record.chunks = []
        record.chunks.push(chunk)
      }
      return chunk
    } catch (err) {
      // 端点未就绪（404/405）：本地占位，confirm 时后端兜底补分类
      console.warn('createChunk failed, using local placeholder:', err.message)
      const placeholder = {
        id: `local_${Date.now()}`,
        recordId,
        segment,
        metadata: {},
        hasEmbedding: false,
      }
      const record = records.value.find(r => r.id === recordId)
      if (record) {
        if (!record.chunks) record.chunks = []
        record.chunks.push(placeholder)
      }
      return placeholder
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
      error.value = err.message || '删除记录失败'
      return false
    }
  }

  /**
   * 确认审查完成（阻塞数秒——补分类 + Embedding）
   * @param {string|number} id
   * @returns {Promise<Object|null>} 更新后的记录（失败返回 null）
   */
  async function confirmReview(id) {
    try {
      const res = await apiConfirmReview(id)
      const index = records.value.findIndex(r => r.id === id)
      if (index !== -1 && res.data) {
        records.value[index] = res.data
      }
      return res.data || records.value[index] || null
    } catch (err) {
      console.error('Failed to confirm review:', err)
      error.value = err.message || '确认失败'
      return null
    }
  }

  /**
   * 重试失败记录（重跑管道；后端未实现时回退为删除+重建）
   * @param {string|number} id
   * @returns {Promise<Object|null>} 新的记录
   */
  async function retryRecord(id) {
    const old = records.value.find(r => r.id === id)
    try {
      const res = await apiRetryRecord(id)
      const updated = res.data
      const index = records.value.findIndex(r => r.id === id)
      if (index !== -1 && updated) records.value[index] = updated
      return updated || null
    } catch (err) {
      // 后端未实现 retry：回退为软删除 + 重新提交原文
      console.warn('retry endpoint failed, falling back to recreate:', err.message)
      const content = old ? old.content : ''
      await deleteRecord(id)
      if (!content) return null
      return createRecord(content)
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
   * 判断是否为拆分记录（有多个 chunks）
   * @param {Record} record
   * @returns {boolean}
   */
  function isSplitRecord(record) {
    return record.chunks && record.chunks.length > 1
  }

  /**
   * 获取记录的显示内容（优先用 segment 数组，没有则用 content）
   * @param {Record} record
   * @returns {string}
   */
  function getDisplayContent(record) {
    if (record.segment && record.segment.length > 0) {
      return record.segment.join('\n\n')
    }
    return record.content
  }

  /**
   * 按日期分组，拆分记录合并展示
   * 返回格式：[{ date, items: [Record | Record[]] }]
   */
  const groupedRecordsWithSplit = computed(() => {
    const groups = {}
    const processedIds = new Set()

    records.value.forEach(r => {
      if (processedIds.has(r.id)) return

      const key = dateLabel(r.created_at)
      if (!groups[key]) groups[key] = []

      // 按时间戳分组：同一秒内的记录视为一组
      const timestamp = new Date(r.created_at).getTime()
      const sameTimestampRecords = records.value.filter(rec => {
        const recTime = new Date(rec.created_at).getTime()
        return Math.abs(recTime - timestamp) < 1000 && !processedIds.has(rec.id)
      })

      if (sameTimestampRecords.length > 1) {
        // 同一时间戳有多条记录，作为一组
        groups[key].push(sameTimestampRecords)
        sameTimestampRecords.forEach(item => processedIds.add(item.id))
      } else {
        // 单条记录，直接添加
        groups[key].push(r)
        processedIds.add(r.id)
      }
    })

    return Object.entries(groups).map(([date, items]) => ({ date, items }))
  })

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
   * 从后端获取日历标记数据
   * @param {number} year
   * @param {number} month - 月份（0-11）
   * @returns {Promise<void>}
   */
  async function fetchCalendarMarks(year, month) {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    try {
      const res = await apiGetCalendarMarks(monthStr)
      calendarMarks.value[monthStr] = res.data || {}
    } catch (err) {
      console.error('Failed to fetch calendar marks:', err)
      calendarMarks.value[monthStr] = {}
    }
  }

  /**
   * 获取有记录的日期集合（用于日历标记）
   * 优先使用后端日历标记数据，回退到本地记录
   * @param {number} year
   * @param {number} month
   * @returns {Set<number>}
   */
  function getRecordDates(year, month) {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
    const marks = calendarMarks.value[monthStr]

    // 如果有后端数据，使用后端数据
    if (marks) {
      const dates = new Set()
      Object.entries(marks).forEach(([day, count]) => {
        if (count > 0) dates.add(Number(day))
      })
      return dates
    }

    // 回退到本地记录
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
    groupedRecordsWithSplit,
    pendingRecords,
    processingRecords,
    doneRecords,
    calendarMarks,
    fetchRecords,
    fetchRecord,
    createRecord,
    updateChunk,
    deleteChunk,
    addChunk,
    deleteRecord,
    confirmReview,
    retryRecord,
    fetchCalendarMarks,
    getById,
    getByDate,
    getRecordDates,
    isSplitRecord,
    getDisplayContent,
  }
})
