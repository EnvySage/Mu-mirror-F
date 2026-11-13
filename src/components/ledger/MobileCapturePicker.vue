<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close', 'diary', 'ledger'])
const dialog = ref(null)
watch(() => props.open, async open => {
  await nextTick()
  if (!dialog.value || open !== props.open) return
  if (open && !dialog.value.open) dialog.value.showModal()
  if (!open && dialog.value.open) dialog.value.close()
})

function choose(action) {
  dialog.value?.close()
  emit(action)
}
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="capture-picker" aria-labelledby="capture-heading"
      @click.self="emit('close')" @cancel.prevent="emit('close')" @close="emit('close')">
      <div class="capture-paper">
        <header><h2 id="capture-heading">写下此刻</h2><button type="button" aria-label="关闭" autofocus @click="emit('close')">×</button></header>
        <button class="capture-diary" type="button" @click="choose('diary')"><span>写日记</span><small>留下今天的片段</small></button>
        <button class="capture-ledger" type="button" @click="choose('ledger')"><span>记一笔</span><small>收支、回款和凭证</small></button>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.capture-picker{position:fixed;inset:auto 0 calc(var(--nav-height) + var(--safe-bottom) + 10px);width:min(100% - 28px,440px);max-height:calc(100dvh - var(--nav-height) - 24px);margin:auto;padding:0;border:0;overflow:auto;background:transparent;color:var(--night)}
.capture-picker::backdrop{background:#02092592;backdrop-filter:blur(3px)}
.capture-paper{background:var(--card);padding:18px 20px 22px;border-top:5px solid var(--cyan);clip-path:polygon(0 0,100% 0,100% 92%,92% 100%,0 100%)}
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
h2{margin:0;font-size:21px;font-weight:900}
header button{width:44px;height:44px;font-size:25px}
.capture-diary,.capture-ledger{display:grid;gap:4px;width:100%;text-align:left;padding:12px 16px;min-height:55px;clip-path:polygon(0 0,100% 0,96% 100%,0 100%);font-weight:800}
.capture-diary{background:#e4edff;color:var(--night);margin-bottom:7px}
.capture-ledger{background:var(--night);color:var(--cyan)}
small{font-size:11px;font-weight:500}
</style>
