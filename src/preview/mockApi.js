const userId = 'demo-visitor'
let nextRecordId = 804
let nextChunkId = 1404

function shanghaiParts(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  const date = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) - offsetDays))
  return {
    year: date.getUTCFullYear(),
    month: String(date.getUTCMonth() + 1).padStart(2, '0'),
    day: String(date.getUTCDate()).padStart(2, '0'),
  }
}

function demoDate(offsetDays = 0) {
  const { year, month, day } = shanghaiParts(offsetDays)
  return `${year}-${month}-${day}`
}

function demoTime(offsetDays = 0, hour = 9, minute = 20) {
  return `${demoDate(offsetDays)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`
}

function makeChunk(id, recordId, segment, title, contentType, mood, keywords, approved = false, todoApproved = false) {
  return {
    id,
    recordId,
    segment,
    metadata: { title, summary: segment, contentType, mood: [mood], keywords, taskStatus: contentType === 'todo' ? 'in_progress' : null },
    hasEmbedding: approved,
    aiMemoryApproved: approved,
    todoApproved,
  }
}

function makeRecord(id, offsetDays, hour, minute, content, status, chunks = []) {
  const createdAt = demoTime(offsetDays, hour, minute)
  return {
    id,
    userId,
    content,
    segments: chunks.map(chunk => chunk.segment),
    status,
    aiProcessingAuthorized: status === 'reviewing' || status === 'done',
    userReviewed: status === 'done',
    failReason: null,
    chunks,
    createdAt,
    updatedAt: createdAt,
  }
}

const records = [
  makeRecord(803, 0, 9, 18, '早上把拖了很久的作品集首页重新整理了一遍。先定下蓝色的主视觉，再把最重要的几个项目放到第一屏。虽然还没全部完成，但终于有了一个清楚的方向。', 'done', [
    makeChunk(1403, 803, '重新整理作品集首页，确定蓝色主视觉与内容层级。', '为作品集找到清晰方向', 'learning', 'focused', ['作品集', '设计'], true),
  ]),
  makeRecord(802, 0, 13, 42, '午饭后去河边走了二十分钟。最近一到下午就容易坐太久，散步回来感觉脑子清楚了一点。', 'record_only'),
  makeRecord(801, 1, 21, 5, '今天学完了 React 状态管理这一章，终于搞懂了为什么要把服务端状态和界面状态分开。明天把小练习补完。', 'reviewing', [
    makeChunk(1401, 801, '学习了 React 状态管理，并理解服务端状态与界面状态的区别。', '理解状态管理边界', 'learning', 'curious', ['React', '状态管理']),
    makeChunk(1402, 801, '明天把状态管理章节的小练习补完。', '补完章节练习', 'todo', 'determined', ['练习'], false, false),
  ]),
  makeRecord(800, 2, 18, 30, '和朋友聊了最近的工作节奏。发现自己给计划排得太满，一旦有一件事延迟就会觉得整天都失败了。', 'done', [
    makeChunk(1400, 800, '计划排得太满，单件延迟时容易把整天都判断为失败。', '重新看待计划与挫折', 'reflection', 'tired', ['节奏', '计划'], true),
  ]),
  makeRecord(799, 4, 8, 10, '今天状态一般，先把重要的事情记下来，晚点再决定要不要处理。', 'record_only'),
]

const summaries = [
  {
    recordId: 9802, summaryDate: demoDate(0),
    content: '今天你把一个重要的设计重新拉回了可推进的状态。你没有要求自己一次完成全部，只先确定主视觉和内容层级。下午的短暂散步也帮你从久坐里切换出来。\n\n这一天的节奏有停顿，也有继续向前的部分。',
    highlights: ['先找方向，再逐步补齐作品集', '主动用散步切换下午状态', '把完成标准拆小后更容易开始'],
    stats: { recordCount: 2 }, createdAt: demoTime(0, 22, 10),
  },
  {
    recordId: 9801, summaryDate: demoDate(1),
    content: '你在学习中找到了一个之前模糊的概念边界，也为明天留下了一个具体的小任务。和朋友交谈时，你观察到计划过满会放大挫折感；这个发现可以帮助你调整下一步的安排。',
    highlights: ['理解了服务端状态与界面状态的区别', '给明天留下一个可执行的练习', '注意到计划过满对情绪的影响'],
    stats: { recordCount: 2 }, createdAt: demoTime(1, 23, 5),
  },
  {
    recordId: 9800, summaryDate: demoDate(2),
    content: '今天你留意到了自己的工作节奏，并开始把长时间的专注切成更容易恢复的区段。',
    highlights: ['工作后留出恢复时间', '记录让状态变得可观察'],
    stats: { recordCount: 1 }, createdAt: demoTime(2, 22, 30),
  },
]

const profile = {
  id: 9902,
  snapshotType: 'monthly',
  periodMonth: demoDate(0).slice(0, 7),
  createdAt: demoTime(0, 22, 30),
  driftDistance: 0.18,
  overallSummary: '最近的你正在练习把目标拆小，也更愿意留意自己的节奏。遇到卡住的时候，你开始尝试先找到方向，而不是要求自己立刻完成。',
  moodAnalysis: '近一段时间，专注和好奇出现得更多。压力感通常和计划过满同时出现；散步、与朋友交流能帮助你重新整理思路。',
  learningAnalysis: '你持续投入前端与交互设计，近期开始主动整理作品集。把知识写成小练习，是你比较稳定的学习方式。',
  todoAnalysis: '你有几个清晰的小任务正在推进。把“补完练习”拆成一个独立步骤，比把整章学习视为一个任务更适合你。',
  rhythmAnalysis: '记录主要集中在上午开始和晚间回顾。下午短暂离开屏幕后，注意力更容易回来。',
  userTags: ['持续学习', '重视节奏', '善于复盘', '设计探索'],
}

const snapshots = [
  { id: 9902, snapshotType: 'monthly', periodMonth: demoDate(0).slice(0, 7), createdAt: demoTime(0, 22, 30), driftDistance: 0.18, overallSummary: profile.overallSummary },
  { id: 9901, snapshotType: 'monthly', periodMonth: demoDate(28).slice(0, 7), createdAt: demoTime(28, 21, 40), driftDistance: 0.11, overallSummary: '你持续投入学习，也在尝试为工作留出更稳定的节奏。' },
  { id: 9900, snapshotType: 'manual', createdAt: demoTime(18, 20, 15), driftDistance: null, overallSummary: '你正在寻找更适合自己的工作和休息节奏。' },
]

const todos = [
  { todoId: 602, title: '补完状态管理章节练习', currentStatus: 'in_progress', createdAt: demoTime(1, 21, 10), origin: { chunkId: 1402, recordId: 801, excerpt: '明天把小练习补完。', date: demoDate(1) }, evidence: [], pendingSuggestionCount: 0 },
  { todoId: 601, title: '整理作品集首页文案', currentStatus: 'not_started', createdAt: demoTime(3, 10, 10), origin: { chunkId: 1398, recordId: 798, excerpt: '周末先把项目介绍的文案列出来。', date: demoDate(3) }, evidence: [], pendingSuggestionCount: 0 },
]

// Synthetic fixture for the public UI preview; production keeps its API path.
const growthAxes = [
  ['knowledge', '学识', '学习与理解', 18], ['courage', '勇气', '面对困难', 9],
  ['action', '行动', '落实计划', 14], ['care', '体贴', '关怀自己与他人', 11],
  ['expression', '表达', '清晰表达', 7],
].map(([id, name, description, totalPoints]) => ({ id, name, description, totalPoints, stageIndex: 2 }))
const growthConfig = { thresholds: [0, 6, 18, 36, 60], manualMin: 1, manualMax: 6 }
growthAxes.forEach(axis => { axis.stageIndex = Math.max(0, growthConfig.thresholds.filter(limit => axis.totalPoints >= limit).length - 1) })
const growthEntries = []
const growthRequests = new Set()
const growthOverview = () => ({ axes: clone(growthAxes), totalPoints: growthAxes.reduce((sum, axis) => sum + axis.totalPoints, 0), config: clone(growthConfig), stage: { label: '正在积累' } })

const settings = {
  aiProvider: 'demo', aiProtocol: 'openai', aiApiKey: '', aiBaseUrl: '', aiModel: '预览模式',
  embeddingSource: 'local', embeddingBaseUrl: '', embeddingApiKey: '', embeddingModel: '预览模式',
  reviewMode: 'manual', autoReviewAvailable: false, ragHalfLife: 30, mirrorLookback: 1,
}

const glossary = {
  pending: [{ id: 710, term: '作品集', aliases: ['portfolio'], description: '你正在整理的个人项目展示页面。', status: 'pending', kind: 'new', evidence: '近期多次提到作品集首页。', sourceRecordId: 803, sourceChunkId: 1403 }],
  confirmed: [{ id: 709, term: '状态管理', aliases: ['state management'], description: '将服务端数据和界面交互状态分开维护的方式。', status: 'confirmed', sourceRecordId: 801, sourceChunkId: 1401 }],
  dismissed: [],
}

function makeStats() {
  const recordDaily = Array.from({ length: 30 }, (_, index) => ({
    date: demoDate(29 - index), count: [1, 0, 2, 1, 0, 1, 2, 1, 0, 2, 1, 1, 0, 1, 2, 1, 0, 2, 1, 1, 0, 2, 1, 0, 1, 2, 1, 0, 2, 2][index],
  }))
  const moodDaily = recordDaily.map((day, index) => ({
    date: day.date,
    moods: day.count ? [{ mood: ['happy', 'excited', 'calm', 'satisfied', 'grateful'][index % 5], count: Math.min(day.count, 2) }] : [],
  }))
  return {
    days: 30,
    recordDaily,
    moodDaily,
    hourDist: Array.from({ length: 24 }, (_, bucket) => ({ bucket, count: [8, 9, 13, 18, 20, 21].includes(bucket) ? 2 : 0 })),
    weekdayDist: Array.from({ length: 7 }, (_, bucket) => ({ bucket, count: [2, 1, 2, 1, 2, 3, 2][bucket] })),
    keywordTop: [{ keyword: '设计', count: 8 }, { keyword: '学习', count: 7 }, { keyword: '节奏', count: 5 }, { keyword: '作品集', count: 4 }, { keyword: '复盘', count: 3 }],
    todo: { total: 7, completed: 4, notStarted: 1, inProgress: 2, openItems: todos.map(item => ({ recordId: item.origin.recordId, title: item.title, summary: item.origin.excerpt, taskStatus: item.currentStatus })) },
  }
}

function parseBody(config) {
  if (typeof config.data !== 'string') return config.data || {}
  try { return JSON.parse(config.data) } catch { return {} }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function makeRecordFromText(content, authorized) {
  const id = ++nextRecordId
  const chunks = authorized
    ? [makeChunk(++nextChunkId, id, content, '一段新的观察', 'reflection', 'calm', ['日常'])]
    : []
  const record = makeRecord(id, 0, 16, 0, content, authorized ? 'reviewing' : 'record_only', chunks)
  records.unshift(record)
  return record
}

function envelope(data = null, message = '演示数据') {
  return { code: 200, message, data, timestamp: new Date().toISOString() }
}

function result(config, data = null) {
  return { data: envelope(data), status: 200, statusText: 'OK', headers: {}, config, request: {} }
}

function route(config) {
  const base = `${config.baseURL || ''}/${String(config.url || '').replace(/^\//, '')}`
  const parsed = new URL(base, window.location.origin)
  const path = parsed.pathname.replace(/\/$/, '') || '/'
  const method = String(config.method || 'get').toUpperCase()
  const params = { ...Object.fromEntries(parsed.searchParams.entries()), ...(config.params || {}) }
  const body = parseBody(config)

  if (path === '/api/auth/login' || path === '/api/auth/register') {
    return result(config, { token: 'demo-preview-token', tokenType: 'Bearer', expiresIn: 86400, user: { id: userId, username: 'Mirror 访客', createdAt: demoTime(0) } })
  }
  if (path === '/api/auth/status' || path === '/api/auth/me') return result(config, { id: userId, username: 'Mirror 访客', createdAt: demoTime(0) })
  if (path === '/api/records/calendar') {
    const month = String(params.month || demoDate().slice(0, 7))
    const marks = {}
    for (const record of records) {
      const day = String(record.createdAt).slice(0, 10)
      if (day.startsWith(month)) marks[day.slice(8, 10)] = (marks[day.slice(8, 10)] || 0) + 1
    }
    return result(config, marks)
  }
  if (path === '/api/records' && method === 'GET') {
    const list = records.filter(record => {
      const day = String(record.createdAt).slice(0, 10)
      return (!params.startDate || day >= params.startDate) && (!params.endDate || day <= params.endDate)
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return result(config, clone(list))
  }
  if (path === '/api/records' && method === 'POST') return result(config, clone(makeRecordFromText(body.content || '一条新的演示记录。', Boolean(body.requestAiProcessing))))

  const recordSuggestions = path.match(/^\/api\/records\/(\d+)\/suggestions$/)
  if (recordSuggestions) return result(config, { suggestions: [] })
  const organize = path.match(/^\/api\/records\/(\d+)\/organize$/)
  if (organize && method === 'POST') {
    const record = records.find(item => item.id === Number(organize[1]))
    if (record) Object.assign(record, makeRecord(record.id, 0, 16, 0, record.content, 'reviewing', [makeChunk(++nextChunkId, record.id, record.content, '一段新的观察', 'reflection', 'calm', ['日常'])]))
    return result(config, clone(record || null))
  }
  const editRaw = path.match(/^\/api\/records\/(\d+)\/content$/)
  if (editRaw && method === 'PUT') {
    const record = records.find(item => item.id === Number(editRaw[1]))
    if (record) { record.content = body.content || record.content; record.updatedAt = demoTime(0, 16, 10) }
    return result(config, clone(record || null))
  }
  const confirm = path.match(/^\/api\/records\/(\d+)\/confirm$/)
  if (confirm && method === 'PUT') {
    const record = records.find(item => item.id === Number(confirm[1]))
    if (record) {
      const memoryIds = new Set(body.aiMemoryChunkIds || [])
      const todoIds = new Set(body.todoChunkIds || [])
      record.chunks.forEach(chunk => {
        chunk.aiMemoryApproved = memoryIds.has(chunk.id)
        chunk.todoApproved = todoIds.has(chunk.id)
        chunk.hasEmbedding = chunk.aiMemoryApproved
      })
      record.userReviewed = true
      record.status = 'done'
      record.updatedAt = demoTime(0, 16, 15)
    }
    return result(config, clone(record || null))
  }
  const recordChunks = path.match(/^\/api\/records\/(\d+)\/chunks$/)
  if (recordChunks && method === 'POST') {
    const record = records.find(item => item.id === Number(recordChunks[1]))
    if (record) {
      const chunk = makeChunk(++nextChunkId, record.id, body.segment || '', '新片段', 'reflection', 'calm', [])
      record.chunks.push(chunk)
      record.segments = record.chunks.map(item => item.segment)
      return result(config, clone(chunk))
    }
  }
  const recordPath = path.match(/^\/api\/records\/(\d+)$/)
  if (recordPath && method === 'GET') return result(config, clone(records.find(item => item.id === Number(recordPath[1])) || null))
  if (recordPath && method === 'DELETE') {
    const index = records.findIndex(item => item.id === Number(recordPath[1]))
    if (index >= 0) records.splice(index, 1)
    return result(config)
  }
  const chunkPath = path.match(/^\/api\/chunks\/(\d+)$/)
  if (chunkPath) {
    for (const record of records) {
      const index = record.chunks.findIndex(item => item.id === Number(chunkPath[1]))
      if (index < 0) continue
      if (method === 'DELETE') record.chunks.splice(index, 1)
      else if (method === 'PUT') {
        const chunk = record.chunks[index]
        if (body.segment != null) chunk.segment = body.segment
        chunk.metadata = { ...chunk.metadata, ...body }
        chunk.aiMemoryApproved = false
        chunk.hasEmbedding = false
      }
      record.segments = record.chunks.map(item => item.segment)
      return result(config, method === 'DELETE' ? null : clone(record.chunks[index]))
    }
  }
  if (path === '/api/summaries/missing') return result(config, [])
  if (path === '/api/summaries') {
    const list = params.date ? summaries.filter(item => item.summaryDate === params.date) : summaries.filter(item => !params.before || item.summaryDate < params.before)
    return result(config, clone(params.limit ? list.slice(0, Number(params.limit)) : list))
  }
  if (path === '/api/mirror') return result(config, clone(profile))
  if (path === '/api/mirror/stats') return result(config, makeStats())
  if (path === '/api/mirror/snapshots') return result(config, clone(snapshots))
  const snapshot = path.match(/^\/api\/mirror\/snapshots\/(\d+)$/)
  if (snapshot) return result(config, { ...clone(profile), ...clone(snapshots.find(item => item.id === Number(snapshot[1])) || { id: Number(snapshot[1]) }) })
  if (path === '/api/mirror/generate' || path === '/api/mirror/generate-monthly') return result(config, clone(profile))
  if (path === '/api/settings' && method === 'GET') return result(config, clone(settings))
  if (path === '/api/settings' && method === 'PUT') { Object.assign(settings, body); return result(config, clone(settings)) }
  if (path === '/api/settings/test-ai') return result(config, '演示环境不连接 AI 服务')
  if (path === '/api/settings/test-db') return result(config, '演示环境未连接数据库')
  if (path === '/api/glossary') return result(config, clone(glossary))
  if (path === '/api/growth') return result(config, growthOverview())
  if (path === '/api/growth/axes') return result(config, { axes: clone(growthAxes), version: 1, locked: true, config: clone(growthConfig) })
  if (path === '/api/growth/entries') return result(config, clone(growthEntries))
  if (path === '/api/growth/manual' && method === 'POST') {
    const axis = growthAxes.find(item => item.id === body.dimensionId)
    const points = Number(body.points)
    if (!axis || !Number.isInteger(points) || points < growthConfig.manualMin || points > growthConfig.manualMax || !body.reason?.trim() || !body.requestId) throw new Error('请填写有效的维度、分值和原因。')
    if (!growthRequests.has(body.requestId)) {
      growthRequests.add(body.requestId)
      axis.totalPoints += points
      axis.stageIndex = Math.max(0, growthConfig.thresholds.filter(limit => axis.totalPoints >= limit).length - 1)
      growthEntries.unshift({ id: body.requestId, dimensionId: axis.id, dimensionName: axis.name, points, reason: body.reason, sourceType: 'manual', definitionVersion: 1, createdAt: new Date().toISOString() })
    }
    return result(config, growthOverview())
  }
  if (path === '/api/todos/pending-suggestions') return result(config, { suggestions: [] })
  if (path === '/api/todos/open-chain') return result(config, { chains: clone(todos) })
  if (path === '/api/todos') return result(config, { todos: clone(todos) })
  if (path === '/api/vault') return result(config, [{ id: 501, originalName: '灵感参考图.png', kind: 'image', fileType: 'png', sizeBytes: 1480000, digestStatus: 'confirmed', description: '用于作品集配色探索的参考图，虚构演示素材。', digestChunkCount: 1, quotaUsedBytes: 1480000, quotaBytes: 524288000, createdAt: demoTime(3, 15, 20) }])
  if (path === '/api/mirror/sessions') return result(config, [])
  const session = path.match(/^\/api\/mirror\/sessions\/([^/]+)$/)
  if (session && method === 'GET') return result(config, { id: session[1], messages: [] })
  if (path.startsWith('/api/')) return result(config)
  return result(config)
}

export async function demoApiAdapter(config) {
  await new Promise(resolve => setTimeout(resolve, 90))
  return route(config)
}
