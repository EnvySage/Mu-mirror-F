import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getMirror as apiGetMirror, generateMirror as apiGenerateMirror } from '@/api/mirror'

/**
 * @typedef {Object} MirrorProfile
 * @property {number|null} id
 * @property {string} [snapshot_type] - manual | monthly
 * @property {string} [mood_analysis] - 情绪维度分析
 * @property {string} [learning_analysis] - 学习维度分析
 * @property {string} [todo_analysis] - 待办维度分析
 * @property {string} [rhythm_analysis] - 节奏维度分析
 * @property {string[]} [user_tags] - 用户标签
 * @property {string} [overall_summary] - 总体总结
 * @property {number} [drift_distance] - 漂移余弦距离 0~2（null=无参照）
 * @property {string} [drift_baseline_at] - 漂移参照快照时间
 * @property {string} [created_at]
 */

export const useMirrorStore = defineStore('mirror', () => {
  /** @type {import('vue').Ref<MirrorProfile|null>} */
  const profile = ref(null)
  const loading = ref(false)
  const generating = ref(false)
  const error = ref(null)

  /**
   * 拉取最新快照（GET /api/mirror）
   */
  async function fetchMirror() {
    loading.value = true
    error.value = null
    try {
      const res = await apiGetMirror()
      profile.value = res.data || null
    } catch (err) {
      error.value = err.message || '获取画像失败'
      console.error('Failed to fetch mirror:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 生成 manual 快照（POST /api/mirror/generate，阻塞数十秒）
   * @returns {Promise<boolean>}
   */
  async function generate() {
    generating.value = true
    error.value = null
    try {
      const res = await apiGenerateMirror()
      profile.value = res.data || profile.value
      return true
    } catch (err) {
      error.value = err.message || '画像生成失败'
      console.error('Failed to generate mirror:', err)
      return false
    } finally {
      generating.value = false
    }
  }

  /** 漂移展示（余弦距离 0~2 → 0~100% + 程度词） */
  const drift = computed(() => {
    const d = profile.value?.drift_distance
    if (d === null || d === undefined) return null
    const pct = Math.round((d / 2) * 100)
    const level = pct >= 40 ? '明显变化' : pct >= 15 ? '有所变化' : '基本稳定'
    return { pct, level }
  })

  /** 从未生成过画像（空 VO id=null） */
  const isEmpty = computed(() => !profile.value || profile.value.id === null || profile.value.id === undefined)

  return {
    profile,
    loading,
    generating,
    error,
    drift,
    isEmpty,
    fetchMirror,
    generate,
  }
})
