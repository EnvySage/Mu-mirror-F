import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getStorage, setStorage, removeStorage } from '@/utils/storage'
import { login as apiLogin, register as apiRegister } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(getStorage('token') || '')
  const tokenExpires = ref(getStorage('token_expires') || '')
  const isAuthenticated = computed(() => !!token.value && !!user.value && !isTokenExpired())
  const loading = ref(false)
  const _initialized = ref(false)

  /**
   * 检查 Token 是否已过期
   */
  function isTokenExpired() {
    if (!tokenExpires.value) return false
    return Date.now() >= parseInt(tokenExpires.value)
  }

  /**
   * 初始化：从本地存储恢复登录状态
   */
  function init() {
    const savedToken = getStorage('token')
    const savedUser = getStorage('user')
    const savedExpires = getStorage('token_expires')

    if (savedToken && savedUser) {
      // 检查 Token 是否已过期
      if (savedExpires && Date.now() >= parseInt(savedExpires)) {
        // Token 已过期，清除登录状态
        logout()
        _initialized.value = true
        return
      }

      token.value = savedToken
      tokenExpires.value = savedExpires
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
      const { token: newToken, user: userData, expiresIn } = res.data

      token.value = newToken
      user.value = userData

      // 计算过期时间
      if (expiresIn) {
        const expiresAt = Date.now() + expiresIn * 1000
        tokenExpires.value = expiresAt.toString()
        setStorage('token_expires', expiresAt.toString())
      }

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
    tokenExpires.value = ''
    user.value = null
    removeStorage('token')
    removeStorage('user')
    removeStorage('token_expires')
  }

  return {
    user,
    token,
    tokenExpires,
    isAuthenticated,
    loading,
    _initialized,
    isTokenExpired,
    init,
    login,
    register,
    logout,
  }
})
