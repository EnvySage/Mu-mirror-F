import axios from 'axios'
import { getStorage, removeStorage } from '@/utils/storage'

/**
 * 将 camelCase 转为 snake_case
 * @param {string} str
 * @returns {string}
 */
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

/**
 * 递归转换对象的 key 从 camelCase 到 snake_case
 *
 * 豁免：chunk metadata 是业务 JSON（key 契约恒为 camelCase：contentType/taskStatus），
 * 全局转换会把它变成 content_type/task_status，导致审核卡片读不到内容类型/任务状态
 * （metadata 由 AI 分类与 PUT /chunks/{id} 写入，键名不参与列名映射）。
 * @param {any} data
 * @returns {any}
 */
function convertKeys(data) {
  if (Array.isArray(data)) {
    return data.map(item => convertKeys(item))
  }
  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    if (isMetadataObject(data)) return data
    const converted = {}
    for (const [key, value] of Object.entries(data)) {
      const snakeKey = toSnakeCase(key)
      converted[snakeKey] = convertKeys(value)
    }
    return converted
  }
  return data
}

/**
 * 判定是否为 chunk metadata 业务 JSON：
 * 特征 = 含 contentType / taskStatus 等 metadata 专属键且无 id 字段
 * （ChunkVO 自身有 id，metadata 没有——用它区分 chunk 与其 metadata）。
 * @param {Object} data
 * @returns {boolean}
 */
function isMetadataObject(data) {
  const keys = Object.keys(data)
  const metaKey = keys.find(k => k === 'contentType' || k === 'taskStatus')
  return metaKey !== undefined && !('id' in data)
}

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
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截器：统一处理错误 + 字段名转换
request.interceptors.response.use(
  (response) => {
    const res = response.data
    // 后端统一返回 { code, message, data, timestamp }（R 包装无 success 字段）
    // BusinessException 返回 HTTP 200 + code != 200，必须按 code 判错
    if (res.code !== undefined && res.code !== 200) {
      const err = new Error(res.message || '请求失败')
      err.code = res.code
      err.data = res.data
      return Promise.reject(err)
    }
    // 转换 data 中的 camelCase 为 snake_case
    if (res.data !== undefined) {
      res.data = convertKeys(res.data)
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
