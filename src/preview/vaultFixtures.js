import manifest from './vaultManifest.json'
import { categoryOf } from '@/constants/fileTypes'

const items = manifest.map((item, index) => ({ ...item, createdAt: new Date(Date.now() - index * 86400000).toISOString(), digestChunkCount: 1 }))
const uploaded = new Map()
let nextId = 600
const metadata = item => ({ ...item, quotaUsedBytes: items.reduce((sum, item) => sum + item.sizeBytes, 0), quotaBytes: 524288000 })

// Preview mode only: real local files, with session-local uploads for UI checks.
export async function vaultFixtureRoute(config, path, method, body, result) {
  if (path === '/api/vault' && method === 'GET') return result(config, items.map(metadata))
  if (path === '/api/vault/upload' && method === 'POST') {
    const file = config.data.get('file')
    if (!(file instanceof Blob)) throw new Error('没有选择有效文件')
    const ext = file.name.split('.').pop().toLowerCase()
    const item = { id: nextId++, originalName: file.name, displayName: file.name, fileType: ext, kind: categoryOf(ext), sizeBytes: file.size, description: config.data.get('description') || '', digestStatus: 'extracted', createdAt: new Date().toISOString(), digestChunkCount: 0 }
    items.unshift(item); uploaded.set(item.id, file)
    return result(config, metadata(item))
  }
  const match = path.match(/^\/api\/vault\/(\d+)(?:\/(preview|download|confirm))?$/)
  if (!match) return result(config, null)
  const item = items.find(item => item.id === Number(match[1]))
  if (!item) throw new Error('文件不存在或已移除')
  if (['preview', 'download'].includes(match[2]) && method === 'GET') {
    let blob = uploaded.get(item.id)
    if (!blob) {
      const response = await fetch(import.meta.env.BASE_URL + item.url.replace(/^\//, ''), { signal: config.signal })
      if (!response.ok) throw new Error('演示文件读取失败')
      blob = await response.blob()
    }
    return { data: blob, status: 200, statusText: 'OK', headers: {}, config, request: {} }
  }
  if (method === 'PUT' || match[2] === 'confirm') {
    if (body.description != null) item.description = body.description
    if (body.key) item.displayName = body.key
    if (match[2] === 'confirm') item.digestStatus = 'confirmed'
    return result(config, metadata(item))
  }
  if (method === 'DELETE') {
    const confirmation = config.headers?.get?.('X-Confirm-Name') || config.headers?.['X-Confirm-Name']
    const inline = config.headers?.get?.('X-Confirm-Skip') === 'inline'
    if (!inline && String(confirmation).toUpperCase() !== item.originalName.slice(-4).toUpperCase()) throw new Error('文件名确认不匹配')
    items.splice(items.indexOf(item), 1); uploaded.delete(item.id)
    return result(config, null)
  }
  return result(config, metadata(item))
}
