import { reportAchievementActivity } from '@/api/achievements'
import SnapshotReader from '@/components/molecules/SnapshotReader.vue'
import TarotEntry from '@/components/tarot/TarotEntry.vue'
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMirrorStore } from '@/stores/mirror'
import { useRecordsStore } from '@/stores/records'
import { useStatsStore } from '@/stores/stats'
import { useTodoStore } from '@/stores/todo'
import { useUIStore } from '@/stores/ui'
import { useToastStore } from '@/stores/toast'
import { useAuthStore } from '@/stores/auth'
import { MOOD_COLOR } from '@/constants/moodColor'
import { moodMap } from '@/constants/tags'
import { timeAgo } from '@/utils/time'
import StatisticsDeck from '@/components/organisms/StatisticsDeck.vue'
import PortraitCollage from '@/components/organisms/PortraitCollage.vue'
import SelectMenu from '@/components/atoms/SelectMenu.vue'
import PageMasthead from '@/components/molecules/PageMasthead.vue'
import MirrorStage from '@/components/organisms/MirrorStage.vue'
import { beginMirrorCut as beginMirrorShatter } from '@/composables/useMirrorCut'
import { gsap, prefersReducedMotion } from '@/motion/core'

export function useMirrorView() {
const mirror = useMirrorStore()
const recordsStore = useRecordsStore()
const statsStore = useStatsStore()
const todoStore = useTodoStore()
const ui = useUIStore()
const toast = useToastStore()
const auth = useAuthStore()
const mirrorStage = ref(null)
const switchingSnapshot = ref(false)
const preparingGeneration = ref(false)
const route = useRoute()
let viewEpoch = 0
const mirrorBusy = computed(() => preparingGeneration.value || switchingSnapshot.value || mirror.generating || mirror.generatingMonthly)
const viewActive = epoch => !isUnmounted && route.name === 'mirror' && epoch === viewEpoch
let snapshotGlass = null
let focusTween = null

async function focusMirrorSurface() {
  const surface = mirrorStage.value?.surface, content = surface?.closest('.page-content')
  if (!surface || !content) return null
  const rect = surface.getBoundingClientRect(), view = content.getBoundingClientRect()

  if (rect.top < view.top - 2 || rect.top > view.bottom - 100) {
    const target = content.scrollTop + rect.top - view.top
    focusTween?.kill()
    await new Promise(resolve => {
      focusTween = gsap.to(content, { scrollTop: Math.max(0, target), duration: prefersReducedMotion() ? 0 : .22, ease: 'power2.out', onComplete: resolve, onInterrupt: resolve })
    })
  }
  return isUnmounted || route.name !== 'mirror' ? null : surface
}
watch(() => route.name, name => {
  if (name === 'mirror') return
  viewEpoch += 1
  focusTween?.kill()
  snapshotGlass?.cancel()
}, { flush: 'sync' })
let mirrorViewMounted = false

function reloadMirrorForAccount(userId) {
  const nextOwnerId = userId === null || userId === undefined ? null : String(userId)
  mirror.ensureOwner(nextOwnerId)
  if (nextOwnerId === null) return
  mirror.fetchMirror().catch(() => {})

  mirror.fetchSnapshots().catch(() => {})
  mirror.fetchSnapshotMonths().catch(() => {})
}

function reloadMirror() {
  return Promise.all([mirror.fetchMirror(), mirror.fetchSnapshots()])
}

watch(() => auth.user?.id ?? null, (userId) => {
  if (mirrorViewMounted) reloadMirrorForAccount(userId)
})

onMounted(() => {
  mirrorViewMounted = true

  reloadMirrorForAccount(auth.user?.id)

  statsStore.fetchStats().catch(() => {})

  todoStore.fetchChains().catch(() => {})
})


const now = new Date()
const mirrorName = computed(() => '这一刻的你')
const monthNumber = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', month: '2-digit' }).format(now)
const yearNumber = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(now)
const openTodoCount = computed(() => (statsStore.todo.not_started || 0) + (statsStore.todo.in_progress || 0))






const stats = computed(() => {
  const daily = statsStore.record_daily
  const total = daily.reduce((a, d) => a + (d.count || 0), 0)
  const activeDays = daily.filter(d => (d.count || 0) > 0).length
  const avg = activeDays ? total / activeDays : 0
  const raw = [
    { num: total, label: '条记录', decimals: 0 },
    { num: activeDays, label: '活跃天', decimals: 0 },
    { num: avg, label: '日均', decimals: 1 },
  ]
  return raw.map(s => ({
    ...s,
    display: Number(s.num).toFixed(s.decimals),
  }))
})



let isUnmounted = false
const justSettled = ref(false)
let settledTimer = null
watch(() => mirror.profile, (p) => {
  if (!p || isUnmounted) return
  justSettled.value = true
  clearTimeout(settledTimer)
  settledTimer = setTimeout(() => { if (!isUnmounted) justSettled.value = false }, 1200)
})


const moodSegments = computed(() => {
  const count = {}
  statsStore.mood_daily.forEach(d => (d.moods || []).forEach(m => {
    count[m.mood] = (count[m.mood] || 0) + (m.count || 0)
  }))
  const total = Object.values(count).reduce((a, b) => a + b, 0)
  if (!total) return []
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([m, n]) => ({ key: m, label: moodMap[m] || m, pct: Math.round((n / total) * 100), color: MOOD_COLOR[m] || '#888' }))
})


const learningEvidence = computed(() => {
  const items = []
  recordsStore.records.forEach(r => (r.chunks || []).forEach(c => {
    if (c.metadata?.contentType === 'learning') items.push({ date: timeAgo(r.created_at), text: c.metadata?.title || c.segment })
  }))
  return items.slice(0, 2)
})


const chains = computed(() => todoStore.chains)


function openTodoRecord(recordId) {
  if (!recordId) return
  ui.selectedRecordId = recordId
  ui.showDetail = true
}


const moodLegend = computed(() => {
  const totals = {}
  statsStore.mood_daily.forEach(d => (d.moods || []).forEach(m => {
    totals[m.mood] = (totals[m.mood] || 0) + (m.count || 0)
  }))
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key]) => ({ key, label: moodMap[key] || key, color: MOOD_COLOR[key] || '#A8A8A0' }))
})


const freqSummary = computed(() => {
  const daily = statsStore.record_daily
  if (!daily.length) return ''
  const total = daily.reduce((a, d) => a + (d.count || 0), 0)
  const active = daily.filter(d => (d.count || 0) > 0).length
  return active ? `日均 ${(total / active).toFixed(1)} 条 · 活跃 ${active} 天` : ''
})


const statsFirstLoad = computed(() => statsStore.loading && !statsStore.record_daily.length)
const statsUnavailable = computed(() => statsFirstLoad.value || (!!statsStore.error && !statsStore.stats))




function shortDay(dateStr) {
  const s = String(dateStr || '')
  return s.length >= 10 ? s.slice(5, 10) : s
}


function shortDateTime(dateStr) {
  const s = String(dateStr || '')
  return s.length >= 16 ? `${s.slice(5, 10)} ${s.slice(11, 16)}` : s
}


const timeline = computed(() => (mirror.snapshots || []).map((s, i) => ({
  id: s.id,
  label: s.snapshot_type === 'monthly' && s.period_month
    ? monthLabel(s.period_month)
    : shortDay(s.created_at),
  full: s.created_at || '',
  type: s.snapshot_type === 'monthly' ? 'monthly' : 'manual',
  periodMonth: s.period_month || null,
  version: s.version_no || 1,
  contextStatus: s.context_status || 'usable',
  invalidatedReason: s.invalidated_reason || '',
  deletedSourceCount: Number(s.deleted_source_count || 0),
  archiveDiscontinuity: Boolean(s.archive_discontinuity),
  drift: s.drift_distance,
  summary: s.overall_summary || '',
  latest: i === 0,
  viewing: mirror.currentSnapshotId === s.id,
})))


const TIMELINE_RETENTION = '保留策略：手动最近 2 份 / 月度最近 12 份'


const timelineNote = computed(() => {
  const n = timeline.value.length
  if (!n) return mirror.snapshotsLoading ? '正在读取归档' : '暂无历史快照'
  const monthly = timeline.value.filter(t => t.type === 'monthly').length
  return `已加载 ${n} 份 · 手动 ${n - monthly} · 月度 ${monthly}`
})


async function switchSnapshot(load) {
  if (mirrorBusy.value) return
  switchingSnapshot.value = true
  const epoch = viewEpoch
  let effect = null
  try {
    const surface = await focusMirrorSurface()
    if (!viewActive(epoch)) return
    effect = snapshotGlass = beginMirrorShatter(surface)
    const ok = await load()
    if (!viewActive(epoch)) return
    if (!ok) { toast.error(mirror.error || '快照加载失败'); return }
    await nextTick()
    await effect?.reveal()
  } finally {
    effect?.cancel()
    if (snapshotGlass === effect) snapshotGlass = null
    if (!isUnmounted) switchingSnapshot.value = false
  }
}
async function onViewSnapshot(node) {
  if (node.id !== mirror.currentSnapshotId) await switchSnapshot(() => mirror.viewSnapshot(node.id))
  if (String(mirror.currentSnapshotId) === String(node.id)) snapshotReadSource.value = 'archive'
}
const snapshotReadSource = ref('current')


async function onBackToLatest() {
  await switchSnapshot(() => mirror.backToLatest())
  snapshotReadSource.value = 'current'
}


const compareMode = ref(false)

const compareAId = ref(null)

const compareBId = ref(null)

function toggleCompare() {
  compareMode.value = !compareMode.value
  if (compareMode.value) {

    compareAId.value = mirror.currentSnapshotId ?? (mirror.profile?.id ?? null)
    compareBId.value = defaultCompareB()
  } else {
    compareAId.value = null
    compareBId.value = null
  }
}


function defaultCompareB() {
  const list = timeline.value
  const other = list.find(n => n.id !== compareAId.value)
  return other ? other.id : null
}


const compareA = ref(null)

const compareB = ref(null)
const compareLoading = ref(false)


watch([compareAId, compareBId], async ([aId, bId], [prevA, prevB]) => {
  if (!compareMode.value) return
  if (aId === prevA && bId === prevB && compareA.value) return
  compareLoading.value = true
  const [a, b] = await Promise.all([
    aId ? mirror.fetchSnapshotDetail(aId) : Promise.resolve(null),
    bId ? mirror.fetchSnapshotDetail(bId) : Promise.resolve(null),
  ])
  if (isUnmounted) return
  compareA.value = a
  compareB.value = b
  compareLoading.value = false
  if (a && b && aId !== bId) reportAchievementActivity('snapshot.compared', aId, bId)
}, { immediate: true })


const driftDelta = computed(() => {
  const a = compareA.value?.drift_distance
  const b = compareB.value?.drift_distance
  if (a === null || a === undefined || b === null || b === undefined) return null
  return Math.abs(a - b)
})


function deltaTier(label) {
  if (label === '明显变化') return 'major'
  if (label === '有所变化') return 'minor'
  return 'stable'
}


const driftDeltaLabel = computed(() => (driftDelta.value === null ? null : mirror.driftLevel(driftDelta.value)))


const driftDeltaTier = computed(() => (driftDelta.value === null ? null : deltaTier(driftDeltaLabel.value)))


const compareOptions = computed(() => timeline.value.filter(n => n.id !== compareAId.value))

const compareReady = computed(() => Boolean(compareA.value && compareB.value))

function compareLabel(id) {
  const node = timeline.value.find(n => n.id === id)
  return node ? `${node.full ? shortDateTime(node.full) : `#${id}`} · ${node.type}` : `#${id}`
}


const compareAOptions = computed(() =>
  timeline.value.map(n => ({ value: n.id, label: compareLabel(n.id) })))
const compareBOptions = computed(() =>
  compareOptions.value.map(n => ({ value: n.id, label: compareLabel(n.id) })))

async function onGenerate() {
  if (mirrorBusy.value || mirror.loading) return
  preparingGeneration.value = true
  const epoch = viewEpoch
  try {
    await focusMirrorSurface()
    if (!viewActive(epoch)) return
    const captured = mirrorStage.value?.capture()
    const ok = await mirror.generate()

    if (!viewActive(epoch)) return
    if (ok) {
      toast.success('快照已生成')
      await nextTick()
      if (viewActive(epoch)) await mirrorStage.value?.reveal(captured)
    } else toast.error(mirror.error || '生成失败，请重试')
  } finally { if (!isUnmounted) preparingGeneration.value = false }
}




const ghostMonth = ref('')


watch(() => mirror.generatableMonths, (list) => {
  if (!list.includes(ghostMonth.value)) ghostMonth.value = list[0] || ''
}, { immediate: true })


function monthLabel(ym) {
  const year = Number(String(ym || '').slice(0, 4))
  const m = Number(String(ym || '').slice(5, 7))
  return m ? `${year}年${m}月` : String(ym || '')
}

function invalidationReasonText(reason) {
  const labels = {
    record_deleted: '引用的原始记录已删除',
    memory_revoked: '已取消这段内容的 AI 记忆授权',
    approved_chunk_edited: '已编辑这段授权内容',
    chunk_removed: '引用的内容片段已移除',
    legacy_untracked_source_change: '旧版镜子没有来源清单；授权变化后已停止用于后续镜子',
    legacy_invalidated: '该镜子在归档升级前已经失效',
  }
  return labels[reason] || (reason ? `归档原因：${reason}` : '来源发生变化，这份镜子仅保留查阅')
}


const ghostMonthOptions = computed(() =>
  mirror.generatableMonths.map(ym => ({ value: ym, label: monthLabel(ym) })))

const confirmingMonth = ref(null)
const cancelMonthConfirmButton = ref(null)
const monthConfirmTrigger = ref(null)

async function requestMonthGeneration(month, event) {
  if (!month || mirrorBusy.value) return
  monthConfirmTrigger.value = event?.currentTarget || null
  confirmingMonth.value = month
  await nextTick()
  cancelMonthConfirmButton.value?.focus()
}

function closeMonthConfirmation() {
  confirmingMonth.value = null
  nextTick(() => monthConfirmTrigger.value?.focus?.())
}


async function onGenerateMonthly(event) {
  await requestMonthGeneration(ghostMonth.value, event)
}

async function confirmMonthGeneration() {
  const month = confirmingMonth.value
  if (!month || mirrorBusy.value) return
  preparingGeneration.value = true
  const epoch = viewEpoch
  confirmingMonth.value = null
  const trigger = monthConfirmTrigger.value
  try {
    await nextTick()
    trigger?.focus?.({ preventScroll: true })
    await focusMirrorSurface()
    if (!viewActive(epoch)) return
    const captured = mirrorStage.value?.capture()
    const res = await mirror.generateForMonth(month)
    if (!viewActive(epoch)) return
    if (res.ok) {
      toast.success(`${monthLabel(month)}的镜子已生成`)
      await nextTick()
      if (viewActive(epoch)) await mirrorStage.value?.reveal(captured)
    } else toast.error(mirror.error || '生成失败，请重试')
  } finally { if (!isUnmounted) preparingGeneration.value = false }
}

onBeforeUnmount(() => {
  focusTween?.kill()
  snapshotGlass?.cancel()
  isUnmounted = true
  clearTimeout(settledTimer)
})

return { SnapshotReader, TarotEntry, ref, StatisticsDeck, PortraitCollage, SelectMenu, PageMasthead, MirrorStage, mirror, statsStore, todoStore, ui, mirrorStage, preparingGeneration, mirrorBusy, reloadMirror, mirrorName, openTodoCount, stats, justSettled, moodSegments, learningEvidence, chains, openTodoRecord, moodLegend, freqSummary, statsFirstLoad, statsUnavailable, shortDateTime, timeline, TIMELINE_RETENTION, timelineNote, onViewSnapshot, snapshotReadSource, onBackToLatest, compareMode, compareAId, compareBId, toggleCompare, compareA, compareB, compareLoading, driftDelta, driftDeltaLabel, driftDeltaTier, compareReady, compareAOptions, compareBOptions, onGenerate, ghostMonth, monthLabel, invalidationReasonText, ghostMonthOptions, confirmingMonth, cancelMonthConfirmButton, requestMonthGeneration, closeMonthConfirmation, onGenerateMonthly, confirmMonthGeneration }
}
