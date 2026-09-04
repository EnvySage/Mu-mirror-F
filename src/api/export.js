/**
 * 数据导出（裁决 #19：只导出不导入）
 *
 * 走原生 fetch 而非 axios：需要 blob 下载 + 透传 Content-Disposition 文件名，
 * 且 axios 全局拦截器按 JSON R 包装解析会破坏二进制流。
 */

import { getStorage, removeStorage } from '@/utils/storage'

/**
 * 触发浏览器下载（a[download] + objectURL）
 * @param {Blob} blob
 * @param {string} filename
 */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * 从 Content-Disposition 提取文件名（后端格式：attachment; filename="mu-mirror-export_20260903_120000.json"）
 * @param {string|null} header
 * @param {string} fallback
 * @returns {string}
 */
function parseFilename(header, fallback) {
  if (!header) return fallback
  const m = header.match(/filename="?([^";]+)"?/i)
  return m ? m[1] : fallback
}

/**
 * 导出并下载（GET /api/export/json | /api/export/markdown）
 * @param {'json' | 'markdown'} kind
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function exportData(kind) {
  const isJson = kind === 'json'
  const fallbackName = isJson ? 'mu-mirror-export.json' : 'mu-mirror-export.md'
  try {
    const token = getStorage('token')
    const res = await fetch(`/api/export/${isJson ? 'json' : 'markdown'}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.status === 401) {
      removeStorage('token')
      removeStorage('user')
      removeStorage('token_expires')
      window.location.href = '/auth/login'
      return { ok: false, message: '登录已过期' }
    }
    if (!res.ok) throw new Error(`export http ${res.status}`)
    const blob = await res.blob()
    saveBlob(blob, parseFilename(res.headers.get('Content-Disposition'), fallbackName))
    return { ok: true, message: '导出完成' }
  } catch (err) {
    console.error('Export failed:', err)
    return { ok: false, message: '导出失败 · 请检查服务是否可用' }
  }
}
