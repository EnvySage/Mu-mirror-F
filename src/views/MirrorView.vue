<script setup>
import { computed, onMounted } from 'vue'
import { useMirrorStore } from '@/stores/mirror'
import { useRecordsStore } from '@/stores/records'
import { useToastStore } from '@/stores/toast'
import { MOOD_COLOR } from '@/constants/moodColor'
import { moodMap, taskStatusMap } from '@/constants/tags'
import { timeAgo } from '@/utils/time'

const mirror = useMirrorStore()
const recordsStore = useRecordsStore()
const toast = useToastStore()

onMounted(() => {
  mirror.fetchMirror()
  if (recordsStore.records.length === 0) recordsStore.fetchRecords()
})

/** 镜子名：当前月份 */
const now = new Date()
const mirrorName = computed(() => `你的镜子 · ${now.getMonth() + 1} 月`)

/** 三格 stats：总记录 / 活跃天 / 日均（从记录本地统计） */
const stats = computed(() => {
  const rs = recordsStore.records
  const days = new Set(rs.map(r => {
    const d = new Date(String(r.created_at).replace(' ', 'T'))
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }))
  const activeDays = days.size || 1
  return [
    { num: rs.length, label: '条记录' },
    { num: days.size, label: '活跃天' },
    { num: (rs.length / activeDays).toFixed(1), label: '日均' },
  ]
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
        <!-- mirror-hero：sheen 扫光 + 渐变 stats -->
        <div class="mirror-hero card">
          <div class="mirror-greeting">这是我在你身上看到的</div>
          <div class="mirror-name">{{ mirrorName }}</div>
          <div v-if="mirror.drift" class="mirror-drift">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>
            较上月漂移 Δ {{ mirror.profile.drift_distance }} · {{ mirror.drift.level }}
          </div>
          <div class="mirror-overall">{{ mirror.profile.overall_summary || '还没有总体总结，先去写几条记录吧。' }}</div>
          <div class="mirror-stats">
            <div v-for="(s, i) in stats" :key="i" class="mirror-stat">
              <div class="mirror-stat-num">{{ s.num }}</div>
              <div class="mirror-stat-label">{{ s.label }}</div>
            </div>
          </div>
          <button class="mirror-generate" :disabled="mirror.generating" @click="onGenerate">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>
            {{ mirror.generating ? '生成中…' : '重新生成快照（manual）' }}
          </button>
        </div>

        <!-- portrait-grid 四卡 -->
        <div class="portrait-grid">
          <div class="portrait-section card">
            <div class="portrait-section-header">
              <div class="portrait-section-icon" style="background:var(--accent-grad)">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
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
              <div class="portrait-section-icon" style="background:linear-gradient(135deg,#4ADE9C,#6EE7F0)">
                <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
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
              <div class="portrait-section-icon" style="background:linear-gradient(135deg,#FFC862,#FB923C)">
                <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
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
              <div class="portrait-section-icon" style="background:linear-gradient(135deg,#E879F9,#A78BFA)">
                <svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
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
            <div class="portrait-section-icon" style="background:rgba(255,255,255,.14)">
              <svg viewBox="0 0 24 24" style="stroke:var(--text-hi)"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>
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

.page-header { display: none; padding: 26px 32px 0; align-items: baseline; gap: 14px; }
@media (min-width: 900px) { .page-header { display: flex; } }
.page-title { font-family: var(--font-display); font-size: 26px; font-weight: 600; }
.page-subtitle { font-size: 13px; color: var(--text-low); }

.page-content {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 10px 18px calc(96px + var(--safe-bottom));
  -webkit-overflow-scrolling: touch;
}
@media (min-width: 900px) {
  .page-content { padding: 18px 32px 40px; max-width: 900px; }
}

/* mirror-hero + sheen 扫光 */
.mirror-hero { position: relative; overflow: hidden; padding: 26px 22px; margin-top: 8px; text-align: left; }
.mirror-hero::before {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.07) 46%, rgba(110,231,240,.06) 50%, transparent 66%);
  background-size: 240% 100%;
  animation: sheen 7s ease-in-out infinite;
  pointer-events: none;
}
.mirror-greeting { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .22em; color: var(--cyan); margin-bottom: 8px; }
.mirror-name { font-family: var(--font-display); font-size: 30px; font-weight: 600; line-height: 1.3; }
.mirror-drift {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 12px;
  font-size: 12px; color: var(--violet);
  padding: 4px 12px; border-radius: var(--radius-full);
  background: rgba(167,139,250,.1); box-shadow: inset 0 0 0 1px rgba(167,139,250,.3);
}
.mirror-drift svg { width: 12px; height: 12px; stroke: var(--violet); fill: none; }
.mirror-overall { font-size: 14px; line-height: 1.85; color: var(--text-mid); margin-top: 14px; }

.mirror-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
.mirror-stat {
  text-align: center; padding: 12px 6px; border-radius: var(--radius-sm);
  background: rgba(255,255,255,.03); box-shadow: inset 0 0 0 1px var(--line);
}
.mirror-stat-num {
  font-family: var(--font-display); font-size: 21px; font-weight: 600;
  background: var(--accent-grad);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.mirror-stat-label { font-size: 11px; color: var(--text-low); margin-top: 1px; }

.mirror-generate {
  margin-top: 16px; width: 100%; padding: 12px; border-radius: 13px;
  font-size: 14px; font-weight: 600; color: var(--text-mid);
  box-shadow: inset 0 0 0 1px var(--line-strong);
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all .2s;
}
.mirror-generate:hover:not(:disabled) { color: var(--cyan); box-shadow: inset 0 0 0 1px rgba(110,231,240,.4); }
.mirror-generate:disabled { opacity: .55; cursor: not-allowed; }
.mirror-generate svg { width: 15px; height: 15px; stroke: currentColor; fill: none; }

/* portrait grid */
.portrait-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 14px; }
@media (min-width: 900px) {
  .portrait-grid { grid-template-columns: repeat(2, 1fr); }
  .portrait-grid .card.span-2 { grid-column: span 2; }
}
.portrait-section { padding: 16px; }
.portrait-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.portrait-section-icon { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; }
.portrait-section-icon svg { width: 15px; height: 15px; stroke: #0B0E1A; fill: none; stroke-width: 2; }
.portrait-section-title { font-size: 14px; font-weight: 600; }
.portrait-text { font-size: 13.5px; line-height: 1.8; color: var(--text-mid); }
.portrait-evidence { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line); }
.portrait-evidence-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: .16em; color: var(--text-low); margin-bottom: 7px; }
.portrait-evidence-item { display: flex; gap: 8px; align-items: baseline; font-size: 12px; color: var(--text-low); margin-bottom: 5px; }
.evidence-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--cyan); flex-shrink: 0; align-self: center; }
.evidence-date { font-family: var(--font-mono); font-size: 10.5px; color: var(--cyan); flex-shrink: 0; }

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
  background: var(--accent-grad); color: #0B0E1A; font-weight: 600;
}

/* snapshot strip */
.snapshot-strip { display: flex; gap: 8px; margin-top: 4px; overflow-x: auto; padding-bottom: 4px; }
.snapshot-chip {
  flex-shrink: 0; font-family: var(--font-mono); font-size: 10.5px;
  padding: 5px 11px; border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px var(--line); color: var(--text-low);
}
.snapshot-chip.current { color: var(--cyan); box-shadow: inset 0 0 0 1px rgba(110,231,240,.4); }
.snapshot-chip.compare { color: var(--violet); box-shadow: inset 0 0 0 1px rgba(167,139,250,.4); }

/* 生成中视图 */
.processing-view { text-align: center; padding: 70px 20px; }
.processing-ring {
  width: 58px; height: 58px; margin: 0 auto 22px; border-radius: 50%;
  border: 2.5px solid rgba(110,231,240,.15); border-top-color: var(--cyan);
  animation: spin 1.1s linear infinite;
}
.processing-title { font-family: var(--font-display); font-size: 17px; }
.processing-desc { font-size: 12.5px; color: var(--text-low); margin-top: 6px; }
</style>
