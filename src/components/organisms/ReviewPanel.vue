<script setup>
import { computed } from 'vue'
import ChunkCard from '@/components/organisms/ChunkCard.vue'
import MButton from '@/components/atoms/MButton.vue'

/**
 * 审核面板（8.3 片段卡片交互 → 端点映射的编排层）
 *
 * 职责：渲染片段卡片列表、引导合并/拆分/新增片段的多步端点序列，
 * 所有点击只 emit 给父级（DetailPanel）执行真正的 API 编排。
 */
const props = defineProps({
  record: { type: Object, required: true },
  /** 各 chunk 是否有待保存修改：{ [chunkId]: true } */
  dirtyMap: { type: Object, default: () => ({}) },
  submitting: { type: Boolean, default: false },
  /** 确认中的长时 loading 文案 */
  confirming: { type: Boolean, default: false },
  /** 最后一次操作产生的提示（来自父级） */
  notice: { type: String, default: '' },
})

const emit = defineEmits([
  'save-chunk',
  'remove-chunk',
  'add-chunk',
  'merge-chunks',
  'split-chunk',
  'confirm',
  'discard',
])

const chunks = computed(() => props.record.chunks || [])
const canConfirm = computed(() => chunks.value.length > 0)
</script>

<template>
  <div class="review-panel">
    <!-- 原始内容（只读，不可改） -->
    <div class="review-original">
      <div class="section-label">原始内容</div>
      <div class="review-original-text">{{ record.content }}</div>
      <div class="review-original-hint">片段间不要求拼回原文，原文始终作为完整备份保存</div>
    </div>

    <!-- 片段卡片列表 -->
    <div class="chunks-list">
      <div class="section-label">片段（{{ chunks.length }}）</div>
      <ChunkCard
        v-for="(chunk, i) in chunks"
        :key="chunk.id"
        :chunk="chunk"
        :index="i"
        :total="chunks.length"
        :submitting="submitting"
        :dirty="!!dirtyMap[chunk.id]"
        @save="emit('save-chunk', $event)"
        @remove="emit('remove-chunk', $event)"
        @merge-up="emit('merge-chunks', { ...$event, targetIndex: i - 1 })"
        @split-request="emit('split-chunk', { ...$event, index: i })"
      />
      <div v-if="chunks.length === 0" class="chunks-empty">
        已无片段。新增至少 1 个片段后才能确认。
      </div>
    </div>

    <button class="add-chunk-btn" :disabled="submitting" @click="emit('add-chunk')">
      + 新增片段
    </button>

    <div v-if="notice" class="review-notice">{{ notice }}</div>

    <!-- 底部操作 -->
    <div class="review-actions">
      <MButton
        variant="primary"
        :disabled="!canConfirm || submitting"
        :loading="confirming"
        @click="emit('confirm')"
      >
        {{ confirming ? '确认中…（补分类 + 向量化，约需数秒）' : '✓ 确认' }}
      </MButton>
      <MButton variant="secondary" :disabled="submitting" @click="emit('discard')">丢弃这条记录</MButton>
    </div>
  </div>
</template>

<style scoped>
.review-panel { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.review-original {
  background: var(--surface); border-radius: var(--radius-md);
  padding: 18px; margin-bottom: 20px; border: 0.5px solid var(--border);
}
.review-original-text { font-size: 14px; color: var(--text-primary); line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.review-original-hint { margin-top: 8px; font-size: 11px; color: var(--text-tertiary); }

.chunks-list { margin-bottom: 12px; }
.chunks-list > .section-label { margin-bottom: 10px; }
.chunks-empty {
  padding: 24px; text-align: center; font-size: 13px; color: var(--text-tertiary);
  border: 1.5px dashed var(--border); border-radius: var(--radius-md);
}

.add-chunk-btn {
  width: 100%; padding: 12px; border-radius: var(--radius-md);
  border: 1.5px dashed var(--border); background: transparent;
  color: var(--text-secondary); font-size: 14px; cursor: pointer;
  transition: all 0.15s; font-family: var(--font); margin-bottom: 16px;
}
.add-chunk-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.add-chunk-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.review-notice {
  padding: 10px 14px; margin-bottom: 12px; border-radius: var(--radius-sm);
  background: var(--accent-light); color: var(--accent); font-size: 13px;
}

.review-actions { display: flex; flex-direction: column; gap: 0; margin-top: 8px; }

.section-label {
  font-size: 11px; font-weight: 600; color: var(--text-tertiary);
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;
}
</style>
