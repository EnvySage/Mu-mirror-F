import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { dateLabel } from '@/utils/time'

/** @typedef {'processing' | 'done' | 'failed'} ProcessingStatus */

/**
 * @typedef {Object} Record
 * @property {string} id
 * @property {string} content
 * @property {string} [title]
 * @property {string} [summary]
 * @property {string} [content_type]
 * @property {string[]} [mood]
 * @property {string[]} [keywords]
 * @property {ProcessingStatus} status
 * @property {string} created_at
 */

const demoRecords = [
  {
    id: '1', status: 'done',
    content: '今天学了 Spring Security 的认证流程，感觉有点难但总算搞懂了。晚上打算继续看授权部分。',
    title: '学习 Spring Security 认证流程',
    summary: '学习了认证流程，有难度但已理解，计划继续学习授权部分',
    content_type: 'learning', mood: ['calm', 'satisfied'], keywords: ['Spring Security', '认证', '授权'],
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: '2', status: 'done',
    content: '完成数据库概念设计，心情不错。',
    title: '完成数据库概念设计',
    summary: '完成了数据库的概念设计阶段',
    content_type: 'work', mood: ['happy'], keywords: ['数据库', '设计'],
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: '3', status: 'done',
    content: '晚上和朋友吃饭，聊了毕业设计，他建议我用 Vue 写前端。',
    title: '和朋友吃饭',
    summary: '和朋友吃饭聊了毕业设计，得到了前端技术选型建议',
    content_type: 'social', mood: ['happy'], keywords: ['朋友', '毕业设计', 'Vue'],
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: '4', status: 'done',
    content: '明天要开会讨论项目进度，需要准备演示文稿。',
    title: '明天开会',
    summary: '需要准备项目进度会议的演示文稿',
    content_type: 'todo', mood: ['anxious'], keywords: ['会议', '演示文稿'],
    created_at: new Date(Date.now() - 26 * 3600000).toISOString(),
  },
  {
    id: '5', status: 'done',
    content: '最近有点累，学习节奏太快了，需要调整一下。',
    title: '需要调整节奏',
    summary: '学习节奏太快感到疲惫，需要适当调整',
    content_type: 'thought', mood: ['tired', 'anxious'], keywords: ['疲劳', '节奏'],
    created_at: new Date(Date.now() - 50 * 3600000).toISOString(),
  },
]

export const useRecordsStore = defineStore('records', () => {
  /** @type {import('vue').Ref<Record[]>} */
  const records = ref([...demoRecords])

  const loading = ref(false)

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

  /**
   * 根据 ID 获取记录
   * @param {string} id
   * @returns {Record | undefined}
   */
  function getById(id) {
    return records.value.find(r => r.id === id)
  }

  /**
   * 创建新记录（demo 模拟）
   * @param {string} content
   * @returns {Record}
   */
  function createRecord(content) {
    const newRecord = {
      id: String(Date.now()),
      status: 'processing',
      content,
      created_at: new Date().toISOString(),
    }
    records.value.unshift(newRecord)
    return newRecord
  }

  /**
   * 模拟 AI 处理完成后更新记录
   * @param {string} id
   * @param {Partial<Record>} data
   */
  function updateRecord(id, data) {
    const record = records.value.find(r => r.id === id)
    if (record) {
      Object.assign(record, data)
    }
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
    totalCount,
    groupedRecords,
    getById,
    createRecord,
    updateRecord,
    getByDate,
    getRecordDates,
  }
})
