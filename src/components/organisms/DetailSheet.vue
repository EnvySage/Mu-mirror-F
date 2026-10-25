<script setup>
import { ref, useId } from 'vue'
import { useDialogFocus } from '@/composables/useDialogFocus'

const props = defineProps({ open: Boolean, title: String, subtitle: String })
const emit = defineEmits(['close'])
const panel = ref(null)
const titleId = useId()
useDialogFocus(() => props.open, panel, '.detail-close', () => emit('close'))
</script>

<template>
  <Teleport to="body">
    <Transition name="detail-cut">
      <div v-if="open" class="detail-backdrop" @click.self="emit('close')">
        <section ref="panel" class="detail-sheet" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
          <header class="detail-heading"><div><p v-if="subtitle">{{ subtitle }}</p><h2 :id="titleId">{{ title }}</h2></div><button class="detail-close" type="button" aria-label="关闭详情" @click="emit('close')">×</button></header>
          <div class="detail-content"><slot /></div>
          <footer v-if="$slots.footer" class="detail-footer"><slot name="footer" /></footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.detail-backdrop{position:fixed;inset:0;z-index:150;display:flex;align-items:center;justify-content:center;padding:28px;background:#020e2bbd;backdrop-filter:blur(12px);perspective:1200px}
.detail-sheet{--surface:#f5f8f4;--text:#172e46;--text-mid:#415c70;--text-low:#526d80;--accent:#164fd5;display:flex;flex-direction:column;min-width:0;width:min(740px,100%);max-height:calc(100dvh - 56px);background:#f5f8f4;color:#172e46;box-shadow:9px 10px 0 #1548b6,16px 18px 0 #020d2e66;text-align:left;white-space:normal;border:1px solid #b5dfed}
.detail-heading{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-shrink:0;padding:23px 28px;background:#0b2853;color:#f6fbf4;border-bottom:5px solid #83e7ed}.detail-heading:before{content:'';position:absolute;right:84px;top:0;width:58px;height:100%;background:#2154a666;transform:skew(-22deg);pointer-events:none}.detail-heading p{margin:0 0 7px;color:#9fe9ed;font-size:11px}.detail-heading h2{position:relative;margin:0;font-size:23px;font-weight:900;line-height:1.4;overflow-wrap:anywhere}.detail-close{position:relative;flex-shrink:0;width:40px;height:40px;border:1px solid #6896b6;background:#123965;color:white;font-size:28px;cursor:pointer;transform:rotate(4deg)}
.detail-content{overflow:auto;overscroll-behavior:contain;min-height:0;padding:27px 28px;scrollbar-width:thin}.detail-footer{flex-shrink:0;padding:15px 28px;border-top:1px solid #c4d5d9;background:#e6eeeb}.detail-sheet:focus-visible,.detail-close:focus-visible{outline:3px solid #ee4a8b;outline-offset:3px}
.detail-cut-enter-active{transition:opacity .28s}.detail-cut-enter-active .detail-sheet{transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .3s}.detail-cut-leave-active{transition:opacity .18s}.detail-cut-leave-active .detail-sheet{transition:transform .18s}.detail-cut-enter-from,.detail-cut-leave-to{opacity:0}.detail-cut-enter-from .detail-sheet{opacity:0;transform:translate3d(100px,60px,-140px) rotate(-7deg)}.detail-cut-leave-to .detail-sheet{transform:translateY(25px) rotate(2deg)}
@media(max-width:599px){.detail-backdrop{padding:16px 10px;align-items:flex-end}.detail-sheet{max-height:calc(100dvh - 32px);box-shadow:4px 5px 0 #1548b6}.detail-heading{padding:18px}.detail-heading h2{font-size:20px}.detail-content{padding:20px 18px}.detail-footer{padding:13px 18px;padding-bottom:max(13px,env(safe-area-inset-bottom))}}
@media(prefers-reduced-motion:reduce){.detail-cut-enter-active,.detail-cut-leave-active,.detail-cut-enter-active .detail-sheet,.detail-cut-leave-active .detail-sheet{transition:none}.detail-cut-enter-from .detail-sheet,.detail-cut-leave-to .detail-sheet{transform:none}}
</style>
