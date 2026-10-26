import { defineAsyncComponent } from 'vue'

const sharedPages = {
  tarot: defineAsyncComponent(() => import('@/views/TarotView.vue')),
  chat: defineAsyncComponent(() => import('@/views/ChatView.vue')),
  records: defineAsyncComponent(() => import('@/views/RecordsView.vue')),
  mirror: defineAsyncComponent(() => import('@/views/MirrorView.vue')),
  calendar: defineAsyncComponent(() => import('@/views/CalendarView.vue')),
  vault: defineAsyncComponent(() => import('@/views/VaultView.vue')),
  settings: defineAsyncComponent(() => import('@/views/SettingsView.vue')),
}
// Keep one business page instance for each route. The two route maps intentionally
// share page identity; their desktop/mobile shells and CSS provide presentation.
const desktop = { ...sharedPages }
const mobile = { ...sharedPages }

export function resolvePresentationPage(mode, routeName) {
  return (mode === 'mobile' ? mobile : desktop)[routeName] || null
}
