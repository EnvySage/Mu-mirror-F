/* 第十一轮验证 B：移动端 375×812——vault 页与对话文件卡不溢出 + 全交互冒烟 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5199';
const TOKEN_FILE = 'C:/Users/15999/AppData/Local/Temp/mu_token.txt';
const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
const OUT = path.join(__dirname, 'shot-r11');
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

  // ===== 1. vault 页 375px =====
  await page.goto(BASE + '/vault', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  log('375px vault 页无横向溢出', overflow <= 0, `overflowX=${overflow}px`);

  // bottom-nav 资产入口（第六项在 375px 不溢出）
  const navItems = await page.locator('.bottom-nav .nav-item').count();
  log('bottom-nav 六项（含资产）', navItems === 6, `items=${navItems}`);
  const navBox = await page.locator('.bottom-nav').boundingBox();
  log('bottom-nav 不超屏', navBox && navBox.x + navBox.width <= 375.5, navBox ? `w=${navBox.width.toFixed(1)}` : 'n/a');

  // 配额条
  const quotaBox = await page.locator('.quota-card').boundingBox();
  log('配额卡不超屏', quotaBox && quotaBox.x + quotaBox.width <= 375.5, quotaBox ? `w=${quotaBox.width.toFixed(1)}` : 'n/a');

  // 投放区
  const dropBox = await page.locator('.dropzone').boundingBox();
  log('投放区不超屏', dropBox && dropBox.x + dropBox.width <= 375.5, dropBox ? `w=${dropBox.width.toFixed(1)}` : 'n/a');

  // 文件卡
  const assetBox = await page.locator('.asset-card').first().boundingBox();
  log('文件卡不超屏', assetBox && assetBox.x + assetBox.width <= 375.5, assetBox ? `w=${assetBox.width.toFixed(1)}` : 'n/a');
  await page.screenshot({ path: path.join(OUT, 'm1-vault.png') });

  // 低信息区
  const lowBox = await page.locator('.lowinfo-row').first().boundingBox().catch(() => null);
  log('低信息行不超屏', lowBox && lowBox.x + lowBox.width <= 375.5, lowBox ? `w=${lowBox.width.toFixed(1)}` : 'n/a');
  await page.screenshot({ path: path.join(OUT, 'm2-vault-lowinfo.png') });

  // 筛选 chips
  const filterBox = await page.locator('.filter-row').boundingBox();
  log('筛选行不超屏', filterBox && filterBox.x + filterBox.width <= 375.5, filterBox ? `w=${filterBox.width.toFixed(1)}` : 'n/a');

  // 上传卡（选文件后）不超屏 + 可保存
  await page.setInputFiles('.dropzone input[type=file]', { name: 'm_test_notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# m') });
  await page.waitForTimeout(500);
  const upBox = await page.locator('.upload-wrap').boundingBox();
  log('上传卡不超屏', upBox && upBox.x + upBox.width <= 375.5, upBox ? `w=${upBox.width.toFixed(1)}` : 'n/a');
  await page.getByRole('button', { name: '就这样存' }).click();
  await page.waitForTimeout(700);
  log('移动端上传成功（列表 +1）', (await page.locator('.asset-card').count()) === 5);
  await page.screenshot({ path: path.join(OUT, 'm3-vault-uploaded.png') });

  // 编辑框不超屏
  const editCard = page.locator('.asset-card').nth(1);
  await editCard.getByRole('button', { name: '编辑' }).click();
  await page.waitForTimeout(400);
  const editBox = await page.locator('.asset-card .as-input').first().boundingBox();
  log('编辑框不超屏', editBox && editBox.x + editBox.width <= 375.5, editBox ? `w=${editBox.width.toFixed(1)}` : 'n/a');
  await editCard.getByRole('button', { name: '取消' }).click();
  await page.waitForTimeout(300);

  // ===== 2. 对话页 375px：文件卡三档 =====
  await page.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  log('375px 对话页无横向溢出', overflow <= 0, `overflowX=${overflow}px`);

  await page.getByRole('button', { name: '看看文件卡长什么样（演示）' }).click();
  await page.waitForTimeout(900);
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  log('演示卡渲染后无横向溢出', overflow <= 0, `overflowX=${overflow}px`);

  const strongBox = await page.locator('.vref-card').first().boundingBox();
  log('强引用卡不超屏', strongBox && strongBox.x + strongBox.width <= 375.5, strongBox ? `w=${strongBox.width.toFixed(1)}` : 'n/a');
  const chipBox = await page.locator('.vref-chip').first().boundingBox();
  log('弱引用芯片不超屏', chipBox && chipBox.x + chipBox.width <= 375.5, chipBox ? `w=${chipBox.width.toFixed(1)}` : 'n/a');
  const trailBox = await page.locator('.tool-trail').first().boundingBox().catch(() => null);
  log('工具轨迹不超屏', trailBox && trailBox.x + trailBox.width <= 375.5, trailBox ? `w=${trailBox.width.toFixed(1)}` : 'n/a');
  await page.screenshot({ path: path.join(OUT, 'm4-chat-cards.png') });

  // 弱引用展开后完整卡不超屏
  await page.locator('.vref-chip', { hasText: '宿舍合照' }).click();
  await page.waitForTimeout(400);
  const weakCardBox = await page.locator('.vref-card').nth(1).boundingBox();
  log('弱引用展开卡不超屏', weakCardBox && weakCardBox.x + weakCardBox.width <= 375.5, weakCardBox ? `w=${weakCardBox.width.toFixed(1)}` : 'n/a');
  await page.screenshot({ path: path.join(OUT, 'm5-chat-expanded.png') });

  // 回执卡：跨页上传时 goto('/chat') 会重建 mock items（digest timer 作用域随条目丢弃），
  // 因此移动端在对话页内直接上传 → 等 2s 消化完成 → 回执出现（与桌面脚本 5b 同口径）
  await page.setInputFiles('.chat-input-bar input[type=file]', { name: 'm_chat_notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# c') });
  await page.waitForTimeout(500);
  await page.fill('.up-desc-input', '移动端测试');
  await page.getByRole('button', { name: '就这样存' }).click();
  await page.waitForTimeout(3000);
  const receiptBox = await page.locator('.receipt-card').first().boundingBox().catch(() => null);
  log('回执卡不超屏', receiptBox && receiptBox.x + receiptBox.width <= 375.5, receiptBox ? `w=${receiptBox.width.toFixed(1)}` : 'n/a');

  // 附件按钮 + 输入条
  const attachBox = await page.locator('.chat-attach').boundingBox();
  log('附件按钮可见', attachBox !== null, attachBox ? `w=${attachBox.width.toFixed(1)}` : 'n/a');
  const inputBox = await page.locator('.chat-input-bar').boundingBox();
  log('输入条不超屏', inputBox && inputBox.x + inputBox.width <= 375.5, inputBox ? `w=${inputBox.width.toFixed(1)}` : 'n/a');

  // ===== 3. 其余四页冒烟（改动无回归） =====
  for (const p of ['/records', '/calendar', '/mirror', '/settings']) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    log(`375px ${p} 无横向溢出`, ov <= 0, `overflowX=${ov}px`);
  }

  // ===== 汇总 =====
  const result = {
    steps: steps.length,
    pass: steps.filter(s => s.startsWith('PASS')).length,
    fail: steps.filter(s => s.startsWith('FAIL')).length,
    errors, pageErrors,
  };
  fs.writeFileSync(path.join(OUT, 'result-mobile.json'), JSON.stringify(result, null, 2));
  console.log(`\n===== 移动端走查：${result.pass}/${result.steps} PASS，${result.fail} FAIL =====`);
  console.log(`console.error=${errors.length} pageerror=${pageErrors.length}`);

  await browser.close();
  process.exit(result.fail > 0 || errors.length > 0 || pageErrors.length > 0 ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(2); });
