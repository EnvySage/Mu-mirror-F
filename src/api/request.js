import axios from 'axios'
import { getStorage, removeStorage } from '@/utils/storage'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：自动携带 Token
request.interceptors.request.use(
  (config) => {
    const token = getStorage('token')
    if (token) {
      config.headers.Authorization = token
    }
    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截器：统一处理错误
request.interceptors.response.use(
  (response) => {
    const res = response.data
    // 后端统一返回 { code, message, data, success, timestamp }
    if (res.success === false) {
      const err = new Error(res.message || '请求失败')
      err.code = res.code
      return Promise.reject(err)
    }
    return res
  },
  (error) => {
    // 401 未授权：清除 Token，跳转登录
    if (error.response?.status === 401) {
      removeStorage('token')
      removeStorage('user')
      removeStorage('token_expires')
      window.location.href = '/auth/login'
    }
    const msg = error.response?.data?.message || error.message || '网络错误'
    const err = new Error(msg)
    err.code = error.response?.status
    return Promise.reject(err)
  },
)

export default request
