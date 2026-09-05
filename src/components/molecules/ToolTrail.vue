<script setup>
/**
 * 工具轨迹芯片（任务 5 · 设计稿 4.5 E6）
 *
 * 气泡上方小型 mono 芯片行：`查了 9 月记录 · 12 条`（sources 同款风格更轻）。
 * 数据源：SSE meta.tools_used（chat store 归一化为 [{ id, tool, summary }]）。
 * 无数据不渲染整个分区（无工具轨迹 = PlanTools 跳过/失败的降级常态，不造假）。
 */
defineProps({
  /** [{ id, tool, summary }] */
  tools: { type: Array, default: () => [] },
})
</script>

<template>
  <div v-if="tools && tools.length" class="tool-trail" aria-label="本轮使用的检索工具">
    <template v-for="(t, i) in tools" :key="t.id || i">
      <span v-if="i > 0" class="tool-trail-sep">·</span>
      <span class="tool-trail-chip">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        {{ t.summary ? `${t.tool} ${t.summary}` : t.tool }}
      </span>
    </template>
  </div>
</template>

<style scoped>
.tool-trail {
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
  margin-bottom: 5px;
  font-family: var(--font-mono); font-size: 10px; letter-spacing: .06em;
  color: var(--text-low);
}
.tool-trail-sep { opacity: .6; }
.tool-trail-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: var(--radius-full);
  background: var(--ink-2);
}
.tool-trail-chip svg { width: 10px; height: 10px; opacity: .8; }
</style>
