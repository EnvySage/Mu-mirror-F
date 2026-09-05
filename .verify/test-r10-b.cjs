/* 第十轮验证 B：移动端 375px——词典卡与候选分区不溢出 + 角标 + 交互 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5199';
const TOKEN_FILE = 'C:/Users/15999/AppData/Local/Temp/mu_token.txt';
const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
const OUT = path.join(__dirname, 'shot-r10');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const pageErrors = [];
const steps = [];
function log(step, ok, extra) {
  steps.push(`${ok ? 'PASS' : 'FAIL'} | ${step}${extra ? ' | ' + extra : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${step}${extra ? ' | ' + extra : ''}`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 250)); });
  page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 250)));

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('mirror_token', t);
    localStorage.setItem('mirror_user', JSON.stringify({ id: '959fe2bb-1670-412b-8d4c-0ea38a43457f', username: 'verifyf8' }));
    localStorage.setItem('mirror_token_expires', String(Date.now() + 86400_000));
  }, token);
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  // 横向溢出检测
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  log('375px 设置页无横向溢出', overflow <= 0, `overflowX=${overflow}px`);

  // 移动端设置入口角标
  const mBadge = page.locator('.header-icon-badge');
  const mBadgeVisible = await mBadge.isVisible().catch(() => false);
  const mBadgeText = mBadgeVisible ? (await mBadge.textContent()).trim() : '';
  log('移动端设置图标 pending 角标', mBadgeVisible && mBadgeText === '3', `badge=${mBadgeText}`);

  // 词典卡三分组渲染 + 卡片宽度
  const cardVisible = await page.locator('.glossary-card').isVisible().catch(() => false);
  log('词典卡渲染', cardVisible);
  const termBox = await page.locator('.glossary-card .term-card').first().boundingBox();
  log('词条卡不超屏（≤375px）', termBox && termBox.x >= 0 && termBox.x + termBox.width <= 375.5,
    termBox ? `x=${termBox.x.toFixed(1)} w=${termBox.width.toFixed(1)}` : 'n/a');
  const warnBox = await page.locator('.term-warn').first().boundingBox();
  log('警示语条不超屏', warnBox && warnBox.x + warnBox.width <= 375.5, warnBox ? `w=${warnBox.width.toFixed(1)}` : 'n/a');
  await page.screenshot({ path: path.join(OUT, 'm1-settings-glossary.png') });

  // 教镜子一个词表单不超屏
  await page.getByRole('button', { name: '教镜子一个词' }).click();
  await page.waitForTimeout(400);
  const formBox = await page.locator('.glossary-add-form').boundingBox();
  log('新增表单不超屏', formBox && formBox.x + formBox.width <= 375.5, formBox ? `w=${formBox.width.toFixed(1)}` : 'n/a');
  await page.screenshot({ path: path.join(OUT, 'm2-add-form.png') });
  await page.locator('.glossary-cancel').click();
  await page.waitForTimeout(300);

  // 编辑框不超屏
  await page.locator('.glossary-card .term-card').first().getByRole('button', { name: '改一改' }).click();
  await page.waitForTimeout(400);
  const editBox = await page.locator('.term-edit').first().boundingBox();
  log('原地编辑框不超屏', editBox && editBox.x + editBox.width <= 375.5, editBox ? `w=${editBox.width.toFixed(1)}` : 'n/a');
  await page.locator('.term-card .term-btn-ghost').first().click();
  await page.waitForTimeout(300);

  // 移动端每日总结入口（MobileHeader 文档按钮）→ 候选分区
  await page.locator('.header-icon-btn[title="每日总结"]').click();
  await page.waitForTimeout(1500);
  const sheetVisible = await page.locator('.sheet').isVisible().catch(() => false);
  log('移动端每日总结 sheet 打开', sheetVisible);
  const sheetOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  log('sheet 打开后无横向溢出', sheetOverflow <= 0, `overflowX=${sheetOverflow}px`);
  const secVisible = await page.locator('.glossary-section').isVisible().catch(() => false);
  log('候选分区渲染', secVisible);
  const secBox = await page.locator('.glossary-section').boundingBox();
  log('候选分区不超屏', secBox && secBox.x + secBox.width <= 375.5, secBox ? `w=${secBox.width.toFixed(1)}` : 'n/a');
  // 三按钮行不超屏
  const actionsBox = await page.locator('.glossary-section .term-actions').first().boundingBox();
  log('三按钮行不超屏', actionsBox && actionsBox.x + actionsBox.width <= 375.5, actionsBox ? `w=${actionsBox.width.toFixed(1)}` : 'n/a');
  await page.screenshot({ path: path.join(OUT, 'm3-sheet-candidates.png') });

  // sheet 内确认交互
  await page.locator('.glossary-section .term-card').first().getByRole('button', { name: '确认', exact: true }).click();
  await page.waitForTimeout(800);
  const toasts = await page.locator('.toast-message').allTextContents();
  log('sheet 内确认 toast', (toasts[toasts.length - 1] || '').includes('下次对话开始使用'), (toasts[toasts.length - 1] || '').trim());
  await page.screenshot({ path: path.join(OUT, 'm4-sheet-confirm.png') });

  // 依据跳详情（375px 全屏 detail page）
  const srcBtn = page.locator('.glossary-section .term-source').first();
  if (await srcBtn.isVisible().catch(() => false)) {
    await srcBtn.click();
    await page.waitForTimeout(1200);
    const detailVisible = await page.locator('.detail-page').isVisible().catch(() => false);
    log('依据 → 记录详情（375px）', detailVisible);
    await page.screenshot({ path: path.join(OUT, 'm5-detail.png') });
  }

  // 五页切换冒烟（词典改动未破坏其它页）
  for (const name of ['记录', '日历', '对话', '镜子']) {
    await page.goto(`${BASE}/${({ '记录': 'records', '日历': 'calendar', '对话': 'chat', '镜子': 'mirror' })[name]}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    log(`${name}页 375px 无溢出 0 error`, ov <= 0, `overflowX=${ov}px`);
  }

  const result = { steps, errors, pageErrors, summary: { pass: steps.filter(s => s.startsWith('PASS')).length, fail: steps.filter(s => s.startsWith('FAIL')).length } };
  fs.writeFileSync(path.join(OUT, 'result-mobile.json'), JSON.stringify(result, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(`PASS ${result.summary.pass} / FAIL ${result.summary.fail}`);
  console.log(`console.error: ${errors.length}, pageerror: ${pageErrors.length}`);
  if (errors.length) console.log('ERRORS:', errors.slice(0, 8));
  await browser.close();
  process.exit(result.summary.fail > 0 || errors.length > 0 ? 1 : 0);
})();
