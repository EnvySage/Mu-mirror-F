import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getStats as apiGetStats } from '@/api/mirror'

/**
 * 聚合统计 store（GET /api/mirror/stats?days=30）
 *
 * 后端（B Agent）已交付：默认走真接口。真接口 camelCase 经 axios 拦截器转 snake_case，
 * deepSnake 对接口数据做同样归一。
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

/** 缓存窗口（ms） */
const CACHE_TTL = 30_000

/** camelCase → snake_case（与 request.js 拦截器同规则） */
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
   * @param {boolean} [force] - 跳过缓存强制拉取（写日记/入库后 todo 变了，缓存会挡住新数据）
   * @returns {Promise<Object|null>}
   */
  async function fetchStats(days = 30, force = false) {
    if (!force && stats.value && Date.now() - fetchedAt < CACHE_TTL) return stats.value
    loading.value = true
    error.value = null
    try {
      const res = await apiGetStats(days)
      // camelCase 已被拦截器转 snake_case，再过一遍 deepSnake 幂等兜底
      stats.value = deepSnake(res.data || {})
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
    stats, loading, error,
    mood_daily, hour_dist, weekday_dist, keyword_top, record_daily, todo,
    fetchStats,
  }
})
