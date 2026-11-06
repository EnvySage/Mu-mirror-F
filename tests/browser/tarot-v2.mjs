// Real Vue runtime and HTTP boundary; no mock component or store injection.
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const cards = JSON.parse(await readFile(process.env.TAROT_CATALOG || new URL('../../src/preview/tarotCatalog.json', import.meta.url), 'utf8'))
assert.equal(cards.length, 78, 'acceptance requires the complete v2 catalog')
const families = { major: 22, wands: 14, cups: 14, swords: 14, pentacles: 14 }
for (const [family, count] of Object.entries(families)) assert.equal(cards.filter(card => card.category === family).length, count)
const base = process.env.TAROT_UI_URL || 'http://127.0.0.1:5179'
const output = process.env.TAROT_SCREENSHOTS || '.superpowers/sdd/2026-10-30-tarot-v2'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    const page = await context.newPage(), errors = [], historyQueries = [], hydratedVersions = []
    page.on('pageerror', e => errors.push(e.message))
    await page.addInitScript(() => {
      localStorage.setItem('mirror_token', 'test-token')
      localStorage.setItem('mirror_user', JSON.stringify({ id: 'tarot-v2-user', username: '验收账号' }))
    })
    const dailyCard = cards.find(card => card.id === '02-priestess') || cards[2]
    const questionCard = cards.find(card => card.id === 'cups-ace')
    let draw = null, reading = null, analysis = null, analysisCount = 0, unlocked = false, loseResponse = true, otherAccount = false
    const dailyIds = [], analysisPayloads = [], history = Array.from({ length: 23 }, (_, index) => ({ id: index === 0 ? 'past-question' : `past-${index}`, kind: index % 3 ? 'daily' : 'question', cardId: cards[index].id, catalogVersion: 'v2', orientation: index % 2 ? 'upright' : 'reversed', drawDate: '2026-10-29', createdAt: `2026-10-29T${String(23 - index).padStart(2, '0')}:00:00+08:00`, latestAnalysisId: index === 0 ? 'saved-1' : null }))
    const saved = {
      'saved-2': { analysisId: 'saved-2', readingId: 'past-question', status: 'completed', question: '过去的问题', text: '这是第二次保存的解读。', sources: [], notices: [], createdAt: '2026-10-29T12:00:00+08:00' },
      'saved-1': { analysisId: 'saved-1', readingId: 'past-question', status: 'stale', question: '过去的问题', text: null, sources: [], notices: [], createdAt: '2026-10-29T11:00:00+08:00' },
    }
    await page.route(/\/api\//, async route => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname
      if (!path.startsWith('/api/')) return route.continue()
      let data = null
      if (path === '/api/tarot/cards') data = { catalogVersion: 'v2', activeCount: 78, cards }
      if (path === '/api/tarot/preferences') data = { diaryEnabled: false, diaryDays: 7, todosEnabled: false, mirrorEnabled: false, version: 0 }
      if (path === '/api/tarot/daily/draw') {
        const id = req.postDataJSON().clientRequestId; dailyIds.push(id)
        draw ||= { id: 'today-draw', cardId: dailyCard.id, catalogVersion: 'v2', orientation: 'reversed', drawDate: '2026-10-30', createdAt: '2026-10-30T12:00:00+08:00' }
        unlocked = true
        if (loseResponse) { loseResponse = false; return route.abort('failed') }
        data = { serverDate: '2026-10-30', draw, newlyCollected: true }
      }
      if (path === '/api/tarot/daily') data = { serverDate: '2026-10-30', draw: otherAccount ? null : draw }
      if (path === '/api/tarot/collection') data = { activeCount: 78, unlockedCount: unlocked && !otherAccount ? 1 : 0, entries: unlocked && !otherAccount ? [{ cardId: dailyCard.id, firstObtainedAt: '2026-10-28T17:00:00Z', dailyDrawCount: 3 }] : [] }
      if (path === '/api/tarot/readings' && req.method() === 'POST') {
        reading = { readingId: 'current-reading', cardId: questionCard.id, catalogVersion: 'v2', orientation: 'reversed', latestAnalysisId: null, createdAt: '2026-10-30T12:00:00+08:00' }; data = reading
      }
      if (path === '/api/tarot/readings/latest' || path === '/api/tarot/readings/current-reading') data = otherAccount ? null : reading
      if (path === '/api/tarot/readings/current-reading/analyses' && req.method() === 'POST') {
        const payload = req.postDataJSON(); analysisPayloads.push(payload); analysisCount++
        analysis = { analysisId: `current-analysis-${analysisCount}`, readingId: reading.readingId, question: payload.question, status: analysisCount === 1 ? 'failed' : 'completed', text: analysisCount === 1 ? null : '先从十分钟的小尝试开始。', sources: [], notices: [] }
        reading.latestAnalysisId = analysis.analysisId; data = analysis
      }
      if (path === '/api/tarot/history') {
        const limit = Number(url.searchParams.get('limit')), offset = Number(url.searchParams.get('offset')); historyQueries.push({ limit, offset })
        data = { items: otherAccount ? [] : history.slice(offset, offset + limit), total: otherAccount ? 0 : history.length, limit, offset, hasMore: !otherAccount && offset + limit < history.length }
      }
      if (path === '/api/tarot/readings/past-question/analyses') data = Object.values(saved).map(({ analysisId, readingId, status, question, createdAt }) => ({ analysisId, readingId, status, question, createdAt }))
      if (path.includes('/api/tarot/analyses/')) {
        const id = path.split('/').at(-1); hydratedVersions.push(id); data = saved[id] || analysis
      }
      await route.fulfill({ json: { code: 200, data } })
    })
    await page.goto(`${base}/tarot`)
    await page.getByRole('button', { name: '抽取今日牌', exact: true }).click({ timeout: 10000 }).catch(async e => { console.log('PAGE ERRORS', errors); console.log(await page.locator('body').innerText()); await page.screenshot({path:`${output}/failure-${width}.png`}); throw e })
    await page.getByRole('button', { name: '重新找回这张牌', exact: true }).click()
    await page.locator('.ritual-footer button:enabled').waitFor()
    assert.equal(await page.locator('.spotlight-headline').innerText(), dailyCard.reversedMeaning)
    assert.equal(await page.locator('.spotlight-action').innerText(), dailyCard.reversedAction)
    await page.screenshot({ path: `${output}/acquisition-reversed-${width}.png` })
    await page.locator('.ritual-footer button:enabled').click()
    assert.equal(dailyIds.length, 2); assert.equal(dailyIds[0], dailyIds[1], 'lost responses keep the same draw request')
    await page.getByText('今天已抽取', { exact: true }).waitFor()
    assert.ok((await page.locator('.card-meaning').innerText()).includes(dailyCard.reversedMeaning))
    assert.ok((await page.locator('.small-action').innerText()).includes(dailyCard.reversedAction))
    assert.equal(await page.locator('.card-stage .tarot-art.reversed').count(), 1)
    await page.screenshot({ path: `${output}/daily-${width}.png` })
    await page.reload(); await page.getByText('今天已抽取', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '抽取今日牌', exact: true }).count(), 0)
    await page.getByRole('button', { name: /^收藏册/ }).click()
    assert.equal(await page.locator('.collection-grid .tarot-card').count(), 78)
    assert.equal(await page.locator('.collection-grid .tarot-card.locked').count(), 77)
    assert.ok((await page.locator('.collection-grid').innerText()).includes('每日抽中 3 次'))
    for (const [id, count] of Object.entries(families)) {
      const family = page.locator(`.collection-filters button`).filter({ hasText: ({major:'大阿尔卡纳',wands:'权杖',cups:'圣杯',swords:'宝剑',pentacles:'星币'})[id] })
      await family.click(); assert.equal(await page.locator('.collection-grid .tarot-card').count(), count)
      assert.equal(await page.locator(`.collection-grid .family-${id}`).count(), count)
    }
    await page.locator('.collection-filters button').filter({ hasText: '全部' }).click()
    const lockedCard = cards.find(card => card.id !== dailyCard.id)
    await page.getByRole('button', { name: `尚未收藏，查看${lockedCard.name}`, exact: true }).click()
    await page.getByRole('dialog', { name: `欣赏${lockedCard.name}` }).waitFor()
    assert.ok((await page.locator('.gallery-info').innerText()).includes(lockedCard.meaning))
    assert.equal(await page.locator('.gallery-count').innerText(), '1 / 78')
    await page.getByRole('button', { name: '下一张', exact: true }).click()
    await page.getByRole('dialog', { name: `欣赏${cards[1].name}` }).waitFor()
    await page.keyboard.press('Escape')
    await page.locator('.tarot-gallery').waitFor({ state: 'hidden' })
    await page.screenshot({ path: `${output}/collection-${width}.png` })
    await page.getByRole('button', { name: '问一问', exact: true }).click()
    await page.getByRole('button', { name: '心里有个问题，抽一张', exact: true }).click()
    assert.equal(reading, null)
    await page.getByRole('button', { name: '默念好了，揭开这张牌', exact: true }).click()
    await page.locator('.ritual-footer button:enabled').click()
    assert.ok((await page.locator('.question-meaning').innerText()).includes(questionCard.reversedMeaning))
    assert.ok((await page.locator('.small-action').innerText()).includes(questionCard.reversedAction))
    await page.getByLabel('愿意说说你的问题吗？').fill('如何开始学画画？')
    await page.getByRole('button', { name: '看看这张牌的启发', exact: true }).click()
    await page.getByText('这次解读没有完成。牌已保留，可以重新解读。').waitFor()
    await page.getByRole('button', { name: '重新解读这张牌', exact: true }).click()
    await page.getByText('先从十分钟的小尝试开始。', { exact: true }).waitFor()
    assert.equal(reading.cardId, questionCard.id)
    assert.notEqual(analysisPayloads[0].clientRequestId, analysisPayloads[1].clientRequestId)
    await page.locator('.card-stage .tarot-card').click()
    assert.ok((await page.locator('.gallery-info').innerText()).includes(questionCard.reversedMeaning))
    assert.ok((await page.locator('.gallery-canvas img').getAttribute('style')).includes('rotate(180deg)'))
    await page.screenshot({ path: `${output}/gallery-reversed-${width}.png` })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '相遇记录', exact: true }).click()
    await page.locator('.history-event').first().waitFor()
    assert.equal(await page.locator('.history-event').count(), 20)
    history.unshift({ id: 'new-from-another-tab', kind: 'daily', cardId: cards[77].id, catalogVersion: 'v2', orientation: 'upright', drawDate: '2026-10-30', createdAt: '2026-10-30T13:00:00+08:00', latestAnalysisId: null })
    await page.getByRole('button', { name: '更早的相遇 ↓', exact: true }).click()
    await page.getByText('记录有更新，已从最新相遇重新展开。', { exact: true }).waitFor()
    assert.equal(await page.locator('.history-event').count(), 20)
    assert.ok((await page.locator('.history-event').first().innerText()).includes(cards[77].name))
    assert.deepEqual(historyQueries.slice(0,3), [{limit:20,offset:0},{limit:20,offset:20},{limit:20,offset:0}])
    await page.getByRole('button', { name: '更早的相遇 ↓', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.history-event').length === 24)
    assert.equal(historyQueries[3].offset, 20, 'restart preserves a correct next-page offset')
    const renderedEvents = await page.locator('.history-event').allTextContents()
    assert.equal(new Set(renderedEvents).size, renderedEvents.length, 'no duplicated history entries')
    await page.locator('.history-event').filter({ hasText: '有保存的解读' }).click()
    await page.getByText('这是第二次保存的解读。', { exact: true }).waitFor()
    assert.equal(await page.locator('.analysis-versions button').count(), 2)
    await page.locator('.analysis-versions button').filter({ hasText: '版本 1' }).click()
    await page.getByText('参考资料已变更或撤回，旧解读已隐藏。', { exact: true }).waitFor()
    assert.equal(await page.getByText('这是第二次保存的解读。', { exact: true }).count(), 0)
    assert.ok(hydratedVersions.includes('saved-1') && hydratedVersions.includes('saved-2'))
    await page.locator('.analysis-versions button').filter({ hasText: '版本 2' }).click()
    await page.getByText('这是第二次保存的解读。', { exact: true }).waitFor()
    await page.screenshot({ path: `${output}/history-${width}.png` })
    await page.getByRole('button', { name: '问一问', exact: true }).click()
    await page.getByText('先从十分钟的小尝试开始。', { exact: true }).waitFor()
    await page.getByRole('button', { name: /^收藏册/ }).click()
    assert.equal(await page.locator('.collection-grid .tarot-card.locked').count(), 77, 'question draws do not unlock collection')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow')
    otherAccount = true
    await page.evaluate(() => {
      const auth = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('auth')
      auth.user = { id: 'other-tarot-user', username: '另一个账号' }; auth.token = 'other-token'
    })
    await page.waitForFunction(() => document.querySelectorAll('.collection-grid .tarot-card.locked').length === 78)
    await page.getByRole('button', { name: '相遇记录', exact: true }).click()
    await page.getByText('还没有相遇记录。抽取一张牌，故事就开始了。').waitFor()
    assert.equal(await page.locator('.history-analysis').count(), 0)
    assert.deepEqual(errors, [])
    await context.close()
    console.log(`PASS ${width}px: 78 cards/five families, reversed art/text, daily retry, visible grayscale collection, metadata, gallery, question no unlock, pagination, saved versions/stale hydration, account clearing, no overflow`)
  }
} finally { await browser.close() }
