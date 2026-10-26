import request from './request'

const data = promise => promise.then(res => res.data)
export const tarotApi = {
  cards: () => data(request.get('/tarot/cards')),
  daily: () => data(request.get('/tarot/daily')),
  draw: clientRequestId => data(request.post('/tarot/daily/draw', { clientRequestId })),
  collection: () => data(request.get('/tarot/collection')),
  preferences: () => data(request.get('/tarot/preferences')),
  savePreferences: payload => data(request.put('/tarot/preferences', payload)),
  reading: clientRequestId => data(request.post('/tarot/readings', { clientRequestId })),
  latest: () => data(request.get('/tarot/readings/latest')),
  getReading: id => data(request.get(`/tarot/readings/${id}`)),
  analyze: (id, payload) => data(request.post(`/tarot/readings/${id}/analyses`, payload)),
  analysis: id => data(request.get(`/tarot/analyses/${id}`)),
}
