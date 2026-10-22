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
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useSummariesStore } from '@/stores/summaries'
import { useGlossaryStore } from '@/stores/glossary'
import { useUIStore } from '@/stores/ui'
import { useToastStore } from '@/stores/toast'
import TermCard from '@/components/molecules/TermCard.vue'
import { useDialogFocus, prepareDialogFocusHandoff } from '@/composables/useDialogFocus'
import { useOverlayMotion } from '@/motion/useOverlayMotion'

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
    ui.selectedRecordId = term.source_record_id
    ui.showDetail = true
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
        <div class="summary-cover">
          <div><p class="cover-caption">给认真生活的你，一次回望。</p><h3>这一天，<br>也有值得记住的事。</h3></div>
          <div class="cover-index" v-if="!summaries.loading && !summaries.error && summaries.list.length"><strong>{{ String(summaries.list.length).padStart(2, '0') }}</strong><span>篇已载入的日常<small>向下翻阅，更早的自己。</small></span></div>
          <span v-else class="cover-watermark" aria-hidden="true">DAY BY DAY.</span>
        </div>
        <div ref="bodyEl" class="sheet-body" @scroll="onBodyScroll">
          <!-- 加载中 -->
          <template v-if="summaries.loading">
            <div class="summary-loading summary-state" role="status"><span class="spinner" /> 正在翻开你的日常…</div>
          </template>

          <!-- 加载失败（后端未起兜底，不白屏） -->
          <template v-else-if="summaries.error">
            <div class="summary-empty summary-state" role="alert"><span class="state-mark" aria-hidden="true">!</span><h3>这次回望，还没有加载好。</h3><p>{{ summaries.error }}</p><button class="state-action" @click="retrySummaries">重新加载 <span aria-hidden="true">↗</span></button></div>
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
                      <p :id="`summary-body-${row.date}`" class="summary-text">{{ row.item.content }}</p>
                      <button class="summary-expand" :aria-expanded="true" :aria-controls="`summary-body-${row.date}`" @click="toggleItem(row.item)">收起全文 <span aria-hidden="true">↑</span></button>
                    </template>
                    <div v-else class="summary-empty" role="alert">全文加载失败 <button class="summary-expand" @click="summaries.fetchDetail(row.item.summary_date)">重试</button><button class="summary-expand" @click="toggleItem(row.item)">收起</button></div>
                  </template>

                  <!-- 未展开：摘要行 + 展开按钮 -->
                  <template v-else>
                    <p class="summary-text summary-text-brief">
                      {{ (row.item.highlights && row.item.highlights.length ? row.item.highlights.join('\n') : '暂无摘要') }}
                    </p>
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

          <!-- 空态：无候选且无日报 -->
          <div v-if="!summaries.loading && !summaries.error && !monthGroups.length && !glossary.pending.length" class="summary-empty summary-state">
            <span class="state-mark" aria-hidden="true">↗</span><h3>你的日常，还在写下第一页。</h3><p>先留下今天的记录，Mirror 会在次日凌晨整理成总结。</p><button class="state-action" @click="startWriting">写下今天 <span aria-hidden="true">↗</span></button>
          </div>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay{position:fixed;inset:0;background:#020b32ba;backdrop-filter:blur(7px);z-index:44}
.sheet{position:fixed;left:50%;bottom:0;transform:translate(-50%,0);width:min(100%,980px);height:92dvh;max-height:860px;z-index:45;display:flex;flex-direction:column;overflow:hidden;background:var(--ink);color:var(--text-hi);border-top:4px solid var(--cyan);box-shadow:10px 12px 0 #02113b70,0 25px 90px #010a3480;padding-bottom:var(--safe-bottom)}
.sheet-header{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:24px 38px 20px;background:var(--night);color:white}.sheet-header>div{display:flex;align-items:center;gap:20px}.summary-edition{font:italic 800 37px/.9 var(--font-display);letter-spacing:-.03em;color:var(--cyan)}.sheet-header h2{font-size:16px;font-weight:800;border-left:1px solid #6da4ff70;padding-left:20px}.sheet-close{display:flex;align-items:center;gap:15px;color:#d1e2ff;font-size:11px;min-height:34px}.sheet-close span{font:300 26px/1 var(--font)}
.summary-cover{position:relative;isolation:isolate;overflow:hidden;flex-shrink:0;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:26px 38px 30px;color:white;background:linear-gradient(100deg,#0636bdea,#0b45c85c),url('/art/water-surface.webp') center 34%/cover}.summary-cover::after{content:'';position:absolute;right:-60px;top:-165px;width:330px;height:400px;border:32px solid #8eeeff55;border-radius:50%;transform:rotate(-26deg);z-index:-1}.cover-caption{font-size:11px;color:#bee5ff;letter-spacing:.05em}.summary-cover h3{font-size:30px;line-height:1.4;font-weight:900;letter-spacing:-.04em;margin-top:9px}.cover-index{display:flex;align-items:center;gap:17px;padding:0 5px 4px 0}.cover-index strong{font:italic 800 85px/.85 var(--font-display);color:var(--cyan)}.cover-index span{font-size:11px;font-weight:700}.cover-index small{display:block;font-size:10px;line-height:1.8;color:#bdd9ff;margin-top:8px;font-weight:400}.cover-watermark{font:italic 800 65px/1 var(--font-display);color:#a8edff50}
.sheet-body{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:0 38px 28px;scrollbar-gutter:stable;font-size:14px;line-height:1.85}.month-group{margin-bottom:20px}.month-head{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:18px;padding:22px 0 14px;background:var(--ink)}.month-label{font:700 12px var(--font);color:var(--accent);white-space:nowrap}.month-line{height:1px;flex:1;background:#adc3e6}
.summary-item{position:relative;padding:24px 28px 22px;margin-bottom:12px;background:var(--card);border-left:3px solid transparent;box-shadow:0 1px 0 #b4c7e650}.summary-item.expanded{border-left-color:var(--electric);background:white}.summary-meta{display:flex;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:17px;font-size:10px;color:var(--text-low)}.summary-date{display:inline-flex;align-items:baseline;gap:10px;font:italic 700 33px/1 var(--font-display);color:var(--text-hi)}.summary-weekday{font:normal 10px var(--font);color:var(--text-low)}.summary-records{border-left:1px solid var(--line);padding-left:16px}.summary-regen{margin-left:auto;min-width:32px;min-height:32px;display:grid;place-items:center;color:var(--text-low);transition:background .15s,color .15s}.summary-regen svg{width:16px;height:16px}.summary-regen:hover:not(:disabled){background:var(--accent-soft);color:var(--accent)}.summary-regen.busy svg{animation:spin 1s linear infinite}.summary-regen:disabled{opacity:.45;cursor:wait}
.summary-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:2.1;color:var(--text-hi);max-width:64ch;margin:0}.summary-text-brief{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;color:var(--text-mid)}.expanded .summary-text{animation:summary-unfold .25s ease}.summary-expand{display:inline-flex;align-items:center;gap:30px;margin-top:17px;padding:5px 0;color:var(--accent);font-size:11px;font-weight:700}.summary-expand:hover{text-decoration:underline}.summary-expand span{font-size:16px}.summary-empty .summary-expand{margin-left:15px}
.summary-missing{display:flex;align-items:center;flex-wrap:wrap;gap:14px;padding:20px 26px;margin-bottom:12px;border:1px dashed #9cb5dc;background:#dae7fb}.summary-missing .summary-date{font-size:28px;color:var(--text-mid)}.missing-note{font-size:11px;color:var(--text-mid)}.missing-gen{margin-left:auto;padding:8px 18px;background:var(--night);color:var(--cyan);font-size:11px;font-weight:700;min-height:34px}.missing-gen:disabled{opacity:.5;cursor:wait}
.summary-loading{display:flex;align-items:center;gap:10px;padding:22px 0;font-size:12px;color:var(--text-mid)}.summary-empty{padding:20px 0;font-size:12px;color:var(--text-mid)}.summary-state{min-height:230px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:35px 6px;gap:12px}.summary-state h3{font-size:22px;line-height:1.5;font-weight:800;color:var(--text-hi)}.summary-state p{font-size:12px;max-width:48ch;overflow-wrap:anywhere}.state-mark{font:italic 700 40px/.8 var(--font-display);color:var(--accent)}.state-action{display:flex;align-items:center;gap:32px;padding:11px 17px;margin-top:9px;background:var(--accent);color:white;font-size:12px;font-weight:700;box-shadow:3px 3px 0 var(--cyan)}
.page-foot{display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 0 4px;font-size:11px;color:var(--text-low)}.load-more{padding:10px 22px;border:1px solid var(--line-strong);background:white;color:var(--accent);font-size:12px}.page-end{font-size:10px;color:var(--text-low)}
.glossary-section{padding:22px 0 8px;border-bottom:1px solid var(--line-strong)}.glossary-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.glossary-title{font-size:12px;font-weight:800}.glossary-count{padding:0 7px;background:var(--accent);color:white;font:italic 700 16px/1.4 var(--font-display)}
@keyframes summary-unfold{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media(min-width:900px){.sheet{top:50%;bottom:auto;transform:translate(-50%,-50%);height:88dvh;max-width:calc(100vw - 80px)}}
@media(max-width:599px){.sheet{height:95dvh;max-height:none}.sheet-header{padding:17px 20px 15px}.sheet-header>div{display:block}.summary-edition{font-size:29px}.sheet-header h2{font-size:12px;margin-top:6px;padding:0;border:0}.summary-cover{padding:22px 22px 24px;gap:12px}.cover-caption{font-size:10px}.summary-cover h3{font-size:23px}.cover-index{display:block;padding:0}.cover-index strong{font-size:58px}.cover-index span{display:block;font-size:9px;margin-top:7px}.cover-index small{display:none}.cover-watermark{display:none}.sheet-body{padding:0 16px 24px}.month-head{padding-top:18px}.summary-item{padding:20px 18px}.summary-meta{gap:10px;margin-bottom:15px}.summary-date{font-size:30px;gap:7px}.summary-generated{display:none}.summary-records{padding-left:10px}.summary-text{font-size:13px;line-height:2}.summary-missing{padding:18px 15px;gap:9px}.summary-missing .summary-date{font-size:25px}.missing-note{font-size:10px}.missing-gen{padding:7px 12px}.summary-state h3{font-size:20px}}
</style>
