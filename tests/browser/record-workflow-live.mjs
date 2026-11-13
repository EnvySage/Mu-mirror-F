import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const evidence = process.env.MIRROR_RECORD_WORKFLOW_OUTPUT
if (!evidence) throw new Error('Set MIRROR_RECORD_WORKFLOW_OUTPUT to an evidence directory; use the disposable mirror-record-fixes-db environment.')
mkdirSync(evidence, { recursive: true })
import { execFileSync } from 'node:child_process'
const selectiveOnly = process.env.MIRROR_RECORD_INDEXING_ONLY === '1'
if (selectiveOnly) {
  const container = process.env.MIRROR_RECORD_TEST_DB_CONTAINER
  assert.ok(container?.startsWith('mirror-record-selective-index-test-'), 'Selective acceptance requires the explicitly named disposable test container')
  assert.equal(execFileSync('docker', ['inspect', '--format', '{{.State.Running}}', container], { encoding: 'utf8' }).trim(), 'true')
}
let token
async function api(path, method = 'GET', body) {
  const response = await fetch(`http://127.0.0.1:9050/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const result = await response.json(); assert.equal(result.code, 200, `${method} ${path}: ${result.message}`); return result.data
}
const credentials = { username: `workflow_${Date.now()}`, password: 'record-flow-local' }
await api('/auth/register', 'POST', credentials)
const auth = await api('/auth/login', 'POST', credentials); token = auth.token
assert.equal((await api('/assistant/actions/records')).length, 0, 'A new account cannot see other users record drafts')
await api('/settings', 'PUT', { aiProvider: 'openai', aiProtocol: 'openai', aiApiKey: 'local-stub-only', aiModel: 'stub', aiBaseUrl: 'http://127.0.0.1:18080/v1', embeddingSource: 'api', embeddingApiKey: 'local-stub-only', embeddingModel: 'stub', embeddingBaseUrl: 'http://127.0.0.1:18080/v1', defaultRecordMode: 'AI_ASSISTED' })

async function waitForValue(read, matches, description, timeout = 45000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const value = await read()
    if (matches(value)) return value
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out: ${description}`)
}

async function selectiveAcceptance(page) {
  const requests = []
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (/^\/api\/(assistant\/actions|records)/.test(path)) requests.push({ method: request.method(), path, body: request.postDataJSON() })
  })
  async function candidate(title, segments) {
    const prepared = await api('/assistant/actions/prepare', 'POST', { kind: 'record.create', prepareKey: crypto.randomUUID(), payload: { rawContent: segments.map(s => s.text).join('\n'), mode: 'AI_ASSISTED' } })
    const ready = await waitForValue(() => api(`/assistant/actions/${prepared.id}`), action => action.payload?.recordDraft?.preparationStatus === 'READY', 'candidate ready')
    assert.equal(ready.payload.recordDraft.indexPolicyVersion, 1, 'Enable selective indexing on the isolated backend before acceptance')
    const payload = structuredClone(ready.payload)
    payload.recordDraft.segments = segments.map((segment, index) => ({ ...payload.recordDraft.segments[0], draftId: crypto.randomUUID(), title: `${title}${index ? ` ${index + 1}` : ''}`, summary: segment.text, contentType: 'note', moods: [], keywords: [], tags: [], memoryEnabled: true, todoEnabled: false, ...segment }))
    payload.recordDraft.finalContent = segments.map(s => s.text).join('\n')
    await api(`/assistant/actions/${prepared.id}`, 'PATCH', { expectedVersion: ready.version, payload })
    await page.reload()
    const flight = page.locator(`[data-workflow-id="${prepared.id}"]`)
    await flight.waitFor(); await flight.click()
    await page.locator('.record-editor-expanded').waitFor()
    return prepared.id
  }
  async function confirm(id, title) {
    await page.locator('.review-workspace-toolbar .workspace-submit').click()
    await page.locator('.review-workspace').waitFor({ state: 'hidden' })
    const completed = await api(`/assistant/actions/${id}`)
    assert.equal(completed.state, 'SUCCEEDED')
    const record = await api(`/records/${completed.result.recordId}`)
    assert.equal(record.status, 'done'); assert.equal(record.memoryState, 'READY'); assert.equal(record.userReviewed, true)
    await page.locator('.record-card').filter({ hasText: title }).waitFor()
    return record
  }
  try {
    const dailyId = await candidate('选择性验收：全日常', [{ text: '中午吃饭，下午干活。', embeddingEnabled: false, embeddingReason: '普通日常' }])
    await page.reload()
    await page.locator(`[data-workflow-id="${dailyId}"]`).click()
    const dailyOption = page.locator('.record-indexing-options').first()
    assert.equal(await dailyOption.getAttribute('open'), null, 'Index choice starts collapsed without an extra required step')
    await dailyOption.locator('summary').click()
    assert.equal(await dailyOption.getByRole('checkbox').isChecked(), false)
    await page.screenshot({ path: evidence + '/selective-daily-editor-desktop.png' })
    const daily = await confirm(dailyId, '选择性验收：全日常')
    assert.equal(daily.chunks[0].embeddingEnabled, false)
    assert.equal(daily.chunks[0].aiMemoryApproved, true)
    assert.equal(daily.chunks[0].embeddingStatus, 'not_requested')
    assert.equal((daily.queuedEmbeddingJobIds || []).length, 0)
    const dailyCard = page.locator('.record-card').filter({ hasText: '选择性验收：全日常' })
    assert.match(await dailyCard.innerText(), /可查询/)
    assert.equal(await dailyCard.locator('.spinner').count(), 0)
    await dailyCard.click()
    await page.locator('.chunk-embedding-status[data-status="skipped"]').waitFor()
    assert.equal(await page.locator('.chunk-embedding-status button').count(), 0)
    await page.screenshot({ path: evidence + '/selective-daily-detail-desktop.png' })
    await page.goto('http://127.0.0.1:5173/records')
    const mixedId = await candidate('选择性验收：混合', [
      { text: '中午吃饭。', embeddingEnabled: false, embeddingReason: '普通日常' },
      { text: '去了陈记牛肉面，太咸以后不去了。', embeddingEnabled: true, embeddingReason: '具体地点与偏好' },
      { text: '未授权的合成内容。', embeddingEnabled: false, embeddingReason: '测试未授权', memoryEnabled: false },
    ])
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.record-indexing-options').first().locator('summary').click()
    await page.getByLabel('片段文字').first().fill('中午去了陈记牛肉面。')
    assert.equal(await page.locator('.record-indexing-options').first().getByRole('checkbox').isChecked(), true)
    assert.match(await page.locator('.record-indexing-options').first().innerText(), /正文已修改，默认保留检索/)
    await page.locator('.record-indexing-options').first().getByRole('checkbox').uncheck()
    assert.equal(await page.locator('.review-workspace-scroll').evaluate(el => el.scrollWidth <= el.clientWidth), true)
    await page.screenshot({ path: evidence + '/selective-mixed-editor-mobile.png' })
    const mixedSaved = await confirm(mixedId, '选择性验收：混合')
    assert.deepEqual(mixedSaved.chunks.map(c => c.embeddingEnabled), [false, true, false])
    assert.deepEqual(mixedSaved.chunks.map(c => c.aiMemoryApproved), [true, true, false])
    const mixed = await waitForValue(() => api(`/records/${mixedSaved.id}`), record => record.chunks.some(chunk =>
      chunk.metadata?.title === '选择性验收：混合 2' && chunk.embeddingEnabled && chunk.aiMemoryApproved
      && chunk.embeddingStatus === 'ready' && chunk.hasEmbedding), 'important authorized segment indexed', 90000)
    await page.reload()
    const mixedCard = page.locator('.record-card').filter({ hasText: '选择性验收：混合' })
    await mixedCard.waitFor()
    assert.match(await mixedCard.innerText(), /已授权片段可查询/)
    await page.screenshot({ path: evidence + '/selective-mixed-saved-mobile.png' })
    const failureBase = process.env.MIRROR_RECORD_EMBEDDING_FAILURE_BASE_URL
    if (!failureBase) throw new Error('Daily/mixed/refresh/edit-select passed; failure acceptance remains incomplete: set MIRROR_RECORD_EMBEDDING_FAILURE_BASE_URL to a controlled local embedding failure stub.')
    assert.ok(/^http:\/\/127\.0\.0\.1:\d+\//.test(failureBase), 'Failure injection must use the local disposable model stub')
    await api('/settings', 'PUT', { embeddingBaseUrl: failureBase })
    const failedId = await candidate('选择性验收：索引失败', [{ text: '具体合成经历，用于验证失败。', embeddingEnabled: true, embeddingReason: '具体经历' }])
    const failedRecord = await confirm(failedId, '选择性验收：索引失败')
    // The local backend keeps its normal five attempts with exponential backoff (10+20+40+80s).
    const failed = await waitForValue(() => api(`/records/${failedRecord.id}`), record => record.chunks.some(chunk => chunk.embeddingStatus === 'failed'), 'persisted failed embedding', 240000)
    assert.equal(failed.status, 'done'); assert.equal(failed.memoryState, 'READY')
    await page.reload()
    const failedCard = page.locator('.record-card').filter({ hasText: '选择性验收：索引失败' })
    await failedCard.waitFor(); assert.match(await failedCard.innerText(), /可查询/); assert.match(await failedCard.innerText(), /索引失败/)
    await page.screenshot({ path: evidence + '/selective-failed-mobile.png' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.screenshot({ path: evidence + '/selective-failed-desktop.png' })
    writeFileSync(evidence + '/selective-record-results.json', JSON.stringify({ daily, mixed, failed }, null, 2))
    console.log('PASS: selective all-daily/mixed/refresh/edit-then-select/failure; persisted requests and desktop/mobile screenshots captured.')
  } finally { writeFileSync(evidence + '/selective-requests.json', JSON.stringify(requests, null, 2)) }
}
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  page.on('console', msg => { if (msg.type() === 'error') console.log('browser:', msg.text()) })
  await page.addInitScript(auth => { localStorage.setItem('mirror_token', auth.token); localStorage.setItem('mirror_user', JSON.stringify(auth.user)) }, auth)
  await page.goto('http://127.0.0.1:5173/records')
  if (selectiveOnly) await selectiveAcceptance(page)
  else {
  await page.locator('.record-capture').click()
  await page.getByRole('textbox', { name: '日记内容' }).fill('今天把项目的记录流程重新梳理了一遍，想让等待变得轻一点。')
  await page.locator('input[value="AI_ASSISTED"]').check()
  await page.locator('.write-submit').click()
  await page.locator('.write-modal').waitFor({ state: 'hidden', timeout: 5000 })
  const flight = page.locator('.record-flight').first()
  await flight.waitFor()
  assert.equal(await flight.getAttribute('data-phase'), 'preparing')
  const actionId = await flight.getAttribute('data-workflow-id')
  await page.screenshot({ path: evidence + '/record-workflow-processing.png' })
  await page.reload()
  await page.locator(`[data-workflow-id="${actionId}"][data-phase="review"]`).waitFor({ timeout: 30000 })
  console.log('PASS: submit closes writer, animated list state, refresh restores server-owned draft.')
  await page.locator(`[data-workflow-id="${actionId}"]`).click()
  await page.locator('.record-editor-expanded').waitFor()
  await page.getByLabel('最终正文', { exact: true }).fill('这是我在完整编辑台修改过的正文，关闭等待之前先确认保存。')
  await page.getByLabel('标题', { exact: true }).fill('把等待还给生活')
  await page.getByLabel('摘要', { exact: true }).fill('整理记录时可以继续生活，不必守着进度。')
  await page.locator('.record-segment select').selectOption('todo')
  await page.getByLabel('自由标签', { exact: true }).fill('产品设计, 交互优化')
  await page.getByRole('button', { name: '满足', exact: true }).click()
  await page.locator('.review-workspace-enter-active').waitFor({ state: 'hidden' })
  await page.locator('.review-workspace-scroll').evaluate(el => { el.scrollTop = 0 })
  await page.screenshot({ path: evidence + '/record-workflow-editor-desktop.png' })
  await page.locator('.review-workspace-toolbar .workspace-submit').click()
  await page.locator('.review-workspace').waitFor({ state: 'hidden', timeout: 5000 })
  await page.locator(`[data-workflow-id="${actionId}"][data-phase="indexing"]`).waitFor({ timeout: 3000 })
  await page.screenshot({ path: evidence + '/record-workflow-indexing.png' })
  await page.locator('.record-card').filter({ hasText: '把等待还给生活' }).waitFor({ timeout: 30000 })
  assert.ok((await page.locator('.record-card').filter({ hasText: '把等待还给生活' }).innerText()).includes('已就绪'))
  const completed = await api(`/assistant/actions/${actionId}`)
  assert.equal(completed.state, 'SUCCEEDED')
  const record = await api(`/records/${completed.result.recordId}`)
  assert.equal(record.chunks[0].segment, '这是我在完整编辑台修改过的正文，关闭等待之前先确认保存。')
  assert.equal(record.chunks[0].metadata.title, '把等待还给生活')
  assert.deepEqual(record.chunks[0].metadata.userTags, ['产品设计', '交互优化'])
  assert.ok(record.chunks[0].metadata.mood.includes('satisfied'))
  console.log('PASS: full editor preserves body/title/summary/category/tags/moods; confirmation returns to list during embedding, then shows the saved record.')
  const next = await api('/assistant/actions/prepare', 'POST', { kind: 'record.create', prepareKey: crypto.randomUUID(), payload: { rawContent: '手机上也要能舒展开来编辑。', mode: 'AI_ASSISTED' } })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.locator(`[data-workflow-id="${next.id}"][data-phase="review"]`).waitFor({ timeout: 30000 })
  await page.locator(`[data-workflow-id="${next.id}"]`).click()
  await page.locator('.record-editor-expanded').waitFor()
  await page.locator('.review-workspace-enter-active').waitFor({ state: 'hidden' })
  await page.screenshot({ path: evidence + '/record-workflow-editor-mobile.png' })
  assert.equal(await page.locator('.review-workspace-scroll').evaluate(el => el.scrollWidth <= el.clientWidth), true)
  await page.getByRole('button', { name: '〈 返回列表', exact: true }).click()
  await page.locator('.review-workspace').waitFor({ state: 'hidden' })
  await page.reload()
  await page.locator(`[data-workflow-id="${next.id}"][data-phase="review"]`).waitFor()
  console.log('PASS: mobile editor fits the screen; leaving without edits preserves the pending draft across reload.')
  const session = (await api('/mirror/sessions/today', 'POST')).session
  const owner = auth.user.id
  const sourceId = execFileSync('docker', ['exec', 'mirror-record-fixes-db', 'psql', '-U', 'postgres', '-d', 'mu_mirror_test', '-t', '-A', '-c', `INSERT INTO conversation_history(session_id,user_id,role,content) VALUES ('${session.id}','${owner}','user','请把这段想法整理成一条记录。') RETURNING id`], { encoding: 'utf8' }).trim().split('\n')[0]
  execFileSync('docker', ['exec', 'mirror-record-fixes-db', 'psql', '-U', 'postgres', '-d', 'mu_mirror_test', '-c', `INSERT INTO conversation_history(session_id,user_id,role,content) VALUES ('${session.id}','${owner}','assistant','已经准备好整理候选，你可以在完整编辑台里确认。')`])
  const chatAction = await api('/assistant/actions/prepare', 'POST', { kind: 'record.create', prepareKey: crypto.randomUUID(), sourceSessionId: session.id, sourceMessageId: Number(sourceId), payload: { rawContent: '这是一段来自聊天的记录，可以稍后编辑再确认。', mode: 'AI_ASSISTED' } })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('http://127.0.0.1:5173/chat')
  const chatCard = page.locator(`[data-workflow-id="${chatAction.id}"].compact`)
  await chatCard.waitFor({ timeout: 30000 })
  await chatCard.click()
  await page.locator('.record-editor-expanded').waitFor({ timeout: 15000 })
  await page.locator('.review-workspace-enter-active').waitFor({ state: 'hidden' })
  await page.getByLabel('标题', { exact: true }).fill('从对话带回日常')
  await page.locator('.review-workspace-toolbar .workspace-submit').click()
  await page.locator('.review-workspace').waitFor({ state: 'hidden' })
  await page.waitForURL('**/records')
  await page.locator(`[data-workflow-id="${chatAction.id}"][data-phase="indexing"]`).waitFor()
  await page.locator('.record-card').filter({ hasText: '从对话带回日常' }).waitFor({ timeout: 30000 })
  console.log('PASS: server-restored chat card opens the shared editor; confirming returns to records while memory builds in the background.')
  await page.goto('http://127.0.0.1:5173/chat')
  const savedChatCard = page.locator(`[data-workflow-id="${chatAction.id}"].compact`)
  await savedChatCard.waitFor()
  await savedChatCard.click()
  await page.getByRole('dialog', { name: '记录详情', exact: true }).waitFor()
  assert.equal(await page.locator('.review-workspace').count(), 0)
  console.log('PASS: a completed chat card opens the saved record directly, without another confirmation screen.')
  }
  assert.deepEqual(errors, [])
} catch (e) {
  const failedPage = browser.contexts()[0]?.pages()[0]
  if (failedPage) await failedPage.screenshot({ path: evidence + '/record-workflow-failure.png' }).catch(() => {})
  console.error(e)
  throw e
} finally { await browser.close() }
