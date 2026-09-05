/* 1c 验证 v3：按钮导航（sidebar-nav-item）+ bottom-nav 双通道 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5199';
const token = fs.readFileSync('C:/Users/15999/AppData/Local/Temp/mu_token.txt', 'utf8').trim();
const OUT = path.join(__dirname, 'shot3');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const warnings = [];
const pageErrors = [];
const steps = [];

function log(step, extra) {
  steps.push(`${step}${extra ? ' | ' + extra : ''}`);
  console.log(`STEP | ${step}${extra ? ' | ' + extra : ''}`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text().slice(0, 300)}`);
    if (msg.type() === 'warning') warnings.push(`[console.warn] ${msg.text().slice(0, 200)}`);
  });
  page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message.slice(0, 300)}`));

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('mirror_token', t);
    localStorage.setItem('mirror_user', JSON.stringify({ id: '959fe2bb-1670-412b-8d4c-0ea38a43457f', username: 'verifyf8' }));
    localStorage.setItem('mirror_token_expires', String(Date.now() + 86400_000));
  }, token);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  log('进入应用', page.url());

  // sidebar-nav-item 是 button，label 在 span 里
  const navNames = ['记录', '日历', '对话', '镜子', '设置'];
  for (let round = 1; round <= 3; round++) {
    for (const name of navNames) {
      const t0 = Date.now();
      try {
        const btn = page.locator('.sidebar-nav-item', { hasText: name }).first();
        await btn.click({ timeout: 4000 });
        await page.waitForTimeout(2000);
        log(`R${round} 切到 ${name}`, `${Date.now() - t0}ms url=${page.url()}`);
        await page.screenshot({ path: path.join(OUT, `r${round}-${name}.png`) });
      } catch (e) {
        log(`R${round} 切到 ${name} 失败`, e.message.split('\n')[0].slice(0, 120));
      }
    }
  }

  console.log('\n===== 汇总 =====');
  console.log(`console.error 总数: ${errors.length}`);
  errors.forEach(e => console.log('  ' + e));
  console.log(`pageerror 总数: ${pageErrors.length}`);
  pageErrors.forEach(e => console.log('  ' + e));
  console.log(`console.warn 总数: ${warnings.length}`);
  warnings.slice(0, 10).forEach(w => console.log('  ' + w));

  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ steps, errors, pageErrors, warnings }, null, 2));
  await browser.close();
  process.exit(errors.length || pageErrors.length ? 1 : 0);
})();
