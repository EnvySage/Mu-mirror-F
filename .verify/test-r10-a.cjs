/* 第十轮验证 A：桌面 1600×900 走查——设置页词典卡三分组全流程 + 总结 sheet 候选分区 + 三按钮交互 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5199';
const TOKEN_FILE = 'C:/Users/15999/AppData/Local/Temp/mu_token.txt';
const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
const OUT = path.join(__dirname, 'shot-r10');
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

  // 登录态注入
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('mirror_token', t);
    localStorage.setItem('mirror_user', JSON.stringify({ id: '959fe2bb-1670-412b-8d4c-0ea38a43457f', username: 'verifyf8' }));
    localStorage.setItem('mirror_token_expires', String(Date.now() + 86400_000));
  }, token);
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  // ===== 1. 设置页词典卡 =====
  const glossaryCard = page.locator('.glossary-card');
  const cardVisible = await glossaryCard.isVisible().catch(() => false);
  log('设置页「个人词典」卡渲染', cardVisible);

  // 三分组标题
  const groupHeads = await page.locator('.glossary-group-head').allTextContents();
  const hasPending = groupHeads.some(t => t.includes('待确认'));
  const hasConfirmed = groupHeads.some(t => t.includes('已生效'));
  log('三分组标题（待确认/已生效/已忽略）', hasPending && hasConfirmed, JSON.stringify(groupHeads.map(t => t.trim().replace(/\s+/g, ' ')).slice(0, 4)));

  // 待确认 badge 计数 = mock 3 条
  const badge = page.locator('.glossary-group-head .glossary-badge').first();
  const badgeText = await badge.textContent().catch(() => '');
  log('待确认 badge 计数', badgeText.trim() === '3', `badge=${badgeText.trim()}`);

  // 侧栏设置图标角标（同一数据源）
  const navBadge = page.locator('.sidebar-nav-badge');
  const navBadgeVisible = await navBadge.isVisible().catch(() => false);
  const navBadgeText = navBadgeVisible ? (await navBadge.textContent()).trim() : '';
  log('侧栏设置图标 pending 角标', navBadgeVisible && navBadgeText === '3', `badge=${navBadgeText}`);
  await page.screenshot({ path: path.join(OUT, '01-settings-glossary.png'), fullPage: false });

  // 已生效卡显示"最后确认于x月x日 · 近 30 天相关记录 n 条"
  const statusLines = await page.locator('.term-card .term-status').allTextContents();
  const confirmedLine = statusLines.find(t => t.includes('最后确认于'));
  log('已生效卡「最后确认于x月x日」格式', !!confirmedLine && /\d+月\d+日/.test(confirmedLine), (confirmedLine || '').trim());

  // ===== 2. 待确认词条三按钮：确认 =====
  const pendingCards = page.locator('.glossary-card .term-card').filter({ hasNot: page.locator('.term-evidence') });
  const firstTermName = await page.locator('.glossary-card .term-card .term-name').first().textContent();
  const confirmBtn = page.locator('.glossary-card .term-card').first().getByRole('button', { name: '确认', exact: true });
  await confirmBtn.click();
  await page.waitForTimeout(700);
  // toast
  const toastText = await page.locator('.toast-message').first().textContent().catch(() => '');
  log('确认 toast「下次对话开始使用」', toastText.includes('下次对话开始使用'), toastText.trim());
  // badge 3 → 2
  const badgeAfter = (await page.locator('.glossary-group-head .glossary-badge').first().textContent().catch(() => '')).trim();
  log('确认后待确认 badge 3→2', badgeAfter === '2', `badge=${badgeAfter}`);
  const navBadgeAfter = (await page.locator('.sidebar-nav-badge').textContent().catch(() => '')).trim();
  log('侧栏角标同步 3→2', navBadgeAfter === '2', `badge=${navBadgeAfter}`);
  await page.screenshot({ path: path.join(OUT, '02-after-confirm.png') });

  // ===== 3. 改一改（原地展开编辑） =====
  const firstCard = page.locator('.glossary-card .term-card').first();
  await firstCard.getByRole('button', { name: '改一改' }).click();
  await page.waitForTimeout(400);
  const editVisible = await firstCard.locator('.term-edit').isVisible().catch(() => false);
  log('改一改 → 原地展开编辑框', editVisible);
  // 改 description
  const descInput = firstCard.locator('.term-textarea');
  await descInput.fill('你的毕业设计《AI 日记镜子系统》，改一改验证：RAG + 评测中。');
  await firstCard.getByRole('button', { name: '保存' }).click();
  await page.waitForTimeout(600);
  const cardText = await firstCard.textContent();
  log('编辑保存生效（新描述渲染）', cardText.includes('改一改验证'), '');
  await page.screenshot({ path: path.join(OUT, '03-after-edit.png') });

  // ===== 4. 不要（dismiss 淡出） =====
  const before = await page.locator('.glossary-card .term-card').count();
  await page.locator('.glossary-card .term-card').first().getByRole('button', { name: '不要' }).click();
  await page.waitForTimeout(900);
  const after = await page.locator('.glossary-card .term-card').count();
  log('不要 → 卡片移出待确认', after === before - 1, `before=${before} after=${after}`);
  // 已忽略组展开（折叠默认收起）
  const toggle = page.locator('.glossary-group-toggle');
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    await page.waitForTimeout(400);
    const dismissedCards = await page.locator('.glossary-card .term-card').count();
    log('已忽略组展开（折叠默认收起）', dismissedCards > 0, `展开后卡片总数=${dismissedCards}`);
  }
  await page.screenshot({ path: path.join(OUT, '04-after-dismiss.png') });

  // ===== 5. 教镜子一个词 =====
  await page.getByRole('button', { name: '教镜子一个词' }).click();
  await page.waitForTimeout(300);
  await page.locator('.glossary-add-form input').first().fill('搭子');
  await page.locator('.glossary-add-form input').nth(1).fill('饭搭子');
  await page.locator('.glossary-add-form textarea').fill('一起吃午饭的同事小王');
  await page.getByRole('button', { name: '加入词典' }).click();
  await page.waitForTimeout(1200);
  // 前序步骤 toast（3s 时长）仍在容器里，取最后一个（最新）
  const allToasts5 = await page.locator('.toast-message').allTextContents();
  const addToast = allToasts5[allToasts5.length - 1] || '';
  log('教镜子一个词 → 新增成功 toast', addToast.includes('已教给镜子'), addToast.trim());
  const addCard = page.locator('.glossary-card .term-card', { hasText: '搭子' });
  log('新词条进「已生效」组', await addCard.first().isVisible().catch(() => false), '');
  await page.screenshot({ path: path.join(OUT, '05-after-add.png') });

  // ===== 6. 重新抽取按钮 =====
  await page.getByRole('button', { name: '重新抽取' }).click();
  await page.waitForTimeout(1400);
  const allToasts6 = await page.locator('.toast-message').allTextContents();
  const extractToast = allToasts6[allToasts6.length - 1] || '';
  log('手动触发抽取', extractToast.includes('抽取完成'), extractToast.trim());

  // ===== 7. 总结 sheet 候选分区 =====
  // 先确认一条候选供 sheet 展示（store 共享；若 pending 空，刷新页面重置 mock）
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const pendingBefore = await page.locator('.sidebar-nav-badge').textContent().catch(() => '0');
  log('刷新后 mock 复位（角标恢复）', pendingBefore.trim() === '3', `badge=${pendingBefore.trim()}`);

  // 从设置页走 side sheet：桌面入口在记录页侧栏「全部」→ 这里直接经 UI store 打开（移动端 header 同一按钮）
  // 走真实交互：回记录页点侧栏「全部」
  await page.getByRole('button', { name: '记录' }).click();
  await page.waitForTimeout(1200);
  const openSummary = page.getByRole('button', { name: '全部', exact: true });
  if (await openSummary.isVisible().catch(() => false)) {
    await openSummary.click();
  } else {
    // 兜底：键盘不可达时直接调 store（等同移动端 header 每日总结按钮）
    await page.evaluate(() => document.querySelector('.records-sidebar .side-more')?.click());
  }
  await page.waitForTimeout(1500);
  const sheetVisible = await page.locator('.sheet').isVisible().catch(() => false);
  log('每日总结 sheet 打开', sheetVisible);
  const section = page.locator('.glossary-section');
  const sectionVisible = await section.isVisible().catch(() => false);
  log('sheet 内「个人词典候选」分区渲染', sectionVisible);
  const sectionTitle = await section.locator('.glossary-title').textContent().catch(() => '');
  const sectionCount = await section.locator('.glossary-count').textContent().catch(() => '');
  log('分区标题+计数', sectionTitle.trim() === '个人词典候选' && sectionCount.trim() === '3', `title=${sectionTitle.trim()} count=${sectionCount.trim()}`);
  // 状态行 + 固定警示语
  const sheetStatus = await section.locator('.term-status').first().textContent().catch(() => '');
  log('候选状态行「待确认 · 证据…」', sheetStatus.includes('待确认'), sheetStatus.trim());
  const warnText = await section.locator('.term-warn').first().textContent().catch(() => '');
  log('固定警示语（非 LLM 文案）', warnText.includes('确认后对话会按此理解检索你的记录'), warnText.trim().slice(0, 40));
  // kind 标记：new / evidence / update 三分支
  const kinds = await section.locator('.term-kind').allTextContents();
  log('kind 三分支标记渲染', kinds.length >= 2, JSON.stringify(kinds.map(k => k.trim())));
  // evidence 弱化样式
  const evidenceCard = section.locator('.term-card.term-evidence');
  const evCount = await evidenceCard.count();
  log('evidence 候选弱化样式', evCount >= 1, `evidence 卡=${evCount}`);
  await page.screenshot({ path: path.join(OUT, '06-sheet-candidates.png') });

  // sheet 内依据跳原文：记录 93 是 done 态可开详情
  const srcBtn = section.locator('.term-source').first();
  if (await srcBtn.isVisible().catch(() => false)) {
    await srcBtn.click();
    await page.waitForTimeout(1200);
    const detailVisible = await page.locator('.detail-page').isVisible().catch(() => false);
    const sheetGone = !(await page.locator('.sheet').isVisible().catch(() => false));
    log('依据：查看原文 → 关 sheet 开记录详情', detailVisible && sheetGone, '');
    await page.screenshot({ path: path.join(OUT, '07-detail-from-source.png') });
    await page.locator('.detail-back').click();
    await page.waitForTimeout(600);
  }

  // sheet 内三按钮：确认 → toast
  await page.evaluate(() => document.querySelector('.side-more')?.click());
  await page.waitForTimeout(1200);
  const sec2 = page.locator('.glossary-section');
  await sec2.locator('.term-card').first().getByRole('button', { name: '确认', exact: true }).click();
  await page.waitForTimeout(700);
  const cToast = await page.locator('.toast-message').first().textContent().catch(() => '');
  log('sheet 内确认 toast', cToast.includes('下次对话开始使用'), cToast.trim());
  await page.screenshot({ path: path.join(OUT, '08-sheet-confirm.png') });

  // sheet 内改一改
  await sec2.locator('.term-card').first().getByRole('button', { name: '改一改' }).click();
  await page.waitForTimeout(400);
  const sheetEdit = await sec2.locator('.term-edit').first().isVisible().catch(() => false);
  log('sheet 内改一改原地展开', sheetEdit);
  await sec2.locator('.term-card').first().getByRole('button', { name: '取消' }).click();
  await page.waitForTimeout(300);

  // sheet 内不要 → 淡出
  const nBefore = await sec2.locator('.term-card').count();
  await sec2.locator('.term-card').first().getByRole('button', { name: '不要' }).click();
  await page.waitForTimeout(900);
  const nAfter = await sec2.locator('.term-card').count();
  log('sheet 内不要 → 卡片淡出移除', nAfter === nBefore - 1, `before=${nBefore} after=${nAfter}`);
  await page.screenshot({ path: path.join(OUT, '09-sheet-dismiss.png') });

  // sheet 关闭
  await page.locator('.sheet-close').click();
  await page.waitForTimeout(600);

  // ===== 结果 =====
  const result = {
    steps, errors, warnings, pageErrors,
    summary: { pass: steps.filter(s => s.startsWith('PASS')).length, fail: steps.filter(s => s.startsWith('FAIL')).length },
  };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(`PASS ${result.summary.pass} / FAIL ${result.summary.fail}`);
  console.log(`console.error: ${errors.length}, console.warn: ${warnings.length}, pageerror: ${pageErrors.length}`);
  if (errors.length) console.log('ERRORS:', errors.slice(0, 10));
  if (pageErrors.length) console.log('PAGE ERRORS:', pageErrors.slice(0, 10));

  await browser.close();
  process.exit(result.summary.fail > 0 || errors.length > 0 || pageErrors.length > 0 ? 1 : 0);
})();
