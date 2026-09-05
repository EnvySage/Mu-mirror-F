<script setup>
/**
 * 每日总结 sheet（v2 原型样式，T-F-R7 + 三轮接线 + 词典候选分区 R10）
 * 数据源：GET /api/summaries
 *  - 不带 date：全部日报列表（新→旧，content 空、highlights 取前 3 行）
 *  - 带 date=YYYY-MM-DD：该日单篇（含全文 content）
 * 交互：列表展示日期 + 摘要行，点击展开拉全文；无日报 / 加载失败走兜底文案。
 * 词条候选分区（lexicon-design.md 5a）：总结正文之后独立分区「个人词典候选」，
 * 仅展示最近一天（候选注入当日报语料窗口，历史日报不重复挂）；无候选不渲染整个分区。
 * 「依据：查看原文」→ 关 sheet + 打开 source_chunk_id 对应记录详情（复用 openRecord 交互）。
 */
import { ref, watch } from 'vue'
import { useSummariesStore } from '@/stores/summaries'
import { useGlossaryStore } from '@/stores/glossary'
import { useUIStore } from '@/stores/ui'
import { useToastStore } from '@/stores/toast'
import TermCard from '@/components/molecules/TermCard.vue'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close'])

const summaries = useSummariesStore()
const glossary = useGlossaryStore()
const ui = useUIStore()
const toast = useToastStore()

/** 当前展开全文的日报日期（YYYY-MM-DD） */
const expandedDate = ref(null)

/** 正在操作（确认/保存）的词条 id，禁按钮防双击 */
const busyTermId = ref(null)

watch(() => props.show, (val) => {
  if (val) {
    expandedDate.value = null
    summaries.fetchList()
    // 词条候选：sheet 打开即拉（pending 组给候选分区，设置页共用同一 store）
    if (!glossary.pending.length) glossary.fetch()
  }
})

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
  else toast.error(glossary.error || '操作失败')
}

/** 依据 → 关 sheet 打开来源记录详情（复用 openRecord 交互） */
function openSource(term) {
  if (term.source_chunk_id == null) return
  ui.closeSummarySheet()
  ui.selectedRecordId = term.source_chunk_id
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
          <button class="sheet-close" @click="emit('close')">关闭</button>
        </div>
        <div class="sheet-body">
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

          <!-- 日报列表 -->
          <template v-if="summaries.list.length">
            <div
              v-for="item in summaries.list"
              :key="item.summary_date"
              class="summary-item"
            >
              <span class="summary-tag">系统记录 · source=system</span>
              <div class="summary-meta">
                <span>{{ item.summary_date }}</span>
                <span>记录 {{ item.stats?.record_count ?? '—' }} 条</span>
                <span>{{ genTime(item.created_at) }} 生成</span>
              </div>

              <!-- 已展开：全文 -->
              <template v-if="expandedDate === item.summary_date">
                <div v-if="summaries.detailLoading" class="summary-loading"><span class="spinner" /> 加载全文…</div>
                <p v-else-if="item.content" class="summary-text">{{ item.content }}</p>
                <p v-else class="summary-empty">全文加载失败</p>
              </template>

              <!-- 未展开：摘要行 + 展开按钮 -->
              <template v-else>
                <p class="summary-text summary-text-brief">
                  {{ (item.highlights && item.highlights.length ? item.highlights.join('\n') : '暂无摘要') }}
                </p>
                <button class="summary-expand" @click="toggleItem(item)">展开全文</button>
              </template>
            </div>
          </template>

          <!-- 空态：无候选且无日报 -->
          <div v-if="!summaries.loading && !summaries.error && !summaries.list.length && !glossary.pending.length" class="summary-empty">
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
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px 10px;
}
.sheet-title { font-family: var(--font-display); font-size: 16px; }
.sheet-close { font-size: 14.5px; color: var(--text-mid); padding: 6px 2px; cursor: pointer; }

.sheet-body {
  overflow-y: auto; padding: 6px 20px 22px;
  font-size: 14px; line-height: 1.85; color: var(--text-mid);
}
.summary-loading { display: flex; align-items: center; gap: 8px; color: var(--text-low); }
.summary-empty { color: var(--text-low); font-size: 13px; padding: 18px 0; text-align: center; }

.summary-item { padding: 4px 0 14px; margin-bottom: 8px; border-bottom: 1px dashed var(--line); }
.summary-item:last-child { border-bottom: none; margin-bottom: 0; }

.summary-tag {
  display: inline-flex; font-size: 11px; color: var(--accent);
  padding: 3px 10px; border-radius: var(--radius-full);
  background: var(--accent-soft); margin-bottom: 12px;
}
.summary-meta {
  font-family: var(--font-mono); font-size: 11px; color: var(--text-low);
  margin-bottom: 12px; display: flex; gap: 14px;
}
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
