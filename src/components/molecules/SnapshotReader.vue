<script setup>
import { ref } from 'vue'
import { reportAchievementActivity } from '@/api/achievements'
import { vReadEnd } from '@/composables/useReadingEnd'
const props = defineProps({ profile: { type: Object, required: true }, source: { type: String, default: 'current' } })
const expanded = ref(false)
const fields = [['overall_summary', '总体画像'], ['mood_analysis', '情绪分析'], ['learning_analysis', '学习进展'], ['todo_analysis', '行动线索'], ['rhythm_analysis', '生活节奏']]
function read() { reportAchievementActivity('snapshot.opened', props.profile.id, null, props.source) }
</script>
<template>
  <div class="snapshot-reader">
    <button type="button" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起完整画像 ↑' : '阅读完整画像 ↗' }}</button>
    <div v-if="expanded" :key="profile.id" class="snapshot-reader-scroll" tabindex="0" aria-label="完整画像">
      <article v-read-end="{ key: `${profile.id}:${source}`, onRead: read }"><section v-for="[field,label] in fields" :key="field"><h3>{{ label }}</h3><p>{{ profile[field] || '暂无分析' }}</p></section><section v-if="profile.user_tags?.length"><h3>个人标签</h3><p>{{ profile.user_tags.join(' · ') }}</p></section></article>
    </div>
  </div>
</template>
<style scoped>
.snapshot-reader>button{padding:10px 0;color:var(--accent);font-size:13px;border-bottom:1px solid currentColor}.snapshot-reader-scroll{max-height:440px;overflow:auto;margin-top:16px;padding:0 12px 0 0;overscroll-behavior:contain;scrollbar-width:thin}.snapshot-reader section+section{margin-top:20px}.snapshot-reader h3{font-size:13px;color:var(--text-low);margin-bottom:7px}.snapshot-reader p{font-size:14px;white-space:pre-wrap;line-height:1.9;overflow-wrap:anywhere}.snapshot-reader :focus-visible{outline:2px solid var(--accent);outline-offset:3px}
</style>
