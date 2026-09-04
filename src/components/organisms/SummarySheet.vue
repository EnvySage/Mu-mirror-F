<script setup>
/**
 * 每日总结 sheet（v2 原型样式，T-F-R7）
 * 数据源：GET /api/summaries 未就绪 —— 展示 mock 占位，结构先行。
 */
import { ref, watch } from 'vue'
import { useUIStore } from '@/stores/ui'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close'])

const ui = useUIStore()

/** TODO: 接 GET /api/summaries（agent-B 未就绪，mock 顶着） */
const mockSummary = {
  tag: '系统记录 · source=system',
  date: '2026-09-02',
  count: '记录 4 条',
  time: '23:41 生成',
  body: '昨日接口尚未开放，这里展示的是占位数据。每日总结由 AI 在深夜自动生成：汇总当天记录、标注情绪走向与挂起事项。后端 GET /api/summaries 就绪后此面板将自动展示真实数据。',
}
const loading = ref(false)

watch(() => props.show, (val) => {
  if (val) loadSummary()
})

async function loadSummary() {
  loading.value = true
  // TODO: const res = await api.get('/summaries')
  setTimeout(() => { loading.value = false }, 300)
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
          <template v-if="loading">
            <div class="summary-loading"><span class="spinner" /> 加载中…</div>
          </template>
          <template v-else>
            <span class="summary-tag">{{ mockSummary.tag }}</span>
            <div class="summary-meta">
              <span>{{ mockSummary.date }}</span>
              <span>{{ mockSummary.count }}</span>
              <span>{{ mockSummary.time }}</span>
            </div>
            <p class="summary-text">{{ mockSummary.body }}</p>
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
  position: fixed; left: 50%; bottom: 0; transform: translate(-50%, 110%);
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
.sheet-close { font-size: 14.5px; color: var(--text-mid); padding: 6px 2px; }

.sheet-body {
  overflow-y: auto; padding: 6px 20px 22px;
  font-size: 14px; line-height: 1.85; color: var(--text-mid);
}
.summary-loading { display: flex; align-items: center; gap: 8px; color: var(--text-low); }
.summary-tag {
  display: inline-flex; font-size: 11px; color: var(--cyan);
  padding: 3px 10px; border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px rgba(110,231,240,.25); margin-bottom: 12px;
}
.summary-meta {
  font-family: var(--font-mono); font-size: 11px; color: var(--text-low);
  margin-bottom: 12px; display: flex; gap: 14px;
}
.summary-text { margin: 0; }

.sheet-enter-active, .sheet-leave-active { transition: transform .32s cubic-bezier(.32,.72,.28,1); }
.sheet-enter-from, .sheet-leave-to { transform: translate(-50%, 110%) !important; }
.sheet-enter-to, .sheet-leave-from { transform: translate(-50%, 0) !important; }
</style>
