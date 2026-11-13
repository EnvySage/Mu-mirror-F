// Preview-only browser check; use the synthetic ledger fixture.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = new URL(process.env.LEDGER_PREVIEW_URL || 'http://127.0.0.1:19517').origin
const out = process.env.LEDGER_SCREENSHOTS || '.verify'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.setDefaultTimeout(8000)

async function assertCentered(dialog) {
  await dialog.waitFor({ state: 'visible' })
  const geometry = await dialog.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      viewportWidth: innerWidth, viewportHeight: innerHeight }
  })
  assert.ok(Math.abs(geometry.x + geometry.width / 2 - geometry.viewportWidth / 2) <= 1, 'Ledger dialog must be horizontally centered')
  assert.ok(Math.abs(geometry.y + geometry.height / 2 - geometry.viewportHeight / 2) <= 1, 'Ledger dialog must be vertically centered')
  assert.ok(geometry.y >= 10 && geometry.y + geometry.height <= geometry.viewportHeight - 10, 'Ledger dialog must stay inside the viewport')
}

try {
  await page.goto(origin + '/records')
  await page.getByRole('button', { name: '新建记录或账目' }).click()
  await page.getByRole('dialog', { name: '写下此刻' }).getByRole('button', { name: /^记一笔/ }).click()
  const editor = page.getByRole('dialog', { name: '记一笔', exact: true })
  await editor.waitFor()
  await assertCentered(editor)
  await editor.getByLabel('账目名称').fill('浏览器晚餐')
  await editor.getByLabel('金额（元）').fill('21.50')
  await editor.getByLabel('流水分类', { exact: true }).selectOption('food')
  await editor.getByRole('button', { name: '确认入账' }).click()
  const detail = page.getByRole('dialog', { name: '浏览器晚餐' })
  await detail.waitFor()
  await assertCentered(detail)
  assert.match(await detail.textContent(), /21\.50/)
  await page.screenshot({ path: out + '/ledger-mobile-detail.png' })
  await page.keyboard.press('Escape')
  await detail.waitFor({ state: 'hidden' })

  await page.getByRole('button', { name: /和朋友吃晚餐/ }).click()
  const linkedDetail = page.getByRole('dialog', { name: '和朋友吃晚餐' })
  await linkedDetail.getByRole('button', { name: '修改当天流水' }).click()
  const linkedEditor = page.getByRole('dialog', { name: '修改当天流水' })
  await linkedEditor.getByText(/会更新自动生成的随记/).waitFor()
  await page.keyboard.press('Escape')
  await linkedDetail.waitFor()
  await page.keyboard.press('Escape')
  await linkedDetail.waitFor({ state: 'hidden' })

  await page.getByRole('button', { name: '愿望与周期', exact: true }).click()
  await page.getByRole('button', { name: /许个愿望/ }).click()
  await page.getByText(/上期已达成/).waitFor()
  const wish = page.getByRole('dialog', { name: '许个愿望' })
  await assertCentered(wish)
  await wish.getByLabel('愿望名称').fill('下一本书')
  await wish.getByLabel('达标金额').fill('100')
  await wish.getByLabel('消费总预算').fill('800')
  await wish.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('heading', { name: '下一本书' }).waitFor()
  await page.getByText('愿望已加入', { exact: true }).waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: '账目流水', exact: true }).click()
  await page.evaluate(() => { document.querySelector('.ledger-page').scrollTop = 0 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390)
  await page.screenshot({ path: out + '/ledger-mobile.png' })

  await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('button', { name: '日历', exact: true }).click()
  await page.getByRole('link', { name: /浏览器晚餐/ }).click()
  await page.getByRole('dialog', { name: '浏览器晚餐' }).waitFor()

  await page.goto(origin + '/chat')
  await page.getByRole('button', { name: '更多对话操作' }).click()
  await page.getByRole('switch', { name: /识别支付截图/ }).click()
  await page.keyboard.press('Escape')
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X2B8UAAAAASUVORK5CYII=', 'base64')
  await page.locator('input[type=file]').setInputFiles({ name: 'payment.png', mimeType: 'image/png', buffer: pixel })
  await page.getByRole('button', { name: '上传并识别这张支付截图' }).click()
  await page.getByRole('button', { name: '生成记账卡' }).click()
  await page.getByRole('button', { name: '保存候选' }).click()
  await page.getByRole('button', { name: '核对并入账' }).click()
  await page.getByRole('button', { name: '确认入账', exact: true }).click()
  await page.getByRole('link', { name: '查看已入账记录' }).waitFor()
  assert.deepEqual(errors, [])

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' })
  await desktop.goto(origin + '/ledger')
  await desktop.getByRole('button', { name: /和朋友吃晚餐/ }).waitFor()
  await desktop.screenshot({ path: out + '/ledger-desktop.png' })
  await desktop.setViewportSize({ width: 1440, height: 480 })
  await desktop.getByRole('button', { name: '＋ 记一笔', exact: true }).click()
  const shortEditor = desktop.getByRole('dialog', { name: '记一笔', exact: true })
  await assertCentered(shortEditor)
  assert.ok(await shortEditor.evaluate(element => element.scrollHeight > element.clientHeight), 'Short-screen dialog must scroll internally')
  await desktop.keyboard.press('Escape')
  console.log('PASS Chrome mobile capture, ledger save, wish create, calendar deep link, screenshot review and confirmation; desktop layout.')
} finally {
  await browser.close()
}
