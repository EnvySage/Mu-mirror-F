import request from './request'

/**
 * 获取用户配置
 * @returns {Promise<{ code: number, data: SettingsVO }>}
 */
export function getSettings() {
  return request.get('/settings')
}

/**
 * 更新用户配置（部分更新，只传需要修改的字段）
 * @param {Object} data - 配置数据
 * @param {string} [data.aiProvider] - AI 提供商：openai/zhipu/qwen
 * @param {string} [data.aiApiKey] - AI API Key（明文，后端加密存储）
 * @param {string} [data.aiBaseUrl] - AI API 地址
 * @param {string} [data.aiModel] - AI 模型名称
 * @param {string} [data.embeddingSource] - Embedding 来源：local/api
 * @param {string} [data.embeddingApiKey] - Embedding API Key
 * @param {string} [data.embeddingModel] - Embedding 模型名
 * @param {string} [data.reviewMode] - 审核模式：manual/auto
 * @param {number} [data.mirrorLookback] - 镜子原文回看深度 0-3（默认 1；B 侧列上线前 PUT 可能被忽略，前端不报错）
 * @returns {Promise<{ code: number, data: SettingsVO }>}
 */
export function updateSettings(data) {
  return request.put('/settings', data)
}

/**
 * 测试 AI 连接
 * @returns {Promise<{ code: number, data: string }>}
 */
export function testAiConnection() {
  return request.post('/settings/test-ai')
}

/**
 * 测试数据库连接
 * @returns {Promise<{ code: number, data: string }>}
 */
export function testDbConnection() {
  return request.post('/settings/test-db')
}
