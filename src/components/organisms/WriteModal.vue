<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordsStore } from '@/stores/records'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close'])

const router = useRouter()
const recordsStore = useRecordsStore()
const settingsStore = useSettingsStore()
const toast = useToastStore()

const content = ref('')
const loading = ref(false)
const error = ref('')
const textareaEl = ref(null)

const MAX = 500

const count = computed(() => content.value.length)
const enabled = computed(() => content.value.trim().length > 0 && !loading.value)

watch(() => props.show, async (val) => {
  if (val) {
    content.value = ''
    error.value = ''
    await nextTick()
    textareaEl.value?.focus()
  }
})

async function handleSubmit() {
  if (!enabled.value) return

  if (!settingsStore.isModelConfigComplete) {
    const msg = settingsStore.getModelConfigMissingMessage()
    toast.warning(msg || '请先完成 AI 模型配置后再写日记')
    emit('close')
    setTimeout(() => router.push({ name: 'settings' }), 300)
    return
  }

  loading.value = true
  error.value = ''
  try {
    const record = await recordsStore.createRecord(content.value.trim())
    emit('close')
    toast.info('已提交，AI 拆分中…')
    // processing 态记录留在列表轮询（RecordsView 列表级轮询接管）
    return record
  } catch (err) {
    error.value = err.message || '创建失败，请重试'
  } finally {
    loading.value = false
  }
}

function onClose() {
  if (loading.value) return
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="modal-overlay" @click="onClose" />
    </Transition>
    <Transition name="sheet">
      <div v-if="show" class="write-modal">
        <div class="write-header">
          <button class="write-cancel" @click="onClose">取消</button>
          <span class="write-header-title">写日记</span>
          <button :class="['write-submit', { enabled }]" :disabled="!enabled" @click="handleSubmit">
            {{ loading ? '提交中…' : '保存' }}
          </button>
        </div>
        <div class="write-body">
          <div v-if="error" class="write-error">{{ error }}</div>
          <textarea
            ref="textareaEl"
            v-model="content"
            class="write-textarea"
            placeholder="今天发生了什么？"
            :maxlength="MAX"
          />
          <div class="write-footer">
            <span class="write-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>
              可写多件事，AI 会自动拆分成片段
            </span>
            <span class="write-counter"><span>{{ count }}</span>/{{ MAX }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(5,7,15,.6);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  z-index: 40;
}

.write-modal {
  position: fixed; left: 50%; bottom: 0; transform: translate(-50%, 110%);
  width: 100%; max-width: 640px; z-index: 41;
  background: rgba(19,23,44,.92);
  backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -12px 48px rgba(0,0,0,.5), inset 0 1px 0 var(--line-strong);
  padding-bottom: var(--safe-bottom);
}
.write-modal.show { transform: translate(-50%, 0); }

@media (min-width: 900px) {
  .write-modal { border-radius: 22px; bottom: 8dvh; }
}

.write-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px 8px;
}
.write-cancel { font-size: 14.5px; color: var(--text-mid); padding: 6px 2px; }
.write-header-title { font-family: var(--font-display); font-size: 15px; }
.write-submit {
  font-size: 14.5px; font-weight: 600; color: var(--text-low);
  padding: 7px 16px; border-radius: var(--radius-full); transition: all .2s;
}
.write-submit.enabled {
  color: #0B0E1A; background: var(--accent-grad);
  box-shadow: 0 4px 16px rgba(110,231,240,.3);
}
.write-submit:disabled { cursor: not-allowed; }

.write-body { padding: 4px 20px 20px; }
.write-error {
  font-size: 12.5px; color: var(--danger);
  padding: 8px 12px; margin-bottom: 8px;
  border-radius: var(--radius-sm); background: var(--danger-bg);
}
.write-textarea {
  width: 100%; min-height: 130px;
  background: transparent; border: none; resize: none;
  font-size: 16px; line-height: 1.7; color: var(--text-hi);
}
.write-textarea::placeholder { color: var(--text-low); }
.write-textarea:focus { outline: none; }

.write-footer {
  display: flex; justify-content: space-between; align-items: center; margin-top: 10px;
}
.write-hint { font-size: 12px; color: var(--text-low); display: flex; align-items: center; gap: 6px; }
.write-hint svg { width: 13px; height: 13px; stroke: var(--cyan); fill: none; flex-shrink: 0; }
.write-counter { font-family: var(--font-mono); font-size: 11px; color: var(--text-low); }

/* sheet 过渡：translate 与 .write-modal 自身 transform 冲突，走 Vue class 覆盖 */
.sheet-enter-active, .sheet-leave-active { transition: transform .32s cubic-bezier(.32,.72,.28,1); }
.sheet-enter-from, .sheet-leave-to { transform: translate(-50%, 110%) !important; }
.sheet-enter-to, .sheet-leave-from { transform: translate(-50%, 0) !important; }
</style>
