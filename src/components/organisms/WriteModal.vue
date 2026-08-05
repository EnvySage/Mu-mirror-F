<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useRecordsStore } from '@/stores/records'

const router = useRouter()
const ui = useUIStore()
const records = useRecordsStore()

const content = ref('')
const charCount = computed(() => content.value.length)
const canSubmit = computed(() => content.value.trim().length > 0)

function close() {
  content.value = ''
  ui.closeWriteModal()
}

function submit() {
  if (!canSubmit.value) return
  records.createRecord(content.value.trim())
  close()
  router.push({ name: 'records' })
}
</script>

<template>
  <div v-if="ui.showWriteModal" class="modal-wrapper">
    <div class="modal-overlay" @click="close" />
    <div class="write-modal" :class="{ show: ui.showWriteModal }">
      <div class="write-header">
        <button class="write-cancel" @click="close">取消</button>
        <span class="write-header-title">写日记</span>
        <button :class="['write-submit', { enabled: canSubmit }]" @click="submit">保存</button>
      </div>
      <div class="write-body">
        <textarea
          v-model="content"
          class="write-textarea"
          placeholder="今天发生了什么?"
          maxlength="500"
          autofocus
        />
        <div class="write-footer">
          <span class="write-hint">可写多个事件，AI会自动拆分</span>
          <span class="write-counter">{{ charCount }}/500</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-wrapper {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 200;
}

.modal-overlay {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
  animation: fadeIn 0.3s ease;
}

.write-modal {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%) scale(0.95);
  width: 90%; max-width: 560px; max-height: 85vh;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column;
  animation: modalIn 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes modalIn { from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }

.write-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 28px; border-bottom: 0.5px solid var(--border);
}
.write-header-title { font-size: 17px; font-weight: 600; }
.write-cancel { font-size: 15px; color: var(--text-secondary); background: none; border: none; cursor: pointer; padding: 6px 0; font-family: var(--font); }
.write-submit {
  font-size: 14px; font-weight: 600; color: #fff; background: var(--accent);
  border: none; cursor: pointer; padding: 10px 24px;
  border-radius: var(--radius-full); opacity: 0.4; pointer-events: none;
  transition: all 0.2s ease; font-family: var(--font);
}
.write-submit.enabled { opacity: 1; pointer-events: auto; }
.write-submit.enabled:hover { background: var(--accent-hover); }

.write-body { flex: 1; padding: 24px 28px; display: flex; flex-direction: column; min-height: 320px; }
.write-textarea {
  flex: 1; border: none; outline: none;
  font-size: 17px; line-height: 1.8;
  color: var(--text-primary); resize: none;
  font-family: var(--font); background: transparent;
}
.write-textarea::placeholder { color: var(--text-tertiary); }
.write-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 0.5px solid var(--border); }
.write-counter { font-size: 13px; color: var(--text-tertiary); font-family: var(--font-mono); }
.write-hint { font-size: 12px; color: var(--text-tertiary); }

@media (min-width: 900px) {
  .write-modal { max-width: 640px; max-height: 80vh; }
  .write-body { min-height: 400px; padding: 28px 32px; }
  .write-textarea { font-size: 18px; }
}
</style>
