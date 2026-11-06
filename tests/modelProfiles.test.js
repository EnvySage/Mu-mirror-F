import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MODEL_PROVIDERS, profileDraft, profilePayload, validateProfile } from '../src/utils/modelProfiles.js'

const valid = { name: '日常', aiProvider: 'custom', aiProtocol: 'openai', aiBaseUrl: 'https://example.com/v1', aiModel: 'account-model', aiApiKey: 'new-secret' }

test('existing profile never copies a returned secret into its editable draft', () => {
  const draft = profileDraft({ name: 'My model', ai_provider: 'qwen', ai_protocol: 'openai', ai_base_url: 'https://example.com', ai_model: 'model', ai_api_key: 'masked-key', has_api_key: true })
  assert.equal(draft.aiApiKey, '')
  assert.equal(draft.aiModel, 'model')
})

test('blank keys retain a saved credential but cannot create or reuse unreadable credentials', () => {
  const blank = { ...valid, aiApiKey: '' }
  assert.equal(validateProfile(blank, { has_api_key: true }), '')
  assert.equal(validateProfile(blank), '请输入 API Key')
  assert.equal(validateProfile(blank, { has_api_key: true, api_key_needs_reentry: true }), '请输入 API Key')
  assert.equal(profilePayload(blank).aiApiKey, '')
})

test('draft test permits unnamed configuration and requires actual model ID and service root', () => {
  assert.equal(validateProfile({ ...valid, name: '' }, null, { test: true }), '')
  assert.match(validateProfile({ ...valid, name: '' }), /名称/)
  assert.match(validateProfile({ ...valid, aiModel: '' }), /模型 ID/)
  for (const aiBaseUrl of ['', 'javascript:alert(1)', 'https://user:secret@example.com/v1', 'https://example.com/v1?key=secret']) {
    assert.match(validateProfile({ ...valid, aiBaseUrl }), /有效/)
  }
  assert.match(validateProfile({ ...valid, aiBaseUrl: 'https://example.com/v1/chat/completions' }), /基础地址/)
})

test('provider presets cover all required providers without pinning an account model', () => {
  assert.deepEqual(MODEL_PROVIDERS.map(provider => provider.id), ['deepseek', 'zhipu', 'qwen', 'moonshot', 'doubao', 'openai', 'anthropic', 'custom'])
  assert.equal(profileDraft().aiModel, '')
  assert.equal(MODEL_PROVIDERS.find(provider => provider.id === 'anthropic').protocol, 'anthropic')
  assert.ok(MODEL_PROVIDERS.filter(provider => provider.id !== 'custom').every(provider => provider.docs.startsWith('https://') && provider.baseUrl.startsWith('https://')))
})
