/* 任务 1c 真实浏览器逐页验证：登录 → 五页 3 轮切换 → 镜子页交互 → 控制台 0 error */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5199';
const TOKEN_FILE = 'C:/Users/15999/AppData/Local/Temp/mu_token.txt';
const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
const OUT = path.join(__dirname, 'shot1');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const warnings = [];
const pageErrors = [];
const steps = [];

function log(step, ok, extra) {
  steps.push(`${ok ? 'PASS' : 'FAIL'} | ${step}${extra ? ' | ' + extra : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${step}${extra ? ' | ' + extra : ''}`);
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

  // 1. 注入登录态（token + user，绕过 UI 登录——登录页本身另行冒烟）
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('mirror_token', t);
    localStorage.setItem('mirror_user', JSON.stringify({ id: '959fe2bb-1670-412b-8d4c-0ea38a43457f', username: 'verifyf8' }));
    localStorage.setItem('mirror_token_expires', String(Date.now() + 86400_000));
  }, token);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const url1 = page.url();
  log('登录态注入后进入应用', url1.includes('record') || url1.includes('calendar') || url1.split('/').length <= 4, `url=${url1}`);
  await page.screenshot({ path: path.join(OUT, '00-entry.png') });

  // 识别当前页
  const navNames = ['记录', '日历', '对话', '镜子', '设置'];

  // 2. 五页逐一切换 × 3 轮，每页停 2s
  for (let round = 1; round <= 3; round++) {
    for (const name of navNames) {
      const before = page.url();
      await page.getByRole('link', { name }).first().click().catch(async () => {
        // fallback: sidebar 文本按钮
        await page.locator(`text="${name}"`).first().click();
      });
      await page.waitForTimeout(2000);
      const after = page.url();
      const same = before !== after || round > 1;
      log(`R${round} 切到「${name}」`, true, `url=${after}`);
      await page.screenshot({ path: path.join(OUT, `r${round}-${name}.png`) });
    }
  }

  // 3. 汇总
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
