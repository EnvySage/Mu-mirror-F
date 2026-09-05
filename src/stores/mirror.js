import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  getMirror as apiGetMirror,
  generateMirror as apiGenerateMirror,
  getSnapshots as apiGetSnapshots,
  getSnapshot as apiGetSnapshot,
} from '@/api/mirror'

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

/** @typedef {{ id: number, snapshot_type: string, created_at: string, drift_distance: number|null, overall_summary: string }} SnapshotItem */

/**
 * mock 开关：快照历史接口与主链路同库同表，真接口已就绪（MirrorController
 * /snapshots 与 /snapshots/{id}，MirrorServiceImpl.listSnapshots/getSnapshot）。
 * 置 true 可临时回落 mock（后端未启动/联调时用），与 stats store 同模式。
 */
const USE_MOCK = false

/** 快照详情缓存（id → MirrorProfile），避免重复拉取已看过的快照 */
const CACHE_TTL = 60_000

/** mock 数据：与任务书契约同构（camelCase 原样，读取端做双格式兜底） */
const MOCK_SNAPSHOTS = [
  { id: 3, snapshotType: 'manual', createdAt: '2026-09-05 10:00:00', driftDistance: null, overallSummary: '本周状态明显回暖，学习节奏稳定，情绪以平静和满足为主。' },
  { id: 2, snapshotType: 'monthly', createdAt: '2026-09-01 02:00:00', driftDistance: 0.12, overallSummary: '九月开局：夜猫子节奏有所收敛，学习占比上升，待办完成率提升。' },
  { id: 1, snapshotType: 'monthly', createdAt: '2026-08-01 02:00:00', driftDistance: 0.31, overallSummary: '八月整体处于冲刺焦虑期，深夜记录居多，情绪波动较大。' },
]

/** mock 单份完整快照（与 GET /mirror 同结构，id 对应 MOCK_SNAPSHOTS） */
function mockSnapshotDetail(id) {
  const list = MOCK_SNAPSHOTS.find(s => s.id === Number(id))
  const base = {
    id: list ? list.id : null,
    snapshotType: list ? list.snapshotType : 'manual',
    createdAt: list ? list.createdAt : '2026-09-05 10:00:00',
    driftDistance: list ? list.driftDistance : null,
    driftBaselineAt: null,
    overallSummary: list
      ? list.overallSummary
      : '这是一份占位画像：情绪平稳，学习持续推进，待办略有积压。',
    moodAnalysis: '情绪以平静与满足为主基调，学习类记录伴随明显的兴奋与期待。',
    learningAnalysis: '学习集中在 Three.js 与 Vue3，笔记类产出稳定，视频教程占比下降。',
    todoAnalysis: '待办完成率约五成，长周期任务（投简历、读书计划）推进偏慢。',
    rhythmAnalysis: '记录集中在上午 9-11 点与晚上 21-23 点，深夜记录较上月减少。',
    userTags: ['技术学习', '夜猫子', '跑步新人'],
  }
  return base
}

export const useMirrorStore = defineStore('mirror', () => {
  /** @type {import('vue').Ref<MirrorProfile|null>} */
  const profile = ref(null)
  const loading = ref(false)
  const generating = ref(false)
  const error = ref(null)

  /** 快照历史列表（时间倒序，最新在前）；null = 尚未拉取 */
  /** @type {import('vue').Ref<SnapshotItem[]|null>} */
  const snapshots = ref(null)
  const snapshotsLoading = ref(false)
  const snapshotsError = ref(null)

  /** 当前查看的快照 id（= mirror.profile 的来源）；null 表示接口列表为空 */
  const currentSnapshotId = ref(null)

  /** 单份快照详情缓存 id → profile 对象 */
  const snapshotCache = new Map()

  /**
   * 拉取最新快照（GET /api/mirror）
   */
  async function fetchMirror() {
    loading.value = true
    error.value = null
    try {
      const res = await apiGetMirror()
      profile.value = res.data || null
      currentSnapshotId.value = profile.value?.id ?? null
    } catch (err) {
      error.value = err.message || '获取画像失败'
      console.error('Failed to fetch mirror:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 拉取快照历史列表（GET /api/mirror/snapshots）
   *
   * 失败不阻断页面（返回 []，hero 仍展示最新快照 profile）。
   * 双格式兜底：真接口 camelCase 已被拦截器转 snake_case；
   * mock 路径手动归一，两路数据结构一致。
   * @returns {Promise<SnapshotItem[]>}
   */
  async function fetchSnapshots() {
    if (snapshotsLoading.value) return snapshots.value || []
    snapshotsLoading.value = true
    snapshotsError.value = null
    try {
      let raw
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 150))
        raw = MOCK_SNAPSHOTS
      } else {
        const res = await apiGetSnapshots()
        raw = res.data || []
      }
      snapshots.value = raw.map(s => ({
        id: s.id,
        snapshot_type: s.snapshot_type ?? (s.snapshotType === 'monthly' ? 'monthly' : 'manual'),
        created_at: s.created_at ?? s.createdAt ?? '',
        drift_distance: s.drift_distance ?? s.driftDistance ?? null,
        overall_summary: s.overall_summary ?? s.overallSummary ?? '',
      }))
      return snapshots.value
    } catch (err) {
      // 列表拉不到不阻断：轨迹条显示"暂无历史快照"，hero 仍用 profile
      snapshots.value = []
      snapshotsError.value = err.message || '快照列表加载失败'
      console.warn('Failed to fetch snapshots:', err.message)
      return []
    } finally {
      snapshotsLoading.value = false
    }
  }

  /**
   * 拉取单份快照详情（GET /api/mirror/snapshots/{id}，60s 缓存，不改当前查看态）
   *
   * 与 viewSnapshot 的区别：本函数只取数据（对比面板等场景用），
   * viewSnapshot = 取数据 + 切换 hero 展示。
   * @param {number|string} id
   * @returns {Promise<Object|null>}
   */
  async function fetchSnapshotDetail(id) {
    if (id === null || id === undefined || String(id) === '') return null
    const hit = snapshotCache.get(id)
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data
    try {
      let data
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 120))
        data = mockSnapshotDetail(id)
      } else {
        const res = await apiGetSnapshot(id)
        data = res.data || null
      }
      if (!data) return null
      snapshotCache.set(id, { data, at: Date.now() })
      return data
    } catch (err) {
      console.warn('Failed to fetch snapshot detail:', err.message)
      error.value = err.message || '快照加载失败'
      return null
    }
  }

  /** 查看某份历史快照（取详情 + hero 切换为该快照） */
  async function viewSnapshot(id) {
    const data = await fetchSnapshotDetail(id)
    if (!data) return false
    profile.value = data
    currentSnapshotId.value = id
    return true
  }

  /** 返回最新快照（时间线第一位）；列表为空时回落 GET /mirror 的 profile */
  async function backToLatest() {
    const list = snapshots.value
    const latestId = list && list.length ? list[0].id : (profile.value?.id ?? null)
    if (latestId === null || latestId === undefined) return false
    return viewSnapshot(latestId)
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
      currentSnapshotId.value = profile.value?.id ?? null
      // 新快照入库：重拉列表（本地 prepend 会缺 drift/截断摘要，直接用接口口径）
      fetchSnapshots()
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

  /**
   * 漂移程度词（两快照差值 Δ 归一：余弦距离差 0~1，0.3+ 明显变化 / 0.12+ 有所变化 / 否则基本稳定）
   * @param {number} delta
   * @returns {'基本稳定'|'有所变化'|'明显变化'}
   */
  function driftLevel(delta) {
    const d = Math.abs(delta)
    if (d >= 0.3) return '明显变化'
    if (d >= 0.12) return '有所变化'
    return '基本稳定'
  }

  /** 从未生成过画像（空 VO id=null） */
  const isEmpty = computed(() => !profile.value || profile.value.id === null || profile.value.id === undefined)

  return {
    profile,
    loading,
    generating,
    error,
    drift,
    isEmpty,
    snapshots,
    snapshotsLoading,
    snapshotsError,
    currentSnapshotId,
    fetchMirror,
    fetchSnapshots,
    fetchSnapshotDetail,
    viewSnapshot,
    backToLatest,
    generate,
    driftLevel,
  }
})
