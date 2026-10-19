<script setup>
import { computed, onMounted, ref } from 'vue'
import { listChatMemories, getChatMemory } from '@/api/chatMemories'
import { memoryActionPayload } from '@/utils/chatMemoryActions'
import { useActionsStore } from '@/stores/actions'
import { createPrepareKey } from '@/api/actions'
import ActionCard from './ActionCard.vue'

const emit = defineEmits(['close'])
const actions = useActionsStore()
const memories = ref([])
const selected = ref(null)
const detail = ref(null)
const draft = ref({ content: '', kind: 'fact', eventDate: '', expiresAt: '' })
const cards = ref([])
const loading = ref(false)
const error = ref('')
const detailId = computed(() => selected.value?.id ?? selected.value?.memory_id)
const sourceMessageIds = computed(() => detail.value?.source_message_ids || detail.value?.sourceMessageIds || [])

function unwrap(response) { return response?.data?.data ?? response?.data ?? response }
async function load() {
  loading.value = true; error.value = ''
  try {
    const data = unwrap(await listChatMemories())
    memories.value = Array.isArray(data) ? data : (data?.items || data?.records || [])
  } catch (e) { error.value = e?.message || '记忆列表暂时无法加载' }
  finally { loading.value = false }
}
async function select(memory) {
  selected.value = memory; detail.value = null; cards.value = []; error.value = ''
  try {
    detail.value = unwrap(await getChatMemory(memory.id ?? memory.memory_id))
    draft.value = {
      content: detail.value?.content || '',
      kind: detail.value?.kind || 'fact',
      eventDate: String(detail.value?.event_date || detail.value?.eventDate || '').slice(0, 10),
      expiresAt: String(detail.value?.expires_at || detail.value?.expiresAt || '').slice(0, 10),
    }
  }
  catch (e) { error.value = e?.message || '记忆详情暂时无法加载' }
}
async function prepare(kind) {
  if (!detail.value) return
  error.value = ''
  try {
    const memoryId = detail.value.id ?? detail.value.memory_id
    const version = detail.value.version ?? detail.value.memory_version
    const payload = kind === 'memory.edit'
      ? { memoryId, expectedVersion: version, content: draft.value.content.trim(), kind: draft.value.kind, eventDate: draft.value.eventDate || null, expiresAt: draft.value.expiresAt || null }
      : { memoryId, expectedVersion: version }
    const sourceSessionId = detail.value.source_session_id || detail.value.sourceSessionId
    const sourceMessageId = detail.value.source_message_id || detail.value.sourceMessageId || sourceMessageIds.value[0]
    if (sourceSessionId) payload.sourceSessionId = sourceSessionId
    if (sourceMessageId) payload.sourceMessageId = sourceMessageId
    const card = await actions.prepare(kind, memoryActionPayload(kind, payload), createPrepareKey())
    cards.value = [...cards.value.filter(item => item.id !== card.id), card]
  } catch (e) { error.value = e?.message || '暂时无法准备记忆操作卡' }
}
onMounted(load)
</script>

<template>
  <section class="memory-panel" role="dialog" aria-modal="true" aria-label="聊天记忆管理">
    <header><div><strong>聊天记忆</strong><p>修改或遗忘都先准备操作卡，确认后才会生效。</p></div><button type="button" @click="emit('close')">关闭</button></header>
    <p v-if="error" role="alert" class="memory-error">{{ error }}</p>
    <div class="memory-columns">
      <nav aria-label="记忆列表"><p v-if="loading">加载中…</p><p v-else-if="!memories.length">还没有已生效的聊天记忆。</p>
        <button v-for="memory in memories" :key="memory.id || memory.memory_id" type="button" @click="select(memory)">
          {{ memory.content || '（无内容）' }}<small>{{ memory.kind || '记忆' }} · {{ memory.source_date || '日期未知' }}</small>
        </button>
      </nav>
      <article v-if="detail">
        <h3>来源</h3><p>{{ detail.source_date || detail.sourceDate || '日期未知' }} · {{ detail.kind || '记忆' }}</p>
        <p v-if="sourceMessageIds.length">来源消息：{{ sourceMessageIds.join('、') }}</p>
        <label>记忆内容<textarea v-model="draft.content" maxlength="2000" /></label>
        <label>类型<select v-model="draft.kind"><option value="fact">事实</option><option value="preference">偏好</option><option value="plan">计划</option><option value="event">事件</option></select></label>
        <label>事实日期（不确定可留空）<input v-model="draft.eventDate" type="date"></label>
        <label>有效至（可留空）<input v-model="draft.expiresAt" type="date"></label>
        <div class="memory-actions"><button type="button" :disabled="!draft.content.trim()" @click="prepare('memory.edit')">准备修改卡</button><button type="button" class="forget" @click="prepare('memory.forget')">准备遗忘卡</button></div>
        <ActionCard v-for="card in cards" :key="card.id" :proposal="card" :hide-edit="true" @updated="load" />
      </article>
      <p v-else class="memory-placeholder">选择一条记忆查看来源和可用操作。</p>
    </div>
  </section>
</template>

<style scoped>
.memory-panel{position:fixed;z-index:80;inset:8vh max(16px,calc((100vw - 940px)/2));overflow:auto;background:#fff;color:#18213a;border:1px solid #7186c966;border-radius:14px;padding:20px;box-shadow:0 18px 60px #101a3850}.memory-panel header{display:flex;justify-content:space-between;align-items:start}.memory-panel header p,.memory-placeholder{color:#68738c;font-size:13px}.memory-columns{display:grid;grid-template-columns:minmax(190px, .8fr) 1.2fr;gap:20px;margin-top:16px}.memory-columns nav{display:flex;flex-direction:column;gap:8px}.memory-columns nav button{text-align:left;padding:10px;border:1px solid #ccd3e2;border-radius:8px;background:#fff}.memory-columns small{display:block;color:#68738c;margin-top:5px}.memory-columns article{border-left:1px solid #e0e4ee;padding-left:18px}.memory-columns textarea{display:block;width:100%;min-height:100px;margin-top:6px;padding:10px}.memory-actions{display:flex;gap:8px;margin:12px 0}.memory-actions button,.memory-panel header button{padding:8px 12px}.memory-actions .forget{color:#a33333}.memory-error{color:#a33333}@media(max-width:650px){.memory-columns{grid-template-columns:1fr}.memory-columns article{border:0;padding:0}}
</style>
