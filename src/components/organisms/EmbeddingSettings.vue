<script setup>
import { computed, ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { testEmbeddingConnection } from '@/api/settings'
import { IS_DEMO_PREVIEW } from '@/preview/mode'

const settings = useSettingsStore()
const toast = useToastStore()
const draft = ref({ source: 'local', baseUrl: '', model: '', apiKey: '' })
const saving = ref(false)
const dirty = ref(false)
const testResult = ref(null)
function reset() {
  const value = settings.settings
  draft.value = { source: value.embedding_source || 'local', baseUrl: value.embedding_base_url || '', model: value.embedding_model || '', apiKey: '' }
  dirty.value = false
}
watch(() => settings.settings, () => { if (!dirty.value) reset() }, { immediate: true })
const keyHint = computed(() => settings.settings.embedding_api_key_needs_reentry ? '原密钥无法解密，请重新输入' : settings.settings.embedding_api_key ? '已保存密钥；留空保留' : '尚未配置密钥')
async function save() {
  const remote = draft.value.source === 'api'
  if (remote && (!draft.value.baseUrl.trim() || !draft.value.model.trim())) return toast.warning('请填写检索 API 地址与模型 ID')
  if (remote && !draft.value.apiKey.trim() && (!settings.settings.embedding_api_key || settings.settings.embedding_api_key_needs_reentry)) return toast.warning('请输入检索 API Key')
  const payload = { embedding_source: draft.value.source, embedding_base_url: draft.value.baseUrl.trim(), embedding_model: draft.value.model.trim() }
  if (draft.value.apiKey.trim()) payload.embedding_api_key = draft.value.apiKey.trim()
  saving.value = true
  const ok = await settings.updateSettings(payload)
  saving.value = false
  if (ok) { reset(); testResult.value = null; toast.success('已保存记忆检索配置') }
  else toast.error(settings.error || '保存失败')
}
async function testSaved() {
  saving.value = true
  testResult.value = null
  try {
    const response = await testEmbeddingConnection()
    testResult.value = { success: true, message: IS_DEMO_PREVIEW ? '演示环境仅模拟测试，未连接真实检索服务。' : response.data || '检索连接测试成功' }
  } catch (err) { testResult.value = { success: false, message: err.message || '检索连接测试失败' } }
  finally { saving.value = false }
}
defineExpose({ isDirty: () => dirty.value })
</script>

<template>
  <section class="embedding-editor" aria-labelledby="embedding-title">
    <header><span class="embedding-mark" aria-hidden="true">↗</span><div><h2 id="embedding-title">记忆检索模型</h2><p>将记录转换为可检索的记忆，供镜子回看。</p></div></header>
    <form @submit.prevent="save" @input="dirty = true" @change="dirty = true">
      <fieldset :disabled="saving">
        <label>服务来源<select v-model="draft.source"><option value="local">本地 BGE-m3（1024 维）</option><option value="api">远程 API 服务</option></select></label>
        <template v-if="draft.source === 'api'">
          <label>基础地址<input v-model="draft.baseUrl" type="url" placeholder="https://api.example.com/v1" autocomplete="off"></label>
          <label>模型 ID<input v-model="draft.model" placeholder="填写支持 1024 维的模型 ID" autocomplete="off"></label>
          <label>API Key <small>{{ keyHint }}</small><input v-model="draft.apiKey" type="password" placeholder="输入新密钥，或留空保留" autocomplete="new-password"></label>
        </template>
        <p v-else class="embedding-note">本地服务使用 BGE-m3，不需要单独填写 API Key。</p>
        <p class="embedding-note">当前记忆库使用 1024 维向量。远程模型也须支持 1024 维；保存不会检测远程服务。</p>
        <footer><button class="embedding-save" type="submit">{{ saving ? '处理中…' : '保存检索配置' }}</button><button class="embedding-test" type="button" @click="testSaved">测试已保存配置</button><span v-if="dirty">有未保存修改；测试使用上次保存的配置</span></footer>
        <p v-if="testResult" class="embedding-result" :class="{ failed: !testResult.success }" role="status">{{ testResult.message }}</p>
      </fieldset>
    </form>
  </section>
</template>

<style scoped>
.embedding-editor { max-width:760px; padding:28px; background:#f1f6ff; color:#0b2356; border-top:5px solid #59e1f3; box-shadow:8px 8px 0 #05143870; }
header { display:flex; gap:20px; align-items:center; margin-bottom:28px; }
.embedding-mark { font:800 58px/1 var(--font-display); color:#1765ca; } h2 { font-size:23px; margin:0 0 8px; } header p,.embedding-note { font-size:13px; line-height:1.8; color:#486082; }
fieldset { border:0; padding:0; margin:0; min-width:0; display:grid; gap:21px; } label { display:grid; gap:9px; font-weight:700; font-size:13px; } small { color:#596f8e; font-weight:400; }
input,select { width:100%; min-width:0; padding:12px; background:white; border:1px solid #a6bbd8; color:#102851; font:inherit; } :is(input,select,button):focus-visible { outline:3px solid #286ed0; outline-offset:3px; } footer { display:flex; flex-wrap:wrap; align-items:center; gap:18px; } footer span { color:#7a5811; font-size:12px; } .embedding-save { padding:13px 21px; background:#0b3f95; color:white; font-weight:700; } .embedding-note { margin:0; }
.embedding-test { border:1px solid #7e9dc5; padding:12px 16px; font-size:12px; color:#1f529a; } .embedding-result { font-size:12px; line-height:1.8; background:#d9f2f1; color:#155e65; padding:14px; margin:0; } .embedding-result.failed { background:#f7e6e6; color:#913c3c; }
@media(max-width:600px) { .embedding-editor { padding:22px 18px; } header { gap:12px; } h2 { font-size:20px; } }
</style>
