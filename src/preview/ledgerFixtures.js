import { shanghaiToday, shiftDay } from '@/utils/ledger'

const today = shanghaiToday()
const day = offset => shiftDay(today, offset)
const categories = [
  { id: 'food', name: '餐饮', preset: true }, { id: 'transport', name: '交通', preset: true },
  { id: 'study', name: '学习', preset: true }, { id: 'work', name: '工作', preset: true },
  { id: 'life', name: '日用', preset: true }, { id: 'other', name: '其他', preset: true },
]
const uuid = () => crypto.randomUUID()
const row = (kind, amount, categoryId, occurredOn = today, note = '') => ({ id: uuid(), kind, amount, categoryId, occurredOn, note })
const record = (title, flows, description = '') => ({ id: uuid(), title, description, recordDate: flows[0].occurredOn, flows, diaryIds: [] })
const entries = [
  record('和朋友吃晚餐', [row('EXPENSE', 228, 'food', today, '我先付'), row('RECOVERY', 114, 'food', today, '朋友的 AA 款')], '聊到打烊才散场。'),
  record('下班坐地铁', [row('EXPENSE', 5, 'transport')]),
  record('收到了稿费', [row('INCOME', 420, 'work')]),
  record('一本装帧漂亮的书', [row('EXPENSE', 68, 'study', day(-1))]),
  record('午餐便当', [row('EXPENSE', 25.5, 'food', day(-2))]),
  record('买了新一周的食材', [row('EXPENSE', 134, 'life', day(-4))]),
  record('去图书馆', [row('EXPENSE', 8, 'transport', day(-5))]),
  record('周末的两杯咖啡', [row('EXPENSE', 47, 'food', day(-6))]),
]
entries[0].diaryIds.push(802)
const wishes = [
  { id: uuid(), title: '买下惦记很久的书', kind: 'ONCE', metric: 'SAVINGS', state: 'ACTIVE', windowMode: 'ROLLING', windowDays: 30, startOn: day(-27), periodStart: day(-27), periodEnd: day(2), targetAmount: 200, budget: 1000, price: 168, progressAmount: 144, progressRatio: .72, categoryBudgets: {} },
  { id: uuid(), title: '周末去看一场电影', kind: 'RECURRING', metric: 'INCOME', state: 'ACTIVE', windowMode: 'FIXED', windowDays: 7, startOn: day(-4), periodStart: day(-4), periodEnd: day(2), targetAmount: 700, progressAmount: 420, progressRatio: .6, categoryBudgets: {} },
]
const rent = { id: uuid(), title: '音乐订阅', amount: 15, categoryId: 'life', interval: 'MONTH', intervalCount: 1, startOn: today }
const recurring = [rent]
const due = [{ id: uuid(), ruleId: rent.id, title: rent.title, amount: rent.amount, categoryId: rent.categoryId, dueOn: today, state: 'PENDING' }]
const events = [{ id: uuid(), wishId: wishes[1].id, title: '周末去看一场电影', achievedOn: day(-7), periodStart: day(-11), periodEnd: day(-7), amount: 870, targetAmount: 700, recordIds: [entries[2].id] }]
const requests = new Map(), actionRequests = new Map(), actions = new Map()

function totals(flows) {
  const sums = { expense: 0, income: 0, recovery: 0, flowCount: flows.length }
  const keys = { EXPENSE: 'expense', INCOME: 'income', RECOVERY: 'recovery' }
  for (const flow of flows) if (keys[flow.kind]) sums[keys[flow.kind]] += Number(flow.amount)
  return { ...sums, netExpense: sums.expense - sums.recovery }
}
function view(entry) {
  return {
    ...entry, ...totals(entry.flows),
    flows: entry.flows.map(flow => ({ ...flow, categoryName: categories.find(category => category.id === flow.categoryId)?.name || '其他' })),
  }
}
function between(date, params) { return (!params.start || date >= params.start) && (!params.end || date <= params.end) }
function list(params) {
  const q = String(params.q || '').toLowerCase()
  return entries.filter(entry => entry.flows.some(flow => between(flow.occurredOn, params))
    && (!q || [entry.title, entry.description, ...entry.flows.map(flow => flow.note)].join(' ').toLowerCase().includes(q)))
    .slice(0, Number(params.limit) || 100).map(view)
}
function create(input) {
  if (input.requestId && requests.has(input.requestId)) return requests.get(input.requestId)
  const entry = record(input.title || '今日账目', input.flows.map(flow => ({ ...flow, id: uuid(), occurredOn: flow.occurredOn || today })), input.description)
  entries.unshift(entry)
  if (input.requestId) requests.set(input.requestId, entry)
  return entry
}
const answer = (config, blob) => ({ data: blob, status: 200, statusText: 'OK', headers: {}, config, request: {} })
const asCsv = values => values.map(value => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(',')
function exportRecords(config, params) {
  const records = list({ ...params, limit: 1000 })
  if (params.format === 'json') return answer(config, new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }))
  const rows = [['账目', '日期', '性质', '金额', '分类', '备注']]
  records.forEach(entry => entry.flows.filter(flow => between(flow.occurredOn, params)).forEach(flow => rows.push([entry.title, flow.occurredOn, flow.kind, flow.amount, flow.categoryName, flow.note])))
  return answer(config, new Blob(['\uFEFF', rows.map(asCsv).join('\r\n')], { type: 'text/csv' }))
}

export function ledgerFixtureRoute(config, path, method, params, body, result) {
  const respond = value => result(config, structuredClone(value))
  if (path === '/api/assistant/actions/prepare' && body.kind === 'ledger.create') {
    let card = actionRequests.get(body.prepareKey)
    if (!card) {
      card = { id: uuid(), kind: 'ledger.create', state: 'PENDING', version: 1, preparationStatus: 'READY', payload: { ...body.payload, preparedOn: today }, preview: {} }
      actions.set(card.id, card); actionRequests.set(body.prepareKey, card)
    }
    return respond(card)
  }
  const action = path.match(/^\/api\/assistant\/actions\/([^/]+)(?:\/(confirm|cancel))?$/)
  if (action && actions.has(action[1])) {
    const card = actions.get(action[1])
    if (action[2] === 'confirm' && card.state === 'PENDING') {
      const entry = card.payload.recordId
        ? entries.find(entry => entry.id === card.payload.recordId)
        : create({ ...card.payload, requestId: card.id })
      if (card.payload.recordId) entry.flows.push(...card.payload.flows.map(flow => ({ ...flow, id: uuid(), occurredOn: flow.occurredOn || today })))
      card.state = 'SUCCEEDED'; card.result = { ledgerRecordId: entry.id, title: entry.title }; card.version++
    }
    if (action[2] === 'cancel' && card.state === 'PENDING') { card.state = 'CANCELLED'; card.version++ }
    if (method === 'PATCH' && card.state === 'PENDING') { card.payload = body.payload; card.version++ }
    return respond(card)
  }
  if (!path.startsWith('/api/ledger/')) return undefined
  const route = path.slice('/api/ledger'.length)
  if (route === '/categories') {
    if (method === 'POST') {
      const category = { id: uuid(), name: body.name, preset: false }
      categories.push(category); return respond(category)
    }
    return respond(categories)
  }
  if (route === '/records') return respond(method === 'POST' ? view(create(body)) : list(params))
  const entryRoute = route.match(/^\/records\/([^/]+)(?:\/flows(?:\/([^/]+))?)?$/)
  if (entryRoute) {
    const index = entries.findIndex(entry => entry.id === entryRoute[1]), entry = entries[index]
    if (!entry) throw new Error('没有找到这条账目')
    if (method === 'DELETE') {
      if (entryRoute[2]) {
        entry.flows = entry.flows.filter(flow => flow.id !== entryRoute[2])
        if (!entry.flows.length) entries.splice(index, 1)
      } else entries.splice(index, 1)
      return respond(null)
    }
    if (method === 'POST') {
      if (!requests.has(body.requestId)) {
        entry.flows.push(...body.flows.map(flow => ({ ...flow, id: uuid(), occurredOn: flow.occurredOn || today })))
        requests.set(body.requestId, entry)
      }
    }
    if (method === 'PUT') {
      const history = entry.flows.filter(flow => flow.occurredOn !== today)
      entry.flows = [...history, ...body.flows.map(flow => ({ ...flow, id: flow.id || uuid(), occurredOn: flow.occurredOn || today }))]
      if (entry.recordDate === today) { entry.title = body.title || '今日账目'; entry.description = body.description }
    }
    return respond(view(entry))
  }
  if (route === '/brief') {
    const flows = entries.flatMap(entry => entry.flows).filter(flow => between(flow.occurredOn, params))
    const start = params.start || today, end = params.end || today
    const days = []
    for (let date = start; date <= end && days.length < 366; date = shiftDay(date, 1)) {
      days.push({ date, ...totals(flows.filter(flow => flow.occurredOn === date)) })
    }
    const categoryRows = categories.map(category => ({ categoryId: category.id, name: category.name, ...totals(flows.filter(flow => flow.categoryId === category.id)) })).filter(row => row.flowCount > 0)
    return respond({ start, end, ...totals(flows), categories: categoryRows, days })
  }
  if (route === '/export') return exportRecords(config, params)
  if (route === '/recognize') return respond({ status: 'BILL', message: '演示识别结果，请核对流水。', draft: { title: '午餐', flows: [{ kind: 'EXPENSE', amount: '38.50', categoryId: 'food', occurredOn: today }] } })
  const diary = route.match(/^\/diaries\/(\d+)\/records$/)
  if (diary) {
    const id = Number(diary[1])
    if (method === 'PUT') for (const entry of entries) {
      entry.diaryIds = entry.diaryIds.filter(diaryId => diaryId !== id)
      if (body.recordIds.includes(entry.id)) entry.diaryIds.push(id)
    }
    return respond(entries.filter(entry => entry.diaryIds.includes(id)).map(view))
  }
  if (route === '/wishes') {
    if (method === 'POST') {
      const wish = { ...body, id: uuid(), state: 'ACTIVE', progressAmount: 0, progressRatio: 0 }
      wishes.unshift(wish); return respond(wish)
    }
    return respond(wishes)
  }
  const wish = route.match(/^\/wishes\/([^/]+)$/)
  if (wish) {
    const index = wishes.findIndex(item => item.id === wish[1])
    if (method === 'DELETE') { wishes.splice(index, 1); return respond(null) }
    Object.assign(wishes[index], body); return respond(wishes[index])
  }
  if (route === '/wish-events') return respond(events.filter(event => between(event.achievedOn, params)))
  if (route === '/recurring') {
    if (method === 'POST') {
      const rule = { ...body, id: uuid() }; recurring.unshift(rule); return respond(rule)
    }
    return respond(recurring)
  }
  if (route === '/recurring/due') return respond(due.filter(item => item.state === 'PENDING'))
  const occurrence = route.match(/^\/recurring\/due\/([^/]+)\/(confirm|skip)$/)
  if (occurrence) {
    const item = due.find(item => item.id === occurrence[1])
    if (item.state === 'PENDING' && occurrence[2] === 'confirm') {
      item.state = 'CONFIRMED'
      item.recordId = create({ title: item.title, flows: [row('EXPENSE', body.amount, item.categoryId)] }).id
    } else if (item.state === 'PENDING') item.state = 'SKIPPED'
    return respond(item)
  }
  const rule = route.match(/^\/recurring\/([^/]+)$/)
  if (rule && method === 'DELETE') {
    const index = recurring.findIndex(item => item.id === rule[1])
    if (index >= 0) recurring.splice(index, 1)
    return respond(null)
  }
  return respond(null)
}
