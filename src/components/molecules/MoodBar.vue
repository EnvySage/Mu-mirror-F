<script setup>
defineProps({
  segments: { type: Array, required: true },
})
</script>

<template>
  <div>
    <div class="mood-bar">
      <div
        v-for="seg in segments"
        :key="seg.key"
        class="mood-bar-seg"
        :style="{ width: seg.percentage + '%', background: seg.color }"
      />
    </div>
    <div class="mood-legend">
      <div v-for="seg in segments" :key="seg.key" class="mood-legend-item">
        <div class="mood-legend-dot" :style="{ background: seg.color }" />
        {{ seg.label }} {{ seg.percentage }}%
      </div>
    </div>
  </div>
</template>

<style scoped>
.mood-bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 10px; }
.mood-bar-seg { transition: width 0.6s ease; }
.mood-legend { display: flex; gap: 12px; flex-wrap: wrap; }
.mood-legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-secondary); }
.mood-legend-dot { width: 10px; height: 10px; border-radius: 50%; }

@media (min-width: 900px) {
  .mood-bar { height: 10px; border-radius: 5px; margin-bottom: 12px; }
  .mood-legend { gap: 16px; }
  .mood-legend-item { font-size: 13px; gap: 6px; }
}
</style>
