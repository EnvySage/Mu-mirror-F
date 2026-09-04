<script setup>
/**
 * 每日总结 sheet（v2 原型样式，T-F-R7 + 三轮接线）
 * 数据源：GET /api/summaries
 *  - 不带 date：全部日报列表（新→旧，content 空、highlights 取前 3 行）
 *  - 带 date=YYYY-MM-DD：该日单篇（含全文 content）
 * 交互：列表展示日期 + 摘要行，点击展开拉全文；无日报 / 加载失败走兜底文案。
 */
import { ref, watch } from 'vue'
import { useSummariesStore } from '@/stores/summaries'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close'])

const summaries = useSummariesStore()

/** 当前展开全文的日报日期（YYYY-MM-DD） */
const expandedDate = ref(null)

watch(() => props.show, (val) => {
  if (val) {
    expandedDate.value = null
    summaries.fetchList()
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

          <!-- 空态：还没有日报 -->
          <template v-else-if="!summaries.list.length">
            <div class="summary-empty">还没有每日总结 · AI 会在每天凌晨自动生成昨日的总结</div>
          </template>

          <!-- 日报列表 -->
          <template v-else>
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
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(5,7,15,.6);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  z-index: 44;
}

.sheet {
  position: fixed; left: 50%; bottom: 0; transform: translate(-50%, 0);
  width: 100%; max-width: 640px; max-height: 78dvh; z-index: 45;
  background: rgba(19,23,44,.95);
  backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -12px 48px rgba(0,0,0,.5), inset 0 1px 0 var(--line-strong);
  display: flex; flex-direction: column;
  padding-bottom: var(--safe-bottom);
}
@media (min-width: 900px) {
  .sheet { border-radius: 22px; bottom: 8dvh; }
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
  display: inline-flex; font-size: 11px; color: var(--cyan);
  padding: 3px 10px; border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px rgba(110,231,240,.25); margin-bottom: 12px;
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
  margin-top: 8px; font-size: 12.5px; color: var(--cyan); cursor: pointer;
  padding: 2px 0;
}
.summary-expand:hover { text-decoration: underline; }

.sheet-enter-active, .sheet-leave-active { transition: transform .32s cubic-bezier(.32,.72,.28,1); }
.sheet-enter-from, .sheet-leave-to { transform: translate(-50%, 110%) !important; }
</style>
