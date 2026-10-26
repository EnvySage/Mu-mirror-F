// Real API acceptance. Accounts/records are synthetic; no route interception.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const output = process.env.MIRROR_TAROT_TEST_OUTPUT
if (!output) throw new Error('Run B/scripts/tarot_e2e.py first and supply MIRROR_TAROT_TEST_OUTPUT')
const auth = JSON.parse(await readFile(`${output}/test-account.json`, 'utf8'))
const other = JSON.parse(await readFile(`${output}/test-other-account.json`, 'utf8'))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(auth => {
    if (!localStorage.getItem('mirror_token')) {
      localStorage.setItem('mirror_token', auth.token)
      localStorage.setItem('mirror_user', JSON.stringify(auth.user))
    }
  }, auth)
  await page.goto(process.env.TAROT_UI_URL || 'http://127.0.0.1:5180/tarot')
  await page.getByText('今天已抽取', { exact: true }).waitFor()
  await page.getByRole('button', { name: '问一问', exact: true }).click()
  await page.locator('.reading-text').waitFor()
  assert.ok((await page.locator('.reading-text').innerText()).includes('[D1]'))
  for (const ref of ['D1', 'T1', 'M1']) {
    await page.locator('.tarot-sources button').filter({ hasText: `[${ref}]` }).click()
    await page.locator('.source-text').waitFor()
    assert.ok((await page.locator('.source-text').innerText()).length > 4)
    await page.keyboard.press('Escape')
  }
  await page.screenshot({ path: `${output}/live-question-1440.png` })
  // Switch account in the running app to exercise state clearing before navigation.
  await page.evaluate(other => {
    localStorage.setItem('mirror_token', other.token)
    localStorage.setItem('mirror_user', JSON.stringify(other.user))
    const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('auth')
    store.token = other.token; store.user = other.user
  }, other)
  await page.getByRole('button', { name: '心里有个问题，抽一张', exact: true }).waitFor()
  assert.equal(await page.locator('.reading-text').count(), 0)
  await page.getByRole('button', { name: /^收藏册/ }).click()
  assert.equal(await page.getByRole('button', { name: '尚未获得', exact: true }).count(), 12)
  assert.deepEqual(errors, [])
  console.log('PASS real browser: restored daily/readings, three original source dialogs, live account switch clears personal results and collection')
} finally { await browser.close() }
