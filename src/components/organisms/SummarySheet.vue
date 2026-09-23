<script setup>
/**
 * 每日总结 sheet（v2 原型样式，T-F-R7 + 三轮接线 + 词典候选分区 R10）
 * 数据源：GET /api/summaries
 *  - 不带 date：日报列表（新→旧，content 空、highlights 取前 3 行），游标分页
 *    （limit 每页条数 + before=summary_date 游标，只返回更早的；返回条数 < limit 即到底）
 *  - 带 date=YYYY-MM-DD：该日单篇（含全文 content）
 *
 * 浏览交互（日报按天无限累积，不做全量渲染）：
 *  - 首屏 10 篇，滚动触底自动翻下一页；底部同时给「加载更早」按钮兜底（自动加载失效时可用）
 *  - 按月份分组 + sticky 月份标题（"2026 年 9 月"），长列表里能定位时间
 *  - 单篇展开为卡片内联展开，互斥（同时只展开一天，避免长列表跳动）
 * 「依据：查看原文」→ 关 sheet + 打开 source_record_id 对应记录详情（复用 openRecord 交互）。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useSummariesStore } from '@/stores/summaries'
import { useGlossaryStore } from '@/stores/glossary'
import { useUIStore } from '@/stores/ui'
import { useToastStore } from '@/stores/toast'
import TermCard from '@/components/molecules/TermCard.vue'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close'])

/** 弹窗每页条数（进「全部」即为浏览历史，比侧栏 7 篇口径放宽） */
const PAGE_SIZE = 10
/** 触底提前量（px）：距底不足即预加载下一页，避免可见的等待 */
const PREFETCH_OFFSET = 160
/** 缺失日回溯窗口（天）：与定时任务 BACKFILL_DAYS 同口径 */
const MISSING_LOOKBACK = 7

const summaries = useSummariesStore()
const glossary = useGlossaryStore()
const ui = useUIStore()
const toast = useToastStore()

/** 当前展开全文的日报日期（YYYY-MM-DD） */
const expandedDate = ref(null)

/** 正在操作（确认/保存）的词条 id，禁按钮防双击 */
const busyTermId = ref(null)

/** 滚动容器（触底判定 + 打开时复位到顶部） */
const bodyEl = ref(null)

watch(() => props.show, (val) => {
  if (val) {
    expandedDate.value = null
    summaries.fetchList({ limit: PAGE_SIZE })
    // 缺失日（有记录但没生成成功）：渲染成流里的一行，补生成按钮挂在那一天上
    summaries.fetchMissing(MISSING_LOOKBACK)
    // 词条候选：sheet 打开即拉（pending 组给候选分区，设置页共用同一 store）
    if (!glossary.pending.length) glossary.fetch()
    nextTick(() => {
      if (bodyEl.value) bodyEl.value.scrollTop = 0
    })
  }
})

/** 触底加载更早的一页 */
function onBodyScroll(e) {
  const el = e.currentTarget
  if (el.scrollHeight - el.scrollTop - el.clientHeight < PREFETCH_OFFSET) loadMore()
}

function loadMore() {
  if (summaries.loading || summaries.loadingMore || !summaries.hasMore) return
  summaries.fetchMore(PAGE_SIZE)
}

/** 生成成功后统一刷新（列表 + 缺失日），避免残留已补上的「未生成」行 */
async function refreshAfterGenerate() {
  await summaries.fetchList({ limit: PAGE_SIZE })
  await summaries.fetchMissing(MISSING_LOOKBACK)
}

/** 补生成缺失的那一天（force=false：本来就没有日报，不需要删旧） */
async function onGenerate(date) {
  if (summaries.regeneratingDate) return
  const vo = await summaries.regenerate(date, false)
  if (summaries.error) {
    toast.error(summaries.error)
    return
  }
  if (vo) {
    toast.success(`${date} 日报已生成`)
    await refreshAfterGenerate()
  } else {
    toast.info(`${date} 当天没有可总结的记录`)
  }
}

/**
 * 「重新生成」某天日报（force=true 删旧重建）
 * 生成要调 LLM，阻塞数秒；结束后重拉列表拿最新内容。
 */
async function onRegenerate(item) {
  if (summaries.regeneratingDate) return
  const vo = await summaries.regenerate(item.summary_date, true)
  if (summaries.error) {
    toast.error(summaries.error)
    return
  }
  if (vo) {
    toast.success(`${item.summary_date} 日报已重新生成`)
    await refreshAfterGenerate()
  } else {
    toast.info('该日期无需生成 · 当天没有记录')
  }
}

/** 展开/收起单篇（首次展开时拉全文） */
async function toggleItem(item) {
  if (expandedDate.value === item.summary_date) {
    expandedDate.value = null
    return
  }
  expandedDate.value = item.summary_date
  if (!item.content) {
    await summaries.fetchDetail(item.summary_date)
  }
}

// ==================== 列表分组 / 展示 ====================

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** "2026-09" → "2026 年 9 月" */
function monthLabel(ym) {
  const [y, m] = ym.split('-')
  return `${y} 年 ${Number(m)} 月`
}

/** "2026-09-13" → { md: "09-13", weekday: "周日" }（本地构造，避免 UTC 解析偏移） */
function dayMeta(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number)
  if (!y || !m || !d) return { md: String(dateStr || ''), weekday: '' }
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return {
    md: `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    weekday: `周${weekday}`,
  }
}

/**
 * 日报流：已有日报 + 缺失日（有记录但没生成成功）合并，按日期倒序后按月分组。
 * 缺失日插在它原本的位置上——补生成的按钮就该长在"那一天"，而不是列表顶部。
 */
const monthGroups = computed(() => {
  const rows = [
    ...summaries.list.map(item => ({ kind: 'summary', date: item.summary_date, item })),
    ...summaries.missingDates.map(date => ({ kind: 'missing', date })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const groups = []
  rows.forEach(row => {
    const ym = String(row.date || '').slice(0, 7)
    if (!ym) return
    const last = groups[groups.length - 1]
    if (last && last.key === ym) last.items.push(row)
    else groups.push({ key: ym, label: monthLabel(ym), items: [row] })
  })
  return groups
})

/** 生成时间 HH:mm（created_at "yyyy-MM-dd HH:mm:ss"） */
function genTime(dateStr) {
  return dateStr ? dateStr.slice(11, 16) : ''
}

// ==================== 词条候选（lexicon-design.md 5a） ====================

/** [确认] → POST confirm，toast「下次对话开始使用」 */
async function onConfirm(term) {
  busyTermId.value = term.id
  const ok = await glossary.confirm(term.id)
  busyTermId.value = null
  if (ok) toast.success(`「${term.term}」已生效 · 下次对话开始使用`)
  else toast.error(glossary.error || '确认失败')
}

/** [改一改] 保存 → PUT */
async function onSave(term, data) {
  busyTermId.value = term.id
  const ok = await glossary.update(term.id, data)
  busyTermId.value = null
  if (ok) toast.success('已更新')
  else toast.error(glossary.error || '保存失败')
}

/** [不要] → dismiss，卡片淡出（TermCard 内先放淡出动画再 emit） */
async function onDismiss(term) {
  const ok = await glossary.dismiss(term.id)
  if (ok) toast.info(`「${term.term}」已忽略 · 30 天后可能重新浮现`)
  else toast.error('操作失败')
}

/** 依据 → 关 sheet 打开来源记录详情（复用 openRecord 交互）
 *
 * 用 source_record_id（records 主键），不是 source_chunk_id（chunks 主键）——详情面板按
 * records.id 查，两表号段重叠会翻到同号的另一条记录。
 */
function openSource(term) {
  if (term.source_record_id == null) return
  ui.closeSummarySheet()
  ui.selectedRecordId = term.source_record_id
  ui.showDetail = true
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="modal-overlay" @click="emit('close')" />
    </Transition>
    <Transition name="sheet">
      <div v-if="show" class="sheet">
        <div class="sheet-header">
          <span class="sheet-title">每日总结</span>
          <span v-if="summaries.list.length" class="sheet-count">{{ summaries.list.length }} 篇</span>
          <button class="sheet-close" @click="emit('close')">关闭</button>
        </div>
        <div ref="bodyEl" class="sheet-body" @scroll="onBodyScroll">
          <!-- 加载中 -->
          <template v-if="summaries.loading">
            <div class="summary-loading"><span class="spinner" /> 加载中…</div>
          </template>

          <!-- 加载失败（后端未起兜底，不白屏） -->
          <template v-else-if="summaries.error">
            <div class="summary-empty">{{ summaries.error }}</div>
          </template>

          <!-- 词条候选分区（总结正文之后，独立分区；无候选不渲染。
               注意：summaries.error / loading 时不在此分支挂载，候选独立于日报状态） -->
          <div v-if="!summaries.loading && !summaries.error && glossary.pending.length" class="glossary-section">
            <div class="glossary-head">
              <span class="glossary-title">个人词典候选</span>
              <span class="glossary-count">{{ glossary.pending.length }}</span>
            </div>
            <TermCard
              v-for="t in glossary.pending"
              :key="t.id"
              :term="t"
              group="pending"
              :busy="busyTermId === t.id"
              @confirm="onConfirm(t)"
              @save="data => onSave(t, data)"
              @dismiss="onDismiss(t)"
              @open-source="openSource"
            />
          </div>

          <!-- 日报流：按月分组 + 触底翻页 -->
          <template v-if="!summaries.loading && !summaries.error && monthGroups.length">
            <section v-for="group in monthGroups" :key="group.key" class="month-group">
              <div class="month-head">
                <span class="month-label">{{ group.label }}</span>
                <span class="month-line" />
              </div>

              <template v-for="row in group.items" :key="row.date">
                <!-- 缺失日：那天有记录但日报没生成成功 → 按钮就挂在这一天上 -->
                <div v-if="row.kind === 'missing'" class="summary-missing">
                  <span class="summary-date">
                    {{ dayMeta(row.date).md }}
                    <i class="summary-weekday">{{ dayMeta(row.date).weekday }}</i>
                  </span>
                  <span class="missing-note">日报未生成</span>
                  <button
                    class="missing-gen"
                    :disabled="!!summaries.regeneratingDate"
                    @click="onGenerate(row.date)"
                  >{{ summaries.regeneratingDate === row.date ? '生成中…' : '生成' }}</button>
                </div>

                <!-- 已有日报 -->
                <div v-else class="summary-item">
                  <div class="summary-meta">
                    <span class="summary-date">
                      {{ dayMeta(row.item.summary_date).md }}
                      <i class="summary-weekday">{{ dayMeta(row.item.summary_date).weekday }}</i>
                    </span>
                    <span>记录 {{ row.item.stats?.record_count ?? '—' }} 条</span>
                    <span v-if="genTime(row.item.created_at)">{{ genTime(row.item.created_at) }} 生成</span>
                    <!-- 重生成：常驻低对比图标，hover 才提亮（不抢日期的视觉重心） -->
                    <button
                      class="summary-regen"
                      :class="{ busy: summaries.regeneratingDate === row.item.summary_date }"
                      :disabled="!!summaries.regeneratingDate"
                      :title="summaries.regeneratingDate === row.item.summary_date ? '生成中…' : '重新生成这一天的日报'"
                      @click="onRegenerate(row.item)"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
                      </svg>
                    </button>
                  </div>

                  <!-- 已展开：全文 -->
                  <template v-if="expandedDate === row.item.summary_date">
                    <div v-if="summaries.detailLoading" class="summary-loading"><span class="spinner" /> 加载全文…</div>
                    <template v-else-if="row.item.content">
                      <p class="summary-text">{{ row.item.content }}</p>
                      <button class="summary-expand" @click="toggleItem(row.item)">收起</button>
                    </template>
                    <p v-else class="summary-empty">全文加载失败</p>
                  </template>

                  <!-- 未展开：摘要行 + 展开按钮 -->
                  <template v-else>
                    <p class="summary-text summary-text-brief">
                      {{ (row.item.highlights && row.item.highlights.length ? row.item.highlights.join('\n') : '暂无摘要') }}
                    </p>
                    <button class="summary-expand" @click="toggleItem(row.item)">展开全文</button>
                  </template>
                </div>
              </template>
            </section>

            <!-- 分页状态：加载中 / 加载更早 / 到底 -->
            <div class="page-foot">
              <template v-if="summaries.loadingMore">
                <span class="spinner" /> 加载更早的日报…
              </template>
              <template v-else-if="summaries.hasMore">
                <button class="load-more" @click="loadMore">加载更早的日报</button>
              </template>
              <span v-else class="page-end">已经是最早的一篇日报了</span>
            </div>
          </template>

          <!-- 空态：无候选且无日报 -->
          <div v-if="!summaries.loading && !summaries.error && !monthGroups.length && !glossary.pending.length" class="summary-empty">
            还没有每日总结 · AI 会在每天凌晨自动生成昨日的总结
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(26,26,23,.35);
  z-index: 44;
}

.sheet {
  position: fixed; left: 50%; bottom: 0; transform: translate(-50%, 0);
  width: 100%; max-width: 640px; max-height: 78dvh; z-index: 45;
  background: #FFFFFF;
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -8px 28px rgba(20,20,15,.14);
  display: flex; flex-direction: column;
  padding-bottom: var(--safe-bottom);
}
@media (min-width: 900px) {
  .sheet { border-radius: 20px; bottom: 8dvh; }
}

.sheet-header {
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
  padding: 16px 20px 10px;
}
.sheet-title { font-family: var(--font-display); font-size: 16px; }
.sheet-count {
  margin-right: auto;
  font-family: var(--font-mono); font-size: 10.5px; color: var(--text-low);
  padding: 2px 8px; border-radius: var(--radius-full); background: var(--ink-2);
}
.sheet-close { font-size: 14.5px; color: var(--text-mid); padding: 6px 2px; cursor: pointer; }


.sheet-body {
  overflow-y: auto; padding: 6px 20px 22px;
  font-size: 14px; line-height: 1.85; color: var(--text-mid);
}
.summary-loading { display: flex; align-items: center; gap: 8px; color: var(--text-low); }
.summary-empty { color: var(--text-low); font-size: 13px; padding: 18px 0; text-align: center; }

/* ===== 月份分组（长列表定位） ===== */
.month-group { margin-bottom: 4px; }
.month-head {
  position: sticky; top: 0; z-index: 1;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0 8px;
  /* 盖住滚动内容：月份标题滑过时下面的日报不能透出来 */
  background: linear-gradient(#FFFFFF 72%, rgba(255,255,255,0));
}
.month-label {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .1em;
  color: var(--text-low); white-space: nowrap;
}
.month-line { flex: 1; height: 1px; background: var(--line); }

.summary-item { padding: 6px 0 14px; border-bottom: 1px dashed var(--line); }
.summary-item:last-child { border-bottom: none; }

.summary-meta {
  font-family: var(--font-mono); font-size: 11px; color: var(--text-low);
  margin-bottom: 10px; display: flex; gap: 14px; align-items: baseline;
}
.summary-date {
  display: inline-flex; align-items: baseline; gap: 5px;
  color: var(--text-hi); font-weight: 600;
}
.summary-weekday { font-style: normal; font-weight: 400; color: var(--text-low); }
/* 重新生成：右对齐的刷新图标（常驻低对比，hover 才提亮） */
.summary-regen {
  margin-left: auto; width: 22px; height: 22px; border-radius: 50%;
  display: grid; place-items: center;
  color: var(--text-low); opacity: .55;
  transition: color .15s, background .15s, opacity .15s;
}
.summary-regen svg { width: 13px; height: 13px; }
.summary-regen:hover:not(:disabled) { color: var(--accent); background: var(--ink-2); opacity: 1; }
.summary-regen:disabled { cursor: default; }
.summary-regen.busy { color: var(--accent); opacity: 1; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* 缺失日：一行轻量提示 + 生成按钮（按钮长在"那一天"上） */
.summary-missing {
  display: flex; align-items: baseline; gap: 10px;
  padding: 4px 0 13px; margin-bottom: 0;
  border-bottom: 1px dashed var(--line);
}
.summary-missing .summary-date { color: var(--text-mid); font-weight: 500; }
.missing-note { font-size: 11.5px; color: var(--text-low); }
.missing-gen {
  margin-left: auto; font-size: 11.5px; color: var(--accent);
  padding: 3px 11px; border: 1px solid var(--line-strong);
  border-radius: var(--radius-full); transition: background .15s;
}
.missing-gen:hover:not(:disabled) { background: var(--accent-soft); }
.missing-gen:disabled { opacity: .55; cursor: default; }
.summary-text { margin: 0; white-space: pre-wrap; }
.summary-text-brief {
  color: var(--text-mid);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.summary-expand {
  margin-top: 8px; font-size: 12.5px; color: var(--accent); cursor: pointer;
  padding: 2px 0;
}
.summary-expand:hover { text-decoration: underline; }

/* ===== 分页状态 ===== */
.page-foot {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 16px 0 4px;
  font-size: 12.5px; color: var(--text-low);
}
.load-more {
  font-size: 12.5px; color: var(--accent); padding: 6px 14px;
  border: 1px solid var(--line-strong); border-radius: var(--radius-full);
}
.load-more:hover { background: var(--accent-soft); }
.page-end { font-size: 12px; color: var(--text-low); }

/* ===== 个人词典候选分区（lexicon-design.md 5a） ===== */
.glossary-section {
  margin-bottom: 18px; padding-bottom: 16px;
  border-bottom: 1px dashed var(--line);
  animation: cardIn .3s ease;
}
.glossary-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.glossary-title {
  font-family: var(--font-mono); font-size: 11.5px; letter-spacing: .16em;
  color: var(--text-low);
}
.glossary-count {
  min-width: 17px; height: 17px; padding: 0 5px; border-radius: var(--radius-full);
  background: var(--accent); color: #FFFFFF;
  font-family: var(--font-mono); font-size: 10.5px; line-height: 17px; text-align: center;
}

.sheet-enter-active, .sheet-leave-active { transition: transform .32s cubic-bezier(.32,.72,.28,1); }
.sheet-enter-from, .sheet-leave-to { transform: translate(-50%, 110%) !important; }
</style>
