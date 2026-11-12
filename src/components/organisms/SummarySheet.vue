<script setup>
import { reportAchievementActivity } from '@/api/achievements'
import { vReadEnd } from '@/composables/useReadingEnd'
import SummarySources from '@/components/molecules/SummarySources.vue'
import { summarySourceIds } from '@/utils/summarySources'
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
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useSummariesStore } from '@/stores/summaries'
import { useGlossaryStore } from '@/stores/glossary'
import { useUIStore } from '@/stores/ui'
import { useToastStore } from '@/stores/toast'
import TermCard from '@/components/molecules/TermCard.vue'
import { useDialogFocus, prepareDialogFocusHandoff } from '@/composables/useDialogFocus'
import { useOverlayMotion } from '@/motion/useOverlayMotion'
import { usePaperEntrance } from '@/motion/usePaperEntrance'

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
usePaperEntrance(bodyEl, () => summaries.list.map(item => item.summary_date).join(','), '.summary-item')
const dialogEl = ref(null)
const focusOpen = ref(false)
const dialogFocus = useDialogFocus(() => focusOpen.value, dialogEl, '.sheet-close', () => emit('close'))
const overlay = useOverlayMotion(() => ({ xPercent: -50, yPercent: window.matchMedia('(min-width: 900px)').matches ? -50 : 0, distance: 36 }))
let pendingHandoff = null
let cancelFocusHandoff = null
onBeforeUnmount(() => cancelFocusHandoff?.())
function afterSheetLeave() {
  if (props.show) return
  focusOpen.value = false
  const handoff = pendingHandoff
  pendingHandoff = null
  cancelFocusHandoff = null
  handoff?.()
}
function retrySummaries() { summaries.fetchList({ limit: PAGE_SIZE }); summaries.fetchMissing(MISSING_LOOKBACK) }
function startWriting() { cancelFocusHandoff = prepareDialogFocusHandoff(); pendingHandoff = () => ui.openWriteModal(); emit('close') }

watch(() => props.show, (val) => {
  if (val) {
    cancelFocusHandoff?.()
    cancelFocusHandoff = null
    pendingHandoff = null
    focusOpen.value = true
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
  cancelFocusHandoff = prepareDialogFocusHandoff()
  pendingHandoff = () => {
    ui.openRecordWithActivity(term.source_record_id, { kind: 'glossary.source_opened', subjectId: term.id, otherId: term.source_record_id })
  }
  ui.closeSummarySheet()
}
</script>

<template>
  <Teleport to="body">
    <Transition :css="false" v-bind="overlay.backdropHooks">
      <div v-if="show" class="modal-overlay" @click="emit('close')" />
    </Transition>
    <Transition :css="false" v-bind="overlay.panelHooks" @after-enter="dialogFocus.focusInitial" @after-leave="afterSheetLeave">
      <section v-if="show" ref="dialogEl" class="sheet" role="dialog" aria-modal="true" aria-labelledby="summary-title" tabindex="-1">
        <header class="sheet-header">
          <div><span class="summary-edition">DAILY REFLECTION</span><h2 id="summary-title">每日总结</h2></div>
          <button class="sheet-close" @click="emit('close')">关闭 <span aria-hidden="true">×</span></button>
        </header>
        <div ref="bodyEl" class="sheet-body" @scroll="onBodyScroll">
        <div class="summary-cover">
          <div><p class="cover-caption">给认真生活的你，一次回望。</p><h3>这一天，<br>也有值得记住的事。</h3></div>
          <div class="cover-index" v-if="!summaries.loading && !summaries.error && summaries.list.length"><strong>{{ String(summaries.list.length).padStart(2, '0') }}</strong><span>篇已载入的日常<small>向下翻阅，更早的自己。</small></span></div>
          <span v-else class="cover-watermark" aria-hidden="true">DAY BY DAY.</span>
        </div>
          <!-- 加载中 -->
          <template v-if="summaries.loading">
            <div class="summary-loading summary-state" role="status"><span class="spinner" /> 正在翻开你的日常…</div>
          </template>

          <!-- 加载失败（后端未起兜底，不白屏） -->
          <template v-else-if="summaries.error">
            <div class="summary-empty summary-state" role="alert"><span class="state-mark" aria-hidden="true">!</span><h3>这次回望，还没有加载好。</h3><p>{{ summaries.error }}</p><button class="state-action" @click="retrySummaries">重新加载 <span aria-hidden="true">↗</span></button></div>
          </template>

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
                <article v-else class="summary-item" :class="{ expanded: expandedDate === row.item.summary_date }" :aria-label="`${row.item.summary_date} 每日总结`">
                  <div class="summary-meta">
                    <span class="summary-date">
                      {{ dayMeta(row.item.summary_date).md }}
                      <i class="summary-weekday">{{ dayMeta(row.item.summary_date).weekday }}</i>
                    </span>
                    <span class="summary-records">{{ row.item.stats?.record_count ?? '—' }} 条记录</span>
                    <span class="summary-generated" v-if="genTime(row.item.created_at)">{{ genTime(row.item.created_at) }} 生成</span>
                    <!-- 重生成：常驻低对比图标，hover 才提亮（不抢日期的视觉重心） -->
                    <button
                      class="summary-regen"
                      :class="{ busy: summaries.regeneratingDate === row.item.summary_date }"
                      :disabled="!!summaries.regeneratingDate"
                      :aria-label="`重新生成 ${row.item.summary_date} 的总结`"
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
                      <p :id="`summary-body-${row.date}`" v-read-end="{ key: row.item.summary_date, onRead: () => reportAchievementActivity('summary.opened', row.item.summary_date) }" class="summary-text">{{ row.item.content }}</p>
                      <SummarySources :date="row.item.summary_date" :source-ids="summarySourceIds(row.item.stats)" @open-record="id => { cancelFocusHandoff = prepareDialogFocusHandoff(); pendingHandoff = () => { ui.selectedRecordId = id; ui.showDetail = true }; ui.closeSummarySheet() }" />
                      <button class="summary-expand" :aria-expanded="true" :aria-controls="`summary-body-${row.date}`" @click="toggleItem(row.item)">收起全文 <span aria-hidden="true">↑</span></button>
                    </template>
                    <div v-else class="summary-empty" role="alert">全文加载失败 <button class="summary-expand" @click="summaries.fetchDetail(row.item.summary_date)">重试</button><button class="summary-expand" @click="toggleItem(row.item)">收起</button></div>
                  </template>

                  <!-- 未展开：摘要行 + 展开按钮 -->
                  <template v-else>
                    <ol class="summary-highlights" v-if="row.item.highlights?.length">
                      <li v-for="(highlight, index) in row.item.highlights" :key="index"><span aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span><p>{{ highlight }}</p></li>
                    </ol>
                    <p v-else class="summary-text summary-text-brief">暂无摘要</p>
                    <button class="summary-expand" :aria-expanded="false" :aria-label="`阅读 ${row.date} 的完整总结`" @click="toggleItem(row.item)">阅读这一天 <span aria-hidden="true">↗</span></button>
                  </template>
                </article>
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

          <!-- 空态：无候选且无日报 -->
          <div v-if="!summaries.loading && !summaries.error && !monthGroups.length && !glossary.pending.length" class="summary-empty summary-state">
            <span class="state-mark" aria-hidden="true">↗</span><h3>你的日常，还在写下第一页。</h3><p>先留下今天的记录，Mirror 会在次日凌晨整理成总结。</p><button class="state-action" @click="startWriting">写下今天 <span aria-hidden="true">↗</span></button>
          </div>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped src="@/assets/styles/summary-sheet.css"></style>
<style scoped src="@/assets/styles/persona-summary.css"></style>
