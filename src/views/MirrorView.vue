<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
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
import ActivityBand from '@/components/charts/ActivityBand.vue'
import RhythmDist from '@/components/charts/RhythmDist.vue'
import KeywordBars from '@/components/charts/KeywordBars.vue'
import TodoRing from '@/components/charts/TodoRing.vue'
import TodoChainCard from '@/components/molecules/TodoChainCard.vue'
import SelectMenu from '@/components/atoms/SelectMenu.vue'
import PageMasthead from '@/components/molecules/PageMasthead.vue'

const mirror = useMirrorStore()
const recordsStore = useRecordsStore()
const statsStore = useStatsStore()
const todoStore = useTodoStore()
const ui = useUIStore()
const toast = useToastStore()
const auth = useAuthStore()
let mirrorViewMounted = false
let mirrorOwnerId = null
let mirrorOwnerInitialized = false

function reloadMirrorForAccount(userId) {
  const nextOwnerId = userId === null || userId === undefined ? null : String(userId)
  if (mirrorOwnerInitialized && nextOwnerId === mirrorOwnerId) return
  mirrorOwnerInitialized = true
  mirrorOwnerId = nextOwnerId
  mirror.resetForRefresh()
  if (nextOwnerId === null) return
  mirror.fetchMirror().catch(() => {})
  // 归档首屏与可重建月份分开加载，任一失败都不阻断镜子正文。
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
  // 异步回调统一过 isUnmounted 守卫：resolve 时组件可能已被 Transition 卸载（out-in 离场期间无 DOM 可更新）
  reloadMirrorForAccount(auth.user?.id)
  // 六图表数据源（B Agent 真接口，stats store 内 30s 缓存）
  statsStore.fetchStats().catch(() => {})
  // 证据链（「未完成的事」模块数据源；store 有缓存，两页共用一份 chains）
  todoStore.fetchChains().catch(() => {})
})

/** 镜子名：当前月份 */
const now = new Date()
const mirrorName = computed(() => '这一刻的你')
const monthNumber = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', month: '2-digit' }).format(now)
const yearNumber = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(now)
const openTodoCount = computed(() => (statsStore.todo.not_started || 0) + (statsStore.todo.in_progress || 0))

// ---- 三格 stats：口径 = statsStore.record_daily 30 天窗口（不随日历页日期筛选变动） ----
// 注：原 JS rAF 数字滚动动画已移除——卸载竞态（__vnode null）反复复发，稳定性优先于装饰性动效。
// 入场视觉由 hero 卡的 cardIn CSS 动画承担，无 JS 状态写入。

/** 三格 stats：口径 = statsStore.record_daily 30 天窗口（不随日历页日期筛选变动） */
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

// ---- 生成完成：hero 一次轻脉冲 ----
/** 组件卸载标志：卸载后 watcher/timer/异步回调不得再写响应式状态 */
let isUnmounted = false
const justSettled = ref(false)
let settledTimer = null
watch(() => mirror.profile, (p) => {
  if (!p || isUnmounted) return
  justSettled.value = true
  clearTimeout(settledTimer)
  settledTimer = setTimeout(() => { if (!isUnmounted) justSettled.value = false }, 1200)
})

/** 情绪分布（从记录 chunks mood 统计，top5） */
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

/** 学习来源证据（learning 类 chunk，最近 2 条） */
const learningEvidence = computed(() => {
  const items = []
  recordsStore.records.forEach(r => (r.chunks || []).forEach(c => {
    if (c.metadata?.contentType === 'learning') items.push({ date: timeAgo(r.created_at), text: c.metadata?.title || c.segment })
  }))
  return items.slice(0, 2)
})

/**
 * 未完成的事：证据链视图（todoStore.chains，与侧栏待办速览同组件同数据）。
 * 旧的 records chunk 遍历（taskStatus 单行）已被 TodoChainCard 取代。
 */
const chains = computed(() => todoStore.chains)

/** 链节点 open-record → 打开 DetailPanel（与 RecordsView 同款接线：ui store 全局常驻） */
function openTodoRecord(recordId) {
  if (!recordId) return
  ui.selectedRecordId = recordId
  ui.showDetail = true
}

/** MoodBand 图例：30 天窗口内实际出现过的情绪（按出现总量倒序，最多 8 个） */
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

/** 频率摘要：日均（按有记录的天算）+ 活跃天数，补足稀疏柱状图的信息量 */
const freqSummary = computed(() => {
  const daily = statsStore.record_daily
  if (!daily.length) return ''
  const total = daily.reduce((a, d) => a + (d.count || 0), 0)
  const active = daily.filter(d => (d.count || 0) > 0).length
  return active ? `日均 ${(total / active).toFixed(1)} 条 · 活跃 ${active} 天` : ''
})

/**
 * 统计区首次加载：loading 且尚无数据。
 * 此时不能让图表走"暂无数据"分支——那会把"还没取到"说成"你没有记录"。
 */
const statsFirstLoad = computed(() => statsStore.loading && !statsStore.record_daily.length)
const statsUnavailable = computed(() => statsFirstLoad.value || (!!statsStore.error && !statsStore.stats))

// ===== 任务 A：快照历史轨迹 + 查看 + 对比 =====

/** "2026-09-05 10:00:00" → "09-05" */
function shortDay(dateStr) {
  const s = String(dateStr || '')
  return s.length >= 10 ? s.slice(5, 10) : s
}

/** "2026-09-05 10:00:00" → "09-05 10:00" */
function shortDateTime(dateStr) {
  const s = String(dateStr || '')
  return s.length >= 16 ? `${s.slice(5, 10)} ${s.slice(11, 16)}` : s
}

/** 轨迹节点：接口列表（倒序，最新在前），每节点标日期/类型/是否最新 */
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

/** 快照保留策略（原角标文案，收进 title，主行只留数量归属） */
const TIMELINE_RETENTION = '保留策略：手动最近 2 份 / 月度最近 12 份'

/**
 * 时间线口径摘要：共 N 份 · 手动 X · 月度 Y。
 * 旧文案「1 份 · manual 保 2 / monthly 保 12」数量归属含混（保 2/12 是保留上限不是当前份数），
 * 这里把"当前份数"与"保留策略"拆开：主行只报份数，策略进 title。
 */
const timelineNote = computed(() => {
  const n = timeline.value.length
  if (!n) return mirror.snapshotsLoading ? '正在读取归档' : '暂无历史快照'
  const monthly = timeline.value.filter(t => t.type === 'monthly').length
  return `已加载 ${n} 份 · 手动 ${n - monthly} · 月度 ${monthly}`
})

/** 查看历史快照（hero 切换为该快照内容）；卸载后不弹 toast（组件已不在 DOM） */
async function onViewSnapshot(node) {
  const ok = await mirror.viewSnapshot(node.id)
  if (!ok && !isUnmounted) toast.error(mirror.error || '快照加载失败')
}

/** 回到最新（最新节点也可点，用于从历史快照切回） */
async function onBackToLatest() {
  const ok = await mirror.backToLatest()
  if (!ok && !isUnmounted) toast.error(mirror.error || '快照加载失败')
}

/** 对比模式开关 */
const compareMode = ref(false)
/** 对比基线（左侧/锚点）快照 id：进入对比模式时锁定当前查看的快照 */
const compareAId = ref(null)
/** 对比另一份（右侧）快照 id */
const compareBId = ref(null)

function toggleCompare() {
  compareMode.value = !compareMode.value
  if (compareMode.value) {
    // 锚点 = 当前查看的快照；默认候选 = 时间线里最新一份非锚点快照
    compareAId.value = mirror.currentSnapshotId ?? (mirror.profile?.id ?? null)
    compareBId.value = defaultCompareB()
  } else {
    compareAId.value = null
    compareBId.value = null
  }
}

/** 默认对比对象：时间线里第一份不等于锚点的快照，没有则 null（提示用户自选） */
function defaultCompareB() {
  const list = timeline.value
  const other = list.find(n => n.id !== compareAId.value)
  return other ? other.id : null
}

/** 对比数据 A（锚点） */
const compareA = ref(null)
/** 对比数据 B */
const compareB = ref(null)
const compareLoading = ref(false)

/** 拉取两份对比快照详情（store 内 60s 缓存，重复对比不重复请求）
 *  卸载守卫：resolve 时组件可能已随路由切走（out-in 离场期无 DOM），不再写状态 */
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
}, { immediate: true })

/** 漂移差值（两快照 drift_distance 都有值才算）：Δ = |A - B| */
const driftDelta = computed(() => {
  const a = compareA.value?.drift_distance
  const b = compareB.value?.drift_distance
  if (a === null || a === undefined || b === null || b === undefined) return null
  return Math.abs(a - b)
})

/** 漂移程度词 → 程度档位（英文类名，供 CSS 语义色着色） */
function deltaTier(label) {
  if (label === '明显变化') return 'major'
  if (label === '有所变化') return 'minor'
  return 'stable'
}

/** Δ 程度词（driftDelta → 程度词；沿用 store.driftLevel 阈值口径） */
const driftDeltaLabel = computed(() => (driftDelta.value === null ? null : mirror.driftLevel(driftDelta.value)))

/** Δ 程度档位（driftDelta → 'stable' | 'minor' | 'major' | null） */
const driftDeltaTier = computed(() => (driftDelta.value === null ? null : deltaTier(driftDeltaLabel.value)))

/** 对比可选节点（B 下拉排除锚点自身） */
const compareOptions = computed(() => timeline.value.filter(n => n.id !== compareAId.value))

const compareReady = computed(() => Boolean(compareA.value && compareB.value))

function compareLabel(id) {
  const node = timeline.value.find(n => n.id === id)
  return node ? `${node.full ? shortDateTime(node.full) : `#${id}`} · ${node.type}` : `#${id}`
}

/** A / B 对比下拉选项（SelectMenu 用） */
const compareAOptions = computed(() =>
  timeline.value.map(n => ({ value: n.id, label: compareLabel(n.id) })))
const compareBOptions = computed(() =>
  compareOptions.value.map(n => ({ value: n.id, label: compareLabel(n.id) })))

async function onGenerate() {
  const ok = await mirror.generate()
  // 生成阻塞数十秒，期间用户可能已切页：卸载后只落 store 不弹 toast（无宿主 DOM）
  if (isUnmounted) return
  if (ok) toast.success('快照已生成')
  else toast.error(mirror.error || '生成失败，请重试')
}

// ===== 任务：按月生成镜子快照（时间线尾部"幽灵卡"入口） =====

/** 幽灵卡选中的目标月份（默认取最早一个可生成月份，生成顺序 = 时间线自然走向） */
const ghostMonth = ref('')

/** 月份选项变化时回落到第一个候选（候选集为空则空串 → 淡态卡片） */
watch(() => mirror.generatableMonths, (list) => {
  if (!list.includes(ghostMonth.value)) ghostMonth.value = list[0] || ''
}, { immediate: true })

/** "2026-08" → "2026年8月"，月份标题遵循镜子的归属月。 */
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

/** 幽灵卡月份下拉选项（SelectMenu 用；原生 select 的下拉面板无法样式化） */
const ghostMonthOptions = computed(() =>
  mirror.generatableMonths.map(ym => ({ value: ym, label: monthLabel(ym) })))

const confirmingMonth = ref(null)
const cancelMonthConfirmButton = ref(null)
const monthConfirmTrigger = ref(null)

async function requestMonthGeneration(month, event) {
  if (!month || mirror.generatingMonthly) return
  monthConfirmTrigger.value = event?.currentTarget || null
  confirmingMonth.value = month
  await nextTick()
  cancelMonthConfirmButton.value?.focus()
}

function closeMonthConfirmation() {
  confirmingMonth.value = null
  nextTick(() => monthConfirmTrigger.value?.focus?.())
}

/**
 * 生成该月 monthly 快照：
 * 成功 → toast「N 月的镜子已生成」+ store 内已 fetchSnapshots + viewSnapshot 定位新快照；
 * 失败 → toast 后端 message（400 当前/未来月等）。
 * 卸载守卫与其他长时操作同口径：卸载后不弹 toast。
 */
async function onGenerateMonthly(event) {
  await requestMonthGeneration(ghostMonth.value, event)
}

async function confirmMonthGeneration() {
  const month = confirmingMonth.value
  if (!month) return
  confirmingMonth.value = null
  const trigger = monthConfirmTrigger.value
  await nextTick()
  trigger?.focus?.()
  if (!month || mirror.generatingMonthly) return
  const res = await mirror.generateForMonth(month)
  if (isUnmounted) return
  if (res.ok) toast.success(`${monthLabel(month)}的镜子已生成`)
  else toast.error(mirror.error || '生成失败，请重试')
}

onBeforeUnmount(() => {
  isUnmounted = true
  clearTimeout(settledTimer)
})
</script>

<template>
  <div class="page mirror-page">
    <div class="page-content">
      <PageMasthead title="我的镜子" english="MY REFLECTION" description="回望记录，看见这段时间的自己">
        <span class="period-caption">近 30 天</span>
        <button class="p3-button" :disabled="mirror.generating || mirror.loading" @click="onGenerate">{{ mirror.generating ? '正在显影…' : '生成新快照' }}<span aria-hidden="true">↗</span></button>
      </PageMasthead>
      <section class="reflection-stage" aria-label="近 30 天生活回顾">
        <div class="stage-word" aria-hidden="true">REFLECT.</div>
        <div class="stage-orbit" aria-hidden="true" />
        <div class="stage-month" aria-hidden="true"><b>{{ monthNumber }}</b><span>{{ yearNumber }}<br>YOUR DAYS</span></div>
        <div class="stage-copy"><span class="stage-kicker">LIFE, IN REFLECTION</span><template v-if="!statsUnavailable && !stats[0].num"><h2>你的故事，<br>从今天开始。</h2><p>记下第一件小事，<br>让镜子慢慢认识你。</p><button class="stage-first-record" @click="ui.openWriteModal()">写下第一条记录 <span aria-hidden="true">＋</span></button></template><template v-else><h2>原来，<br>你做了这么多。</h2><p>那些认真生活的瞬间，<br>正在拼成越来越清晰的你。</p></template></div>
        <div class="stage-stats">
          <div><strong>{{ statsUnavailable ? '—' : stats[0].display }}</strong><span>次记录<small>留下生活的痕迹</small></span></div>
          <div><strong>{{ statsUnavailable ? '—' : stats[1].display }}</strong><span>个活跃日<small>每一天都有回响</small></span></div>
          <div><strong>{{ statsUnavailable ? '—' : statsStore.todo.completed }}</strong><span>件已完成<small>努力已经有了答案</small></span></div>
          <span class="stage-stats-note">近 30 天实时统计</span>
        </div>
      </section>
      <div class="reflection-status" aria-label="近期状态概览">
        <div><span>最近的情绪</span><strong>{{ statsFirstLoad ? '正在读取…' : statsUnavailable ? '暂不可用' : moodSegments[0]?.label || '等待记录' }}</strong><i :style="{ background: moodSegments[0]?.color || 'var(--cyan)' }" /></div>
        <div><span>经常关注</span><strong>{{ statsUnavailable ? '暂不可用' : statsStore.keyword_top[0]?.keyword || '从下一条记录开始' }}</strong></div>
        <div><span>仍在推进</span><strong>{{ statsUnavailable ? '—' : openTodoCount }} <small>件待办</small></strong></div>
      </div>
      <div v-if="statsStore.error" class="stats-error" role="alert"><span>近期统计暂时无法加载</span><button class="p3-link" @click="statsStore.fetchStats(30, true)">重试</button></div>
      <div v-if="mirror.error && !mirror.profile" class="mirror-error" role="alert"><p>{{ mirror.error }}</p><button class="p3-button secondary" @click="reloadMirror">重新加载快照</button></div>
      <!-- 生成中 -->
      <div v-else-if="mirror.generating" class="processing-view">
        <div class="processing-ring" />
        <div class="processing-title">正在生成画像快照</div>
        <div class="processing-desc">正在整理你的经历、成长和近期状态，请稍等片刻。</div>
      </div>

      <div v-else-if="mirror.isEmpty && (mirror.loading || mirror.snapshots === null || mirror.snapshotsLoading)" class="processing-view" role="status">
        <div class="processing-ring" />
        <div class="processing-title">正在读取镜子归档</div>
        <div class="processing-desc">检查是否有可查阅的历史快照</div>
      </div>

      <div v-else-if="mirror.isEmpty && mirror.error" class="empty-state" style="padding:70px 20px">
        <div class="empty-title">暂时无法打开镜子归档</div>
        <div class="empty-desc">{{ mirror.error }}</div>
        <button class="mirror-generate" style="max-width:260px;margin:20px auto 0" @click="mirror.fetchSnapshots">
          重试读取归档
        </button>
      </div>

      <!-- 首次使用：引导生成 -->
      <div v-else-if="mirror.isEmpty" class="empty-state" style="padding:70px 20px">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>
        </div>
        <div class="empty-title">还没有画像快照</div>
        <div class="empty-desc">写满几条记录后，让 AI 为你生成第一份画像</div>
        <button class="mirror-generate" style="max-width:260px;margin:20px auto 0" @click="onGenerate">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>
          生成画像快照
        </button>
      </div>

      <template v-else-if="mirror.profile">
        <!-- ===== 快照轨迹条（时间线：点节点切换查看；最新在前） ===== -->
        <div class="portrait-section card timeline-card">
          <!-- 头行：眉标 + 份数摘要 + 对比开关（对比原独占一行，合并进头行省一整行高度） -->
          <div class="timeline-head">
            <span class="section-label">快照时间线</span>
            <span class="chart-head-note" :title="timeline.length ? TIMELINE_RETENTION : null">{{ timelineNote }}</span>
            <div v-if="timeline.length >= 2" class="timeline-actions">
              <button type="button" :class="['compare-toggle', { on: compareMode }]" @click="toggleCompare">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M8 3v18M16 3v18M3 8h10M11 16h10"/></svg>
                {{ compareMode ? '退出对比' : '对比两份快照' }}
              </button>
              <span v-if="!compareMode" class="compare-hint">看看两个阶段的自己有什么不同</span>
            </div>
          </div>
          <div v-if="mirror.snapshotsError && !timeline.length" class="snapshot-history-error" role="alert"><span>快照历史暂时无法加载</span><button @click="mirror.fetchSnapshots()">重试快照历史</button></div>
          <div v-else-if="mirror.snapshotsLoading && !timeline.length" class="portrait-text">正在读取历史快照…</div>
          <div v-else-if="timeline.length" class="snapshot-strip" role="tablist" aria-label="镜子归档时间线">
            <button
              v-for="node in timeline"
              :key="node.id"
              type="button"
              role="tab"
              :aria-selected="node.viewing"
              :class="['snapshot-chip', 'snapshot-node', `state-${node.contextStatus}`, { current: node.viewing, latest: node.latest }]"
              :aria-label="`${node.label}，${node.type === 'monthly' ? '月度镜子' : '手动镜子'}，第 ${node.version} 版，${node.contextStatus === 'usable' ? '可用于后续镜子' : '仅作归档'}${node.archiveDiscontinuity ? '，累计历史有断点' : ''}`"
              :title="`${shortDateTime(node.full)} · ${node.type} · V${node.version} · ${node.contextStatus === 'usable' ? '可续写' : '仅归档'}${node.archiveDiscontinuity ? ' · 历史链有断点' : ''}${node.invalidatedReason ? ` · ${invalidationReasonText(node.invalidatedReason)}` : ''}${node.drift !== null && node.drift !== undefined ? ` · 漂移 ${node.drift}` : ''}`"
              @click="onViewSnapshot(node)"
            >
              <span class="snapshot-node-date">{{ node.label }}</span>
              <span class="snapshot-node-version">V{{ node.version }}</span>
              <span :class="['snapshot-type-badge', `badge-${node.type}`]">{{ node.type === 'monthly' ? '月度' : '手动' }}</span>
              <span :class="['snapshot-context-tag', node.contextStatus === 'usable' ? 'context-usable' : 'context-archive']">
                {{ node.contextStatus === 'usable' ? '可续写' : '仅归档' }}
              </span>
              <span v-if="node.archiveDiscontinuity" class="snapshot-break-tag">历史断点</span>
              <span v-if="node.viewing" class="snapshot-viewing-tag">查看中</span>
              <span v-else-if="node.latest" class="snapshot-latest-tag">最新</span>
            </button>
          </div>
          <div v-else-if="mirror.snapshotsError" class="timeline-load-error" role="status">
            <span>{{ mirror.snapshotsError }}</span>
            <button type="button" @click="mirror.fetchSnapshots()">重试</button>
          </div>
          <div v-else-if="!mirror.snapshotsLoading" class="portrait-text">暂无历史快照，生成第一份画像后这里会出现时间线。</div>

          <div v-if="mirror.snapshotsHasMore || mirror.snapshotsLoadingMore || mirror.snapshotsError" class="timeline-more">
            <span v-if="mirror.snapshotsError" class="timeline-more-error" role="status">{{ mirror.snapshotsError }}</span>
            <button
              type="button"
              class="timeline-more-btn"
              :disabled="mirror.snapshotsLoadingMore"
              @click="mirror.snapshotsHasMore ? mirror.fetchMoreSnapshots() : mirror.fetchSnapshots()"
            >
              {{ mirror.snapshotsLoadingMore ? '正在载入…' : mirror.snapshotsError ? '重试加载' : '加载更早镜子' }}
            </button>
          </div>

          <!-- 月份候选由后端依据授权记录与归属月计算；已失效归档月份仍可选择重建。 -->
          <div v-if="mirror.generatableMonths.length" class="ghost-card">
            <div class="ghost-head">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              为历史月份生成镜子
            </div>
            <div class="ghost-actions">
              <SelectMenu
                v-model="ghostMonth"
                class="ghost-select"
                :options="ghostMonthOptions"
                size="sm"
                :block="false"
                aria-label="选择要生成月度画像的月份"
              />
              <button type="button" class="ghost-btn" :disabled="mirror.generatingMonthly || !ghostMonth" @click="onGenerateMonthly">
                <svg v-if="!mirror.generatingMonthly" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                {{ mirror.generatingMonthly ? '照镜中…' : '新建版本' }}
              </button>
            </div>
            <div v-if="mirror.snapshotMonthsError" class="ghost-loading" role="status">{{ mirror.snapshotMonthsError }} <button type="button" @click="mirror.fetchSnapshotMonths()">重试</button></div>
            <div v-else-if="mirror.generatingMonthly" class="ghost-loading">正在生成新镜子…</div>
          </div>
          <div v-else-if="mirror.snapshotMonthsLoading" class="timeline-idle" role="status">正在查找可生成的历史月份…</div>
          <div v-else-if="mirror.snapshotMonthsError" class="timeline-idle" role="status">
            {{ mirror.snapshotMonthsError }} <button type="button" @click="mirror.fetchSnapshotMonths()">重试</button>
          </div>
          <p v-else-if="timeline.length" class="timeline-idle">暂无可生成的历史月份</p>
        </div>

        <!-- ===== 对比区（compareMode 开启时插入 hero 上方） ===== -->
        <div v-if="compareMode" class="portrait-section card compare-card">
          <div class="chart-head" style="margin-bottom:12px">
            <span class="section-label">阶段对比</span>
            <span v-if="driftDelta !== null" :class="['delta-chip', `tier-${driftDeltaTier}`]">
              Δ 漂移 {{ driftDelta.toFixed(3) }} · {{ driftDeltaLabel }}
            </span>
            <span v-else-if="compareReady" class="chart-head-note">两份快照均无漂移基线，Δ 不可比</span>
          </div>

          <!-- A / B 选择行 -->
          <div class="compare-pickers">
            <label class="compare-picker">
              <span class="compare-picker-label">基准 A</span>
              <SelectMenu
                v-model="compareAId"
                class="compare-select"
                :options="compareAOptions"
                size="sm"
                :block="false"
                aria-label="对比基准 A"
              />
            </label>
            <span class="compare-vs">vs</span>
            <label class="compare-picker">
              <span class="compare-picker-label">对比 B</span>
              <SelectMenu
                v-model="compareBId"
                class="compare-select"
                :options="compareBOptions"
                size="sm"
                :block="false"
                aria-label="对比对象 B"
              />
            </label>
          </div>

          <div v-if="compareLoading && !compareReady" class="compare-loading">正在加载两份快照…</div>

          <template v-else-if="compareReady">
            <!-- overall 左右并排 -->
            <div class="compare-grid compare-overall">
              <div class="compare-col">
                <div class="compare-col-head">
                  <span class="compare-col-title">A · {{ shortDateTime(compareA.created_at) }}</span>
                  <span :class="['snapshot-type-badge', `badge-${compareA.snapshot_type === 'monthly' ? 'monthly' : 'manual'}`]">
                    {{ compareA.snapshot_type === 'monthly' ? '月度' : '手动' }}
                  </span>
                </div>
                <div class="compare-text">{{ compareA.overall_summary || '暂无总体总结' }}</div>
              </div>
              <div class="compare-col">
                <div class="compare-col-head">
                  <span class="compare-col-title">B · {{ shortDateTime(compareB.created_at) }}</span>
                  <span :class="['snapshot-type-badge', `badge-${compareB.snapshot_type === 'monthly' ? 'monthly' : 'manual'}`]">
                    {{ compareB.snapshot_type === 'monthly' ? '月度' : '手动' }}
                  </span>
                </div>
                <div class="compare-text">{{ compareB.overall_summary || '暂无总体总结' }}</div>
              </div>
            </div>

            <!-- 六维左右并排（四段分析 + user_tags） -->
            <div class="compare-grid compare-dims">
              <div v-for="dim in [
                { key: 'mood', label: '情绪维度', field: 'mood_analysis' },
                { key: 'learning', label: '学习维度', field: 'learning_analysis' },
                { key: 'todo', label: '待办维度', field: 'todo_analysis' },
                { key: 'rhythm', label: '节奏维度', field: 'rhythm_analysis' },
              ]" :key="dim.key" class="compare-dim-row">
                <div class="compare-dim-label">{{ dim.label }}</div>
                <div class="compare-dim-cells">
                  <div class="compare-text dim">{{ compareA[dim.field] || '暂无分析' }}</div>
                  <div class="compare-text dim">{{ compareB[dim.field] || '暂无分析' }}</div>
                </div>
              </div>
              <div class="compare-dim-row">
                <div class="compare-dim-label">个人标签</div>
                <div class="compare-dim-cells">
                  <div class="compare-tags">
                    <span v-for="tag in (compareA.user_tags || [])" :key="'a' + tag" class="user-tag sm">{{ tag }}</span>
                    <span v-if="!(compareA.user_tags || []).length" class="compare-text dim">暂无标签</span>
                  </div>
                  <div class="compare-tags">
                    <span v-for="tag in (compareB.user_tags || [])" :key="'b' + tag" class="user-tag sm">{{ tag }}</span>
                    <span v-if="!(compareB.user_tags || []).length" class="compare-text dim">暂无标签</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 漂移距离芯片高亮 -->
            <div class="compare-drift-row">
              <div class="compare-drift-cell">
                <span class="compare-drift-num">{{
                  compareA.drift_distance !== null && compareA.drift_distance !== undefined
                    ? compareA.drift_distance.toFixed(3) : '—'
                }}</span>
                <span class="compare-drift-cap">A 漂移距离（vs 上一份月度）</span>
              </div>
              <div :class="['compare-drift-cell', 'delta-main', driftDeltaTier ? `tier-${driftDeltaTier}` : '']">
                <span class="compare-drift-num">{{
                  driftDelta !== null ? `Δ ${driftDelta.toFixed(3)}` : 'Δ —'
                }}</span>
                <span class="compare-drift-cap">{{ driftDelta !== null ? driftDeltaLabel : '两份均无漂移基线' }}</span>
              </div>
              <div class="compare-drift-cell">
                <span class="compare-drift-num">{{
                  compareB.drift_distance !== null && compareB.drift_distance !== undefined
                    ? compareB.drift_distance.toFixed(3) : '—'
                }}</span>
                <span class="compare-drift-cap">B 漂移距离（vs 上一份月度）</span>
              </div>
            </div>
          </template>
        </div>

        <!-- mirror-hero：左主文案 + 右指标栏（右栏消化超宽屏的大片右侧留白） -->
        <div :class="['mirror-hero', 'card', { settled: justSettled }]">
          <div class="mirror-hero-inner">
            <div class="mirror-hero-main">
              <div class="mirror-greeting">从你的记录中，看到这些变化</div>
              <div class="mirror-name">{{ mirrorName }}</div>
              <div v-if="!mirror.isEmpty" class="mirror-viewing-line">
                正在查看：{{ shortDateTime(mirror.profile.created_at) }}
                <span :class="['snapshot-type-badge', `badge-${mirror.profile.snapshot_type === 'monthly' ? 'monthly' : 'manual'}`]">
                  {{ mirror.profile.snapshot_type === 'monthly' ? '月度快照' : '手动快照' }}
                </span>
                <button
                  v-if="timeline.length && !timeline[0].viewing"
                  type="button"
                  class="back-latest-btn"
                  @click="onBackToLatest"
                >回到最新</button>
              </div>
              <div v-if="mirror.profile.context_status === 'archive_only' || mirror.profile.archive_discontinuity" class="mirror-archive-note" role="status">
                <strong>{{ mirror.profile.context_status === 'archive_only' ? '仅作归档' : '历史断点' }}</strong>
                <span v-if="mirror.profile.context_status === 'archive_only'">这份镜子仍可查看，不会用于后续镜子的生成。</span>
                <span v-if="mirror.profile.archive_discontinuity">更早的部分来源已无法完整重建，累计历史从这里存在断点。</span>
                <span v-if="mirror.profile.context_status === 'archive_only'">{{ invalidationReasonText(mirror.profile.invalidated_reason) }}</span>
                <span v-if="mirror.profile.deleted_source_count > 0" class="deleted-source-note">
                  原始记录已删除（{{ mirror.profile.deleted_source_count }} 条）
                </span>
              </div>
              <div v-if="mirror.drift" class="mirror-drift">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>
                较上月漂移 Δ {{ mirror.profile.drift_distance }} · {{ mirror.drift.level }}
              </div>
              <div class="mirror-overall">{{ mirror.profile.overall_summary || '还没有总体总结，先去写几条记录吧。' }}</div>
              <button class="mirror-generate" :disabled="mirror.generating" @click="onGenerate">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>
                {{ mirror.generating ? '生成中…' : '更新这一刻的快照' }}
              </button>
              <button
                v-if="mirror.profile.snapshot_type === 'monthly' && mirror.profile.period_month && mirror.profile.context_status === 'usable' && mirror.profile.is_current"
                type="button"
                class="mirror-regenerate-month"
                :disabled="mirror.generatingMonthly"
                @click="requestMonthGeneration(mirror.profile.period_month, $event)"
              >
                为 {{ monthLabel(mirror.profile.period_month) }} 新建版本
              </button>
            </div>

          </div>
        </div>

        <!-- ===== 统计图区（R6 重排：色带全宽 → 三小卡 → 两卡 → portrait → 快照） ===== -->

        <!-- 30 天活动带（全宽）：情绪与记录数融合在同一根时间轴上 -->
        <div class="portrait-section card chart-card zone-start">
          <div class="chart-head">
            <span class="section-label">生活留下的轨迹</span>
            <span class="chart-head-note">柱高 = 当日记录数 · 柱内按情绪占比分色</span>
          </div>
          <ActivityBand v-if="!statsFirstLoad" :daily="statsStore.record_daily" :moods="statsStore.mood_daily" />
          <div v-else class="sk-block sk-activity" aria-busy="true" />
          <div class="chart-legend">
            <span v-for="item in moodLegend" :key="item.key" class="chart-legend-item">
              <i class="legend-dot" :style="{ background: item.color }" />{{ item.label }}
            </span>
            <span v-if="freqSummary" class="chart-legend-item mono">{{ freqSummary }}</span>
          </div>
        </div>

        <!-- 节律 + 待办完成度（桌面并排，窄屏堆叠） -->
        <div class="chart-row-2">
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">你的生活节奏</span>
              <span class="chart-head-note">实时统计 · 哪个时段 / 哪一天在记录</span>
            </div>
            <RhythmDist v-if="!statsFirstLoad" :hours="statsStore.hour_dist" :weekdays="statsStore.weekday_dist" />
            <div v-else class="sk-block sk-rhythm" aria-busy="true" />
          </div>
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">那些完成的事</span>
              <span class="chart-head-note">近 30 天完成度</span>
            </div>
            <!-- 口径注释由 TodoRing 自带（.ring-note），此处不再重复渲染 -->
            <div class="chart-body">
              <TodoRing v-if="!statsFirstLoad" :todo="statsStore.todo" />
              <div v-else class="sk-block sk-ring" aria-busy="true" />
            </div>
          </div>
        </div>

        <!-- 关键词 + 情绪构成（桌面并排，窄屏堆叠） -->
        <div class="chart-row-2">
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">反复出现的关注</span>
              <span class="chart-head-note">实时统计 · Top 10</span>
            </div>
            <div class="chart-body">
              <KeywordBars v-if="!statsFirstLoad" :data="statsStore.keyword_top" />
              <div v-else class="sk-block sk-keywords" aria-busy="true" />
            </div>
            <div class="chart-legend">
              <span class="chart-legend-item">条长 = 出现次数（右侧数值，悬浮可见「出现 N 次」）</span>
            </div>
          </div>
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">最近的情绪底色</span>
              <span class="chart-head-note">近 30 天 · 按出现次数</span>
            </div>
            <div class="chart-body">
              <div v-if="moodSegments.length" class="mood-bar">
                <div
                  v-for="seg in moodSegments"
                  :key="seg.key"
                  class="mood-bar-seg"
                  :style="{ width: seg.pct + '%', background: seg.color }"
                />
              </div>
              <div v-if="moodSegments.length" class="mood-legend">
                <div v-for="seg in moodSegments" :key="seg.key" class="mood-legend-item">
                  <div class="mood-legend-dot" :style="{ background: seg.color }" />{{ seg.label }} {{ seg.pct }}%
                </div>
              </div>
              <!-- 空态：虚线占位条 -->
              <div v-else class="mood-empty">近 30 天无情绪数据 · 写几条带情绪的记录后自动统计</div>
            </div>
            <div v-if="mirror.profile.mood_analysis" class="portrait-text mood-note mood-note-card">{{ mirror.profile.mood_analysis }}</div>
          </div>
        </div>

        <!-- AI 分析三卡 -->
        <div class="portrait-grid zone-start">

          <div class="portrait-section card">
            <div class="portrait-section-header">
              <div class="portrait-section-icon" style="background:var(--success)">
                <svg viewBox="0 0 24 24" style="stroke:#fff"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              </div>
              <div class="portrait-section-title">学习进展</div>
            </div>
            <div class="portrait-text">{{ mirror.profile.learning_analysis || '暂无学习维度分析。' }}</div>
            <div v-if="learningEvidence.length" class="portrait-evidence">
              <div class="portrait-evidence-label">来源 SOURCES</div>
              <div v-for="(ev, i) in learningEvidence" :key="i" class="portrait-evidence-item">
                <div class="evidence-dot" />
                <span class="evidence-date">{{ ev.date }}</span>
                <span>{{ ev.text }}</span>
              </div>
            </div>
          </div>

          <div class="portrait-section card">
            <div class="portrait-section-header">
              <div class="portrait-section-icon" style="background:var(--warn)">
                <svg viewBox="0 0 24 24" style="stroke:#fff"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </div>
              <div class="portrait-section-title">未完成的事 · {{ chains.length }}</div>
            </div>
            <template v-if="chains.length">
              <TodoChainCard
                v-for="c in chains"
                :key="`m-chain-${c.todo_id ?? c.todoId ?? c.title}`"
                :chain="c"
                @open-record="openTodoRecord"
              />
            </template>
            <div v-else-if="todoStore.chainsLoading" class="portrait-text">加载中…</div>
            <div v-else class="portrait-text">没有挂起的待办，干得漂亮。</div>
          </div>

          <div class="portrait-section card">
            <div class="portrait-section-header">
              <div class="portrait-section-icon" style="background:var(--violet)">
                <svg viewBox="0 0 24 24" style="stroke:#fff"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              </div>
              <div class="portrait-section-title">个人标签</div>
            </div>
            <div v-if="(mirror.profile.user_tags || []).length" class="user-tags">
              <span v-for="tag in mirror.profile.user_tags" :key="tag" class="user-tag">{{ tag }}</span>
            </div>
            <div v-else class="portrait-text">标签将在画像生成后出现。</div>
            <div v-if="mirror.profile.rhythm_analysis" class="portrait-text" style="margin-top:10px">{{ mirror.profile.rhythm_analysis }}</div>
          </div>
        </div>
      </template>
    </div>
  </div>
  <Teleport to="body">
    <div
      v-if="confirmingMonth"
      class="month-confirm-scrim"
      @click.self="closeMonthConfirmation"
      @keydown.esc.stop.prevent="closeMonthConfirmation"
    >
      <section class="month-confirm-panel" role="dialog" aria-modal="true" aria-labelledby="month-confirm-title">
        <div class="month-confirm-mark" aria-hidden="true">↻</div>
        <div class="month-confirm-copy">
          <h2 id="month-confirm-title">为 {{ monthLabel(confirmingMonth) }} 新建镜子？</h2>
          <p>若这个月已有版本，旧版会完整保留在归档中；新结果将成为该月当前镜子。</p>
          <p>已删除或取消授权的原始内容不会重新进入这次生成。</p>
        </div>
        <div class="month-confirm-actions">
          <button ref="cancelMonthConfirmButton" type="button" class="month-confirm-cancel" @click="closeMonthConfirmation">
            再看看
          </button>
          <button type="button" class="month-confirm-accept" @click="confirmMonthGeneration">确认生成</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.page { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.page-header { display: none; padding: 26px clamp(32px, 4vw, 72px) 0; align-items: baseline; gap: 14px; }
@media (min-width: 900px) { .page-header { display: flex; } }
.page-title { font-family: var(--font-display); font-size: 26px; font-weight: 600; }
.page-subtitle { font-size: 13px; color: var(--text-low); }

.page-content {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 10px 18px var(--page-bottom-clearance);
  -webkit-overflow-scrolling: touch;
}
/* 模块间距与入场：原先是各卡零散 margin-top（8/12/14 不等）+ 单层淡投影，
   结果卡片挨太近、边界糊成一片。改为统一相邻兄弟间距，配合 base.css 的双层投影 */
.page-content > * + * { margin-top: 18px; }
/* 分区之间 28px、组内 18px —— 间距分级后"分区"才成立，
   否则所有空隙一个尺寸，层次是平的（这也是此前"模块分界不明显"的另一半原因） */
.page-content > .zone-start { margin-top: 28px; }
.page-content > * { animation: cardIn .5s cubic-bezier(.22, .8, .3, 1) backwards; }
.page-content > *:nth-child(2) { animation-delay: 55ms; }
.page-content > *:nth-child(3) { animation-delay: 110ms; }
.page-content > *:nth-child(4) { animation-delay: 165ms; }
.page-content > *:nth-child(5) { animation-delay: 220ms; }
.page-content > *:nth-child(6) { animation-delay: 275ms; }
.page-content > *:nth-child(7) { animation-delay: 330ms; }
.page-content > *:nth-child(n+8) { animation-delay: 380ms; }
/* backwards 而非 both：动画结束即交还 CSS 值，不抢占 .card:hover 的 transform */
@keyframes cardIn {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (min-width: 900px) {
  /* fluid：宽度跟随空间，弹性侧距替代定宽居中（1920 屏内容占比 45%→75%） */
  .page-content { padding: 18px clamp(32px, 4vw, 72px) 40px; }
}

/* ===== 快照时间线：日期卡像沿轨道钉入的档案票根 ===== */
.timeline-card { padding: 12px 14px; }
.timeline-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.timeline-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.timeline-idle { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 11.5px; color: var(--text-low); }
.timeline-load-error { display: flex; align-items: center; gap: 12px; padding: 10px 0; color: var(--text-low); font-size: 12px; }
.timeline-load-error button, .timeline-idle button, .ghost-loading button {
  padding: 2px 8px; color: var(--accent); border-bottom: 1px solid currentColor;
}
.snapshot-strip {
  position: relative; display: flex; align-items: flex-start; gap: 9px;
  overflow-x: auto; padding: 9px 4px 14px; scrollbar-width: thin;
}
.snapshot-strip::before {
  content: ''; position: absolute; top: 31px; left: 4px; right: 4px;
  border-top: 1px solid var(--line-strong); pointer-events: none;
}
.snapshot-chip {
  flex-shrink: 0; font-family: var(--font-mono); font-size: 10.5px;
  padding: 5px 11px; border: 1px solid var(--line); color: var(--text-low);
  background: var(--card);
}
/* 各节点轻微错位，保持轨道秩序但不把档案排成一排同款按钮。 */
.snapshot-node {
  position: relative; display: grid; grid-template-columns: 1fr auto; gap: 7px 10px;
  min-width: 134px; padding: 10px 11px; text-align: left;
  cursor: pointer; transition: transform .18s ease, color .18s ease, border-color .18s ease, background .18s ease;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
}
.snapshot-node:nth-child(4n + 2) { transform: translateY(5px) rotate(.5deg); }
.snapshot-node:nth-child(4n + 3) { transform: translateY(-2px) rotate(-.35deg); }
.snapshot-node:nth-child(4n) { transform: translateY(3px); }
.snapshot-node:hover, .snapshot-node:focus-visible { z-index: 1; transform: translateY(-3px) rotate(0); }
.snapshot-node:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.snapshot-node.state-archive_only {
  border-style: dashed; color: var(--text-low); background: var(--ink-2); opacity: .78;
}
.snapshot-node.current {
  z-index: 1; color: var(--accent); border-color: var(--accent);
  background: var(--accent-soft); font-weight: 600; opacity: 1;
  transform: translateY(-2px) rotate(-.8deg); box-shadow: 3px 3px 0 var(--accent);
}
.snapshot-node-date { grid-column: 1; font-family: var(--font-display); font-size: 14px; line-height: 1.2; font-variant-numeric: tabular-nums; }
.snapshot-node-version { grid-column: 2; align-self: start; font-size: 9px; color: var(--text-low); }
.snapshot-node .snapshot-type-badge, .snapshot-context-tag { grid-row: 2; justify-self: start; }
.snapshot-break-tag {
  grid-column: 1 / -1; justify-self: start; padding: 1px 5px;
  color: var(--warn); background: color-mix(in srgb, var(--warn) 10%, transparent);
  font-size: 8px; letter-spacing: .04em;
}
.snapshot-type-badge {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: .08em;
  padding: 1.5px 6px; border-radius: var(--radius-full); line-height: 1.3;
}
.badge-manual { color: var(--accent); background: var(--accent-soft); }
.badge-monthly { color: var(--violet); background: var(--violet-bg); }
.snapshot-node.current .badge-manual { color: #FFFFFF; background: var(--accent); }
.snapshot-node.current .badge-monthly { color: #FFFFFF; background: var(--violet); }
.snapshot-context-tag { font-size: 9px; padding: 1px 5px; border-left: 2px solid currentColor; }
.context-usable { color: var(--success); }
.context-archive { color: var(--text-low); }
.snapshot-viewing-tag, .snapshot-latest-tag { grid-column: 1 / -1; font-family: var(--font); font-size: 10px; }
.snapshot-viewing-tag { color: var(--accent); }
.snapshot-latest-tag { color: var(--text-low); }
.timeline-more {
  display: flex; align-items: center; justify-content: flex-end; gap: 12px;
  padding: 2px 3px 8px;
}
.timeline-more-error { margin-right: auto; font-size: 11px; color: var(--danger); }
.timeline-more-btn {
  min-height: 30px; padding: 5px 13px; color: var(--accent); font-size: 11.5px; font-weight: 600;
  border: 1px solid var(--accent); background: transparent; clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 0 100%);
  transition: color .16s ease, background .16s ease, transform .16s ease;
}
.timeline-more-btn:hover:not(:disabled) { color: #fff; background: var(--accent); transform: translateY(-1px); }
.timeline-more-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.timeline-more-btn:disabled { opacity: .55; cursor: wait; }

/* ===== 对比开关（已并入时间线头行） ===== */
.compare-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--text-mid);
  padding: 5px 12px; border-radius: var(--radius-full);
  border: 1px solid var(--line-strong); background: var(--card);
  transition: all .15s;
}
.compare-toggle svg { width: 13px; height: 13px; stroke: currentColor; }
.compare-toggle:hover { color: var(--accent); border-color: var(--accent); }
.compare-toggle.on { color: #FFFFFF; background: var(--accent); border-color: var(--accent); }
.compare-hint { font-size: 11.5px; color: var(--text-low); }

/* ===== 按月生成幽灵卡（时间线尾部入口，虚线同 dropzone 视觉） ===== */
.ghost-card {
  margin-top: 8px; padding: 8px 12px;
  border: 1.5px dashed var(--line-strong);
  border-radius: var(--radius-sm);
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  transition: border-color .18s, background .18s;
}
.ghost-card:hover { border-color: var(--accent); background: var(--accent-soft); }
.ghost-head {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; font-weight: 600; color: var(--text-mid);
  min-width: 0;
}
.ghost-head svg { width: 14px; height: 14px; color: var(--text-low); flex-shrink: 0; }
.ghost-card:hover .ghost-head { color: var(--accent); }
.ghost-card:hover .ghost-head svg { color: var(--accent); }
.ghost-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
/* 月份下拉走 atoms/SelectMenu.vue（原生 select 的下拉面板无法样式化，会溢出卡片） */
.ghost-select { max-width: 100%; font-variant-numeric: tabular-nums; }
.ghost-btn {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12.5px; font-weight: 600; color: var(--accent);
  padding: 5px 13px; border-radius: var(--radius-full);
  border: 1px solid var(--accent); background: var(--card);
  transition: all .15s; white-space: nowrap;
}
.ghost-btn svg { width: 12px; height: 12px; stroke: currentColor; }
.ghost-btn:hover:not(:disabled) { color: #FFFFFF; background: var(--accent); }
.ghost-btn:disabled { opacity: .55; cursor: not-allowed; }
.ghost-loading {
  flex-basis: 100%; font-family: var(--font-mono); font-size: 10.5px;
  color: var(--text-low); animation: blink 1.2s ease infinite;
}
.ghost-card { border-left: 3px solid var(--accent); }
@media (max-width: 420px) {
  .ghost-card { padding: 10px 12px; gap: 8px; }
  .ghost-actions { margin-left: 0; width: 100%; }
  .ghost-select { flex: 1; min-width: 0; }
}

/* ===== 对比区 ===== */
.compare-card { padding: 16px; border-color: var(--accent); }
.delta-chip { font-family: var(--font-mono); font-size: 10.5px; padding: 2px 9px; border-radius: var(--radius-full); }
.tier-stable { color: var(--success); background: var(--success-bg); }
.tier-minor { color: var(--warn); background: var(--warn-bg); }
.tier-major { color: var(--danger); background: var(--danger-bg); }

.compare-pickers { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.compare-picker { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.compare-picker-label { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em; color: var(--text-low); }
/* A/B 下拉走 atoms/SelectMenu.vue（同上：原生 popup 不可样式化） */
.compare-select { max-width: 100%; }
.compare-vs { font-family: var(--font-mono); font-size: 11px; color: var(--text-low); padding-bottom: 7px; }
.compare-loading { font-size: 12.5px; color: var(--text-low); padding: 14px 0; text-align: center; }

.compare-grid { display: grid; gap: 12px; margin-bottom: 14px; }
.compare-overall { grid-template-columns: 1fr; }
.compare-col { min-width: 0; padding: 12px; border-radius: var(--radius-sm); background: var(--ink-2); }
.compare-col-head { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.compare-col-title { font-family: var(--font-mono); font-size: 11px; color: var(--accent); font-variant-numeric: tabular-nums; }
.compare-text { font-size: 13px; line-height: 1.8; color: var(--text-mid); }
.compare-text.dim { font-size: 12.5px; line-height: 1.75; }

.compare-dims { gap: 10px; margin-bottom: 12px; }
.compare-dim-row { min-width: 0; }
.compare-dim-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: .14em; color: var(--text-low); margin-bottom: 5px; }
.compare-dim-cells { display: grid; grid-template-columns: 1fr; gap: 8px; }
.compare-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 24px; }
.user-tag.sm { font-size: 11.5px; padding: 3px 10px; }

/* 漂移距离三芯片行 */
.compare-drift-row {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  padding-top: 12px; border-top: 1px dashed var(--line);
}
.compare-drift-cell {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 10px 6px; border-radius: var(--radius-sm); background: var(--ink-2);
}
.compare-drift-cell.delta-main { border: 1px solid transparent; }
.compare-drift-num {
  font-family: var(--font-display); font-size: 17px; font-weight: 600;
  color: var(--text-hi); font-variant-numeric: tabular-nums;
}
.compare-drift-cap { font-size: 10.5px; color: var(--text-low); text-align: center; }
.compare-drift-cell.tier-stable { background: var(--success-bg); }
.compare-drift-cell.tier-stable .compare-drift-num { color: var(--success); }
.compare-drift-cell.tier-minor { background: var(--warn-bg); }
.compare-drift-cell.tier-minor .compare-drift-num { color: var(--warn); }
.compare-drift-cell.tier-major { background: var(--danger-bg); }
.compare-drift-cell.tier-major .compare-drift-num { color: var(--danger); }

/* 对比区 ≥900px：overall 与六维左右并排 */
@media (min-width: 900px) {
  .compare-overall { grid-template-columns: 1fr 1fr; }
  .compare-dim-cells { grid-template-columns: 1fr 1fr; gap: 12px; }
}

/* mirror-hero（白卡，无扫光）：左主文案 + 右指标栏。
   原 max-width:720px 限行长是对的（避免 overall 一行拉太长），但被限出来的右侧就白白空着；
   改成两栏后既保住行长，又让右栏承接指标，超宽屏不再有大片留白 */
.mirror-hero { position: relative; overflow: hidden; padding: 30px 32px; text-align: left; }
/* 主卡身份：hero 是整页的视觉锚点，却和统计卡长得一模一样。
   给它一档更重的投影（及对应的 hover 档），让页面第一次有主次 */
.mirror-hero.card {
  box-shadow: 0 4px 12px -6px rgba(20, 20, 15, .10), 0 18px 40px -18px rgba(20, 20, 15, .18);
}
.mirror-hero.card:hover {
  box-shadow: 0 6px 16px -6px rgba(20, 20, 15, .12), 0 24px 52px -20px rgba(20, 20, 15, .22);
}
/* 1.9 : 1 两列 —— 左栏读书写、右栏放指标。
   关键：两列是比例分配而非"左栏限宽 + 右栏固定宽"，
   否则剩余空间会全堆到右端变成一块死白（首版 flex 写法就是这个毛病） */
.mirror-hero-inner { display: grid; grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr); gap: 40px; align-items: stretch; }
.mirror-hero-main { min-width: 0; }
.mirror-hero.settled { animation: breatheOnce 1.1s ease; }
.mirror-greeting { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .22em; color: var(--accent); margin-bottom: 8px; }
.mirror-name { font-family: var(--font-display); font-size: 30px; font-weight: 600; line-height: 1.3; }
.mirror-viewing-line {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  margin-top: 8px; font-size: 11.5px; color: var(--text-low);
  font-variant-numeric: tabular-nums;
}
.mirror-archive-note {
  display: grid; grid-template-columns: auto 1fr; gap: 5px 10px; align-items: baseline;
  max-width: 620px; margin-top: 12px; padding: 10px 13px;
  color: var(--text-mid); font-size: 11.5px; line-height: 1.55;
  background: var(--ink-2); border-left: 3px solid var(--text-low);
}
.mirror-archive-note strong { grid-row: span 3; align-self: start; color: var(--text-low); font-family: var(--font-display); font-size: 13px; }
.deleted-source-note { color: var(--warn); font-weight: 600; }
.back-latest-btn {
  font-size: 11.5px; color: var(--accent); font-weight: 600;
  padding: 2px 9px; border-radius: var(--radius-full);
  border: 1px solid var(--accent-soft); background: var(--accent-soft);
  transition: all .15s;
}
.back-latest-btn:hover { border-color: var(--accent); }
.mirror-drift {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 12px;
  font-size: 12px; color: var(--violet);
  padding: 4px 12px; border-radius: var(--radius-full);
  background: var(--violet-bg);
}
.mirror-drift svg { width: 12px; height: 12px; stroke: var(--violet); fill: none; }
/* 行长限制从"整栏"挪到"段落"上：栏可以宽，但一行别超过 ~45 个汉字 */
.mirror-overall { font-size: 14px; line-height: 1.85; color: var(--text-mid); margin-top: 14px; max-width: 640px; }

/* 右侧指标栏：3 项横排、整组在栏内垂直居中；左缘竖线兼作主/次分区 */
.mirror-hero-stats {
  display: grid; grid-template-columns: repeat(3, 1fr);
  align-content: center; gap: 16px;
  padding-left: 32px; border-left: 1px solid var(--line);
}
.hero-stats-cap {
  grid-column: 1 / -1;
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .16em;
  color: var(--text-low);
}
.hero-stat { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.hero-stat-num {
  font-family: var(--font-display); font-size: 34px; font-weight: 600;
  color: var(--accent); line-height: 1.15; font-variant-numeric: tabular-nums;
}
.hero-stat-label { font-size: 11.5px; color: var(--text-low); }

@media (max-width: 899px) {
  .mirror-hero { padding: 22px 18px; }
  .mirror-hero-inner { grid-template-columns: 1fr; gap: 18px; }
  .mirror-hero-stats {
    padding-left: 0; padding-top: 16px; gap: 10px;
    border-left: none; border-top: 1px solid var(--line);
  }
  .hero-stat-num { font-size: 21px; }
}

.mirror-generate {
  margin-top: 16px; width: 100%; padding: 12px; border-radius: 12px;
  font-size: 14px; font-weight: 600; color: var(--text-mid);
  border: 1px solid var(--line-strong);
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all .2s;
}
.mirror-generate:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
.mirror-generate:disabled { opacity: .55; cursor: not-allowed; }
.mirror-generate svg { width: 15px; height: 15px; stroke: currentColor; fill: none; }
.mirror-regenerate-month {
  display: block; margin-top: 8px; padding: 5px 10px; color: var(--violet); font-size: 11.5px; font-weight: 600;
  border: 1px dashed var(--violet); background: var(--violet-bg); transition: transform .16s ease, background .16s ease;
}
.mirror-regenerate-month:hover:not(:disabled) { transform: translateX(3px); background: var(--card); }
.mirror-regenerate-month:disabled { opacity: .55; cursor: not-allowed; }

/* 重新生成前说明版本行为，采用带切角的镜面票据而非浏览器原生确认框。 */
.month-confirm-scrim {
  position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 20px;
  background: rgba(3, 13, 44, .72); backdrop-filter: blur(5px);
}
.month-confirm-panel {
  display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 8px 13px;
  width: min(100%, 470px); padding: 23px 24px 19px; color: var(--text-mid);
  background: var(--card); border-top: 3px solid var(--accent);
  clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
  box-shadow: 0 18px 60px rgba(0, 0, 0, .32);
}
.month-confirm-mark {
  display: grid; place-items: center; width: 36px; height: 36px; color: #fff; font-size: 22px;
  background: var(--accent); clip-path: polygon(0 0, 100% 0, 100% 74%, 72% 100%, 0 100%);
}
.month-confirm-copy h2 { margin: 1px 0 8px; color: var(--text); font-family: var(--font-display); font-size: 18px; }
.month-confirm-copy p { margin: 0 0 6px; font-size: 12.5px; line-height: 1.7; color: var(--text-low); }
.month-confirm-actions { grid-column: 2; display: flex; justify-content: flex-end; gap: 9px; margin-top: 9px; }
.month-confirm-actions button { min-height: 34px; padding: 6px 14px; font-size: 12px; font-weight: 600; transition: transform .16s ease, background .16s ease; }
.month-confirm-cancel { color: var(--text-mid); border: 1px solid var(--line-strong); background: transparent; }
.month-confirm-accept { color: #fff; border: 1px solid var(--accent); background: var(--accent); }
.month-confirm-actions button:hover { transform: translateY(-1px); }
.month-confirm-actions button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
@media (max-width: 480px) {
  .month-confirm-panel { grid-template-columns: 32px minmax(0, 1fr); gap: 8px 10px; padding: 18px 17px 15px; }
  .month-confirm-mark { width: 30px; height: 30px; }
  .month-confirm-actions { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) {
  .snapshot-node, .timeline-more-btn, .mirror-regenerate-month, .month-confirm-actions button { transition: none; }
  .snapshot-node:nth-child(n), .snapshot-node.current, .snapshot-node:hover { transform: none; }
}

/* ===== 统计图区布局 ===== */
/* 图表卡统一 flex 列：图例贴底、图表主体吃掉剩余高度（等高栅格下不再"内容堆顶、底部一片白"） */
.chart-card { min-width: 0; display: flex; flex-direction: column; }
.chart-body {
  flex: 1 1 auto; min-height: 0;
  display: flex; flex-direction: column; justify-content: center;
}

/* 首次加载骨架：高度贴近各图表实际渲染高度，加载完不跳版 */
.sk-block {
  border-radius: var(--radius-sm);
  background: var(--ink-2);
  animation: skPulse 1.3s ease-in-out infinite;
}
.sk-activity { height: 110px; }
.sk-rhythm { height: 140px; }
.sk-keywords { height: 190px; }
.sk-ring { height: 150px; }
@keyframes skPulse {
  0%, 100% { opacity: .5; }
  50% { opacity: .85; }
}
@media (min-width: 900px) {
  .sk-activity { height: 168px; }   /* 图高 150 + 日期轴 18 */
  .sk-rhythm { height: 168px; }
}
.chart-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  margin-bottom: 14px;
}
.chart-head-note { font-size: 11px; color: var(--text-low); }

/* 图例行（任务 B）：小字低重，色点 6px，不抢图表 */
.chart-legend {
  display: flex; flex-wrap: wrap; align-items: center; gap: 5px 14px;
  margin-top: 10px; font-size: 11px; color: var(--text-low);
}
.chart-legend.center { justify-content: center; }
.chart-legend-item { display: inline-flex; align-items: center; gap: 5px; }
.chart-legend-item.mono { font-family: var(--font-mono); font-size: 10px; }
.legend-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0; }

/* 两卡：≥900px 一行两列（关键词列稍宽），窄屏堆叠 */
.chart-row-2 { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media (min-width: 900px) { .chart-row-2 { grid-template-columns: 1.4fr 1fr; } }

/* portrait grid */
.portrait-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media (min-width: 900px) {
  .portrait-grid { grid-template-columns: repeat(2, 1fr); }
  .portrait-grid .card.span-2 { grid-column: span 2; }
}
@media (min-width: 1200px) {
  /* 情绪构成卡已上移与关键词并排，AI 分析区收敛为三卡 */
  .portrait-grid { grid-template-columns: repeat(3, 1fr); }
  .portrait-grid .card.span-2 { grid-column: span 3; }
}
.portrait-section { padding: 16px; }
/* 桌面端放宽卡内呼吸：留白的"贵"感主要来自这里 */
@media (min-width: 900px) { .portrait-section { padding: 20px; } }
.portrait-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.portrait-section-icon { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; }
.portrait-section-icon svg { width: 15px; height: 15px; fill: none; stroke-width: 2; }
.portrait-section-title { font-size: 14px; font-weight: 600; }
.portrait-text { font-size: 13.5px; line-height: 1.8; color: var(--text-mid); }
.portrait-evidence { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line); }
.portrait-evidence-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: .16em; color: var(--text-low); margin-bottom: 7px; }
.portrait-evidence-item { display: flex; gap: 8px; align-items: baseline; font-size: 12px; color: var(--text-low); margin-bottom: 5px; }
.evidence-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); flex-shrink: 0; align-self: center; }
.evidence-date { font-family: var(--font-mono); font-size: 10.5px; color: var(--accent); flex-shrink: 0; }

/* mood-bar */
.mood-bar { display: flex; height: 9px; border-radius: 6px; overflow: hidden; gap: 2px; }
.mood-bar-seg { transition: width .6s ease; }
.mood-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 11px; }
.mood-legend-item { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text-mid); }
.mood-legend-dot { width: 7px; height: 7px; border-radius: 50%; }
/* 空态占位（虚线小条，不留整块空白卡） */
.mood-empty {
  padding: 7px 10px; border: 1px dashed var(--line-strong);
  border-radius: var(--radius-sm);
  font-size: 11.5px; color: var(--text-low);
}
.mood-note { margin-top: 8px; font-size: 12.5px; }
/* 情绪构成卡改用 chart-card 结构后，说明文字补卡内边距 */
.mood-note-card { margin-top: 0; padding: 0 16px 14px; }

/* user tags（未完成的事已升级为 TodoChainCard 证据链，.todo-row 旧样式移除） */
.user-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.user-tag {
  font-size: 12.5px; padding: 5px 13px; border-radius: var(--radius-full);
  background: var(--accent-soft); color: var(--accent); font-weight: 600;
}

/* 生成中视图 */
.processing-view { text-align: center; padding: 70px 20px; }
.processing-ring {
  width: 58px; height: 58px; margin: 0 auto 22px; border-radius: 50%;
  border: 2.5px solid var(--processing-bg); border-top-color: var(--processing);
  animation: spin 1.1s linear infinite;
}
.processing-title { font-family: var(--font-display); font-size: 17px; }
.processing-desc { font-size: 12.5px; color: var(--text-low); margin-top: 6px; }

.snapshot-history-error { display:flex; gap:16px; align-items:center; justify-content:space-between; color:var(--danger); font-size:12px; padding:12px 0; }
.snapshot-history-error button { color:var(--accent); text-decoration:underline; text-underline-offset:3px; }
.stats-error { display:flex; justify-content:space-between; color:white; padding:12px 16px; margin-bottom:18px; border:1px solid #88b6ff50; font-size:12px; }
.portrait-section { min-width:0; }
.portrait-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
.portrait-evidence-item { min-width:0; }
.portrait-evidence-item > span:last-child { min-width:0; overflow:hidden; text-overflow:ellipsis; }
@media(max-width:1199px) { .portrait-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:899px) { .portrait-grid { grid-template-columns:minmax(0,1fr); } }
/* Blue-hour module: expressive stage, quiet reading surfaces. */
.mirror-page .page-content { padding-top: 0; }
.period-caption { color: var(--on-dark); font-size: 12px; white-space: nowrap; }
.reflection-stage { position: relative; min-height: 420px; isolation: isolate; overflow: hidden; background: #083dc4 url('/art/water-surface.webp') center 28% / cover; color: white; border: 1px solid #65baff70; }
.reflection-stage::before { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(90deg,#082b99e8 0%,#0838bba0 38%,#072a9140 70%); }
.stage-word { position: absolute; right: -8px; bottom: 103px; font: italic 900 clamp(100px,13vw,200px)/.8 var(--font-display); color: #94eaff24; letter-spacing: -.04em; pointer-events: none; }
.stage-orbit { position: absolute; right: -70px; top: -150px; width: 530px; height: 530px; border: 53px solid #b9faffbd; border-radius: 50%; transform: rotate(-22deg) scaleX(.72); z-index: -1; }

.stage-month { position: absolute; display: flex; align-items: center; gap: 8px; top: 23px; right: 24px; text-shadow: 0 2px 12px #07175470; }
.stage-month b { font: italic 800 73px/.8 var(--font-display); letter-spacing: -.04em; }
.stage-month span { font: 700 12px/1.2 var(--font-display); }
.stage-copy { position: relative; padding: 35px 36px 140px; max-width: 85%; }
.stage-first-record { display:inline-flex; gap:20px; align-items:center; margin-top:16px; padding:8px 13px; background:var(--cyan); color:var(--night); font-size:11px; font-weight:800; min-height:38px; }
.stage-kicker { display: inline-block; font: italic 700 15px var(--font-display); background: var(--cyan); color: var(--night); padding: 3px 10px; transform: skew(-7deg); }
.stage-copy h2 { margin-top: 22px; font-size: clamp(34px,3.8vw,58px); line-height: 1.25; font-weight: 900; letter-spacing: -.04em; text-shadow: 3px 3px 0 #092b8d; }
.stage-copy p { margin-top: 17px; font-size: 13px; line-height: 1.8; color: #c5e8ff; }
.stage-stats { position: absolute; display: flex; align-items: center; gap: clamp(18px,3vw,50px); bottom: 0; left: 0; right: 0; padding: 17px 36px 20px; background: #03184fdc; border-top: 1px solid #8ac3ff50; }
.stage-stats > div { display: flex; align-items: center; gap: 10px; }
.stage-stats strong { font: italic 800 52px/1 var(--font-display); color: var(--cyan); }
.stage-stats span { font-size: 12px; font-weight: 700; }
.stage-stats small { display: block; margin-top: 4px; color: #a4bee9; font-size: 9px; font-weight: 400; }
.stage-stats .stage-stats-note { margin-left: auto; align-self: flex-end; color: #9ebbe7; font-size: 10px; font-weight: 400; }
.reflection-status { display: flex; gap: 0; margin-bottom: 24px; border-bottom: 1px solid #88b6ff40; background: #08276190; }
.reflection-status > div { position: relative; display: flex; align-items: center; gap: 13px; flex: 1; padding: 18px 24px; border-right: 1px solid #88b6ff30; }
.reflection-status > div:last-child { border-right: 0; }
.reflection-status span { font-size: 11px; color: #adc4eb; }
.reflection-status strong { font-size: 14px; font-weight: 700; color: white; }
.reflection-status small { font-size: 11px; font-weight: 400; }
.reflection-status i { width: 7px; height: 7px; border-radius: 50%; margin-left: auto; }
.mirror-hero { margin-top: 18px; border-left: 5px solid var(--electric); background: #f5faff; border-radius: 2px; }
.mirror-hero-inner { display: block; }
.mirror-greeting { font-size: 11px; letter-spacing: .05em; }
.mirror-name { font-family: var(--font); font-size: 25px; font-weight: 900; }
.mirror-overall { max-width: 80ch; line-height: 1.9; }
.mirror-generate { background: var(--accent); border-radius: 2px; font-size: 12px; }
.timeline-card { background: #ecf5ff; border-radius: 2px; padding: 19px 22px; }
.snapshot-node { border-radius: 2px; padding: 9px 13px; border: 1px solid #bacce8; }
.snapshot-node.current { background: var(--night); color: white; border-color: var(--night); box-shadow: 3px 3px 0 var(--cyan); }
.snapshot-node.current .snapshot-node-date { color: white; }
.snapshot-viewing-tag { color: var(--cyan); }
.snapshot-node-date { font: 700 23px var(--font-display); }
.chart-card { border-top: 3px solid var(--electric); }
.chart-head { align-items: center; gap: 12px; flex-wrap: wrap; }
.chart-head .section-label { font-family: var(--font); font-size: 14px; font-weight: 800; letter-spacing: 0; }
.portrait-section-title { font-family: var(--font); font-size: 15px; font-weight: 800; }
.portrait-section-icon { border-radius: 2px; transform: skew(-7deg); }
.portrait-text { line-height: 1.9; }
.user-tag { border-radius: 2px; }
.processing-view, .mirror-page .page-content > .empty-state { background: #f0f7ff; padding: 36px 24px !important; margin: 16px 0; border-top: 4px solid var(--cyan); color: var(--text-hi); }
.mirror-page .page-content > .empty-state .empty-title { color: var(--text-hi); }
.mirror-page .page-content > .empty-state .empty-desc { color: var(--text-mid); }
.processing-desc { max-width: 50ch; }
.mirror-error { display: flex; gap: 20px; align-items: center; justify-content: space-between; padding: 20px; background: #ffffff10; color: white; border: 1px solid #ffadc6; margin: 18px 0; }
@media (max-width: 1199px) {  .stage-copy { padding-left: 28px; } .stage-stats { gap: 22px; padding-left: 28px; } .stage-stats .stage-stats-note { display: none; } .reflection-status > div { padding: 16px; gap: 8px; } }
@media (max-width: 599px) {
 .period-caption { display: none; } .reflection-stage { min-height: 435px; } .stage-copy { padding: 28px 20px 145px; max-width: 77%; } .stage-copy h2 { font-size: 28px; } .stage-copy p { font-size: 11px; } .stage-first-record { display:inline-flex; gap:20px; align-items:center; margin-top:16px; padding:8px 13px; background:var(--cyan); color:var(--night); font-size:11px; font-weight:800; min-height:38px; }
.stage-kicker { font-size: 12px; }  .stage-month { right: 14px; top: 18px; } .stage-month b { font-size: 48px; } .stage-month span { font-size: 10px; } .stage-word { font-size: 100px; bottom: 113px; } .stage-orbit { right: -150px; width: 380px; height: 380px; }
 .stage-stats { justify-content: space-between; gap: 8px; padding: 17px 16px; } .stage-stats > div { display: block; } .stage-stats strong { font-size: 43px; } .stage-stats span { display: block; font-size: 10px; } .stage-stats small { display: none; }
 .reflection-status { flex-wrap: wrap; } .reflection-status > div { flex: 1 1 100%; padding: 11px 16px; border-right: 0; border-bottom: 1px solid #88b6ff25; justify-content: space-between; } .reflection-status i { display: none; } .reflection-status strong { font-size: 12px; }
 .timeline-head { flex-wrap: wrap; } .mirror-error { flex-direction: column; align-items: flex-start; }
}

</style>
