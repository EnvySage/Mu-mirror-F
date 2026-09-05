import request from './request'

/**
 * 个人词典 API（lexicon-design.md 5c，B Agent 提供）
 *
 * GET    /glossary              三组分好 { pending, confirmed, dismissed }
 * POST   /glossary              手动新增（直接 confirmed）
 * PUT    /glossary/{id}         编辑（term/aliases/description）
 * DELETE /glossary/{id}         删除
 * POST   /glossary/{id}/confirm 确认（pending/dismissed → confirmed）
 * POST   /glossary/{id}/dismiss 忽略（→ dismissed，30 天后可重新浮现）
 * POST   /glossary/extract      手动触发抽取（懒人立即出候选）
 */

/**
 * 拉取词条三组
 * @returns {Promise<{ code: number, data: { pending: Array, confirmed: Array, dismissed: Array } }>}
 */
export function getGlossary() {
  return request.get('/glossary')
}

/**
 * 手动新增词条（直接 confirmed）
 * @param {{ term: string, aliases: string[], description: string }} data
 */
export function addTerm(data) {
  return request.post('/glossary', data)
}

/**
 * 编辑词条（改一改 / 更新解释）
 * @param {number|string} id
 * @param {{ term: string, aliases: string[], description: string }} data
 */
export function updateTerm(id, data) {
  return request.put(`/glossary/${id}`, data)
}

/**
 * 删除词条
 * @param {number|string} id
 */
export function deleteTerm(id) {
  return request.delete(`/glossary/${id}`)
}

/**
 * 确认词条
 * @param {number|string} id
 */
export function confirmTerm(id) {
  return request.post(`/glossary/${id}/confirm`)
}

/**
 * 忽略词条
 * @param {number|string} id
 */
export function dismissTerm(id) {
  return request.post(`/glossary/${id}/dismiss`)
}

/**
 * 手动触发抽取（近 14 天 confirmed chunks 语料 → pending 候选）
 */
export function extractTerms() {
  return request.post('/glossary/extract')
}
