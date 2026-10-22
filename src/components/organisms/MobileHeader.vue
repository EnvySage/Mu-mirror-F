<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGlossaryStore } from '@/stores/glossary'
import { useUIStore } from '@/stores/ui'
import { usePresentationMode } from '@/composables/usePresentationMode'

defineProps({ title: { type: String, default: '' } })
const emit = defineEmits(['summary', 'sessions'])
const route = useRoute()
const router = useRouter()
const glossary = useGlossaryStore()
const ui = useUIStore()
const presentation = usePresentationMode()
const menuDialog = ref(null)
const menuOpen = ref(false)

function openMenu() {
  if (!menuDialog.value || menuDialog.value.open) return
  menuDialog.value.showModal()
  menuOpen.value = true
}
function closeMenu() { menuDialog.value?.close() }
function trapMenuTab(event) {
  const buttons = [...menuDialog.value.querySelectorAll('button:not(:disabled)')]
  const first = buttons[0], last = buttons.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
function handleBackdrop(event) {
  if (event.target !== menuDialog.value) return
  const rect = menuDialog.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeMenu()
}
function navigate(page) {
  closeMenu()
  if (!ui.confirmNavigationDrafts()) return
  ui.approveNavigation(router.resolve({ name: page }).fullPath)
  ui.switchPage(page, true)
  router.push({ name: page })
}
function switchPresentation() {
  closeMenu()
  presentation.requestMode(presentation.mode.value === 'mobile' ? 'desktop' : 'mobile')
}
watch(() => route.fullPath, closeMenu)
watch(() => presentation.mode.value, closeMenu)
onBeforeUnmount(closeMenu)
</script>

<template>
  <header class="mobile-header">
    <div class="page-title-sm">{{ title }}</div>
    <div class="header-actions">
      <button v-if="route.name === 'chat'" class="header-icon-btn" title="历史会话" aria-label="历史会话" @click="emit('sessions')">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
      </button>
      <button class="header-icon-btn" title="每日总结" aria-label="每日总结" @click="emit('summary')">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v15h16V9ZM14 3v6h6M8 13h8M8 17h5" /></svg>
      </button>
      <button class="header-icon-btn menu-toggle" :class="{ 'menu-active': ['vault', 'settings'].includes(route.name) }" aria-label="打开导航菜单" aria-haspopup="dialog" aria-controls="mobile-navigation-menu" :aria-expanded="menuOpen" @click="openMenu">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M9 12h10M5 17h14" /></svg>
        <span v-if="glossary.pendingCount" class="header-icon-badge">{{ glossary.pendingCount > 9 ? '9+' : glossary.pendingCount }}</span>
      </button>
    </div>
  </header>

  <!-- Native dialog makes the background inert and restores focus on close.
       Keep Tab inside its controls and teleport outside page clipping layers. -->
  <Teleport to="body">
    <dialog id="mobile-navigation-menu" ref="menuDialog" class="mobile-menu" aria-labelledby="mobile-menu-title" @click="handleBackdrop" @keydown.tab="trapMenuTab" @close="menuOpen = false">
      <div class="menu-heading">
        <h2 id="mobile-menu-title">导航与工具</h2>
        <button class="menu-close" aria-label="关闭导航菜单" @click="closeMenu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
      </div>
      <nav class="menu-destinations" aria-label="其他页面">
        <button class="menu-destination" :class="{ active: route.name === 'vault' }" :aria-current="route.name === 'vault' ? 'page' : undefined" @click="navigate('vault')">
          <span class="menu-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 4h18v5H3ZM5 9v11h14V9M9 13h6" /></svg></span>
          <span class="menu-copy"><strong>记忆资产</strong><small>查看文档与素材</small></span>
          <svg class="menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
        <button class="menu-destination" :class="{ active: route.name === 'settings' }" :aria-current="route.name === 'settings' ? 'page' : undefined" @click="navigate('settings')">
          <span class="menu-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h6M14 7h6M4 17h10M18 17h2" /><circle cx="12" cy="7" r="2" /><circle cx="16" cy="17" r="2" /></svg></span>
          <span class="menu-copy"><strong>设置 <span v-if="glossary.pendingCount" class="menu-count">{{ glossary.pendingCount }} 条待确认</span></strong><small>模型、偏好与词典</small></span>
          <svg class="menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </nav>
      <button class="presentation-switch" @click="switchPresentation">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20h8M12 16v4" /></svg>
        {{ presentation.mode.value === 'mobile' ? '切换到桌面布局' : '切换到手机布局' }}
      </button>
    </dialog>
  </Teleport>
</template>

<style scoped>
.mobile-header { flex: 0 0 auto; min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mobile-header .page-title-sm { min-width: 0; font-size: 20px; line-height: 1.3; }
.header-actions { display: flex; gap: 4px; flex-shrink: 0; }
.mobile-header .header-icon-btn {
  position: relative; width: 44px; height: 44px; border-radius: 3px;
  background: transparent; border: 1px solid transparent;
  display: grid; place-items: center;
}
.mobile-header .header-icon-btn svg { width: 21px; height: 21px; stroke: #cce6ff; fill: none; }
.mobile-header .header-icon-btn:focus-visible { outline-color: var(--cyan); }
.mobile-header .menu-toggle { border-color: #81a4dc50; }
.mobile-header .menu-active { background: #50edfa18; border-color: var(--cyan); }
.mobile-header .menu-active svg { stroke: var(--cyan); }
.header-icon-badge {
  position: absolute; top: -2px; right: -2px; min-width: 17px; height: 17px; padding: 0 4px;
  border-radius: 9px; background: var(--pink); color: white;
  font-size: 10px; line-height: 17px; text-align: center;
}
.mobile-menu {
  position: fixed; inset: 0 0 auto; width: min(calc(100% - 32px), 480px);
  max-height: calc(100dvh - 96px - env(safe-area-inset-top, 0px));
  margin: calc(76px + env(safe-area-inset-top, 0px)) auto 20px;
  padding: 0 20px; overflow-y: auto; overscroll-behavior: contain;
  border: 1px solid #79b6f366; border-top: 3px solid var(--cyan);
  border-radius: 4px; background: #0b2050; color: #f8fbff;
  box-shadow: 0 20px 60px #01082080;
}
.mobile-menu[open] { animation: menu-enter .2s var(--motion-enter); }
.mobile-menu::backdrop { background: #010924b8; }
.mobile-menu button:focus-visible { outline-color: var(--cyan); }
.menu-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 0 8px; }
.menu-heading h2 { font-size: 16px; font-weight: 700; }
.menu-close { width: 44px; height: 44px; display: grid; place-items: center; color: #b6d2f4; }
.menu-close svg { width: 20px; height: 20px; }
.menu-destinations { display: grid; }
.menu-destination { display: flex; align-items: center; gap: 14px; width: 100%; min-height: 78px; padding: 12px 0; border-bottom: 1px solid #84b8ef2b; text-align: left; }
.menu-symbol { flex-shrink: 0; width: 42px; height: 42px; display: grid; place-items: center; background: #619df017; color: var(--cyan); }
.menu-symbol svg { width: 23px; height: 23px; }
.menu-copy { flex: 1; min-width: 0; display: grid; gap: 3px; }
.menu-copy strong { font-size: 15px; font-weight: 600; }
.menu-copy small { font-size: 11px; color: #a9c5e9; }
.menu-count { display: inline-block; margin-left: 5px; font-size: 10px; color: var(--cyan); }
.menu-chevron { width: 18px; height: 18px; flex-shrink: 0; color: #90afd7; }
.menu-destination.active .menu-copy strong { color: var(--cyan); }
.presentation-switch { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 58px; padding: 10px 0; color: #b6d2f4; font-size: 12px; text-align: left; }
.presentation-switch svg { width: 18px; height: 18px; }
@keyframes menu-enter { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
@media (hover: hover) { .menu-destination:hover .menu-copy strong, .presentation-switch:hover, .menu-close:hover { color: var(--cyan); } }
@media (min-width: 900px) { .mobile-header { display: none; } }
</style>
