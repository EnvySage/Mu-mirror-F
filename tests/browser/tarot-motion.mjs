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
} finally { await browser.close() }
