import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

function safeInternalPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null
}

function preferredHome(to = null) {
  const deepLink = safeInternalPath(to?.query?.redirect)
  if (deepLink) return deepLink
  const selected = window.localStorage.getItem('mirror.home-page')
  if (selected === 'chat' || selected === 'records') return `/${selected}`
  const override = window.localStorage.getItem('mirror.presentation-mode')
  const mobile = override === 'mobile' || (override !== 'desktop' && window.innerWidth < 900)
  return mobile ? '/chat' : '/records'
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/components/templates/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: preferredHome },
        {
          path: 'records/:date?',
          name: 'records',
          component: () => import('@/views/RecordsView.vue'),
          props: true,
        },
        {
          path: 'calendar',
          name: 'calendar',
          component: () => import('@/views/CalendarView.vue'),
        },
        {
          path: 'mirror',
          name: 'mirror',
          component: () => import('@/views/MirrorView.vue'),
        },
        {
          path: 'chat',
          name: 'chat',
          component: () => import('@/views/ChatView.vue'),
        },
        {
          path: 'vault',
          name: 'vault',
          component: () => import('@/views/VaultView.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
        },
      ],
    },
    {
      path: '/auth',
      component: () => import('@/components/templates/AuthLayout.vue'),
      children: [
        { path: '', redirect: '/auth/login' },
        {
          path: 'login',
          name: 'login',
          component: () => import('@/views/auth/WelcomeView.vue'),
        },
      ],
    },
  ],
})

// Navigation guard（vue-router 4 返回值风格：弃用第三参数 next()）
router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  // 初始化认证状态（仅首次）
  if (!authStore._initialized) {
    await authStore.init()
    authStore._initialized = true
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }
  if (to.path.startsWith('/auth') && authStore.isAuthenticated) {
    return safeInternalPath(to.query.redirect) || preferredHome()
  }
  // 放行：返回 undefined / true 均可，显式 true 更可读
  return true
})

export default router
