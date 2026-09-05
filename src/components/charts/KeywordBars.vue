<script setup>
/**
 * KeywordBars —— 关键词 Top10 横向条形（纯 HTML/CSS 渲染，DOM 结构即条形图）
 *
 * 名称 + 条（墨蓝，宽 = count/max 占比）+ 数值；最长条满宽。
 * 条宽 CSS transition 0.4s。>10 项截断为 10（组件职责边界）。
 */
import { computed } from 'vue'
import ChartEmpty from './ChartEmpty.vue'

const props = defineProps({
  /** [{ keyword, count }]，已按 count 倒序 */
  data: { type: Array, default: () => [] },
})

const items = computed(() => {
  const top = props.data.slice(0, 10)
  const max = Math.max(0, ...top.map(d => d.count || 0))
  return top.map(d => ({
    ...d,
    pct: max ? Math.round((d.count / max) * 100) : 0,
  }))
})
</script>

<template>
  <ChartEmpty v-if="!data.length" />
  <div v-else class="kw-bars" role="img" aria-label="关键词 Top 10">
    <div v-for="it in items" :key="it.keyword" class="kw-row">
      <span class="kw-name" :title="it.keyword">{{ it.keyword }}</span>
      <span class="kw-track">
        <span class="kw-fill" :style="{ width: it.pct + '%' }" />
      </span>
      <span class="kw-count">{{ it.count }}</span>
    </div>
  </div>
</template>

<style scoped>
.kw-bars { display: flex; flex-direction: column; gap: 7px; }
.kw-row { display: flex; align-items: center; gap: 9px; }
.kw-name {
  flex: 0 0 31%; min-width: 0;
  font-size: 12px; color: var(--text-mid);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  text-align: right;
}
.kw-track { flex: 1; height: 8px; border-radius: 4px; background: var(--ink-2); overflow: hidden; }
.kw-fill {
  display: block; height: 100%; border-radius: 4px;
  background: var(--accent); opacity: .85;
  transition: width .4s ease;
}
.kw-row:hover .kw-fill { opacity: 1; }
.kw-count {
  flex: 0 0 26px; text-align: right;
  font-family: var(--font-mono); font-size: 11px; color: var(--text-low);
  font-variant-numeric: tabular-nums;
}
</style>
