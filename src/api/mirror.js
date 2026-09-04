import request from './request'

/**
 * 查询最新画像快照（优先 manual，其次 monthly；从未生成时返回空 VO id=null）
 * @returns {Promise<{ code: number, data: import('@/stores/mirror').MirrorProfile }>}
 */
export function getMirror() {
  return request.get('/mirror')
}

/**
 * 生成 manual 画像快照（阻塞数秒到数十秒，调用方需 loading 态）
 * @returns {Promise<{ code: number, data: import('@/stores/mirror').MirrorProfile }>}
 */
export function generateMirror() {
  // 画像生成阻塞数十秒（五维统计+LLM+Embedding），绕开 axios 全局 15s 超时
  return request.post('/mirror/generate', null, { timeout: 120000 })
}
