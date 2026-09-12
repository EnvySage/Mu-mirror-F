<script setup>
/**
 * 图表空态：统一小字占位（不破布局），六图表共用
 * text 可选：具体图表可给更贴切的空态措辞（默认"暂无数据"）
 */
defineProps({
  text: { type: String, default: '暂无数据' },
})
</script>

<template>
  <div class="chart-empty">{{ text }}</div>
</template>

<style scoped>
.chart-empty {
  text-align: center;
  font-size: 12px;
  color: var(--text-low);
  padding: 22px 0;
}
</style>
