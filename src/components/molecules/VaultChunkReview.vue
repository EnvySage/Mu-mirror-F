<script setup>
import { ref, watch } from 'vue'
import request from '@/api/request'
import { reportAchievementActivity } from '@/api/achievements'
import { vReadEnd } from '@/composables/useReadingEnd'
const props = defineProps({ itemId: { type: [String, Number], required: true } })
const expanded = ref(false), chunks = ref([]), loading = ref(false), error = ref(''), reviewed = ref(false), attempt = ref(0)
let completion = null
watch([() => props.itemId, expanded, attempt], async ([id, open], _, onCleanup) => {
  let current = true
  onCleanup(() => { current = false })
  if (!open) return
  loading.value = true; error.value = ''; chunks.value = []
  try {
    const response = await request.get(`/vault/${id}/chunks`)
    if (current) chunks.value = response.data || []
  } catch (cause) { if (current) error.value = cause.message || '提取内容暂时无法读取' }
  finally { if (current) loading.value = false }
})
watch(() => props.itemId, () => { reviewed.value = false; completion = null })
function read() {
  completion = reportAchievementActivity('vault.reviewed', props.itemId)
  completion?.then(ok => { reviewed.value = !!ok })
}
defineExpose({ waitForReview: () => completion || Promise.resolve() })
</script>
<template>
  <div class="vault-chunk-review">
    <button type="button" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起提取内容 ↑' : '检查提取出的内容 ↗' }}</button>
    <div v-if="expanded" class="vault-chunk-scroll" tabindex="0" aria-label="提取出的文件片段">
      <p v-if="loading" role="status">正在读取片段…</p>
      <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="attempt++">重试</button></p>
      <article v-else-if="chunks.length" v-read-end="{ key: String(itemId), onRead: read }"><section v-for="(chunk,index) in chunks" :key="chunk.id"><small>片段 {{ index + 1 }} / {{ chunks.length }}</small><p>{{ chunk.segment }}</p></section></article>
      <p v-else>这份文件还没有可供检查的文字片段。</p>
    </div>
    <small v-if="reviewed" class="vault-review-done">已读完提取内容</small>
  </div>
</template>
<style scoped>
.vault-chunk-review{margin:14px 0;font-size:12px}.vault-chunk-review>button{padding:8px 0;color:var(--accent);border-bottom:1px solid currentColor}.vault-chunk-scroll{max-height:280px;overflow:auto;overscroll-behavior:contain;margin-top:12px;padding:12px;border:1px solid #6a91ae66;scrollbar-width:thin}.vault-chunk-scroll section+section{border-top:1px solid #6a91ae33;padding-top:12px;margin-top:12px}.vault-chunk-scroll small{color:var(--text-low)}.vault-chunk-scroll p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9}.vault-review-done{display:block;padding-top:8px;color:var(--success)}.vault-chunk-review :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
