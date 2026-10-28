<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useActionsStore } from '@/stores/actions'
import { useRecordsStore } from '@/stores/records'
import { useToastStore } from '@/stores/toast'
import RecordActionForm from './action-forms/RecordActionForm.vue'
import { recordDraftOf, recordWorkflowState, recordIdOf } from '@/utils/recordWorkflow'
import { useDialogFocus } from '@/composables/useDialogFocus'
const ui = useUIStore(), actions = useActionsStore(), records = useRecordsStore(), toast = useToastStore(), router = useRouter()
const root = ref(null), form = ref(null), dirty = ref(false), saving = ref(false), error = ref('')
const card = computed(() => actions.byId[ui.selectedRecordActionId])
const state = computed(() => recordWorkflowState(card.value, actions.submittingRecords[card.value?.id], actions.recordErrors[card.value?.id]))
const title = computed(() => recordDraftOf(card.value).segments?.find(s => s.title)?.title || '把这一刻，改成你的版本。')
const editable = computed(() => card.value && actions.canEdit(card.value) && !actions.submittingRecords[card.value.id])
useDialogFocus(() => !!ui.selectedRecordActionId, root, '.review-workspace-back', close)
watch(() => ui.selectedRecordActionId, async id => {
  dirty.value = false; error.value = ''
  if (!id) return
  try { await actions.refresh(id) } catch (e) { error.value = e.message }
})
function close() {
  if (saving.value) return
  if (dirty.value && !window.confirm('修改还没有保存。放弃修改并返回？')) return
  ui.selectedRecordActionId = null
}
async function submit(payload) {
  if (saving.value || !editable.value) return
  saving.value = true; error.value = ''
  const id = card.value.id
  const saveOnly = payload.recordDraft?.mode === 'ONLY_SAVE'
  try {
    await actions.edit(id, payload)
    dirty.value = false
    actions.submitRecord(id)
    ui.selectedRecordActionId = null
    await router.push({ name: 'records' })
    toast.info(saveOnly ? '已提交，仅保存这条记录' : '已提交，正在后台加入记忆')
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}
async function discard() {
  if (!card.value || saving.value || !window.confirm('放弃这次整理？这份候选不会保存为新记录。')) return
  saving.value = true
  try { await actions.cancel(card.value.id); dirty.value = false; ui.selectedRecordActionId = null }
  catch (e) { error.value = e.message }
  finally { saving.value = false }
}
async function retry() {
  saving.value = true; error.value = ''
  try {
    const payload = { ...card.value.payload }; delete payload.recordDraft
    const next = await actions.prepare(card.value.kind, payload, crypto.randomUUID())
    if (card.value.state === 'PENDING') await actions.cancel(card.value.id)
    ui.selectedRecordActionId = next.id
  } catch (e) { error.value = e.message } finally { saving.value = false }
}
async function openSaved() {
  const id = recordIdOf(card.value)
  if (id == null) return
  await records.fetchRecord(id)
  ui.selectedRecordActionId = null; ui.selectedRecordId = id; ui.showDetail = true
}
</script>
<template>
  <Teleport to="body"><Transition name="review-workspace"><section v-if="ui.selectedRecordActionId" ref="root" class="review-workspace" role="dialog" aria-modal="true" aria-labelledby="record-review-heading" tabindex="-1">
    <header class="review-workspace-toolbar"><button class="review-workspace-back" :disabled="saving" @click="close">〈 返回列表</button><span>记录整理台</span><span class="workspace-step">{{ editable ? '02 / YOUR TURN' : '01 / IN MOTION' }}</span><button v-if="editable" class="workspace-submit" :disabled="saving" @click="form?.submit()">{{ saving ? '正在保存修改…' : recordDraftOf(card).mode === 'ONLY_SAVE' ? '确认，仅保存' : '确认保存，加入记忆' }} <b>↗</b></button></header>
    <div class="review-workspace-scroll"><div class="review-workspace-body">
      <header class="workspace-hero"><div><span class="workspace-sticker">{{ editable ? 'YOUR WORDS. YOUR CALL.' : 'GO LIVE YOUR DAY.' }}</span><h1 id="record-review-heading">{{ editable ? 'AI 理好线索，' : '这一刻，' }}<br><em>{{ editable ? '最后一笔归你。' : '正在显影。' }}</em></h1><p>{{ editable ? '读一遍，改一改。每个字、每个分类，都由你决定。' : '你可以先去做别的，进度会留在记录列表里。' }}</p></div><span class="workspace-mark" aria-hidden="true">{{ editable ? 'EDIT' : 'WAIT' }}<i>✦</i></span></header>
      <div v-if="error" class="workspace-error" role="alert">{{ error }}<button v-if="!card" @click="actions.refresh(ui.selectedRecordActionId).catch(e => error=e.message)">重试加载</button></div>
      <template v-if="card"><p class="workspace-state" role="status"><b>{{ state.label }}</b>{{ editable ? '尚未保存。确认后才创建记录，并在后台加入记忆。' : state.hint }}</p>
      <h2 class="workspace-title">{{ title }}</h2>
      <fieldset v-if="editable" :disabled="saving" class="workspace-fields"><RecordActionForm ref="form" :proposal="card" expanded hide-actions @dirty="dirty=true" @save="submit" @cancel="close" /></fieldset>
      <section v-else class="workspace-progress"><span class="workspace-kinetic" :class="{ settled: !state.moving }" aria-hidden="true"><i/><i/><i/></span><h2>{{ state.label }}</h2><p>{{ state.hint }}</p><pre>{{ recordDraftOf(card).rawContent }}</pre><button v-if="card.state === 'SUCCEEDED'" class="workspace-submit" @click="openSaved">打开已保存记录 ↗</button><button v-else-if="state.key === 'failed'" class="workspace-submit" :disabled="saving" @click="retry">重新整理 ↗</button><button v-else @click="close">先返回，继续今天</button></section>
      <footer v-if="card.state === 'PENDING'" class="workspace-foot"><span>原始输入始终保留为来源。</span><button :disabled="saving" @click="discard">放弃这次整理</button></footer>
      </template><p v-else-if="!error" role="status">正在找回你的记录…</p>
    </div></div>
  </section></Transition></Teleport>
</template>
<style scoped src="@/assets/styles/record-workspace.css"></style>
