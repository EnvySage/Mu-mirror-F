// Preview-only, user-visible mobile navigation checks; no private account data.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = new URL(process.env.TAROT_PREVIEW_URL || 'http://127.0.0.1:5190/tarot').origin
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const [width, height, motion] of [[320, 600, 'reduce'], [375, 812, 'no-preference'], [844, 390, 'reduce'], [1440, 900, 'reduce']]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: motion })
    if (width === 1440) await page.addInitScript(() => localStorage.setItem('mirror.presentation-mode', 'mobile'))
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`${base}/records`)
    const nav = page.getByRole('navigation', { name: '主导航', exact: true })
    const explore = nav.getByRole('button', { name: '探索', exact: true })
    await explore.waitFor()
    assert.equal(await nav.getByRole('button').count(), 5, 'the navigation bar stays at five controls')
    assert.deepEqual(await nav.locator('.nav-label').allTextContents(), ['记录', '对话', '镜子', '探索'])
    await explore.click()
    const sheet = page.getByRole('dialog', { name: '探索', exact: true })
    await sheet.waitFor()
    await page.keyboard.press('Escape')
    await sheet.waitFor({ state: 'hidden' })
    assert.ok(await explore.evaluate(e => e === document.activeElement), 'Escape returns focus to Explore')
    await explore.click()
    await sheet.getByRole('button', { name: /^塔罗牌/ }).click()
    await sheet.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '点击牌背，抽取今日牌', exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/tarot')
    assert.ok(await explore.evaluate(e => e.classList.contains('active')), 'Explore marks the current destination')
    // The former calendar entry, assets and settings remain reachable from every page.
    for (const [label, path] of [['日历', '/calendar'], ['记忆资产', '/vault'], ['设置', '/settings']]) {
      await explore.click()
      await sheet.getByRole('button', { name: new RegExp(`^${label}`) }).click()
      await sheet.waitFor({ state: 'hidden' })
      await page.waitForURL(`${base}${path}`)
    }
    await explore.click()
    const close = sheet.getByRole('button', { name: '关闭探索' })
    await close.focus()
    await page.keyboard.press('Shift+Tab')
    assert.ok(await sheet.getByRole('button', { name: /切换到桌面布局/ }).evaluate(e => e === document.activeElement), 'keyboard focus stays inside the directory')
    if (height < 500) {
      await sheet.evaluate(e => { e.scrollTop = 0 })
      await sheet.hover()
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(200)
      assert.ok(await sheet.evaluate(e => e.scrollTop > 0), 'short screens can scroll to every destination')
    }
    await page.keyboard.press('Escape')
    await sheet.waitFor({ state: 'hidden' })
    await explore.click()
    await sheet.getByRole('button', { name: /^每日总结/ }).click()
    await sheet.waitFor({ state: 'hidden' })
    await page.getByRole('dialog', { name: '每日总结', exact: true }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: '每日总结', exact: true }).waitFor({ state: 'hidden' })
    await nav.getByRole('button', { name: '记录', exact: true }).click()
    await page.waitForURL(`${base}/records`)
    await nav.getByRole('button', { name: '新建记录', exact: true }).click()
    await page.getByRole('dialog').waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow')
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`PASS ${width}x${height}: five-slot navigation, tarot entry, calendar/assets/settings, focus, scrolling and new record`)
  }
} finally { await browser.close() }
