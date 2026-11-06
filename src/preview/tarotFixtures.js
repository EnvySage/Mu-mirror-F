import cards from './tarotCatalog.json'

// Public preview only: ephemeral synthetic data, never used by the real API.
let preferences = { diaryEnabled: true, diaryDays: 7, todosEnabled: false, mirrorEnabled: false, version: 0 }
let daily = null, latest = null, counter = 0
const history = []
const orientation = () => counter % 2 ? 'upright' : 'reversed'
const dailyRequests = new Map(), readings = new Map(), analyses = new Map(), collected = new Map()
const day = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
const dailyView = draw => ({ serverDate: day(), timezone: 'Asia/Shanghai', draw })

export function tarotFixtureRoute(config, path, method, body, result) {
  if (path === '/api/tarot/cards') return result(config, { cards, catalogVersion: 'v2', activeCount: cards.length })
  if (path === '/api/tarot/daily') return result(config, dailyView(daily?.drawDate === day() ? daily : null))
  if (path === '/api/tarot/daily/draw') {
    const previous = dailyRequests.get(body.clientRequestId)
    if (previous) return result(config, dailyView(previous))
    let newlyCollected = false
    if (daily?.drawDate !== day()) {
      daily = { id: body.clientRequestId, drawDate: day(), cardId: cards[counter++ % cards.length].id, catalogVersion: 'v2', orientation: orientation(), createdAt: new Date().toISOString() }
      history.unshift({ ...daily, kind: 'daily', latestAnalysisId: null })
      const owned = collected.get(daily.cardId)
      newlyCollected = !owned
      collected.set(daily.cardId, { cardId: daily.cardId, firstObtainedAt: owned?.firstObtainedAt || daily.createdAt, dailyDrawCount: (owned?.dailyDrawCount || 0) + 1 })
    }
    dailyRequests.set(body.clientRequestId, daily)
    return result(config, { ...dailyView(daily), newlyCollected })
  }
  if (path === '/api/tarot/collection') return result(config, { activeCount: cards.length, unlockedCount: collected.size, entries: [...collected.values()] })
  if (path === '/api/tarot/history') {
    const limit = Math.max(1, Number(config.params?.limit || 20)), offset = Math.max(0, Number(config.params?.offset || 0))
    return result(config, { items: history.slice(offset, offset + limit).map(event => ({ ...event, latestAnalysisId: event.kind === 'question' ? readings.get(event.id)?.latestAnalysisId : null })), total: history.length, limit, offset, hasMore: offset + limit < history.length })
  }
  if (path === '/api/tarot/preferences') {
    if (method === 'PUT') preferences = { ...body, version: preferences.version + 1 }
    return result(config, { ...preferences })
  }
  if (path === '/api/tarot/readings' && method === 'POST') {
    latest = readings.get(body.clientRequestId)
    if (!latest) {
      latest = { readingId: body.clientRequestId, cardId: cards[counter++ % cards.length].id, catalogVersion: 'v2', orientation: orientation(), createdAt: new Date().toISOString(), latestAnalysisId: null }
      readings.set(body.clientRequestId, latest)
      history.unshift({ ...latest, id: latest.readingId, kind: 'question', drawDate: day() })
    }
    return result(config, { ...latest })
  }
  if (path === '/api/tarot/readings/latest') return result(config, latest ? { ...latest } : null)
  const reading = path.match(/^\/api\/tarot\/readings\/([^/]+)$/)
  if (reading) return result(config, { ...readings.get(reading[1]) })
  const submit = path.match(/^\/api\/tarot\/readings\/([^/]+)\/analyses$/)
  if (submit && method === 'GET') return result(config, [...analyses.values()].filter(item => item.readingId === submit[1]).reverse().map(({ analysisId, readingId, status, question, createdAt, completedAt }) => ({ analysisId, readingId, status, question, createdAt, completedAt })))
  if (submit && method === 'POST') {
    if (!analyses.has(body.clientRequestId)) {
      const draw = readings.get(submit[1]), card = cards.find(c => c.id === draw.cardId)
      analyses.set(body.clientRequestId, { analysisId: body.clientRequestId, readingId: draw.readingId, status: 'completed', question: body.question, options: body.options, createdAt: new Date().toISOString(), completedAt: new Date().toISOString(), text: draw.orientation === 'reversed' ? `${card.reversedMeaning}\n${card.reversedAction}` : `${card.meaning}\n${card.action}`, sources: [], notices: ['演示牌义示例，未调用 AI，也未读取个人资料。'] })
      draw.latestAnalysisId = body.clientRequestId
    }
    return result(config, analyses.get(body.clientRequestId))
  }
  const analysis = path.match(/^\/api\/tarot\/analyses\/([^/]+)$/)
  if (analysis) return result(config, analyses.get(analysis[1]))
  throw new Error('此演示接口暂未提供')
}
