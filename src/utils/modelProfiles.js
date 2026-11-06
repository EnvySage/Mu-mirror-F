// Protocol and service roots checked against each provider's official docs on 2026-11-04.
// Model IDs are deliberately entered by the user: availability depends on their account.
export const MODEL_PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', mark: 'D', protocol: 'openai', baseUrl: 'https://api.deepseek.com', docs: 'https://api-docs.deepseek.com/', note: '填写控制台中可用的模型 ID。' },
  { id: 'zhipu', name: '智谱 GLM', mark: 'Z', protocol: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', docs: 'https://docs.bigmodel.cn/cn/guide/develop/openai/introduction', note: '使用智谱开放平台的 API Key 与模型 ID。' },
  { id: 'qwen', name: '通义千问', mark: 'Q', protocol: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', docs: 'https://help.aliyun.com/en/model-studio/base-url', note: '预填北京地域通用地址；其他地域、工作空间或 Coding Plan 请使用控制台对应地址。' },
  { id: 'moonshot', name: 'Kimi', mark: 'K', protocol: 'openai', baseUrl: 'https://api.moonshot.cn/v1', docs: 'https://platform.kimi.com/docs/guide/migrating-from-openai-to-kimi', note: '使用 Kimi 开放平台的模型 ID；地址需与 API Key 所属平台一致。' },
  { id: 'doubao', name: '豆包', mark: '豆', protocol: 'openai', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', docs: 'https://console.volcengine.com/ark/region%3Acn-beijing/docs/ai-tools-other-tools', note: '填写火山方舟控制台允许调用的模型 ID 或推理接入点 ID。' },
  { id: 'openai', name: 'OpenAI', mark: 'O', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', docs: 'https://developers.openai.com/api/reference/overview', note: '使用支持 Chat Completions 的模型 ID。' },
  { id: 'anthropic', name: 'Anthropic', mark: 'A', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com', docs: 'https://platform.claude.com/docs/en/api/messages', note: '使用 Claude API 的模型 ID。' },
  { id: 'custom', name: '自定义服务', mark: '+', protocol: 'openai', baseUrl: '', docs: null, note: '填写服务商提供的基础地址，并选择对应协议。' },
]

export function modelProvider(id) {
  return MODEL_PROVIDERS.find(provider => provider.id === id) || MODEL_PROVIDERS.at(-1)
}

export function profileDraft(profile = null) {
  return {
    name: profile?.name || '',
    aiProvider: profile?.ai_provider || 'deepseek',
    aiProtocol: profile?.ai_protocol || 'openai',
    aiBaseUrl: profile?.ai_base_url || (profile ? '' : MODEL_PROVIDERS[0].baseUrl),
    aiModel: profile?.ai_model || '',
    aiApiKey: '',
  }
}

export function profilePayload(draft) {
  return Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
}

export function validateProfile(draft, profile = null, { test = false } = {}) {
  if (!test && !draft.name.trim()) return '请为这份配置取一个名称'
  if (!['openai', 'anthropic'].includes(draft.aiProtocol)) return '请选择模型协议'
  try {
    const url = new URL(draft.aiBaseUrl)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error()
  } catch { return '请填写有效的 HTTP 或 HTTPS 基础地址，不要附带密钥或查询参数' }
  if (/\/(chat\/completions|messages)\/?$/.test(draft.aiBaseUrl)) return '请填写基础地址，去掉末尾的 /chat/completions 或 /messages'
  if (!draft.aiModel.trim()) return '请填写服务商提供的模型 ID'
  if (!draft.aiApiKey.trim() && (!profile?.has_api_key || profile?.api_key_needs_reentry)) return '请输入 API Key'
  return ''
}

export function draftSignature(draft) {
  return JSON.stringify(profilePayload(draft))
}
