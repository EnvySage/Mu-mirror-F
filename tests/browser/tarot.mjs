// Run against a production-mode Vite server. Mock only HTTP responses, not Vue state.
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const cards = JSON.parse(await readFile(process.env.TAROT_CATALOG || '../B/src/main/resources/tarot/catalog-v1.json', 'utf8'))
const base = process.env.TAROT_UI_URL || 'http://127.0.0.1:5179'
const output = process.env.TAROT_SCREENSHOTS || '.superpowers/sdd/2026-10-26-tarot'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      if (!localStorage.getItem('mirror_user')) {
        localStorage.setItem('mirror_token', 'test-token')
        localStorage.setItem('mirror_user', JSON.stringify({ id: 'test-account', username: '验收账号' }))
      }
    })
    let day = '2026-10-27', draw = null, reading = null, analysis = null, analysisCount = 0
    let unlocked = false, lostDrawResponse = true
    let preferences = { diaryEnabled: true, diaryDays: 7, todosEnabled: false, mirrorEnabled: false, version: 0 }
    const dailyRequests = [], payloads = [], drawRequests = new Map()
    await page.route(/\/api\//, async route => {
      const req = route.request(), path = new URL(req.url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      let data = null
      if (path === '/api/tarot/cards') data = { catalogVersion: 'v1', activeCount: 12, cards }
      if (path === '/api/tarot/preferences') {
        if (req.method() === 'PUT') preferences = { ...req.postDataJSON(), version: preferences.version + 1 }
        data = preferences
      }
      if (path === '/api/tarot/daily/draw') {
        dailyRequests.push(req.postDataJSON().clientRequestId)
        const requestId = req.postDataJSON().clientRequestId
        if (!drawRequests.has(requestId)) {
          if (draw?.drawDate !== day) draw = { id: `draw-${day}`, drawDate: day, cardId: cards[0].id, createdAt: `${day}T12:00:00+08:00` }
          drawRequests.set(requestId, draw)
        }
        const returned = drawRequests.get(requestId)
        unlocked = true
        if (lostDrawResponse) { lostDrawResponse = false; if (width === 768) day = '2026-10-28'; return route.abort('failed') }
        data = { serverDate: day, draw: returned, newlyCollected: true }
      }
      if (path === '/api/tarot/daily') data = { serverDate: day, draw: draw?.drawDate === day ? draw : null }
      if (path === '/api/tarot/collection') data = { activeCount: 12, unlockedCount: unlocked ? 1 : 0, entries: unlocked ? [{ cardId: cards[0].id, firstObtainedAt: `${day}T12:00:00+08:00`, dailyDrawCount: 1 }] : [] }
      if (path === '/api/tarot/readings' && req.method() === 'POST') {
        reading = { readingId: 'reading-1', cardId: cards[1].id, latestAnalysisId: null }; data = reading
      }
      if (path === '/api/tarot/readings/latest' || path === '/api/tarot/readings/reading-1') data = reading
      if (path.endsWith('/analyses') && req.method() === 'POST') {
        payloads.push(req.postDataJSON()); analysisCount++
        analysis = { analysisId: `analysis-${analysisCount}`, readingId: 'reading-1', question: req.postDataJSON().question, status: analysisCount === 1 ? 'failed' : 'completed', text: analysisCount === 1 ? null : '先从十分钟的速写开始。', sources: [], notices: [] }
        reading.latestAnalysisId = analysis.analysisId; data = analysis
      }
      if (path.includes('/tarot/analyses/')) data = analysis
      await route.fulfill({ json: { code: 200, data } })
    })
    await page.goto(`${base}/tarot`)
    await page.getByRole('button', { name: '抽取今日牌', exact: true }).click()
    await page.locator('.tarot-ritual [role="alert"]').waitFor()
    await page.getByRole('button', { name: '重新找回这张牌', exact: true }).click()
    await page.locator('.ritual-footer button:enabled').click()
    if (width === 768) {
      await page.getByRole('region', { name: '找回的抽牌' }).waitFor()
      assert.ok((await page.getByRole('region', { name: '找回的抽牌' }).innerText()).includes('2026-10-27'))
      assert.ok((await page.getByRole('region', { name: '找回的抽牌' }).innerText()).includes(cards[0].name))
      await page.getByRole('button', { name: '抽取今日牌', exact: true }).click()
      await page.locator('.ritual-footer button:enabled').click()
    }
    await page.getByText('今天已抽取', { exact: true }).waitFor()
    assert.equal(dailyRequests.length, width === 768 ? 3 : 2)
    assert.equal(dailyRequests[0], dailyRequests[1], 'lost draw response must reuse request ID')
    await page.reload()
    await page.getByText('今天已抽取', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '抽取今日牌', exact: true }).count(), 0)
    await page.getByRole('button', { name: /^收藏册/ }).click()
    assert.equal(await page.getByRole('button', { name: '尚未获得', exact: true }).count(), 11)
    await page.getByRole('button', { name: `放大欣赏${cards[0].name}` }).click()
    await page.getByRole('dialog').waitFor()
    await page.getByRole('button', { name: '放大卡牌细节', exact: true }).click()
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 0)
    await page.getByRole('button', { name: '问一问', exact: true }).click()
    await page.getByRole('button', { name: '心里有个问题，抽一张', exact: true }).click()
    assert.equal(reading, null, 'clock does not request a card before confirmation')
    await page.getByRole('button', { name: '默念好了，揭开这张牌', exact: true }).click()
    await page.locator('.ritual-footer button:enabled').click()
    await page.getByLabel('愿意说说你的问题吗？').fill('想学画画，如何开始？')
    await page.locator('summary').click()
    await page.getByLabel('日记时间范围').selectOption('30')
    await page.waitForFunction(() => document.querySelector('fieldset')?.disabled === false)
    await page.getByLabel('未完成待办', { exact: true }).check()
    await page.getByRole('button', { name: '看看这张牌的启发', exact: true }).click()
    await page.getByText('这次解读没有完成。牌已保留，可以重新解读。').waitFor()
    await page.getByRole('button', { name: '重新解读这张牌', exact: true }).click()
    await page.getByText('先从十分钟的速写开始。', { exact: true }).waitFor()
    assert.equal(reading.cardId, cards[1].id)
    assert.equal(payloads[0].options.diaryDays, 30)
    assert.equal(payloads[0].options.todosEnabled, true)
    assert.notEqual(payloads[0].clientRequestId, payloads[1].clientRequestId)
    await page.reload()
    await page.getByRole('button', { name: '问一问', exact: true }).click()
    await page.getByText('先从十分钟的速写开始。', { exact: true }).waitFor()
    await page.getByRole('button', { name: /^收藏册/ }).click()
    assert.equal(await page.getByRole('button', { name: '尚未获得', exact: true }).count(), 11)
    await page.screenshot({ path: `${output}/collection-${width}.png` })
    await page.getByRole('button', { name: '每日运势', exact: true }).click()
    await page.screenshot({ path: `${output}/daily-${width}.png` })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow')
    day = '2026-10-29'; draw = null
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.getByRole('button', { name: '抽取今日牌', exact: true }).waitFor()
    assert.deepEqual(errors, [])
    await context.close()
    console.log(`PASS ${width}px: lost-response retry, immutable daily card, collection lock, gallery, preferences, same-card analysis retry, refresh recovery, midnight, no overflow`)
  }
} finally { await browser.close() }
