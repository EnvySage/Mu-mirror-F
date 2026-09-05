import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/components/templates/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/records' },
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
    return { name: 'login' }
  }
  if (to.path.startsWith('/auth') && authStore.isAuthenticated) {
    return { name: 'records' }
  }
  // 放行：返回 undefined / true 均可，显式 true 更可读
  return true
})

export default router
