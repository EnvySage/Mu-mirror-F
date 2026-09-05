import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getStats as apiGetStats } from '@/api/mirror'

/**
 * 聚合统计 store（GET /api/mirror/stats?days=30）
 *
 * 后端（B Agent）已交付：默认走真接口。USE_MOCK 置 true 可临时回落 mock
 * （与任务书响应样例同构）。真接口 camelCase 经 axios 拦截器转 snake_case，
 * deepSnake 对 mock 路径做同样归一，两路数据结构一致。
 *
 * 补零契约（后端已做，前端不再补）：hourDist 24 格全量、weekdayDist 7 格
 * （周一=0）、moodDaily/recordDaily 按日期序列全量（无记录天 count=0）。
 *
 * 30s 缓存：进镜子页 / 记录页各拉一次，窗口内重复进入不重复请求。
 *
 * @typedef {Object} StatsData
 * @property {number} days
 * @property {{ date: string, moods: { mood: string, count: number }[] }[]} mood_daily
 * @property {{ bucket: number, count: number }[]} hour_dist
 * @property {{ bucket: number, count: number }[]} weekday_dist
 * @property {{ keyword: string, count: number }[]} keyword_top
 * @property {{ total: number, completed: number, not_started: number, in_progress: number,
 *              open_items: { record_id: number, title: string, summary: string, task_status: string }[] }} todo
 * @property {{ date: string, count: number }[]} record_daily
 */

/** mock 开关：真接口已就绪，默认 false；置 true 回落 mock */
const USE_MOCK = false

/** 缓存窗口（ms） */
const CACHE_TTL = 30_000

/** mock 数据：与任务书响应样例同构（camelCase 原样，normalize 兼容） */
const MOCK_STATS = {
  days: 30,
  moodDaily: [
    { date: '2026-09-01', moods: [{ mood: 'satisfied', count: 3 }, { mood: 'calm', count: 1 }] },
    { date: '2026-09-02', moods: [{ mood: 'happy', count: 2 }, { mood: 'anxious', count: 2 }] },
    { date: '2026-09-03', moods: [{ mood: 'excited', count: 1 }] },
    { date: '2026-09-04', moods: [{ mood: 'grateful', count: 2 }, { mood: 'exhausted', count: 1 }, { mood: 'sad', count: 1 }] },
    { date: '2026-09-05', moods: [{ mood: 'calm', count: 2 }, { mood: 'expecting', count: 1 }] },
  ],
  hourDist: [
    { bucket: 0, count: 1 }, { bucket: 1, count: 0 }, { bucket: 2, count: 0 }, { bucket: 3, count: 0 },
    { bucket: 4, count: 0 }, { bucket: 5, count: 2 }, { bucket: 6, count: 4 }, { bucket: 7, count: 7 },
    { bucket: 8, count: 9 }, { bucket: 9, count: 6 }, { bucket: 10, count: 8 }, { bucket: 11, count: 5 },
    { bucket: 12, count: 3 }, { bucket: 13, count: 4 }, { bucket: 14, count: 9 }, { bucket: 15, count: 7 },
    { bucket: 16, count: 6 }, { bucket: 17, count: 4 }, { bucket: 18, count: 8 }, { bucket: 19, count: 5 },
    { bucket: 20, count: 6 }, { bucket: 21, count: 4 }, { bucket: 22, count: 2 }, { bucket: 23, count: 1 },
  ],
  weekdayDist: [
    { bucket: 0, count: 8 }, { bucket: 1, count: 12 }, { bucket: 2, count: 9 },
    { bucket: 3, count: 11 }, { bucket: 4, count: 7 }, { bucket: 5, count: 4 }, { bucket: 6, count: 6 },
  ],
  keywordTop: [
    { keyword: 'Three.js', count: 12 }, { keyword: 'Vue3', count: 9 }, { keyword: '跑步', count: 7 },
    { keyword: 'Shader', count: 6 }, { keyword: '面试', count: 5 }, { keyword: '读书', count: 4 },
    { keyword: '咖啡', count: 3 }, { keyword: 'GLSL', count: 3 }, { keyword: '周报', count: 2 }, { keyword: '游泳', count: 1 },
  ],
  todo: {
    total: 6, completed: 3, notStarted: 2, inProgress: 1,
    openItems: [
      { recordId: 1, title: '整理 Three.js 笔记第三章', summary: '把光照模型部分补完', taskStatus: 'not_started' },
      { recordId: 2, title: '投递两份简历', summary: 'A 公司和 B 公司', taskStatus: 'in_progress' },
      { recordId: 3, title: '预约周四体检', summary: '', taskStatus: 'not_started' },
      { recordId: 4, title: '读完《置身事内》第 4 章', summary: '', taskStatus: 'in_progress' },
      { recordId: 5, title: '给妈妈打电话', summary: '', taskStatus: 'not_started' },
    ],
  },
  recordDaily: [
    { date: '2026-09-01', count: 4 }, { date: '2026-09-02', count: 2 }, { date: '2026-09-03', count: 1 },
    { date: '2026-09-04', count: 5 }, { date: '2026-09-05', count: 3 },
  ],
}

/** camelCase → snake_case（与 request.js 拦截器同规则，mock 与真接口双格式归一） */
function toSnake(key) {
  return key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

/** 递归把对象 key 归一为 snake_case（数组透传） */
function deepSnake(data) {
  if (Array.isArray(data)) return data.map(deepSnake)
  if (data !== null && typeof data === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(data)) out[toSnake(k)] = deepSnake(v)
    return out
  }
  return data
}

export const useStatsStore = defineStore('stats', () => {
  /** @type {import('vue').Ref<StatsData|null>} */
  const stats = ref(null)
  const loading = ref(false)
  const error = ref(null)
  /** 数据来源标记（mock / live），调试与透出用 */
  const source = ref(null)
  let fetchedAt = 0

  /** 归一后的六维字段（snake_case，空数组/空对象兜底） */
  const mood_daily = computed(() => stats.value?.mood_daily || [])
  const hour_dist = computed(() => stats.value?.hour_dist || [])
  const weekday_dist = computed(() => stats.value?.weekday_dist || [])
  const keyword_top = computed(() => stats.value?.keyword_top || [])
  const record_daily = computed(() => stats.value?.record_daily || [])
  const todo = computed(() => stats.value?.todo || { total: 0, completed: 0, not_started: 0, in_progress: 0, open_items: [] })

  /**
   * 拉取统计（30s 内命中缓存直接返回）
   * @param {number} [days] - 窗口天数，默认 30
   * @returns {Promise<Object|null>}
   */
  async function fetchStats(days = 30) {
    if (stats.value && Date.now() - fetchedAt < CACHE_TTL) return stats.value
    loading.value = true
    error.value = null
    try {
      if (USE_MOCK) {
        // mock 路径：camelCase 样例 → deepSnake 归一（与拦截器同规则）
        await new Promise(r => setTimeout(r, 120))
        stats.value = deepSnake(MOCK_STATS)
        source.value = 'mock'
      } else {
        const res = await apiGetStats(days)
        // 真接口：camelCase 已被拦截器转 snake_case，再过一遍 deepSnake 幂等兜底
        stats.value = deepSnake(res.data || {})
        source.value = 'live'
      }
      fetchedAt = Date.now()
      return stats.value
    } catch (err) {
      console.error('Failed to fetch stats:', err)
      error.value = err.message || '统计加载失败'
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    stats, loading, error, source,
    mood_daily, hour_dist, weekday_dist, keyword_top, record_daily, todo,
    fetchStats,
  }
})
