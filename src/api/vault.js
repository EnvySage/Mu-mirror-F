import request from './request'

/**
 * Vault 资产 API（toolcalling-vault-design.md 3.1 + B 第十一轮任务 4）
 *
 * GET    /vault               列表（含 quota 汇总；列表永不拉 blob）
 * POST   /vault               上传（multipart file + description 可空）
 * PUT    /vault/{id}          更新（display_name/description/category）
 * DELETE /vault/{id}          删除（级联清关联 chunks）
 * GET    /vault/{id}/download 下载（非图片强制 attachment）
 * GET    /vault/{id}/preview  预览（图片/PDF 内嵌流）
 *
 * 后端接口未就绪（当前 9050 /api/vault 返回 5006）：store USE_MOCK=true 时不走本文件，
 * 接口 ready 后 vault store 关 mock 即启用。
 */

/**
 * 拉取资产列表 + 配额
 * @returns {Promise<{ code: number, data: { items: Array, quota: { used_bytes: number, total_bytes: number } } }>}
 */
export function getVaultItems() {
  return request.get('/vault')
}

/**
 * 上传文件
 * @param {File} file
 * @param {string} [description] 用户一句话提示（可空）
 */
export function uploadVaultItem(file, description) {
  const form = new FormData()
  form.append('file', file)
  if (description) form.append('description', description)
  return request.post('/vault', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/**
 * 更新资产（回执"改一改"/资产页编辑）
 * @param {number|string} id
 * @param {{ display_name?: string, description?: string, category?: string }} data
 */
export function updateVaultItem(id, data) {
  return request.put(`/vault/${id}`, data)
}

/**
 * 删除资产（硬删除 + 二次确认在前端）
 * @param {number|string} id
 */
export function deleteVaultItem(id) {
  return request.delete(`/vault/${id}`)
}

/**
 * 下载原文件（blob）
 * @param {number|string} id
 */
export function downloadVaultItem(id) {
  return request.get(`/vault/${id}/download`, { responseType: 'blob' })
}

/**
 * 预览地址（图片/PDF 内嵌 <img>/<iframe> 用；带 token 的请求走 axios，
 * 此处返回相对路径供直接拼接——真接口 ready 后若需鉴权改走 blob 方案）
 * @param {number|string} id
 */
export function vaultPreviewUrl(id) {
  return `/api/vault/${id}/preview`
}
