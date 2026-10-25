<script setup>
import { computed, ref } from 'vue'
import ChatMarkdown from './ChatMarkdown.vue'
import DetailSheet from '@/components/organisms/DetailSheet.vue'
const props = defineProps({ content: { type: String, default: '' }, sources: { type: Array, default: () => [] }, vaultRefs: { type: Array, default: () => [] }, streaming: Boolean })
const emit = defineEmits(['open-source', 'open-vault'])
const open = ref(false)
const long = computed(() => !props.streaming && props.content.length > 900)
const excerpt = computed(() => props.content.slice(0, 360).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/(^|\n)#{1,6}\s/g, '$1').replace(/[*`_]/g, '').trim() + '…')
function forward(event, value) { open.value = false; emit(event, value) }
</script>
<template>
  <div class="message-content">
    <template v-if="long"><p class="message-excerpt">{{ excerpt }}</p><button type="button" class="message-expand" @click="open=true">展开完整回复 <span>{{ content.length.toLocaleString() }} 字符 ↗</span></button></template>
    <ChatMarkdown v-else :content="content" :sources="sources" :vault-refs="vaultRefs" @open-source="emit('open-source', $event)" @open-vault="emit('open-vault', $event)" />
    <DetailSheet :open="open" title="另一个我的回复" subtitle="Mirror / 对话" @close="open=false"><div class="message-reader"><ChatMarkdown :content="content" :sources="sources" :vault-refs="vaultRefs" @open-source="forward('open-source', $event)" @open-vault="forward('open-vault', $event)" /></div><template #footer><button type="button" class="message-expand" @click="open=false">返回对话</button></template></DetailSheet>
  </div>
</template>
<style scoped>
.message-content{min-width:0;white-space:normal;overflow-wrap:anywhere}.message-excerpt{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;margin:0;white-space:pre-wrap;font-size:14px;line-height:1.9}.message-expand{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;margin-top:13px;padding:11px 0 2px;border:0;border-top:1px solid #b9cdd4;background:transparent;color:#175394;font-size:12px;font-weight:700;cursor:pointer;text-align:left}.message-expand span{font-size:10px;font-weight:400;color:#526d7d}.message-expand:focus-visible{outline:3px solid #cc3772;outline-offset:4px}.message-reader{font-size:15px;line-height:1.9;overflow-wrap:anywhere}.message-reader :deep(.cite-chip),.message-reader :deep(.cite-file-chip){border:1px solid #b3cdd9;background:#e0edf3;color:#175394;padding:2px 6px;cursor:pointer;border-radius:3px}
</style>
