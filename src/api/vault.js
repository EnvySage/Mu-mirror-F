import request from './request'

/**
 * Vault 资产 API（toolcalling-vault-design.md 3.1 + fix-batch B6/B7 审查修复批）
 *
 * GET    /vault                列表（裸数组，每条带 quota_used_bytes/quota_bytes；永不拉 blob）
 * POST   /vault/upload         上传（multipart file + description 可空；B6 契约：路径带 /upload）
 * PUT    /vault/{id}           补正（body {description, category}——display_name 不在此端点，改名走 confirm 的 key）
 * DELETE /vault/{id}           删除（硬删除+级联清 chunks；Q2 防误删：
 *                              资产页路径必带 X-Confirm-Name=文件名后四位，不符 400；
 *                              对话内路径带 X-Confirm-Skip: inline 免后四位校验——有内联确认卡兜底）
 * POST   /vault/{id}/confirm   确认消化（§3.3b 确认门禁：body {key, description, category}，
 *                              更新元数据→生成 key chunk（embed，进通用检索）→全文 chunks embed
 *                              →digest_status=confirmed。异步 embed，HTTP 202 + data=最新文件卡）
 * GET    /vault/{id}/download  下载（非图片强制 attachment）
 * GET    /vault/{id}/preview   预览（图片/PDF 内嵌流）
 * GET    /vault/search         三层漏斗搜索（query/type/days，matchLayer=strong/weak/vague）
 */

/**
 * 拉取资产列表（裸数组；quota 在每条目上）
 * @returns {Promise<{ code: number, data: Array }>}
 */
export function getVaultItems() {
  return request.get('/vault')
}

/**
 * 上传文件（B6 契约：POST /vault/upload）
 * @param {File} file
 * @param {string} [description] 用户一句话提示（可空）
 * @returns {Promise<{ code: number, data: Object }>} data = 新资产文件卡
 */
export function uploadVaultItem(file, description) {
  const form = new FormData()
  form.append('file', file)
  if (description) form.append('description', description)
  return request.post('/vault/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/**
 * 补正描述/分类（display_name 改名不在本端点——走 confirmVaultItem 的 key）
 * @param {number|string} id
 * @param {{ description?: string, category?: string }} data
 */
export function updateVaultItem(id, data) {
  return request.put(`/vault/${id}`, data)
}

/**
 * 确认消化（§3.3b 确认门禁；确认是 embed 的准入条件）
 * @param {number|string} id
 * @param {{ key?: string, description?: string, category?: string }} [data] key=展示名（可空=保持现名）
 * @returns {Promise<{ code: number, data: Object }>} data = 最新文件卡（HTTP 202，异步 embed）
 */
export function confirmVaultItem(id, data = {}) {
  return request.post(`/vault/${id}/confirm`, data)
}

/**
 * 删除资产（Q2 三层防误删·后端配合）
 * @param {number|string} id
 * @param {{ confirmName?: string, inline?: boolean }} [opts]
 *   - 资产页路径：confirmName = 文件名后四位（不符后端 400「输入的文件名后四位不符」）
 *   - 对话内路径：inline = true → X-Confirm-Skip: inline（有内联确认卡兜底，免后四位）
 */
export function deleteVaultItem(id, opts = {}) {
  const headers = {}
  if (opts.inline) headers['X-Confirm-Skip'] = 'inline'
  else if (opts.confirmName) headers['X-Confirm-Name'] = opts.confirmName
  return request.delete(`/vault/${id}`, { headers })
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
 * 此处返回相对路径供直接拼接——真接口已就绪，window.open 自动带 cookie 场景外
 * 需 blob 方案时可切 downloadVaultItem）
 * @param {number|string} id
 */
export function vaultPreviewUrl(id) {
  return `/api/vault/${id}/preview`
}
