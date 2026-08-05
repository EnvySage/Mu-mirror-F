<script setup>
import { moodMap, typeMap, MOOD_COLOR_MAP } from '@/constants/tags'

const props = defineProps({
  variant: { type: String, required: true }, // type | mood | keyword | processing
  value: { type: String, default: '' },
  mood: { type: String, default: '' }, // mood sub-type
})

const moodClass = props.mood ? (MOOD_COLOR_MAP[props.mood] || '') : ''
</script>

<template>
  <span v-if="variant === 'type'" class="tag tag-type">
    {{ typeMap[value] || value }}
  </span>
  <span v-else-if="variant === 'mood'" :class="['tag', 'tag-mood', moodClass]">
    {{ moodMap[mood] || mood }}
  </span>
  <span v-else-if="variant === 'keyword'" class="keyword">
    #{{ value }}
  </span>
  <span v-else-if="variant === 'processing'" class="tag tag-processing">
    AI 整理中
  </span>
</template>

<style scoped>
/* Styles from components.css — scoped for encapsulation */
.tag { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: var(--radius-full); font-size: 11px; font-weight: 500; }
.tag-type { background: var(--accent-light); color: var(--accent); }
.tag-mood { background: var(--success-light); color: var(--success); }
.tag-mood.anxious { background: var(--warning-light); color: var(--warning); }
.tag-mood.sad { background: var(--danger-light); color: var(--danger); }
.tag-mood.tired { background: #F3F0FF; color: #7C3AED; }
.tag-processing { background: var(--processing-light); color: var(--processing); animation: tagPulse 2s ease-in-out infinite; }
.keyword { font-size: 11px; color: var(--text-tertiary); background: var(--bg); padding: 2px 8px; border-radius: var(--radius-full); }

@keyframes tagPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
</style>
