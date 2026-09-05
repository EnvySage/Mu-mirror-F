<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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
  if (recordsStore.records.length === 0) recordsStore.fetchRecords()
  // 六图表数据源（B Agent 真接口，stats store 内 30s 缓存）
  stats.fetchStats()
})

/** 镜子名：当前月份 */
const now = new Date()
const mirrorName = computed(() => `你的镜子 · ${now.getMonth() + 1} 月`)

// ---- 数字滚动（0 → 目标值，JS rAF ~600ms；纯展示层，无数据逻辑） ----
const statsProgress = ref(0) // 0~1

function animateNumber() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    statsProgress.value = 1
    return
  }
  const start = performance.now()
  const DUR = 600
  function frame(t) {
    const p = Math.min((t - start) / DUR, 1)
    // easeOutCubic
    statsProgress.value = 1 - Math.pow(1 - p, 3)
    if (p < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

/** 三格 stats：总记录 / 活跃天 / 日均（从记录本地统计），num 经滚动插值展示 */
const stats = computed(() => {
  const rs = recordsStore.records
  const days = new Set(rs.map(r => {
    const d = new Date(String(r.created_at).replace(' ', 'T'))
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }))
  const activeDays = days.size || 1
  const raw = [
    { num: rs.length, label: '条记录', decimals: 0 },
    { num: days.size, label: '活跃天', decimals: 0 },
    { num: (rs.length / activeDays).toFixed(1), label: '日均', decimals: 1 },
  ]
  const p = statsProgress.value
  return raw.map(s => ({
    ...s,
    display: (Number(s.num) * p).toFixed(s.decimals),
  }))
})

// 镜子页可见 / 记录数据变化时重放数字滚动
watch(() => recordsStore.records.length, animateNumber, { immediate: true })

// ---- 生成完成：hero 一次轻脉冲 ----
const justSettled = ref(false)
let settledTimer = null
watch(() => mirror.profile, (p) => {
  if (!p) return
  justSettled.value = true
  clearTimeout(settledTimer)
  settledTimer = setTimeout(() => { justSettled.value = false }, 1200)
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

/** 快照轨迹（sessions 接口未就绪，仅当前快照） */
const snapshots = computed(() => {
  const p = mirror.profile
  if (!p || p.id === null || p.id === undefined) return []
  const d = p.created_at ? new Date(String(p.created_at).replace(' ', 'T')) : now
  const label = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return [{ label, type: p.snapshot_type === 'monthly' ? 'monthly' : 'manual', current: true }]
})

async function onGenerate() {
  const ok = await mirror.generate()
  if (ok) toast.success('快照已生成')
  else toast.error(mirror.error || '生成失败，请重试')
}
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
        <!-- mirror-hero：数字滚动 + 完成轻脉冲 -->
        <div :class="['mirror-hero', 'card', { settled: justSettled }]">
          <div class="mirror-hero-inner">
          <div class="mirror-greeting">这是我在你身上看到的</div>
          <div class="mirror-name">{{ mirrorName }}</div>
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
            <span class="chart-head-note">每天一根 · 按当日情绪占比分色</span>
          </div>
          <MoodBand :data="statsStore.mood_daily" />
        </div>

        <!-- 三小卡一行：活跃时段 / 待办完成度 / 周节奏（≥1200px 三列，窄屏堆叠） -->
        <div class="chart-row-3">
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">HOUR HEAT</span>
              <span class="chart-head-note">记录时段分布</span>
            </div>
            <HourHeat :data="statsStore.hour_dist" />
          </div>
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">TODO</span>
              <span class="chart-head-note">近 30 天完成度</span>
            </div>
            <TodoRing :todo="statsStore.todo" />
          </div>
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">WEEKDAY</span>
              <span class="chart-head-note">一周节奏</span>
            </div>
            <WeekdayBars :data="statsStore.weekday_dist" />
          </div>
        </div>

        <!-- 两卡一行：关键词 Top10 / 记录频率 -->
        <div class="chart-row-2">
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">KEYWORDS</span>
              <span class="chart-head-note">Top 10</span>
            </div>
            <KeywordBars :data="statsStore.keyword_top" />
          </div>
          <div class="portrait-section card chart-card">
            <div class="chart-head">
              <span class="section-label">FREQUENCY</span>
              <span class="chart-head-note">每天记录数</span>
            </div>
            <RecordFreq :data="statsStore.record_daily" />
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

        <!-- snapshot-strip 快照轨迹 -->
        <div class="portrait-section card span-2" style="margin-top:12px">
          <div class="portrait-section-header">
            <div class="portrait-section-icon" style="background:var(--ink-2);border:1px solid var(--line)">
              <svg viewBox="0 0 24 24" style="stroke:var(--accent)"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>
            </div>
            <div class="portrait-section-title">快照轨迹（manual 保 2 · monthly 保 12）</div>
          </div>
          <div v-if="snapshots.length" class="snapshot-strip">
            <span
              v-for="(s, i) in snapshots"
              :key="i"
              :class="['snapshot-chip', { current: s.current, compare: s.type === 'monthly' && !s.current }]"
            >{{ s.label }} · {{ s.type }}{{ s.current ? ' · 当前' : '' }}</span>
          </div>
          <div v-else class="portrait-text">暂无历史快照。</div>
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

/* mirror-hero（白卡，无扫光） */
.mirror-hero { position: relative; overflow: hidden; padding: 26px 22px; margin-top: 8px; text-align: left; }
/* 超宽屏限文本行长（卡做全宽背景，内容限宽），避免 overall 总结一行拉太长 */
.mirror-hero-inner { max-width: 720px; }
.mirror-hero.settled { animation: breatheOnce 1.1s ease; }
.mirror-greeting { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .22em; color: var(--accent); margin-bottom: 8px; }
.mirror-name { font-family: var(--font-display); font-size: 30px; font-weight: 600; line-height: 1.3; }
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

/* snapshot strip */
.snapshot-strip { display: flex; gap: 8px; margin-top: 4px; overflow-x: auto; padding-bottom: 4px; }
.snapshot-chip {
  flex-shrink: 0; font-family: var(--font-mono); font-size: 10.5px;
  padding: 5px 11px; border-radius: var(--radius-full);
  border: 1px solid var(--line); color: var(--text-low);
  background: var(--card);
}
.snapshot-chip.current { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
.snapshot-chip.compare { color: #8B5CF6; border-color: #8B5CF6; background: #F3EEFF; }

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
