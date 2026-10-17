import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  getMirror as apiGetMirror,
  generateMirror as apiGenerateMirror,
  generateMonthly as apiGenerateMonthly,
  getSnapshots as apiGetSnapshots,
  getSnapshotMonths as apiGetSnapshotMonths,
  getSnapshot as apiGetSnapshot,
} from '@/api/mirror'

/**
 * @typedef {Object} MirrorProfile
 * @property {number|null} id
 * @property {string} [snapshot_type] - manual | monthly
 * @property {string|null} [period_month] - 月度快照归属月份
 * @property {number} [version_no]
 * @property {boolean} [is_current]
 * @property {'usable'|'archive_only'} [context_status]
 * @property {string|null} [invalidated_at]
 * @property {string|null} [invalidated_reason]
 * @property {number} [deleted_source_count]
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

/** @typedef {MirrorProfile & { id: number, snapshot_type: string, created_at: string, drift_distance: number|null, overall_summary: string }} SnapshotItem */

/** 快照详情缓存（id → MirrorProfile），避免重复拉取已看过的快照 */
const CACHE_TTL = 60_000

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
  const snapshotsLoadingMore = ref(false)
  const snapshotsError = ref(null)
  const snapshotsHasMore = ref(false)
  const snapshotsCursor = ref(null)

  /** 由后端基于授权记录与 period_month 计算的可重建历史月份 */
  const snapshotMonths = ref([])
  const snapshotMonthsLoading = ref(false)
  const snapshotMonthsError = ref(null)

  /** 当前查看的快照 id（= mirror.profile 的来源）；null 表示接口列表为空 */
  const currentSnapshotId = ref(null)

  /** 单份快照详情缓存 id → profile 对象 */
  const snapshotCache = new Map()
  let requestEpoch = 0
  let snapshotsLoadedEpoch = -1

  /** 丢弃旧账号的镜子视图与在途请求结果。 */
  function resetForRefresh() {
    requestEpoch += 1
    profile.value = null
    loading.value = false
    generating.value = false
    error.value = null
    snapshots.value = null
    snapshotsLoading.value = false
    snapshotsLoadingMore.value = false
    snapshotsError.value = null
    snapshotsHasMore.value = false
    snapshotsCursor.value = null
    snapshotMonths.value = []
    snapshotMonthsLoading.value = false
    snapshotMonthsError.value = null
    currentSnapshotId.value = null
    generatingMonthly.value = false
    snapshotCache.clear()
    snapshotsLoadedEpoch = -1
  }

  /**
   * 拉取最新快照（GET /api/mirror）
   */
  async function fetchMirror() {
    const epoch = requestEpoch
    loading.value = true
    error.value = null
    try {
      const res = await apiGetMirror()
      if (epoch !== requestEpoch) return
      const latestUsable = res.data || null
      // GET /mirror 只返回仍可参与上下文的镜子；空结果会清空旧正文。
      // 归档回退等首屏归档列表成功后再执行，避免使用上个账号的缓存。
      profile.value = latestUsable
      currentSnapshotId.value = profile.value?.id ?? null
      await selectLatestArchiveIfNeeded(epoch)
    } catch (err) {
      if (epoch !== requestEpoch) return
      error.value = err.message || '获取画像失败'
      console.error('Failed to fetch mirror:', err)
    } finally {
      if (epoch === requestEpoch) loading.value = false
    }
  }

  /**
   * 拉取归档首屏（GET /api/mirror/snapshots）
   *
   * 失败不阻断页面（返回 []，hero 仍展示最新快照 profile）。
   * @returns {Promise<SnapshotItem[]>}
   */
  async function fetchSnapshots() {
    if (snapshotsLoading.value) return snapshots.value || []
    const epoch = requestEpoch
    snapshotsLoading.value = true
    snapshotsError.value = null
    try {
      const res = await apiGetSnapshots({ limit: 20 })
      if (epoch !== requestEpoch) return []
      const page = normalizeSnapshotPage(res.data)
      snapshots.value = page.items
      snapshotsLoadedEpoch = epoch
      snapshotsHasMore.value = page.hasMore
      snapshotsCursor.value = page.nextCreatedAt && page.nextId !== null && page.nextId !== undefined
        ? { beforeCreatedAt: page.nextCreatedAt, beforeId: page.nextId }
        : null
      if (profile.value?.id === null || profile.value?.id === undefined) error.value = null
      await selectLatestArchiveIfNeeded(epoch)
      return snapshots.value
    } catch (err) {
      if (epoch !== requestEpoch) return []
      // 刷新失败时保留已加载历史；首屏失败保留空数组并允许重试。
      if (snapshots.value === null) snapshots.value = []
      snapshotsError.value = err.message || '快照列表加载失败'
      console.warn('Failed to fetch snapshots:', err.message)
      return []
    } finally {
      if (epoch === requestEpoch) snapshotsLoading.value = false
    }
  }

  /** 拉取下一页并追加，不覆盖已有镜子。 */
  async function fetchMoreSnapshots() {
    if (snapshotsLoadingMore.value || !snapshotsHasMore.value || !snapshotsCursor.value) return false
    const epoch = requestEpoch
    snapshotsLoadingMore.value = true
    snapshotsError.value = null
    try {
      const res = await apiGetSnapshots({ ...snapshotsCursor.value, limit: 20 })
      if (epoch !== requestEpoch) return false
      const page = normalizeSnapshotPage(res.data)
      const knownIds = new Set((snapshots.value || []).map(item => String(item.id)))
      const appended = page.items.filter(item => !knownIds.has(String(item.id)))
      snapshots.value = [...(snapshots.value || []), ...appended]
      snapshotsHasMore.value = page.hasMore
      snapshotsCursor.value = page.nextCreatedAt && page.nextId !== null && page.nextId !== undefined
        ? { beforeCreatedAt: page.nextCreatedAt, beforeId: page.nextId }
        : null
      return true
    } catch (err) {
      if (epoch !== requestEpoch) return false
      // 已加载节点仍留在页面，错误只影响“加载更早”入口。
      snapshotsError.value = err.message || '更早的镜子加载失败'
      console.warn('Failed to fetch older mirror snapshots:', err.message)
      return false
    } finally {
      if (epoch === requestEpoch) snapshotsLoadingMore.value = false
    }
  }

  /** 获取后端确认的可重建月份，不从快照创建时间推断。 */
  async function fetchSnapshotMonths() {
    if (snapshotMonthsLoading.value) return snapshotMonths.value
    const epoch = requestEpoch
    snapshotMonthsLoading.value = true
    snapshotMonthsError.value = null
    try {
      const res = await apiGetSnapshotMonths()
      if (epoch !== requestEpoch) return []
      snapshotMonths.value = Array.isArray(res.data) ? [...res.data] : []
      return snapshotMonths.value
    } catch (err) {
      if (epoch !== requestEpoch) return []
      snapshotMonthsError.value = err.message || '历史月份加载失败'
      console.warn('Failed to fetch rebuildable mirror months:', err.message)
      return snapshotMonths.value
    } finally {
      if (epoch === requestEpoch) snapshotMonthsLoading.value = false
    }
  }

  function normalizeSnapshot(raw) {
    const s = raw || {}
    return {
      ...s,
      id: s.id,
      snapshot_type: s.snapshot_type ?? (s.snapshotType === 'monthly' ? 'monthly' : 'manual'),
      period_month: s.period_month ?? s.periodMonth ?? null,
      version_no: s.version_no ?? s.versionNo ?? 1,
      is_current: s.is_current ?? s.isCurrent ?? true,
      context_status: s.context_status ?? s.contextStatus ?? 'usable',
      invalidated_at: s.invalidated_at ?? s.invalidatedAt ?? null,
      invalidated_reason: s.invalidated_reason ?? s.invalidatedReason ?? null,
      deleted_source_count: s.deleted_source_count ?? s.deletedSourceCount ?? 0,
      archive_discontinuity: s.archive_discontinuity ?? s.archiveDiscontinuity ?? false,
      created_at: s.created_at ?? s.createdAt ?? '',
      drift_distance: s.drift_distance ?? s.driftDistance ?? null,
      overall_summary: s.overall_summary ?? s.overallSummary ?? '',
    }
  }

  function normalizeSnapshotPage(raw) {
    // Legacy array support keeps the view resilient during a rolling backend/frontend local test.
    if (Array.isArray(raw)) {
      return { items: raw.map(normalizeSnapshot), nextCreatedAt: null, nextId: null, hasMore: false }
    }
    const page = raw || {}
    return {
      items: (page.items || []).map(normalizeSnapshot),
      nextCreatedAt: page.next_created_at ?? page.nextCreatedAt ?? null,
      nextId: page.next_id ?? page.nextId ?? null,
      hasMore: Boolean(page.has_more ?? page.hasMore),
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
    const epoch = requestEpoch
    const hit = snapshotCache.get(id)
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data
    try {
      const res = await apiGetSnapshot(id)
      if (epoch !== requestEpoch) return null
      const data = res.data || null
      if (!data) return null
      snapshotCache.set(id, { data, at: Date.now() })
      return data
    } catch (err) {
      if (epoch !== requestEpoch) return null
      console.warn('Failed to fetch snapshot detail:', err.message)
      error.value = err.message || '快照加载失败'
      return null
    }
  }

  /** 查看某份历史快照（取详情 + hero 切换为该快照） */
  async function viewSnapshot(id) {
    const epoch = requestEpoch
    const data = await fetchSnapshotDetail(id)
    if (!data || epoch !== requestEpoch) return false
    profile.value = data
    currentSnapshotId.value = id
    return true
  }

  /** GET /mirror 为空但归档存在时，自动打开最新一份只读快照。 */
  async function selectLatestArchiveIfNeeded(epoch = requestEpoch) {
    if (epoch !== requestEpoch || snapshotsLoadedEpoch !== epoch) return false
    if (profile.value?.id !== null && profile.value?.id !== undefined) return true
    const latest = snapshots.value?.[0]
    if (!latest) return false
    return viewSnapshot(latest.id)
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
    const epoch = requestEpoch
    generating.value = true
    error.value = null
    try {
      const res = await apiGenerateMirror()
      if (epoch !== requestEpoch) return false
      profile.value = res.data || profile.value
      currentSnapshotId.value = profile.value?.id ?? null
      // 用接口返回刷新归档和重建月份，避免本地拼快照缺少版本状态。
      await Promise.all([fetchSnapshots(), fetchSnapshotMonths()])
      return true
    } catch (err) {
      if (epoch !== requestEpoch) return false
      error.value = err.message || '画像生成失败'
      console.error('Failed to generate mirror:', err)
      return false
    } finally {
      if (epoch === requestEpoch) generating.value = false
    }
  }

  /** 生成中防重复提交标记（monthly 与 manual 各自独立，互不阻塞） */
  const generatingMonthly = ref(false)

  /**
   * 按月生成 monthly 快照（POST /mirror/generate-monthly?month=YYYY-MM）
   *
   * 成功后：重拉快照归档与月份候选（本地 prepend 会缺版本状态，用接口口径）+
   * viewSnapshot 定位新快照（hero 切换为该月画像）。
   * 失败（400 当前月/未来月等）：error 透出后端 message，调用方 toast。
   *
   * @param {string} [month] "2026-08"；空 = 上个月
   * @returns {Promise<{ ok: boolean, snapshotId?: number }>}
   */
  async function generateForMonth(month) {
    if (generatingMonthly.value) return { ok: false }
    const epoch = requestEpoch
    generatingMonthly.value = true
    error.value = null
    try {
      const res = await apiGenerateMonthly(month)
      if (epoch !== requestEpoch) return { ok: false }
      const data = res.data || null
      if (!data || data.id === null || data.id === undefined) {
        throw new Error('生成结果为空')
      }
      // 新版本入库：刷新归档和月份候选，页面时间线始终以服务端为准。
      await Promise.all([fetchSnapshots(), fetchSnapshotMonths()])
      if (epoch !== requestEpoch) return { ok: false }
      // hero 定位到新快照（不依赖 fetchSnapshots 结果，id 已知）
      const okView = await viewSnapshot(data.id)
      if (epoch !== requestEpoch) return { ok: false }
      if (!okView) currentSnapshotId.value = data.id
      return { ok: true, snapshotId: data.id }
    } catch (err) {
      if (epoch !== requestEpoch) return { ok: false }
      error.value = err.message || '月度画像生成失败'
      console.error('Failed to generate monthly mirror:', err)
      return { ok: false }
    } finally {
      if (epoch === requestEpoch) generatingMonthly.value = false
    }
  }

  /** Aliased for the existing view; values come directly from /snapshot-months. */
  const generatableMonths = computed(() => snapshotMonths.value)

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
    snapshotsLoadingMore,
    snapshotsError,
    snapshotsHasMore,
    snapshotMonths,
    snapshotMonthsLoading,
    snapshotMonthsError,
    currentSnapshotId,
    generatingMonthly,
    generatableMonths,
    fetchMirror,
    resetForRefresh,
    fetchSnapshots,
    fetchMoreSnapshots,
    fetchSnapshotMonths,
    fetchSnapshotDetail,
    viewSnapshot,
    backToLatest,
    generate,
    generateForMonth,
    driftLevel,
  }
})
