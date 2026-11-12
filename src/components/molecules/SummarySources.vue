<script setup>
import { ref, watch } from 'vue'
import { getRecords } from '@/api/records'
import { useUIStore } from '@/stores/ui'

const props = defineProps({ date: { type: String, required: true }, sourceIds: { type: Array, default: null } })
const emit = defineEmits(['open-record'])
const ui = useUIStore()
const records = ref([]), error = ref(''), loading = ref(false), attempt = ref(0)
watch([() => props.date, () => props.sourceIds, attempt], async ([date, sourceIds], _, onCleanup) => {
  let current = true
  onCleanup(() => { current = false })
  error.value = ''; records.value = []
  if (!sourceIds?.length) { loading.value = false; return }
  loading.value = true
  try {
    const response = await getRecords({ startDate: date, endDate: date, size: 100 })
    const allowed = new Set(sourceIds.map(String))
    if (current) records.value = (response.data || []).filter(record => record.source !== 'system' && allowed.has(String(record.id)))
  } catch (cause) { if (current) error.value = cause.message || '原始记录暂时无法读取' }
  finally { if (current) loading.value = false }
}, { immediate: true })
function open(record) {
  ui.recordAchievement = { recordId: String(record.id), activities: [{ kind: 'summary.source_opened', subjectId: record.id, contextId: props.date }] }
  emit('open-record', record.id)
}
</script>

<template>
  <div class="summary-sources">
    <span v-if="loading" role="status">正在查找当天原文…</span>
    <span v-else-if="error" role="alert">{{ error }} <button type="button" @click="attempt++">重试</button></span>
    <template v-else-if="records.length"><span>当天原文</span><button v-for="record in records" :key="record.id" type="button" @click="open(record)">{{ (record.content || '查看记录').slice(0, 36) }} ↗</button></template>
  </div>
</template>

<style scoped>
.summary-sources{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0;font-size:12px;line-height:1.6}.summary-sources>span{color:var(--text-low);width:100%}.summary-sources button{max-width:100%;padding:7px 9px;text-align:left;overflow-wrap:anywhere;border:1px solid #6a91ae66;color:var(--accent);background:#7ca4c10c}.summary-sources button:focus-visible{outline:2px solid currentColor;outline-offset:2px}
</style>
