// User-visible interaction checks against the explicitly isolated preview build.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.TAROT_PREVIEW_URL || 'http://127.0.0.1:5190/tarot'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const width of [375, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 600 }, reducedMotion: 'reduce' })
    await page.goto(base)
    await page.getByRole('button', { name: '抽取今日牌', exact: true }).waitFor()
    for (const tab of ['每日运势', '问一问', '收藏册']) {
      await page.getByRole('button', { name: new RegExp(`^${tab}`) }).click()
      const content = page.locator('.tarot-content')
      await content.evaluate(e => { e.scrollTop = 0 })
      const bounds = await content.boundingBox()
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      await page.mouse.wheel(0, 700)
      await page.waitForTimeout(180)
      const metrics = await content.evaluate(e => ({ top: e.scrollTop, height: e.clientHeight, total: e.scrollHeight }))
      if (metrics.total > metrics.height + 1) assert.ok(metrics.top > 0, `${width}px ${tab}: actual wheel must scroll`)
      if (tab === '收藏册') assert.ok(metrics.total > metrics.height, 'collection must have scrollable content')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow')
    }
    await page.close()
    console.log(`PASS ${width}px: all tarot tabs scroll inside the app`)
  }
  for (const [width, height, motion] of [[375, 600, 'no-preference'], [768, 700, 'reduce'], [1440, 1000, 'no-preference']]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: motion, hasTouch: true })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base)
    await page.getByRole('button', { name: '问一问', exact: true }).click()
    const drawQuestion = page.getByRole('button', { name: '心里有个问题，抽一张', exact: true })
    await drawQuestion.click()
    await page.getByRole('button', { name: '稍后再抽 ×', exact: true }).click()
    assert.equal(await drawQuestion.count(), 1, 'leaving the clock does not draw')
    await drawQuestion.click()
    await page.waitForTimeout(3500)
    const clock = page.getByRole('dialog', { name: '默念你的问题' })
    const rect = await clock.boundingBox()
    assert.deepEqual(rect, { x: 0, y: 0, width, height }, 'clock fills the viewport')
    assert.equal(await drawQuestion.count(), 1, 'waiting never secretly draws a card')
    assert.equal(await page.locator('.ritual-result').count(), 0, 'no timed reveal')
    // The clock itself is clickable, not only the prompt in its center.
    await page.getByRole('button', { name: '默念好了，揭开这张牌' }).click({ position: { x: 35, y: height * .7 } })
    await page.locator('.ritual-footer button:enabled').waitFor()
    assert.equal(await page.getByText('问一问的牌，不计入收藏', { exact: true }).count(), 1)
    await page.locator('.ritual-footer button').click()
    await page.getByRole('button', { name: /^收藏册/ }).click()
    assert.equal(await page.getByRole('button', { name: '尚未获得', exact: true }).count(), 12)
    await page.getByRole('button', { name: '每日运势', exact: true }).click()
    await page.getByRole('button', { name: '抽取今日牌', exact: true }).click()
    await page.locator('.ritual-footer button:enabled').waitFor()
    await page.getByText('初次相遇 / 新收藏', { exact: true }).waitFor()
    await page.getByRole('button', { name: '放大卡牌细节', exact: true }).click()
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 1, 'closing the nested gallery preserves the acquisition display')
    const collect = page.getByRole('button', { name: /^收下这张牌/ })
    const collectRect = await collect.boundingBox()
    assert.ok(collectRect.y >= 0 && collectRect.y + collectRect.height <= height, 'collect action is visible')
    await collect.click()
    await page.getByRole('button', { name: /^收藏册/ }).click()
    assert.equal(await page.getByRole('button', { name: '尚未获得', exact: true }).count(), 11)
    await page.getByRole('button', { name: /^放大欣赏/ }).click()
    assert.equal(await page.getByText('初次相遇 / 新收藏', { exact: true }).count(), 0, 'viewing an owned card does not replay acquisition')
    await page.getByRole('button', { name: '放大细节', exact: true }).click()
    const zoom = page.getByLabel('卡面细节，可滚动查看', { exact: true })
    await zoom.hover()
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(200)
    assert.ok(await zoom.evaluate(e => e.scrollTop > 0), 'enlarged art can scroll')
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 0)
    const content = page.locator('.tarot-content')
    await content.evaluate(e => { e.scrollTop = 0 })
    const bounds = await content.boundingBox()
    // A real touch swipe must still scroll after both fullscreen displays close.
    const cdp = await page.context().newCDPSession(page)
    const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height * .8
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 25 }] })
      await page.waitForTimeout(20)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(200)
    assert.ok(await content.evaluate(e => e.scrollTop > 0), 'touch scrolling works after closing dialogs')
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS ${width}px ${motion}: user-controlled clock, reveal, first acquisition, locked collection, detail zoom, restored touch scroll`)
  }
} finally { await browser.close() }
