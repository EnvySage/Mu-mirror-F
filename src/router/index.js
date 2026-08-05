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
          path: 'records',
          name: 'records',
          component: () => import('@/views/RecordsView.vue'),
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

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // 初始化认证状态（仅首次）
  if (!authStore._initialized) {
    await authStore.init()
    authStore._initialized = true
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login' })
  } else if (to.path.startsWith('/auth') && authStore.isAuthenticated) {
    next({ name: 'records' })
  } else {
    next()
  }
})

export default router
