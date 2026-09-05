/* 第十一轮验证 A：桌面 1600×900——vault 页全操作 + 对话文件卡三档 + 工具轨迹 + 回执三键 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5199';
const TOKEN_FILE = 'C:/Users/15999/AppData/Local/Temp/mu_token.txt';
const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
const OUT = path.join(__dirname, 'shot-r11');
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

  // 登录态注入（verifyf8，与后端真跑一致）
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('mirror_token', t);
    localStorage.setItem('mirror_user', JSON.stringify({ id: '959fe2bb-1670-412b-8d4c-0ea38a43457f', username: 'verifyf8' }));
    localStorage.setItem('mirror_token_expires', String(Date.now() + 86400_000));
  }, token);

  // ===== 1. 五页切换冒烟（vault 加入后六路由） =====
  for (const [name, pathName] of [['records', '/records'], ['calendar', '/calendar'], ['vault', '/vault'], ['chat', '/chat'], ['mirror', '/mirror'], ['settings', '/settings']]) {
    await page.goto(BASE + pathName, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const app = await page.locator('.app').isVisible().catch(() => false);
    log(`页面切换 ${name}`, app);
  }

  // ===== 2. vault 页初始渲染 =====
  await page.goto(BASE + '/vault', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '01-vault-initial.png') });

  // 侧栏资产入口 active
  const navActive = await page.locator('.sidebar-nav-item.active').textContent().catch(() => '');
  log('侧栏「资产」入口激活', navActive.includes('资产'), `active=${navActive.trim()}`);

  // mock 4 件套（otaku_it：开题报告/合照/歌/失败扫描件）
  const cardCount = await page.locator('.asset-card').count();
  log('资产列表 4 条 mock 渲染', cardCount === 4, `count=${cardCount}`);

  // 配额条
  const quotaLabel = await page.locator('.quota-label').textContent().catch(() => '');
  log('配额条文案「已用 x / 500MB」', /已用 .+ \/ 500MB/.test(quotaLabel), quotaLabel.trim());
  const quotaW = await page.locator('.quota-fill').evaluate(el => parseFloat(getComputedStyle(el).width));
  log('配额条有宽度（>0）', quotaW > 0, `w=${quotaW.toFixed(0)}px`);

  // digest 四态文案
  const metaAll = await page.locator('.asset-card .as-meta').allTextContents();
  const metaJoin = metaAll.join(' ');
  log('digest done=可检索', metaJoin.includes('可检索'));
  log('digest skipped=仅保管', metaJoin.includes('仅保管'));
  log('digest failed=读取失败', metaJoin.includes('读取失败'));

  // 低信息置顶区（合照+扫描件无描述 → 2 条）
  const lowCount = await page.locator('.lowinfo-row').count();
  log('低信息置顶区 2 条', lowCount === 2, `count=${lowCount}`);
  const lowHint = await page.locator('.lowinfo-row').first().textContent().catch(() => '');
  log('低信息提示文案', lowHint.includes('请描述一下'));
  await page.screenshot({ path: path.join(OUT, '02-vault-lowinfo.png') });

  // ===== 3. 类型筛选 chips =====
  await page.locator('.filter-row .chip', { hasText: '音频' }).click();
  await page.waitForTimeout(400);
  const audioCount = await page.locator('.asset-card').count();
  log('筛选音频 → 1 条', audioCount === 1, `count=${audioCount}`);
  await page.locator('.filter-row .chip', { hasText: '文档' }).click();
  await page.waitForTimeout(400);
  const docCount = await page.locator('.asset-card').count();
  log('筛选文档 → 2 条', docCount === 2, `count=${docCount}`);
  await page.locator('.filter-row .chip', { hasText: '全部' }).click();
  await page.waitForTimeout(400);
  log('筛选全部 → 4 条', (await page.locator('.asset-card').count()) === 4);

  // ===== 4. 上传卡全流程（Playwright setInputFiles 造 pdf） =====
  // 4a 拒绝：svg（防 XSS 理由）
  await page.setInputFiles('.dropzone input[type=file]', {
    name: 'evil.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await page.waitForTimeout(500);
  const svgToast = await page.locator('.toast-message').last().textContent().catch(() => '');
  log('svg 被拒 + toast 原因', svgToast.includes('XSS') || svgToast.includes('不支持'), svgToast.trim());

  // 4b 拒绝：视频
  await page.setInputFiles('.dropzone input[type=file]', {
    name: 'movie.mp4', mimeType: 'video/mp4', buffer: Buffer.from('x'),
  });
  await page.waitForTimeout(500);
  const mp4Toast = await page.locator('.toast-message').last().textContent().catch(() => '');
  log('mp4 被拒 + toast 原因', mp4Toast.includes('视频'), mp4Toast.trim());

  // 4c 通过：合法 pdf → 上传卡弹出（元数据榨取名）
  await page.setInputFiles('.dropzone input[type=file]', {
    name: 'RAG_检索评测_中期报告.pdf', mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 mock'),
  });
  await page.waitForTimeout(500);
  const upWrap = page.locator('.upload-wrap');
  const upVisible = await upWrap.isVisible().catch(() => false);
  log('合法 pdf → 上传卡弹出', upVisible);
  const upName = await page.locator('.up-mini-name').textContent().catch(() => '');
  log('元数据榨取名（下划线转空格）', upName.includes('RAG 检索评测 中期报告'), upName.trim());
  const upRecog = await page.locator('.up-mini-meta').textContent().catch(() => '');
  log('AI 已识别行', upRecog.includes('AI 已识别'), upRecog.trim());
  await page.screenshot({ path: path.join(OUT, '03-upload-card.png') });

  // 4d 填描述 + 就这样存
  await page.fill('.up-mini-input', '检索评测的中期数据表');
  await page.getByRole('button', { name: '就这样存' }).click();
  await page.waitForTimeout(700);
  const savedToast = await page.locator('.toast-message').last().textContent().catch(() => '');
  log('上传成功 toast「消化中」', savedToast.includes('消化中'), savedToast.trim());
  const countAfter = await page.locator('.asset-card').count();
  log('列表变 5 条', countAfter === 5, `count=${countAfter}`);
  const pendingDots = await page.locator('.asset-card .dot-pending').count();
  log('新条目 pending 黄点「索引中」', pendingDots === 1, `dots=${pendingDots}`);

  // ===== 5. 对话页消化回执（mock 2s 消化完成）+ 文件卡三档 =====
  await page.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // 5a 演示气泡：文件卡三档 + 工具轨迹
  await page.getByRole('button', { name: '看看文件卡长什么样（演示）' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '04-chat-demo-cards.png') });

  const trailChips = await page.locator('.tool-trail-chip').allTextContents();
  log('工具轨迹芯片（find_item+search_records）', trailChips.length === 2, JSON.stringify(trailChips.map(t => t.trim())));

  // 强引用完整卡：quote + 预览/下载按钮
  const strongCard = page.locator('.vref-card', { hasText: '毕业论文-开题报告' });
  const strongVisible = await strongCard.isVisible().catch(() => false);
  log('强引用完整卡渲染', strongVisible);
  const quoteText = await strongCard.locator('.vref-quote p').textContent().catch(() => '');
  log('AI 引用摘录（quote 引用条）', quoteText.includes('消融实验'), quoteText.trim().slice(0, 30));
  const strongMeta = await strongCard.locator('.vref-meta').textContent().catch(() => '');
  log('强引用 meta 行（2.1MB·存入·已可检索）', strongMeta.includes('2.1MB') && strongMeta.includes('存入') && strongMeta.includes('已可检索'), strongMeta.trim());
  const btnCount = await strongCard.locator('.vref-btn').count();
  log('强引用 [预览][下载] 按钮', btnCount >= 2, `btns=${btnCount}`);

  // 弱引用芯片：IMG 合照 → 点击展开
  const weakChip = page.locator('.vref-chip', { hasText: '宿舍合照' });
  const weakVisible = await weakChip.isVisible().catch(() => false);
  log('弱引用行内芯片', weakVisible);
  await weakChip.click();
  await page.waitForTimeout(400);
  const weakExpanded = await page.locator('.vref-card', { hasText: '宿舍合照' }).isVisible().catch(() => false);
  log('弱引用点击展开完整卡', weakExpanded);

  // 模糊提及芯片：「昨天传的图片」+ 确认提示
  const vagueChip = page.locator('.vref-chip', { hasText: '昨天传的图片' });
  const vagueVisible = await vagueChip.isVisible().catch(() => false);
  log('模糊提及芯片（可能指的是它）', vagueVisible);
  const vagueTag = await vagueChip.locator('.vref-chip-tag').textContent().catch(() => '');
  log('模糊提及 tag 文案', vagueTag.includes('可能指的是它'), vagueTag.trim());
  await vagueChip.click();
  await page.waitForTimeout(400);
  const vagueHint = await page.locator('.vref-vague-hint').textContent().catch(() => '');
  log('模糊提及展开确认「你指的是这个吗」', vagueHint.includes('你指的是这个吗'), vagueHint.trim());
  await page.screenshot({ path: path.join(OUT, '05-chat-expanded-cards.png') });

  // mock 门：预览按钮置灰（disabled），点击被拦截不发请求（无 toast 由 disabled 保证）
  const previewDisabled = await page.locator('.vref-card', { hasText: '毕业论文-开题报告' }).locator('.vref-btn', { hasText: '预览' }).isDisabled().catch(() => false);
  log('mock 预览按钮置灰（disabled）', previewDisabled === true);

  // 5b 回执卡（在对话页直接上传 → 不切页等 2s 消化完成 → 回执出现在消息流末尾）
  await page.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.setInputFiles('.chat-input-bar input[type=file]', {
    name: '实验记录_notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# notes'),
  });
  await page.waitForTimeout(500);
  const upCard2 = await page.locator('.up-card').isVisible().catch(() => false);
  log('对话页附件入口 → 上传卡弹出', upCard2);
  // 也可以在这里填描述（placeholder 以后想怎么找到它？）
  await page.fill('.up-desc-input', '评测实验的流水记录');
  await page.getByRole('button', { name: '就这样存' }).click();
  await page.waitForTimeout(600);
  // 等消化完成（mock 2s）→ 回执出现
  await page.waitForTimeout(2400);
  const receipt = page.locator('.receipt-card');
  const receiptVisible = await receipt.isVisible().catch(() => false);
  log('消化回执卡出现（2s 后）', receiptVisible);
  await page.screenshot({ path: path.join(OUT, '06-receipt-card.png') });

  // 5c 三键：改一改 → 原地编辑
  await receipt.getByRole('button', { name: '改一改' }).click();
  await page.waitForTimeout(400);
  const editVisible = await receipt.locator('.receipt-input').first().isVisible().catch(() => false);
  log('回执改一改 → 原地编辑框', editVisible);
  await receipt.locator('.receipt-input').first().fill('实验记录（改）');
  await receipt.getByRole('button', { name: '保存' }).click();
  await page.waitForTimeout(500);
  const savedT = await page.locator('.toast-message').last().textContent().catch(() => '');
  log('回执保存 toast「已更新」', savedT.includes('已更新'), savedT.trim());
  const rTitle2 = await receipt.locator('.receipt-title').textContent().catch(() => '');
  log('回执标题更新为「实验记录（改）」', rTitle2.includes('实验记录（改）'), rTitle2.trim());

  // 5d 三键：不是这个，删了 → 内联二次确认 → 淡出
  await receipt.getByRole('button', { name: '不是这个，删了' }).click();
  await page.waitForTimeout(300);
  const delWarn = await receipt.locator('.receipt-delete-warn').textContent().catch(() => '');
  log('内联二次确认「不可恢复」', delWarn.includes('不可恢复'), delWarn.trim().slice(0, 24));
  await receipt.getByRole('button', { name: '确认删除' }).click();
  await page.waitForTimeout(700);
  const receiptGone = (await page.locator('.receipt-card').count()) === 0;
  log('确认删除 → 回执淡出消失', receiptGone);

  // ===== 6. vault 页编辑/删除 + 回执后的资产联动 =====
  await page.goto(BASE + '/vault', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // 6a 编辑（改一张卡的名字）——用有描述的开题报告卡，避免与 6b 低信息卡重合
  // 注意：进入编辑态后卡内不再渲染 as-name 文本，hasText 过滤会失配 → 用 nth 下标固定引用
  const firstCard = page.locator('.asset-card').nth(1); // 排序第 2 位 = 毕业论文-开题报告
  await firstCard.getByRole('button', { name: '编辑' }).click();
  await page.waitForTimeout(400);
  const asEdit = await firstCard.locator('.as-input').first().isVisible().catch(() => false);
  log('资产卡编辑展开', asEdit);
  await firstCard.locator('.as-input').first().fill('改过的名字');
  await firstCard.getByRole('button', { name: '保存' }).click();
  await page.waitForTimeout(500);
  const editedName = await firstCard.locator('.as-name').textContent().catch(() => '');
  log('资产卡保存生效', editedName.includes('改过的名字'), editedName.trim());
  await page.screenshot({ path: path.join(OUT, '07-vault-after-edit.png') });

  // 6b 低信息卡补描述 → 归位（置顶区少一条）
  const lowBefore = await page.locator('.lowinfo-row').count();
  // 合照卡（无描述）→ 编辑补描述；同理用下标固定（排序列表第 1 位 = IMG_0901 宿舍合照）
  const photoCard = page.locator('.asset-card').nth(0);
  await photoCard.scrollIntoViewIfNeeded().catch(() => {});
  await photoCard.getByRole('button', { name: '编辑' }).click();
  await page.waitForTimeout(300);
  await photoCard.locator('.as-input').nth(1).fill('9 月 1 日宿舍楼下合照，四个人');
  await photoCard.getByRole('button', { name: '保存' }).click();
  await page.waitForTimeout(500);
  const lowAfter = await page.locator('.lowinfo-row').count();
  log(`低信息卡补描述后归位（${lowBefore}→${lowAfter}）`, lowAfter === lowBefore - 1, `before=${lowBefore} after=${lowAfter}`);

  // 6c 删除二次确认
  const delTarget = page.locator('.asset-card').first();
  await delTarget.scrollIntoViewIfNeeded().catch(() => {});
  const delName = (await delTarget.locator('.as-name').textContent()).trim();
  await delTarget.locator('.as-del').click();
  await page.waitForTimeout(300);
  const asWarn = await delTarget.locator('.as-delete-warn').textContent().catch(() => '');
  log('资产卡删除二次确认', asWarn.includes('不可恢复'), asWarn.trim().slice(0, 24));
  await page.screenshot({ path: path.join(OUT, '08-vault-delete-confirm.png') });
  await delTarget.getByRole('button', { name: '确认删除' }).click();
  await page.waitForTimeout(700);
  const stillThere = await page.locator('.asset-card', { hasText: delName }).count();
  log(`删除生效（「${delName}」消失）`, stillThere === 0);
  await page.screenshot({ path: path.join(OUT, '09-vault-after-delete.png') });

  // ===== 7. 汇总 =====
  const result = {
    steps: steps.length,
    pass: steps.filter(s => s.startsWith('PASS')).length,
    fail: steps.filter(s => s.startsWith('FAIL')).length,
    errors, warnings, pageErrors,
  };
  fs.writeFileSync(path.join(OUT, 'result-desktop.json'), JSON.stringify(result, null, 2));
  console.log(`\n===== 桌面走查：${result.pass}/${result.steps} PASS，${result.fail} FAIL =====`);
  console.log(`console.error=${errors.length} warn=${warnings.length} pageerror=${pageErrors.length}`);

  await browser.close();
  process.exit(result.fail > 0 || errors.length > 0 || pageErrors.length > 0 ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(2); });
