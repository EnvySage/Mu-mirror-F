<script setup>
import { computed } from 'vue'
import { useRecordsStore } from '@/stores/records'
import ChunkCard from '@/components/organisms/ChunkCard.vue'

/**
 * 审核面板（v2 原型版）
 * 上：review-original「光源」面板（只读原文）
 * 下：chunk-card「镜面反射」卡片列表 + add-chunk-btn 虚线按钮 + review-hint 引导
 * chips 编辑即保存（PUT /chunks/{id}），编排逻辑在 ChunkCard/store 内。
 */
const props = defineProps({
  record: { type: Object, required: true },
})

const recordsStore = useRecordsStore()

const editable = computed(() => props.record.status === 'reviewing')
/** done 记录只读：控件禁用而非点击报错 */
const readonly = computed(() => props.record.status === 'done')
const chunks = computed(() => props.record.chunks || [])

/** 新增片段：本地空占位，用户输入文本失焦时 POST /records/{id}/chunks */
function onAddChunk() {
  const placeholder = {
    id: `local_${Date.now()}`,
    recordId: props.record.id,
    segment: '',
    metadata: {},
  }
  if (!props.record.chunks) props.record.chunks = []
  props.record.chunks.push(placeholder)
}
</script>

<template>
  <div class="review-panel">
    <!-- 原文面板 —— "光源" -->
    <div class="review-original">
      <div class="review-label">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        原始内容 · 不可修改
      </div>
      <div class="review-original-text">{{ record.content }}</div>
    </div>

    <!-- 片段卡片列表 -->
    <div class="review-list-label">
      <span>{{ readonly ? '片段卡片 · CHUNKS（已入库，只读）' : '片段卡片 · CHUNKS' }}</span>
      <span>{{ chunks.length }}</span>
    </div>

    <ChunkCard
      v-for="(chunk, i) in chunks"
      :key="chunk.id"
      :chunk="chunk"
      :index="i"
      :editable="editable"
      :readonly="readonly"
    />

    <div v-if="chunks.length === 0" class="chunks-empty">
      已无片段。新增至少 1 个片段后才能确认入库。
    </div>

    <template v-if="editable">
      <button class="add-chunk-btn" @click="onAddChunk">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        新增片段（AI 自动单段分类）
      </button>
      <div class="review-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5"/></svg>
        合并：把 A 的文本改成合并内容，再删掉 B。拆分：把 A 改成前半句，再点「新增片段」补后半。改动文本的片段会在确认时自动重新分类。
      </div>
    </template>
  </div>
</template>

<style scoped>
.review-panel { animation: fadeIn .3s ease; }

.review-original {
  position: relative; padding: 14px 16px; margin-bottom: 14px;
  border-radius: var(--radius);
  background: var(--accent-soft);
  border: 1px solid rgba(44,95,232,.18);
}
.review-label {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .16em;
  color: var(--accent); margin-bottom: 6px;
  display: flex; align-items: center; gap: 6px;
}
.review-label svg { width: 12px; height: 12px; stroke: var(--accent); fill: none; }
.review-original-text { font-size: 14px; line-height: 1.8; color: var(--text-hi); white-space: pre-wrap; word-break: break-word; }

.review-list-label {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .16em;
  color: var(--text-low); margin: 4px 2px 10px;
  display: flex; justify-content: space-between; align-items: center;
}

.chunks-empty {
  padding: 24px; text-align: center; font-size: 13px; color: var(--text-low);
  border: 1.5px dashed var(--line-strong); border-radius: var(--radius);
}

.add-chunk-btn {
  width: 100%; padding: 13px; margin-top: 4px;
  border-radius: var(--radius);
  border: 1.5px dashed var(--line-strong);
  color: var(--text-low); font-size: 13.5px;
  display: flex; align-items: center; justify-content: center; gap: 7px;
  transition: all .18s;
}
.add-chunk-btn:hover { color: var(--accent); border-color: var(--accent); }
.add-chunk-btn svg { width: 15px; height: 15px; stroke: currentColor; fill: none; }

.review-hint {
  display: flex; gap: 8px; align-items: flex-start;
  font-size: 12px; color: var(--text-low); line-height: 1.6;
  padding: 12px 14px; margin-top: 10px;
  border-radius: var(--radius-sm);
  background: var(--warn-bg);
  box-shadow: inset 0 0 0 1px rgba(201,138,27,.2);
}
.review-hint svg { width: 14px; height: 14px; stroke: var(--warn); fill: none; flex-shrink: 0; margin-top: 2px; }
</style>
