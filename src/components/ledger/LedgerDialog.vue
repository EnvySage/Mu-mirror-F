<script setup>
import { nextTick, ref, watch } from 'vue'
import { useOverlayMotion } from '@/motion/useOverlayMotion'
const props = defineProps({ open: Boolean, title: String, busy: Boolean })
const emit = defineEmits(['close'])
const dialog = ref(null)
const paper = ref(null)
const motion = useOverlayMotion({ distance: 22, rotation: -1.5, scale: .98 })
watch(() => props.open, async open => {
  await nextTick()
  if (!dialog.value || open !== props.open) return
  if (open && !dialog.value.open) {
    dialog.value.showModal()
    motion.open(paper.value)
  }
  if (!open && dialog.value.open) {
    motion.cancel(paper.value)
    dialog.value.close()
  }
}, { immediate: true })
function close() { if (!props.busy) emit('close') }
function backdrop(event) {
  const rect = dialog.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close()
}
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="ledger-dialog" :aria-label="title" @cancel.prevent="close" @click.self="backdrop">
      <div ref="paper" class="ledger-dialog-paper">
        <header><h2>{{ title }}</h2><button type="button" :disabled="busy" aria-label="关闭" @click="close">×</button></header>
        <slot />
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.ledger-dialog{--dialog-gutter:clamp(18px,4vw,28px);position:fixed;inset:0;margin:auto;width:min(100% - 32px,650px);max-height:min(calc(100dvh - 40px),850px);max-width:none;padding:0;border:1px solid #9ebcef;overflow:auto;overscroll-behavior:contain;background:var(--card);color:var(--night);box-shadow:7px 8px 0 #1762ff,0 24px 80px #02091f66}
.ledger-dialog::backdrop{background:#020a2cbf;backdrop-filter:blur(5px)}
.ledger-dialog[open]::backdrop{animation:ledger-backdrop-in .2s ease-out both}
.ledger-dialog-paper{padding:0 var(--dialog-gutter) 22px;min-width:0}
header{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;gap:16px;background:var(--night);color:#f8fbff;padding:12px var(--dialog-gutter);border-bottom:4px solid var(--cyan);margin:0 calc(-1 * var(--dialog-gutter)) 18px}
h2{margin:0;font-size:23px;line-height:1.4;font-weight:900;letter-spacing:-.04em;overflow-wrap:anywhere}
header button{flex-shrink:0;min-width:44px;height:44px;font-size:26px;color:var(--cyan);border:1px solid #7796d37a;transition:background .15s,transform .2s}
header button:hover{background:#173e84;transform:rotate(6deg)}
header button:disabled{opacity:.4;cursor:wait}
@keyframes ledger-backdrop-in{from{opacity:0}to{opacity:1}}
@media(max-width:500px){.ledger-dialog{width:calc(100% - 28px);max-height:calc(100dvh - 32px);box-shadow:4px 5px 0 #1762ff,0 16px 50px #02091f55}.ledger-dialog-paper{padding-bottom:max(20px,var(--safe-bottom))}header{padding-block:9px}h2{font-size:21px}}
@media(prefers-reduced-motion:reduce){.ledger-dialog[open]::backdrop{animation:none}header button{transition:none}}
</style>
