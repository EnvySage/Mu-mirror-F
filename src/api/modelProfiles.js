import request from './request'

export const getModelProfiles = () => request.get('/settings/model-profiles')
export const createModelProfile = data => request.post('/settings/model-profiles', data)
export const updateModelProfile = (id, data) => request.put(`/settings/model-profiles/${encodeURIComponent(id)}`, data)
export const deleteModelProfile = id => request.delete(`/settings/model-profiles/${encodeURIComponent(id)}`)
export const activateModelProfile = id => request.post(`/settings/model-profiles/${encodeURIComponent(id)}/activate`)
export const testModelDraft = data => request.post('/settings/test-ai/draft', data, { timeout: 90000 })
