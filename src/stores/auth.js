import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getStorage, setStorage, removeStorage } from '@/utils/storage'
import { login as apiLogin, register as apiRegister } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(getStorage('token') || '')
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const loading = ref(false)
  const _initialized = ref(false)

  /**
   * 初始化：从本地存储恢复登录状态
   */
  function init() {
    const savedToken = getStorage('token')
    const savedUser = getStorage('user')

    if (savedToken && savedUser) {
      token.value = savedToken
      try {
        user.value = JSON.parse(savedUser)
      } catch {
        logout()
      }
    }
    _initialized.value = true
  }

  /**
   * 登录
   * @param {string} username
   * @param {string} password
   * @returns {Promise<void>}
   */
  async function login(username, password) {
    loading.value = true
    try {
      const res = await apiLogin({ username, password })
      const { token: newToken, user: userData } = res.data

      token.value = newToken
      user.value = userData

      setStorage('token', newToken)
      setStorage('user', JSON.stringify(userData))
    } finally {
      loading.value = false
    }
  }

  /**
   * 注册
   * @param {string} username
   * @param {string} password
   * @returns {Promise<void>}
   */
  async function register(username, password) {
    loading.value = true
    try {
      await apiRegister({ username, password })
      // 注册成功后自动登录
      await login(username, password)
    } finally {
      loading.value = false
    }
  }

  /**
   * 退出登录
   */
  function logout() {
    token.value = ''
    user.value = null
    removeStorage('token')
    removeStorage('user')
  }

  return {
    user,
    token,
    isAuthenticated,
    loading,
    _initialized,
    init,
    login,
    register,
    logout,
  }
})
