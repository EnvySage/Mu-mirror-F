<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useMirrorStore } from '@/stores/mirror'
import { useRecordsStore } from '@/stores/records'
import { useStatsStore } from '@/stores/stats'
import { useToastStore } from '@/stores/toast'
import { MOOD_COLOR } from '@/constants/moodColor'
import { moodMap, taskStatusMap } from '@/constants/tags'
import { timeAgo } from '@/utils/time'
import MoodBand from '@/components/charts/MoodBand.vue'
import HourHeat from '@/components/charts/HourHeat.vue'
import WeekdayBars from '@/components/charts/WeekdayBars.vue'
import KeywordBars from '@/components/charts/KeywordBars.vue'
import TodoRing from '@/components/charts/TodoRing.vue'
import RecordFreq from '@/components/charts/RecordFreq.vue'

const mirror = useMirrorStore()
const recordsStore = useRecordsStore()
const statsStore = useStatsStore()
const toast = useToastStore()

onMounted(() => {
  mirror.fetchMirror()
  // 快照历史轨迹（真接口：GET /mirror/snapshots，失败静默回落空轨迹）
  mirror.fetchSnapshots()
  // 六图表数据源（B Agent 真接口，stats store 内 30s 缓存）
  statsStore.fetchStats()
})

/** 镜子名：当前月份 */
const now = new Date()
const mirrorName = computed(() => `你的镜子 · ${now.getMonth() + 1} 月`)

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
/** 组件卸载标志：卸载后 watcher/timer 不得再写响应式状态 */
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
  recordsStore.records.forEach(r => (r.chunks || []).forEach(c =>
    (c.metadata?.mood || []).forEach(m => { count[m] = (count[m] || 0) + 1 })
  ))
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

/** 未完成的事（todo/plan 且 taskStatus !== completed） */
const todos = computed(() => {
  const items = []
  recordsStore.records.forEach(r => (r.chunks || []).forEach(c => {
    if ((c.metadata?.contentType === 'todo' || c.metadata?.contentType === 'plan') && c.metadata?.taskStatus !== 'completed') {
      items.push({ title: c.metadata?.title || c.segment, status: c.metadata?.taskStatus })
    }
  }))
  return items
})

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

/** RecordFreq 端点日期标注（08-07 / 09-05） */
const freqRange = computed(() => {
  const daily = statsStore.record_daily
  if (!daily.length) return ''
  const first = String(daily[0].date || '')
  const last = String(daily[daily.length - 1].date || '')
  return first.length >= 10 && last.length >= 10 ? `${first.slice(5)} / ${last.slice(5)}` : ''
})

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
  label: shortDay(s.created_at),
  full: s.created_at || '',
  type: s.snapshot_type === 'monthly' ? 'monthly' : 'manual',
  drift: s.drift_distance,
  summary: s.overall_summary || '',
  latest: i === 0,
  viewing: mirror.currentSnapshotId === s.id,
})))

/** 查看历史快照（hero 切换为该快照内容） */
async function onViewSnapshot(node) {
  const ok = await mirror.viewSnapshot(node.id)
  if (!ok) toast.error(mirror.error || '快照加载失败')
}

/** 回到最新（最新节点也可点，用于从历史快照切回） */
async function onBackToLatest() {
  const ok = await mirror.backToLatest()
  if (!ok) toast.error(mirror.error || '快照加载失败')
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

/** 拉取两份对比快照详情（store 内 60s 缓存，重复对比不重复请求） */
watch([compareAId, compareBId], async ([aId, bId], [prevA, prevB]) => {
  if (!compareMode.value) return
  if (aId === prevA && bId === prevB && compareA.value) return
  compareLoading.value = true
  const [a, b] = await Promise.all([
    aId ? mirror.fetchSnapshotDetail(aId) : Promise.resolve(null),
    bId ? mirror.fetchSnapshotDetail(bId) : Promise.resolve(null),
  ])
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

/** Δ 程度档位（driftDelta → 'stable' | 'minor' | 'major' | null） */
const driftDeltaTier = computed(() => (driftDelta.value === null ? null : deltaTier(driftDeltaLabel.value)))

/** 对比可选节点（B 下拉排除锚点自身） */
const compareOptions = computed(() => timeline.value.filter(n => n.id !== compareAId.value))

const compareReady = computed(() => Boolean(compareA.value && compareB.value))

function compareLabel(id) {
  const node = timeline.value.find(n => n.id === id)
  return node ? `${node.full ? shortDateTime(node.full) : `#${id}`} · ${node.type}` : `#${id}`
}

async function onGenerate() {
  const ok = await mirror.generate()
  if (ok) toast.success('快照已生成')
  else toast.error(mirror.error || '生成失败，请重试')
}

onBeforeUnmount(() => {
  isUnmounted = true
  clearTimeout(settledTimer)
})
</script>

<template>
  <div class="page mirror-page">
    <div class="page-header">
      <div class="page-title">镜子</div>
      <div class="page-subtitle">快照 · 漂移 · 变化轨迹</div>
    </div>
    <div class="page-content">
      <!-- 生成中 -->
      <div v-if="mirror.generating" class="processing-view">
        <div class="processing-ring" />
        <div class="processing-title">正在生成画像快照</div>
        <div class="processing-desc">五维统计 + 最近记录 → GenerateProfile</div>
      </div>

      <!-- 首次使用：引导生成 -->
      <div v-else-if="mirror.isEmpty && !mirror.loading" class="empty-state" style="padding:70px 20px">
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
          <div class="chart-head" style="margin-bottom:10px">
            <span class="section-label">SNAPSHOT TIMELINE</span>
            <span class="chart-head-note">
              {{ timeline.length ? `${timeline.length} 份 · manual 保 2 / monthly 保 12` : '暂无历史快照' }}
            </span>
          </div>
          <div v-if="timeline.length" class="snapshot-strip" role="tablist" aria-label="快照历史时间线">
            <button
              v-for="node in timeline"
              :key="node.id"
              type="button"
              role="tab"
              :aria-selected="node.viewing"
              :class="['snapshot-chip', 'snapshot-node', { current: node.viewing, latest: node.latest }]"
              :title="`${shortDateTime(node.full)} · ${node.type}${node.drift !== null && node.drift !== undefined ? ` · 漂移 ${node.drift}` : ''}`"
              @click="onViewSnapshot(node)"
            >
              <span class="snapshot-node-date">{{ node.label }}</span>
              <span :class="['snapshot-type-badge', `badge-${node.type}`]">{{ node.type === 'monthly' ? '月度' : '手动' }}</span>
              <span v-if="node.viewing" class="snapshot-viewing-tag">查看中</span>
              <span v-else-if="node.latest" class="snapshot-latest-tag">最新</span>
            </button>
          </div>
          <div v-else class="portrait-text">暂无历史快照，生成第一份画像后这里会出现时间线。</div>

          <!-- 对比开关 + 提示 -->
          <div v-if="timeline.length >= 2" class="compare-bar">
            <button type="button" :class="['compare-toggle', { on: compareMode }]" @click="toggleCompare">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M8 3v18M16 3v18M3 8h10M11 16h10"/></svg>
              {{ compareMode ? '退出对比' : '对比两份快照' }}
            </button>
            <span v-if="!compareMode" class="compare-hint">对比 overall 总结与六维分析的变化</span>
          </div>
        </div>

        <!-- ===== 对比区（compareMode 开启时插入 hero 上方） ===== -->
        <div v-if="compareMode" class="portrait-section card compare-card">
          <div class="chart-head" style="margin-bottom:12px">
            <span class="section-label">SNAPSHOT COMPARE</span>
            <span v-if="driftDelta !== null" :class="['delta-chip', `tier-${driftDeltaTier}`]">
              Δ 漂移 {{ driftDelta.toFixed(3) }} · {{ driftDeltaLabel }}
            </span>
            <span v-else-if="compareReady" class="chart-head-note">两份快照均无漂移基线，Δ 不可比</span>
          </div>

          <!-- A / B 选择行 -->
          <div class="compare-pickers">
            <label class="compare-picker">
              <span class="compare-picker-label">基准 A</span>
              <select v-model="compareAId" class="compare-select">
                <option v-for="node in timeline" :key="node.id" :value="node.id">
                  {{ compareLabel(node.id) }}
                </option>
              </select>
            </label>
            <span class="compare-vs">vs</span>
            <label class="compare-picker">
              <span class="compare-picker-label">对比 B</span>
              <select v-model="compareBId" class="compare-select">
                <option v-for="node in compareOptions" :key="node.id" :value="node.id">
                  {{ compareLabel(node.id) }}
                </option>
              </select>
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

        <!-- mirror-hero：展示当前查看的快照（默认最新） -->
        <div :class="['mirror-hero', 'card', { settled: justSettled }]">
          <div class="mirror-hero-inner">
          <div class="mirror-greeting">这是我在你身上看到的</div>
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
          <div v-if="mirror.drift" class="mirror-drift">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>
            较上月漂移 Δ {{ mirror.profile.drift_distance }} · {{ mirror.drift.level }}
          </div>
          <div class="mirror-overall">{{ mirror.profile.overall_summary || '还没有总体总结，先去写几条记录吧。' }}</div>
          <div class="mirror-stats">
            <div v-for="(s, i) in stats" :key="i" class="mirror-stat">
              <div class="mirror-stat-num">{{ s.display }}</div>
              <div class="mirror-stat-label">{{ s.label }}</div>
            </div>
          </div>
          <div class="mirror-stats-note">近 30 天实时统计（与所选快照无关）</div>
          <button class="mirror-generate" :disabled="mirror.generating" @click="onGenerate">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>
            {{ mirror.generating ? '生成中…' : '重新生成快照（manual）' }}
          </button>
          </div>
        </div>

        <!-- ===== 统计图区（R6 重排：色带全宽 → 三小卡 → 两卡 → portrait → 快照） ===== -->

        <!-- 情绪趋势 30 天堆叠色带（全宽大图） -->
        <div class="portrait-section card chart-card span-all" style="margin-top:12px">
          <div class="chart-head">
            <span class="section-label">MOOD TREND · 30D</span>
            <span class="chart-head-note">实时统计（近 30 天） · 每天一根 · 按当日情绪占比分色</span>
          </div>
          <MoodBand :data="statsStore.mood_daily" />
          <div v-if="moodLegend.length" class="chart-legend">
            <span v-for="item in moodLegend" :key="item.key" class="chart-legend-item">
              <i class="legend-dot" :style="{ background: item.color }" />{{ item.label }}
            </span>
          </div>
        </div>

        <!-- 三小卡一行：活跃时段 / 待办完成度 / 周节奏（≥1200px 三列，窄屏堆叠） -->
        <div class="chart-row-3">
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">HOUR HEAT</span>
              <span class="chart-head-note">实时统计 · 24 小时</span>
            </div>
            <HourHeat :data="statsStore.hour_dist" />
            <div class="chart-legend">
              <span class="chart-legend-item">颜色越深 = 该时段记录越多</span>
              <span class="chart-legend-item heat-scale" aria-hidden="true">
                <i class="heat-scale-cell" style="background:rgba(44,95,232,.14)" />
                <i class="heat-scale-cell" style="background:rgba(44,95,232,.55)" />
                <i class="heat-scale-cell" style="background:rgba(44,95,232,1)" />
              </span>
            </div>
          </div>
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">TODO</span>
              <span class="chart-head-note">近 30 天完成度</span>
            </div>
            <TodoRing :todo="statsStore.todo" />
            <div class="chart-legend center">
              <span class="chart-legend-item">仅统计 todo / plan 类型片段</span>
            </div>
          </div>
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">WEEKDAY</span>
              <span class="chart-head-note">实时统计 · 一周节奏</span>
            </div>
            <WeekdayBars :data="statsStore.weekday_dist" />
            <div class="chart-legend">
              <span class="chart-legend-item">柱高 = 当日记录数（周一至周日）</span>
            </div>
          </div>
        </div>

        <!-- 两卡一行：关键词 Top10 / 记录频率 -->
        <div class="chart-row-2">
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">KEYWORDS</span>
              <span class="chart-head-note">实时统计 · Top 10</span>
            </div>
            <KeywordBars :data="statsStore.keyword_top" />
            <div class="chart-legend">
              <span class="chart-legend-item">条长 = 出现次数（右侧数值，悬浮可见「出现 N 次」）</span>
            </div>
          </div>
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">FREQUENCY</span>
              <span class="chart-head-note">实时统计 · 每天记录数</span>
            </div>
            <RecordFreq :data="statsStore.record_daily" />
            <div class="chart-legend">
              <span class="chart-legend-item">每柱一天 · 高度 = 当日记录数</span>
              <span v-if="freqRange" class="chart-legend-item mono">{{ freqRange }}</span>
            </div>
          </div>
        </div>

        <!-- portrait-grid 四卡（现有 AI 分析） -->
        <div class="portrait-grid">
          <div class="portrait-section card">
            <div class="portrait-section-header">
              <div class="portrait-section-icon" style="background:var(--accent)">
                <svg viewBox="0 0 24 24" style="stroke:#fff"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
              </div>
              <div class="portrait-section-title">情绪分布</div>
            </div>
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
            <div v-if="mirror.profile.mood_analysis" class="portrait-text" style="margin-top:10px">{{ mirror.profile.mood_analysis }}</div>
          </div>

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
              <div class="portrait-section-title">未完成的事 · {{ todos.length }}</div>
            </div>
            <template v-if="todos.length">
              <div v-for="(t, i) in todos" :key="i" class="todo-row">
                <span>{{ t.title }}</span>
                <span class="tag tag-status">{{ taskStatusMap[t.status] || '未开始' }}</span>
              </div>
            </template>
            <div v-else class="portrait-text">没有挂起的待办，干得漂亮。</div>
          </div>

          <div class="portrait-section card">
            <div class="portrait-section-header">
              <div class="portrait-section-icon" style="background:#8B5CF6">
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
</template>

<style scoped>
.page { flex: 1; min-height: 0; display: flex; flex-direction: column; }

.page-header { display: none; padding: 26px clamp(32px, 4vw, 72px) 0; align-items: baseline; gap: 14px; }
@media (min-width: 900px) { .page-header { display: flex; } }
.page-title { font-family: var(--font-display); font-size: 26px; font-weight: 600; }
.page-subtitle { font-size: 13px; color: var(--text-low); }

.page-content {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 10px 18px calc(96px + var(--safe-bottom));
  -webkit-overflow-scrolling: touch;
}
@media (min-width: 900px) {
  /* fluid：宽度跟随空间，弹性侧距替代定宽居中（1920 屏内容占比 45%→75%） */
  .page-content { padding: 18px clamp(32px, 4vw, 72px) 40px; }
}

/* ===== 快照时间线 ===== */
.timeline-card { padding: 14px 16px; margin-top: 8px; }
.snapshot-strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
.snapshot-chip {
  flex-shrink: 0; font-family: var(--font-mono); font-size: 10.5px;
  padding: 5px 11px; border-radius: var(--radius-full);
  border: 1px solid var(--line); color: var(--text-low);
  background: var(--card);
}
/* 可点击节点（button 化）：flex 纵排 + hover 反馈 */
.snapshot-node {
  display: inline-flex; align-items: center; gap: 7px;
  cursor: pointer; transition: all .15s;
  font-family: var(--font-mono); font-size: 10.5px; line-height: 1;
}
.snapshot-node:hover { border-color: var(--accent); color: var(--accent); }
.snapshot-node.current {
  color: var(--accent); border-color: var(--accent);
  background: var(--accent-soft); font-weight: 600;
}
.snapshot-node-date { font-variant-numeric: tabular-nums; }
.snapshot-type-badge {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: .08em;
  padding: 1.5px 6px; border-radius: var(--radius-full); line-height: 1.3;
}
.badge-manual { color: var(--accent); background: var(--accent-soft); }
.badge-monthly { color: #8B5CF6; background: #F3EEFF; }
.snapshot-node.current .badge-manual { color: #FFFFFF; background: var(--accent); }
.snapshot-node.current .badge-monthly { color: #FFFFFF; background: #8B5CF6; }
.snapshot-viewing-tag { font-family: var(--font); font-size: 10px; color: var(--accent); }
.snapshot-latest-tag { font-family: var(--font); font-size: 10px; color: var(--text-low); }

/* ===== 对比开关行 ===== */
.compare-bar { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
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

/* ===== 对比区 ===== */
.compare-card { margin-top: 12px; padding: 16px; border-color: var(--accent); }
.delta-chip { font-family: var(--font-mono); font-size: 10.5px; padding: 2px 9px; border-radius: var(--radius-full); }
.tier-stable { color: var(--success); background: var(--success-bg); }
.tier-minor { color: var(--warn); background: var(--warn-bg); }
.tier-major { color: var(--danger); background: var(--danger-bg); }

.compare-pickers { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.compare-picker { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.compare-picker-label { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .14em; color: var(--text-low); }
.compare-select {
  font-size: 12px; color: var(--text-hi);
  padding: 6px 9px; border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong); background: var(--card);
  max-width: 100%;
}
.compare-select:focus { outline: none; border-color: var(--accent); }
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

/* mirror-hero（白卡，无扫光） */
.mirror-hero { position: relative; overflow: hidden; padding: 26px 22px; margin-top: 12px; text-align: left; }
/* 超宽屏限文本行长（卡做全宽背景，内容限宽），避免 overall 总结一行拉太长 */
.mirror-hero-inner { max-width: 720px; }
.mirror-hero.settled { animation: breatheOnce 1.1s ease; }
.mirror-greeting { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .22em; color: var(--accent); margin-bottom: 8px; }
.mirror-name { font-family: var(--font-display); font-size: 30px; font-weight: 600; line-height: 1.3; }
.mirror-viewing-line {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  margin-top: 8px; font-size: 11.5px; color: var(--text-low);
  font-variant-numeric: tabular-nums;
}
.back-latest-btn {
  font-size: 11.5px; color: var(--accent); font-weight: 600;
  padding: 2px 9px; border-radius: var(--radius-full);
  border: 1px solid var(--accent-soft); background: var(--accent-soft);
  transition: all .15s;
}
.back-latest-btn:hover { border-color: var(--accent); }
.mirror-drift {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 12px;
  font-size: 12px; color: #8B5CF6;
  padding: 4px 12px; border-radius: var(--radius-full);
  background: #F3EEFF;
}
.mirror-drift svg { width: 12px; height: 12px; stroke: #8B5CF6; fill: none; }
.mirror-overall { font-size: 14px; line-height: 1.85; color: var(--text-mid); margin-top: 14px; }

.mirror-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
.mirror-stat {
  text-align: center; padding: 12px 6px; border-radius: var(--radius-sm);
  background: var(--ink-2);
}
.mirror-stat-num {
  font-family: var(--font-display); font-size: 21px; font-weight: 600;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}
.mirror-stat-label { font-size: 11px; color: var(--text-low); margin-top: 1px; }
.mirror-stats-note { font-size: 10.5px; color: var(--text-low); margin-top: 7px; }

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

/* ===== 统计图区布局 ===== */
.chart-card { min-width: 0; }
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
.heat-scale { gap: 2px; }
.heat-scale-cell { width: 12px; height: 8px; border-radius: 2px; display: inline-block; }

/* 三小卡：≥1200px 一行三列，窄屏堆叠 */
.chart-row-3 { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 12px; }
@media (min-width: 700px) { .chart-row-3 { grid-template-columns: repeat(3, 1fr); } }

/* 两卡：≥900px 一行两列（关键词列稍宽），窄屏堆叠 */
.chart-row-2 { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 12px; }
@media (min-width: 900px) { .chart-row-2 { grid-template-columns: 1.2fr 1fr; } }

/* portrait grid */
.portrait-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 14px; }
@media (min-width: 900px) {
  .portrait-grid { grid-template-columns: repeat(2, 1fr); }
  .portrait-grid .card.span-2 { grid-column: span 2; }
}
@media (min-width: 1200px) {
  .portrait-grid { grid-template-columns: repeat(4, 1fr); }
  .portrait-grid .card.span-2 { grid-column: span 4; }
}
.portrait-section { padding: 16px; }
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

/* todo rows + user tags */
.todo-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 8px 0; border-bottom: 1px dashed var(--line); font-size: 13.5px;
}
.todo-row:last-child { border-bottom: none; }
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
</style>
