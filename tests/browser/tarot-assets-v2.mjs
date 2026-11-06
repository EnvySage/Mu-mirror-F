// Final art integration against the built preview; no HTTP interception.
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const cards = JSON.parse(await readFile(new URL('../../src/preview/tarotCatalog.json', import.meta.url), 'utf8'))
const base = process.env.TAROT_PREVIEW_URL || 'http://127.0.0.1:5190/tarot'
const output = process.env.TAROT_SCREENSHOTS || '.verify/tarot-v2-final'
const families = { major: ['大阿尔卡纳', 22, '05-hierophant'], wands: ['权杖', 14, 'wands-02'], cups: ['圣杯', 14, 'cups-02'], swords: ['宝剑', 14, 'swords-02'], pentacles: ['星币', 14, 'pentacles-02'] }
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const report = { checkedAt: new Date().toISOString(), base, viewports: [] }
try {
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    const page = await context.newPage(), errors = [], imageFailures = [], responses = new Map()
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => {
      const path = new URL(response.url()).pathname
      if (path.startsWith('/art/tarot/')) { responses.set(path, response.status()); if (!response.ok()) imageFailures.push(`${path}: HTTP ${response.status()}`) }
    })
    page.on('requestfailed', request => { if (new URL(request.url()).pathname.startsWith('/art/tarot/')) imageFailures.push(`${request.url()}: ${request.failure()?.errorText}`) })
    await page.goto(base)
    await page.getByRole('button', { name: /^收藏册/ }).click()
    await page.locator('.collection-grid .tarot-card').first().waitFor()
    assert.equal(await page.locator('.collection-grid .tarot-card').count(), 78)
    const decoded = await page.locator('.collection-grid').evaluate(async grid => {
      const images = [...grid.querySelectorAll('img')]
      for (const img of images) img.loading = 'eager'
      return Promise.all(images.map(async img => {
        await img.decode()
        const button = img.closest('button'), art = img.closest('.tarot-art')
        return { path: new URL(img.currentSrc).pathname, name: img.alt, width: img.naturalWidth, height: img.naturalHeight, grayscale: getComputedStyle(art).filter, clickable: !button.disabled, label: button.getAttribute('aria-label') }
      }))
    })
    assert.equal(decoded.length, 78, 'every catalog picture is displayed, not an unavailable-art placeholder')
    assert.equal(new Set(decoded.map(item => item.path)).size, 78)
    for (const card of cards) {
      const art = decoded.find(item => item.path === card.imageUrl)
      assert.ok(art, `rendered URL matches catalog: ${card.id}`)
      assert.ok(art.width > 0 && art.height > 0, `${card.id}: decoded actual artwork`)
      assert.equal(art.name, card.name)
      assert.equal(art.grayscale, 'grayscale(1)')
      assert.ok(art.clickable && art.label.includes(card.name), `${card.id}: named and clickable while uncollected`)
      assert.equal(responses.get(card.imageUrl), 200, `${card.id}: actual image HTTP 200`)
    }
    assert.equal(await page.locator('.art-unavailable').count(), 0)
    assert.equal(await page.locator('.collection-grid .tarot-card.locked').count(), 78)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.locator('.tarot-content').evaluate(element => { element.scrollTop = 0 })
    await page.screenshot({ path: `${output}/final-collection-grayscale-${width}.png` })
    for (const [family, [name, count, sampleId]] of Object.entries(families)) {
      await page.locator('.collection-filters button').filter({ hasText: name }).click()
      assert.equal(await page.locator('.collection-grid .tarot-card').count(), count)
      assert.equal(await page.locator(`.collection-grid .family-${family}`).count(), count)
      const sample = cards.find(card => card.id === sampleId)
      await page.getByRole('button', { name: `尚未收藏，查看${sample.name}`, exact: true }).click()
      await page.locator('.gallery-canvas img').evaluate(image => image.decode())
      await page.waitForFunction(() => { const gallery = document.querySelector('.tarot-gallery'); return gallery && getComputedStyle(gallery).opacity === '1' })
      assert.ok((await page.locator('.gallery-info').innerText()).includes(sample.meaning))
      assert.equal(await page.locator('.gallery-count').innerText(), `${cards.filter(card => card.category === family).findIndex(card => card.id === sampleId) + 1} / ${count}`)
      if (width === 1440 || (width === 375 && family === 'pentacles')) await page.screenshot({ path: `${output}/final-color-${family}-${width}.png` })
      await page.keyboard.press('Escape')
      await page.locator('.tarot-gallery').waitFor({ state: 'hidden' })
    }
    assert.deepEqual(imageFailures, [])
    assert.deepEqual(errors, [])
    report.viewports.push({ width, decoded, imageResponses: Object.fromEntries(responses), imageFailures, errors })
    await context.close()
    console.log(`PASS ${width}px: all78 real image responses200+decode, names/grayscale/clickability, category22+14x4, originals and meanings, zero missing-art placeholders/errors`)
  }
  await writeFile(`${output}/final-art-browser-report.json`, JSON.stringify(report, null, 2))
} finally { await browser.close() }
