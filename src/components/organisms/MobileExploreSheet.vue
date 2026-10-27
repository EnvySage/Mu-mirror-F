<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useGlossaryStore } from '@/stores/glossary'
import { usePresentationMode } from '@/composables/usePresentationMode'
import { gsap, prefersReducedMotion } from '@/motion/core'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])
const dialog = ref(null), route = useRoute(), router = useRouter()
const ui = useUIStore(), glossary = useGlossaryStore(), presentation = usePresentationMode()
let tween
const destinations = [
  { page: 'calendar', label: '日历', note: '按日期找回一天', icon: 'M8 3v4M16 3v4M4 10h16M5 5h14v15H5Z' },
  { page: 'vault', label: '记忆资产', note: '文档与素材', icon: 'M3 4h18v5H3ZM5 9v11h14V9M9 13h6' },
  { action: 'summary', label: '每日总结', note: '回看今天的片段', icon: 'M14 3H6v18h14V9ZM14 3v6h6M8 13h8M8 17h5' },
  { page: 'settings', label: '设置', note: '偏好与资料管理', icon: 'M4 7h6M14 7h6M4 17h10M18 17h2M10 5h4v4h-4ZM14 15h4v4h-4Z' },
]
watch(() => props.open, async open => {
  await nextTick()
  if (!dialog.value || open !== props.open) return
  tween?.kill()
  if (open) {
    if (!dialog.value.open) dialog.value.showModal()
    if (!prefersReducedMotion()) tween = gsap.fromTo(dialog.value, { y: 45, opacity: 0 }, { y: 0, opacity: 1, duration: .3, ease: 'power3.out' })
    else gsap.set(dialog.value, { y: 0, opacity: 1 })
  } else if (dialog.value.open) {
    if (prefersReducedMotion()) dialog.value.close()
    else tween = gsap.to(dialog.value, { y: 30, opacity: 0, duration: .2, ease: 'power2.in', onComplete: () => dialog.value?.close() })
  }
})
function close() { emit('close') }
function backdrop(event) {
  if (event.target !== dialog.value) return
  const r = dialog.value.getBoundingClientRect()
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close()
}
function trapTab(event) {
  const items = [...dialog.value.querySelectorAll('button:not(:disabled)')]
  const first = items[0], last = items.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
function choose(item) {
  if (item.page) {
    if (!ui.confirmNavigationDrafts()) return
    ui.approveNavigation(router.resolve({ name: item.page }).fullPath)
    ui.switchPage(item.page, true)
    close()
    router.push({ name: item.page })
  } else {
    // Close the native top-layer dialog before handing focus to the summary overlay.
    tween?.kill(); dialog.value?.close(); close()
    ui.openSummarySheet()
  }
}
function switchLayout() { close(); presentation.requestMode(presentation.mode.value === 'mobile' ? 'desktop' : 'mobile') }
onBeforeUnmount(() => { tween?.kill(); dialog.value?.close() })
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" id="mobile-explore" class="mobile-explore" aria-labelledby="explore-title" @cancel.prevent="close" @close="close" @click="backdrop" @keydown.tab="trapTab">
      <header class="explore-heading"><div><small>生活不止一面</small><h2 id="explore-title">探索</h2></div><button class="explore-close" aria-label="关闭探索" autofocus @click="close">×</button></header>
      <nav class="explore-destinations" aria-label="探索功能">
        <button class="explore-tarot" :aria-current="route.name === 'tarot' ? 'page' : undefined" @click="choose({ page: 'tarot' })">
          <span class="explore-tarot-art" aria-hidden="true"><img src="/art/tarot/v1/back.png" alt="" /><img src="/art/tarot/v1/00-fool.png" alt="" /></span>
          <span class="explore-tarot-copy"><strong>塔罗牌</strong><small><span>每日一张</span><span>问一问</span><span>收藏册</span></small><i aria-hidden="true">↗</i></span>
        </button>
        <button v-for="item in destinations" :key="item.page || item.action" class="explore-destination" :aria-current="route.name === item.page ? 'page' : undefined" @click="choose(item)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path :d="item.icon" /></svg>
          <strong>{{ item.label }}<span v-if="item.page === 'settings' && glossary.pendingCount" class="explore-count">{{ glossary.pendingCount }}</span></strong><small>{{ item.note }}</small>
        </button>
      </nav>
      <button class="explore-layout" @click="switchLayout">{{ presentation.mode.value === 'mobile' ? '切换到桌面布局' : '切换到手机布局' }} <span aria-hidden="true">↗</span></button>
    </dialog>
  </Teleport>
</template>

<style scoped>
.mobile-explore{position:fixed;inset:auto 0 0;width:min(100% - 20px,520px);max-height:calc(100dvh - 28px - env(safe-area-inset-top,0px));margin:auto auto 0;padding:22px 22px max(20px,env(safe-area-inset-bottom));overflow-y:auto;overscroll-behavior:contain;background:linear-gradient(145deg,#122e40f5,#071421fa);color:#e9f4f5;border:1px solid #94c3cd52;border-bottom:0;border-radius:24px 4px 0 0;box-shadow:0 -15px 70px #0006}
.mobile-explore::backdrop{background:#010918ac;backdrop-filter:blur(7px)}
.explore-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.explore-heading small{font-size:11px;color:#a4c0ca}.explore-heading h2{font-size:32px;font-weight:900;line-height:1.4;transform:rotate(-5deg);transform-origin:left center}.explore-close{width:44px;height:44px;font-size:28px;color:#bdd6df}
.explore-destinations{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.explore-destinations button{text-align:left;position:relative;min-width:0}.explore-destinations button[aria-current=page]{outline:1px solid #b7e4e9;outline-offset:-1px}
.explore-tarot{grid-column:1/-1;min-height:148px;overflow:hidden;background:radial-gradient(ellipse at 30% 70%,#598f9d45,transparent 70%);border:1px solid #b9dfe333;border-radius:3px 16px 3px 3px;margin-bottom:4px}
.explore-tarot-art{position:absolute;left:25px;top:20px;width:95px;height:144px}.explore-tarot-art img{position:absolute;width:78px;height:117px;object-fit:cover;transform:rotate(-16deg);box-shadow:4px 8px 18px #0006}.explore-tarot-art img+img{left:26px;top:2px;transform:rotate(8deg)}
.explore-tarot-copy{position:relative;display:block;margin-left:146px;padding:24px 12px 20px 0}.explore-tarot-copy strong{display:block;font-size:26px;transform:rotate(-4deg)}.explore-tarot-copy small{display:block;font-size:10px;color:#bed6dc;margin-top:12px;line-height:1.8}.explore-tarot-copy i{display:block;font-size:24px;margin-top:4px;color:#b5dce0;font-style:normal}
.explore-tarot-copy small span{display:inline-block;white-space:nowrap}.explore-tarot-copy small span+span:before{content:'·';margin:0 4px}
.explore-destination{padding:17px 16px;min-height:117px;border:1px solid #b7dbe71c;background:#a3c4d307;border-radius:3px}.explore-destination:nth-child(even){border-radius:3px 12px 3px 3px}.explore-destination svg{width:23px;height:23px;color:#a8cbd7;margin-bottom:6px}.explore-destination strong{display:block;font-size:15px}.explore-destination small{display:block;font-size:10px;color:#91acbb;margin-top:5px}.explore-count{font-size:10px;margin-left:6px;color:#a1e9e5}
.explore-layout{display:flex;align-items:center;justify-content:space-between;min-height:44px;width:100%;margin-top:16px;color:#9bb7c6;font-size:12px}.explore-layout span{font-size:18px}
@media(max-width:359px){.mobile-explore{padding:18px 15px}.explore-tarot-art{left:12px}.explore-tarot-copy{margin-left:126px}.explore-tarot-copy strong{font-size:23px}}
@media(max-height:600px){.mobile-explore{padding-top:14px}.explore-heading{margin-bottom:14px}.explore-heading h2{font-size:26px}.explore-tarot{min-height:130px}.explore-tarot-art{top:12px}.explore-tarot-copy{padding-block:16px}.explore-destination{min-height:105px;padding:12px 16px}}
</style>
