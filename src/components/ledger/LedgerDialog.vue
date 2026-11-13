<script setup>
import { nextTick, ref, watch } from 'vue'
const props = defineProps({ open: Boolean, title: String, busy: Boolean })
const emit = defineEmits(['close'])
const dialog = ref(null)
watch(() => props.open, async open => {
  await nextTick()
  if (!dialog.value || open !== props.open) return
  if (open && !dialog.value.open) dialog.value.showModal()
  if (!open && dialog.value.open) dialog.value.close()
}, { immediate: true })
function close() { if (!props.busy) emit('close') }
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="ledger-dialog" :aria-label="title" @cancel.prevent="close" @click.self="close">
      <div class="ledger-dialog-paper">
        <header><h2>{{ title }}</h2><button type="button" :disabled="busy" aria-label="关闭" @click="close">×</button></header>
        <slot />
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.ledger-dialog{width:min(100% - 30px,650px);max-height:min(88dvh,850px);max-width:none;padding:0;border:0;background:var(--card);color:var(--night);box-shadow:8px 9px 0 #1762ff}
.ledger-dialog::backdrop{background:#020a2cbf;backdrop-filter:blur(3px)}
.ledger-dialog-paper{padding:0 clamp(16px,4vw,28px) 25px;border-top:5px solid var(--cyan)}
header{position:sticky;top:0;z-index:1;display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--card);padding:12px 0;border-bottom:1px solid var(--line);margin-bottom:14px}
h2{margin:0;font-size:24px;font-weight:900;letter-spacing:-.04em}
header button{min-width:44px;height:44px;font-size:26px}
@media(max-width:500px){.ledger-dialog{margin:auto 0 0;width:100%;max-height:92dvh}.ledger-dialog-paper{padding-bottom:max(24px,var(--safe-bottom))}}
</style>
