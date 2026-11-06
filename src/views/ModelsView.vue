<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageMasthead from '@/components/molecules/PageMasthead.vue'
import EmbeddingSettings from '@/components/organisms/EmbeddingSettings.vue'
import { useModelProfilesStore } from '@/stores/modelProfiles'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { useUIStore } from '@/stores/ui'
import { testModelDraft } from '@/api/modelProfiles'
import { MODEL_PROVIDERS, modelProvider, profileDraft, profilePayload, validateProfile, draftSignature } from '@/utils/modelProfiles'
import { IS_DEMO_PREVIEW } from '@/preview/mode'

const route = useRoute()
const router = useRouter()
const profiles = useModelProfilesStore()
const settings = useSettingsStore()
const toast = useToastStore()
const ui = useUIStore()
const tab = computed(() => route.query.tab === 'embedding' ? 'embedding' : 'chat')
const selectedId = ref(null)
const detailOpen = ref(false)
const draft = ref(profileDraft())
const original = ref(draftSignature(draft.value))
const busy = ref('')
const result = ref(null)
const embeddingEditor = ref(null)
const selected = computed(() => profiles.profiles.find(profile => profile.id === selectedId.value) || null)
const provider = computed(() => modelProvider(draft.value.aiProvider))
const dirty = computed(() => draftSignature(draft.value) !== original.value)
const appliedModel = computed(() => settings.settings.ai_model || '尚未启用模型')
function allowLeave() {
  return !(dirty.value && detailOpen.value || embeddingEditor.value?.isDirty()) || window.confirm('有未保存的修改，确定离开吗？')
}
const removeGuard = ui.registerNavigationGuard('models', allowLeave)
function beforeUnload(event) { if (dirty.value && detailOpen.value || embeddingEditor.value?.isDirty()) { event.preventDefault(); event.returnValue = '' } }
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  await Promise.all([profiles.fetchProfiles(), settings.fetchSettings()])
})
onBeforeUnmount(() => { removeGuard(); window.removeEventListener('beforeunload', beforeUnload); draft.value.aiApiKey = '' })
watch(() => draftSignature(draft.value), () => { if (result.value?.source === 'draft') result.value = null })
function openProfile(profile = null) {
  if (detailOpen.value && !allowLeave()) return
  selectedId.value = profile?.id || null
  draft.value = profileDraft(profile)
  original.value = draftSignature(draft.value)
  result.value = null
  detailOpen.value = true
}
function closeDetail() {
  if (!allowLeave()) return
  detailOpen.value = false
  draft.value = profileDraft(selected.value)
  original.value = draftSignature(draft.value)
  result.value = null
}
function pickProvider(event) {
  const next = modelProvider(event.target.value)
  draft.value.aiProvider = next.id
  draft.value.aiProtocol = next.protocol
  draft.value.aiBaseUrl = next.baseUrl
  draft.value.aiModel = ''
  draft.value.aiApiKey = ''
}
async function save() {
  const error = validateProfile(draft.value, selected.value)
  if (error) return toast.warning(error)
  busy.value = 'save'
  try {
    const saved = await profiles.saveProfile(selectedId.value, profilePayload(draft.value))
    selectedId.value = saved.id
    draft.value = profileDraft(saved)
    original.value = draftSignature(draft.value)
    result.value = null
    toast.success('配置已保存；点击「应用此配置」后开始使用')
  } catch (err) { toast.error(err.message || '保存失败') }
  finally { busy.value = '' }
}
async function test(source) {
  const target = source === 'saved' ? profileDraft(selected.value) : { ...draft.value }
  const error = validateProfile(target, selected.value, { test: true })
  if (error) return toast.warning(error)
  busy.value = source === 'saved' ? 'test-saved' : 'test-draft'
  result.value = null
  try {
    const response = await testModelDraft({ ...profilePayload(target), ...(selectedId.value ? { profileId: selectedId.value } : {}) })
    result.value = { source, success: true, message: IS_DEMO_PREVIEW ? '演示环境仅模拟测试，未连接真实 AI 服务。' : response.data || '连接测试成功' }
  } catch (err) { result.value = { source, success: false, message: err.message || '连接测试失败，请检查地址、模型 ID 与密钥。' } }
  finally { busy.value = '' }
}
async function activate() {
  if (!selected.value || dirty.value) return
  busy.value = 'activate'
  try { await profiles.activate(selectedId.value); await settings.fetchSettings(); toast.success('已应用此配置，后续 AI 请求使用此模型') }
  catch (err) { toast.error(err.message || '应用失败') }
  finally { busy.value = '' }
}
async function remove() {
  if (!selected.value || selected.value.active || !window.confirm(`删除「${selected.value.name}」？`)) return
  busy.value = 'delete'
  try { await profiles.remove(selectedId.value); detailOpen.value = false; draft.value = profileDraft(); original.value = draftSignature(draft.value); toast.success('已删除配置') }
  catch (err) { toast.error(err.message || '删除失败') }
  finally { busy.value = '' }
}
function changeTab(value) {
  if (value === tab.value) return
  if (!allowLeave()) return
  draft.value = profileDraft(selected.value)
  original.value = draftSignature(draft.value)
  result.value = null
  ui.approveNavigation(router.resolve({ name: 'models', query: value === 'embedding' ? { tab: value } : {} }).fullPath)
  router.replace({ name: 'models', query: value === 'embedding' ? { tab: value } : {} })
}
</script>

<template>
  <div class="page models-page" :class="{ 'editing-model': detailOpen && tab === 'chat' }">
    <div class="page-content">
      <PageMasthead title="模型中心" english="MODELS" description="为镜子选择理解与回应你的模型" />
      <div class="model-heading"><div><span class="model-heading-word" aria-hidden="true">CONNECT!</span><h1>选择你的<br>对话搭档。</h1></div><div class="applied-model"><span>当前生效</span><strong>{{ appliedModel }}</strong><small>{{ settings.settings.ai_base_url || '添加配置，开始连接' }}</small></div></div>
      <nav class="model-tabs" aria-label="模型类型"><button :aria-current="tab === 'chat' ? 'page' : undefined" @click="changeTab('chat')">对话模型</button><button :aria-current="tab === 'embedding' ? 'page' : undefined" @click="changeTab('embedding')">记忆检索</button></nav>
      <EmbeddingSettings v-if="tab === 'embedding'" ref="embeddingEditor" />
      <div v-else class="model-workspace" :class="{ 'detail-open': detailOpen }">
        <section class="model-list" aria-labelledby="profile-list-title">
          <header><div><h2 id="profile-list-title">我的配置</h2><span>{{ profiles.profiles.length }} 份配置</span></div><button class="new-profile" :disabled="!!busy" @click="openProfile()"><span aria-hidden="true">＋</span> 新建配置</button></header>
          <div v-if="profiles.error" class="model-error" role="alert">{{ profiles.error }}<button @click="profiles.fetchProfiles()">重试</button></div>
          <p v-else-if="profiles.loading && !profiles.profiles.length" class="list-empty" role="status">正在加载配置…</p>
          <div v-else-if="!profiles.profiles.length" class="list-empty"><span aria-hidden="true">＋</span><h3>连接第一个模型</h3><p>选择服务商，填入自己的模型与密钥。你可以保存多份配置，随时切换。</p><button @click="openProfile()">添加模型配置</button></div>
          <button v-for="profile in profiles.profiles" :key="profile.id" class="profile-row" :class="{ selected: detailOpen && selectedId === profile.id }" :aria-pressed="detailOpen && selectedId === profile.id" :disabled="!!busy" @click="openProfile(profile)"><span class="provider-mark" aria-hidden="true">{{ modelProvider(profile.ai_provider).mark }}</span><span class="profile-copy"><b>{{ profile.name }}</b><span>{{ modelProvider(profile.ai_provider).name }} / {{ profile.ai_model }}</span><small v-if="profile.api_key_needs_reentry" class="key-warning">请重新输入密钥</small></span><span v-if="profile.active" class="profile-status" :class="{ pending: profile.unapplied_changes }">{{ profile.unapplied_changes ? '修改待应用' : '正在使用' }}</span><span v-else class="row-arrow" aria-hidden="true">↗</span></button>
          <p class="list-footnote">保存配置后需单独应用。切换只影响后续 AI 请求。</p>
        </section>
        <section v-if="detailOpen" class="model-detail" aria-labelledby="profile-editor-title">
          <header class="detail-header"><button class="back-to-list" :disabled="!!busy" @click="closeDetail">← 返回列表</button><span>{{ dirty ? '有未保存修改' : selected ? '已保存' : '新配置' }}</span></header>
          <h2 id="profile-editor-title">{{ selected ? selected.name : '添加模型配置' }}</h2>
          <p class="editor-description">填写你已开通的服务。测试、保存与应用各自独立。</p>
          <form @submit.prevent="save">
            <fieldset :disabled="!!busy">
              <label>配置名称<input v-model="draft.name" maxlength="100" placeholder="例如：日常对话" autocomplete="off"></label>
              <label>服务商<select aria-label="服务商" :value="draft.aiProvider" @change="pickProvider"><option v-if="!MODEL_PROVIDERS.some(item => item.id === draft.aiProvider)" :value="draft.aiProvider">原有服务（自定义）</option><option v-for="item in MODEL_PROVIDERS" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
              <p class="provider-note">{{ provider.note }} <a v-if="provider.docs" :href="provider.docs" target="_blank" rel="noopener noreferrer">官方接入文档 ↗</a></p>
              <label>模型 ID<input v-model="draft.aiModel" placeholder="复制服务商控制台中的模型 ID" autocomplete="off" spellcheck="false"></label>
              <label>API Key <small v-if="selected?.api_key_needs_reentry" class="key-warning">原密钥无法解密，请重新输入</small><small v-else-if="selected?.has_api_key">●●●●●●●● 已保存；留空保留原密钥</small><input v-model="draft.aiApiKey" type="password" :placeholder="selected?.has_api_key ? '输入新密钥以替换，或留空保留' : '输入此服务的 API Key'" autocomplete="new-password" spellcheck="false"></label>
              <details class="advanced-model" :open="draft.aiProvider === 'custom'"><summary>高级设置 <span>{{ draft.aiProtocol === 'anthropic' ? 'Anthropic' : 'OpenAI 兼容' }}</span></summary><div class="advanced-fields"><div class="protocol-field"><span id="protocol-label">接口协议</span><div role="group" aria-labelledby="protocol-label"><button type="button" :aria-pressed="draft.aiProtocol === 'openai'" @click="draft.aiProtocol = 'openai'">OpenAI 兼容</button><button type="button" :aria-pressed="draft.aiProtocol === 'anthropic'" @click="draft.aiProtocol = 'anthropic'">Anthropic</button></div></div><label>基础地址<input v-model="draft.aiBaseUrl" type="url" placeholder="填写服务商提供的基础地址" autocomplete="off" spellcheck="false"><small>不用附加 /chat/completions 或 /messages。</small></label></div></details>
              <div class="draft-actions"><button type="button" class="test-model" @click="test('draft')">{{ busy === 'test-draft' ? '测试中…' : '测试当前填写' }}</button><button type="submit" class="save-model">{{ busy === 'save' ? '保存中…' : '保存配置' }}</button></div>
            </fieldset>
          </form>
          <p class="test-explanation">测试会发送固定内容并可能产生少量调用费用，不读取历史记录。测试成功不会自动保存或应用。</p>
          <div v-if="result" class="connection-result" :class="{ failed: !result.success }" role="status"><b>{{ result.source === 'draft' ? '当前填写' : '已保存配置' }} · {{ IS_DEMO_PREVIEW ? '模拟结果' : result.success ? '测试成功' : '测试失败' }}</b><p>{{ result.message }}</p></div>
          <footer v-if="selected" class="saved-actions"><div><b>{{ selected.active ? selected.unapplied_changes ? '这份配置已修改，尚未重新应用' : '这份配置正在使用' : '这份配置已保存' }}</b><p>{{ dirty ? '先保存当前修改，再应用。' : '应用后，镜子将使用这份已保存的配置。' }}</p></div><div class="saved-buttons"><button :disabled="!!busy" @click="test('saved')">{{ busy === 'test-saved' ? '测试中…' : '测试已保存配置' }}</button><button class="apply-model" :disabled="!!busy || dirty || (selected.active && !selected.unapplied_changes)" @click="activate">{{ busy === 'activate' ? '应用中…' : selected.active && !selected.unapplied_changes ? '当前已应用' : '应用此配置' }}</button></div><button v-if="!selected.active" class="delete-model" :disabled="!!busy" @click="remove">删除这份配置</button></footer>
        </section>
        <section v-else class="model-idle" aria-label="配置说明"><span aria-hidden="true">M<span>/</span></span><h2>你的模型，<br>由你选择。</h2><p>选择左侧配置查看详情，<br>或添加一个新的连接。</p></section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.models-page { flex:1; min-height:0; display:flex; flex-direction:column; color:#f2f7ff; }
.page-content { flex:1; min-height:0; overflow-y:auto; padding:18px clamp(24px,4vw,64px) 40px; }
.model-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:30px; margin:26px 0 36px; }
.model-heading>div:first-child { position:relative; } h1 { margin:0; font-size:clamp(28px,3.4vw,45px); line-height:1.35; font-weight:900; letter-spacing:.015em; } .model-heading-word { position:absolute; top:-12px; left:145px; color:#61e6f5; font:italic 900 clamp(35px,5vw,70px)/1 var(--font-display); transform:rotate(-8deg); opacity:.45; pointer-events:none; }
.applied-model { max-width:50%; border-left:3px solid #59e1f3; padding:5px 0 6px 17px; } .applied-model span { display:block; font-size:11px; color:#64e8ef; } .applied-model strong { display:block; font-size:18px; margin:9px 0; overflow-wrap:anywhere; } .applied-model small { color:#a5bfdf; font-size:11px; overflow-wrap:anywhere; display:block; }
.model-tabs { display:flex; gap:8px; border-bottom:1px solid #688ec855; margin-bottom:28px; } .model-tabs button { padding:13px 25px; color:#adc3e5; font-weight:700; font-size:14px; border-bottom:3px solid transparent; } .model-tabs button[aria-current] { color:#66e8f7; border-color:#66e8f7; background:#1464b13b; }
.model-workspace { display:grid; grid-template-columns:minmax(250px,.8fr) minmax(330px,1.2fr); align-items:start; gap:25px; max-width:1280px; }
.model-list { min-width:0; } .model-list>header { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:2px 0 19px; } h2 { margin:0; font-size:21px; } .model-list header span { display:block; color:#99b3d9; font-size:11px; margin-top:6px; } .new-profile { display:flex; gap:4px; align-items:center; font-size:12px; background:#eef6ff; color:#123265; padding:10px 12px; font-weight:700; } .model-list .new-profile span { font-size:18px; margin:0; color:inherit; }
.profile-row { width:100%; display:flex; align-items:center; gap:13px; text-align:left; padding:20px 15px; border-top:1px solid #6188bc55; border-left:3px solid transparent; color:white; background:#0622556b; min-width:0; transition:background .18s,border-color .18s; } .profile-row:last-of-type { border-bottom:1px solid #6188bc55; } .profile-row.selected { background:#1757a5a6; border-left-color:#62e5f3; } .provider-mark { flex:0 0 37px; height:40px; display:grid; place-items:center; background:#224f8a; color:#8cecff; font:italic 800 24px var(--font-display); clip-path:polygon(0 0,100% 0,100% 76%,75% 100%,0 100%); } .profile-copy { min-width:0; flex:1; } .profile-copy b { display:block; overflow-wrap:anywhere; font-size:14px; } .profile-copy>span { display:block; margin-top:7px; color:#b6cbee; font-size:11px; overflow-wrap:anywhere; } .profile-status { flex-shrink:0; background:#4ed0cb; color:#062d41; font-size:10px; padding:5px 7px; } .profile-status.pending { background:#f2d078; color:#4b3309; } .row-arrow { color:#75ddeb; font-size:22px; } .list-footnote { font-size:11px; line-height:1.7; color:#95afd2; margin:18px 0; }
.list-empty { padding:35px 20px; background:#09285f96; border:1px dashed #5c8bc2; color:#b9cce7; font-size:13px; line-height:1.9; } .list-empty>span { font-size:42px; color:#68e4f3; } .list-empty h3 { color:white; font-size:20px; } .list-empty button { margin-top:18px; background:#4de3f0; color:#09274d; padding:10px 17px; font-weight:700; }
.model-detail { background:#f1f6ff; color:#0a2659; padding:24px; border-top:5px solid #5ce4f1; box-shadow:7px 7px 0 #04123e80; min-width:0; animation:detail-in .24s ease-out; } .detail-header { display:flex; align-items:center; justify-content:space-between; font-size:11px; margin-bottom:20px; color:#66789a; } .back-to-list { color:#1d58a3; font-size:12px; font-weight:700; } .model-detail h2 { overflow-wrap:anywhere; } .editor-description { color:#5b7092; font-size:12px; line-height:1.7; margin:10px 0 25px; }
fieldset { padding:0; margin:0; border:0; min-width:0; display:grid; gap:21px; } label { display:grid; gap:9px; font-size:13px; font-weight:700; min-width:0; } input,select { width:100%; min-width:0; border:1px solid #a9bfdd; background:white; color:#102c5a; padding:12px; font:400 13px/1.4 var(--font); border-radius:0; } label small { font-size:11px; font-weight:400; color:#687c9b; line-height:1.6; } .provider-note { font-size:11px; line-height:1.8; color:#5e7193; margin:-9px 0 0; } .provider-note a { color:#155bbb; text-decoration:underline; text-underline-offset:3px; white-space:nowrap; } .protocol-field>span { font-size:13px; font-weight:700; } .protocol-field>div { display:flex; gap:8px; margin-top:10px; } .protocol-field button { padding:10px 12px; border:1px solid #abc1de; color:#48648b; font-size:12px; } .protocol-field button[aria-pressed=true] { color:white; background:#174d9a; border-color:#174d9a; } .draft-actions { display:flex; gap:10px; margin-top:3px; } .draft-actions button { padding:12px 17px; font-size:12px; font-weight:700; } .test-model { border:1px solid #5e83b5; color:#235999; } .save-model { background:#164b9c; color:white; flex:1; } .test-explanation { font-size:11px; line-height:1.8; color:#6b7c94; margin:15px 0 0; } .key-warning { color:#a55318!important; display:block; margin-top:5px; }
.saved-actions { margin-top:25px; border-top:1px solid #b8cbe3; padding-top:22px; } .saved-actions b { font-size:13px; } .saved-actions p { color:#687c99; font-size:11px; line-height:1.8; margin:8px 0 16px; } .saved-buttons { display:flex; gap:10px; } .saved-buttons button { font-size:11px; border:1px solid #8faace; padding:11px; flex:1; color:#275797; } .saved-buttons .apply-model { background:#092f6f; color:white; } .delete-model { display:block; color:#a94949; font-size:11px; margin-top:21px; padding:5px 0; } button:disabled { cursor:default; opacity:.48; } :is(button,input,select,a):focus-visible { outline:3px solid #39a6dc; outline-offset:3px; } .connection-result { margin-top:20px; padding:15px; border-left:3px solid #18999b; background:#d9f2f1; color:#155e65; font-size:12px; } .connection-result p { margin:7px 0 0; font-size:11px; line-height:1.8; overflow-wrap:anywhere; } .connection-result.failed { border-color:#b54949; background:#f7e6e6; color:#913c3c; } .model-error { background:#6f3049; padding:15px; font-size:13px; line-height:1.8; } .model-error button { display:block; text-decoration:underline; margin-top:10px; }
.model-idle { padding:45px 30px; min-height:380px; border-left:1px solid #5073b466; } .model-idle>span { font:italic 900 100px/1 var(--font-display); color:#57d7f0; } .model-idle>span span { color:#3067b4; } .model-idle h2 { font-size:30px; line-height:1.5; margin:25px 0 18px; } .model-idle p { color:#a5bddd; font-size:13px; line-height:1.9; }
.advanced-model { border-top:1px solid #b7c9e0; border-bottom:1px solid #b7c9e0; padding:13px 0; } .advanced-model summary { cursor:pointer; font-size:12px; font-weight:700; } .advanced-model summary span { color:#5e7494; font-weight:400; margin-left:12px; font-size:11px; } .advanced-fields { display:grid; gap:21px; padding:21px 0 3px; }
@keyframes detail-in { from { opacity:0; transform:translateX(14px); } to { opacity:1; transform:none; } }
.presentation-mode-mobile .models-page .page-content { padding:12px 18px 30px; } .presentation-mode-mobile .model-heading { margin:18px 0 25px; gap:18px; } .presentation-mode-mobile h1 { font-size:27px; } .presentation-mode-mobile .model-heading-word { font-size:39px; left:90px; top:2px; } .presentation-mode-mobile .applied-model { max-width:47%; padding-left:12px; } .presentation-mode-mobile .applied-model strong { font-size:13px; } .presentation-mode-mobile .applied-model small { font-size:9px; } .presentation-mode-mobile .model-workspace { display:block; } .presentation-mode-mobile .model-idle { display:none; } .presentation-mode-mobile .detail-open .model-list { display:none; } .presentation-mode-mobile .model-detail { padding:20px 17px; } .presentation-mode-mobile .model-tabs { margin-bottom:23px; }
.presentation-mode-mobile .editing-model .model-heading, .presentation-mode-mobile .editing-model :deep(.masthead) { display:none; }
.presentation-mode-mobile .editing-model .model-tabs { margin-top:0; margin-bottom:14px; }
.presentation-mode-mobile .model-detail :is(input,select), .presentation-mode-mobile .embedding-editor :deep(input), .presentation-mode-mobile .embedding-editor :deep(select) { font-size:16px; }
@media (prefers-reduced-motion:reduce) { .model-detail { animation:none; } .profile-row { transition:none; } }
</style>
