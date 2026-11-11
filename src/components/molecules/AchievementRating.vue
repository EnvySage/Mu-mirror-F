<script setup>
import { computed } from 'vue'
import { achievementDifficulties } from '@/constants/achievements'

const props = defineProps({ level: { type: Number, required: true }, label: Boolean })
const difficulty = computed(() => achievementDifficulties.find(item => item.level === props.level) || achievementDifficulties[0])
</script>

<template>
  <span class="achievement-rating" :style="{ '--rating-color': difficulty.color }" :aria-label="`${difficulty.level} 星难度，${difficulty.label}`" :title="difficulty.description">
    <span aria-hidden="true">{{ '★'.repeat(difficulty.level) }}</span><small v-if="label" aria-hidden="true">{{ difficulty.label }}</small>
  </span>
</template>

<style scoped>
.achievement-rating { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; color: var(--rating-color); }
.achievement-rating > span { font-size: 13px; letter-spacing: 1px; line-height: 1; }
.achievement-rating small { font-size: 11px; }
</style>
