// Real PostgreSQL and HTTP acceptance; no API interception or model requests.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.ACHIEVEMENT_UI_URL || 'http://127.0.0.1:5174'
const apiBase = process.env.ACHIEVEMENT_API_URL || 'http://127.0.0.1:9051/api'
const container = process.env.ACHIEVEMENT_DB_CONTAINER || 'mirror-achievements-20261111'
const database = process.env.ACHIEVEMENT_DB_NAME || 'codex_assistant_growth_test_achievements_v17'
assert.ok(database.startsWith('codex_assistant_growth_test_'), 'Disposable test database required')
const output = '.verify/achievement-complete'
await mkdir(output, { recursive: true })
function sql(statement) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'mirror_test', '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input: statement, encoding: 'utf8' }).trim()
}
async function api(path, auth, method = 'GET', data) {
  const response = await fetch(apiBase + path, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
  const result = await response.json()
  assert.equal(response.ok, true, `${method} ${path}: ${JSON.stringify(result)}`)
  assert.equal(result.code, 200, `${method} ${path}: ${JSON.stringify(result)}`)
  return result.data
}
async function until(getter, predicate, message, timeout = 10000) {
  const deadline = Date.now() + timeout
  let value
  while (Date.now() < deadline) {
    value = await getter()
    if (predicate(value)) return value
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  assert.fail(`${message}: ${JSON.stringify(value)}`)
}
function fixture(user) {
  assert.match(user, /^[a-f0-9-]{36}$/i)
  sql(`
    INSERT INTO records(user_id,content,status,created_at)
     SELECT '${user}', 'Browser record '||n, 'record_only', now()-n*interval '1 day' FROM generate_series(1,35) n;
    INSERT INTO records(user_id,content,status) SELECT '${user}', 'Browser today '||n, 'record_only' FROM generate_series(1,10) n;
    WITH matched AS (INSERT INTO records(user_id,content,status) VALUES('${user}','FILTER MATCH: happy work entry','done') RETURNING id)
     INSERT INTO chunks(user_id,record_id,content,segment,metadata) SELECT '${user}',id,'FILTER MATCH: happy work entry','FILTER MATCH: happy work entry','{"contentType":"work","mood":["happy"]}' FROM matched;
    WITH unrelated AS (INSERT INTO records(user_id,content,status) VALUES('${user}','FILTER EXCLUDE: sad note entry','done') RETURNING id)
     INSERT INTO chunks(user_id,record_id,content,segment,metadata) SELECT '${user}',id,'FILTER EXCLUDE: sad note entry','FILTER EXCLUDE: sad note entry','{"contentType":"note","mood":["sad"]}' FROM unrelated;
    INSERT INTO records(user_id,content,status,created_at)
     SELECT '${user}','Browser quarter '||n,'record_only',date_trunc('year',now())+n*interval '1 month' FROM unnest(ARRAY[1,4,7]) n;
    UPDATE records SET content=content||' Added a meaningful later sentence.' WHERE id=(SELECT max(id) FROM records WHERE user_id='${user}');
    INSERT INTO profile_snapshots(user_id,snapshot_type,period_month,overall_summary,mood_analysis,created_at)
     SELECT '${user}','monthly',to_char(now()-n*interval '1 month','YYYY-MM'),repeat('A carefully recorded personal reflection. ',300),'Mood details.',now()-n*interval '1 month' FROM generate_series(1,3) n;
    INSERT INTO profile_snapshots(user_id,snapshot_type,overall_summary,mood_analysis,learning_analysis,todo_analysis,rhythm_analysis,user_tags)
     VALUES('${user}','manual',repeat('A long reflection that must be read to its end. ',350),repeat('Mood and feelings. ',30),'Learning with evidence.','Plans are supported by records.','An individual daily rhythm.','["browser fixture"]');
    WITH summary_record AS (
     INSERT INTO records(user_id,content,source,status,user_reviewed) VALUES('${user}',repeat('This is a long daily summary. Read it fully before a reading observation is accepted. ',450),'system','done',true) RETURNING id,content
    ) INSERT INTO chunks(user_id,record_id,content,segment,metadata)
     SELECT '${user}',id,content,content,jsonb_build_object('contentType','daily_summary','summaryDate',to_char((now() AT TIME ZONE 'Asia/Shanghai')-interval '1 day','YYYY-MM-DD'),'sourceRecordIds',jsonb_build_array((SELECT min(id) FROM records WHERE user_id='${user}' AND source='user' AND (created_at AT TIME ZONE 'Asia/Shanghai')::date=(now() AT TIME ZONE 'Asia/Shanghai')::date-1)))
     FROM summary_record;
    INSERT INTO vault_items(user_id,original_name,storage_key,size_bytes,mime,category,description,digest_status)
     SELECT '${user}','Archived fixture '||n||'.txt','browser-${user}-'||n,80,'text/plain','document','A confirmed test archive','confirmed' FROM generate_series(1,10) n;
    INSERT INTO vault_items(user_id,original_name,storage_key,size_bytes,mime,category,description,digest_status)
     VALUES('${user}','Reading check.txt','browser-extracted-${user}',100,'text/plain','document','Review this extracted text before confirming.','extracted');
    WITH placeholder AS (
     INSERT INTO records(user_id,content,source,status,user_reviewed) VALUES('${user}','File extraction placeholder','system','done',true) RETURNING id
    ) INSERT INTO chunks(user_id,record_id,content,segment,metadata,vault_item_id)
     SELECT '${user}',id,repeat('Extracted passage that continues down the page. ',300),repeat('Extracted passage that continues down the page. ',300),'{}',
      (SELECT id FROM vault_items WHERE storage_key='browser-extracted-${user}') FROM placeholder;
    INSERT INTO vault_blobs(vault_item_id,data) SELECT id,convert_to('Real local file preview content.','UTF8') FROM vault_items WHERE user_id='${user}';
  `)
  return JSON.parse(sql(`SELECT json_build_object('matchRecord',(SELECT id FROM records WHERE user_id='${user}' AND content='FILTER MATCH: happy work entry'),'excludedRecord',(SELECT id FROM records WHERE user_id='${user}' AND content='FILTER EXCLUDE: sad note entry'),'snapshot',(SELECT max(id) FROM profile_snapshots WHERE user_id='${user}'),'vault',(SELECT id FROM vault_items WHERE storage_key='browser-extracted-${user}'),'summaryDate',to_char((now() AT TIME ZONE 'Asia/Shanghai')-interval '1 day','YYYY-MM-DD'));`))
}
const proofs = []
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const width of [1440, 390]) {
    const username = `ach_live_${width}_${Date.now()}`
    const password = 'BrowserTest26!'
    await api('/auth/register', null, 'POST', { username, password })
    const auth = await api('/auth/login', null, 'POST', { username, password })
    const ids = fixture(auth.user.id)
    const user = auth.user.id
    const count = (kind, subject = null) => Number(sql(`SELECT count(*) FROM user_achievement_activity WHERE user_id='${user}' AND kind='${kind}'${subject == null ? '' : ` AND subject_id='${subject}'`};`))
    const collection = await api('/achievements', auth)
    assert.equal(collection.items.length, 96)
    assert.equal(collection.items.filter(item => item.plating).length, 24)
    assert.ok(collection.items.every(item => !('platingRule' in item) && !('platingProgress' in item)))
    assert.equal(collection.items.find(item => item.code === 'R-04').plated, true)
    assert.ok(collection.items.filter(item => item.earned).length >= 10)
    const pending = await api('/achievements/pending', auth)
    await api('/achievements/acknowledge', auth, 'POST', { codes: ['R-04'] })
    assert.ok((await api('/achievements/pending', auth)).some(item => item.code === 'R-04' && item.kind === 'plated'), 'Ordinary ack must leave plating pending')
    await api('/achievements/acknowledge', auth, 'POST', { notifications: pending.filter(item => !(item.code === 'R-04' && item.kind === 'plated')).map(({code,kind}) => ({code,kind})) })
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 }, reducedMotion: 'reduce' })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`) })
    page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} [${message.location().url}]`) })
    await page.addInitScript(auth => { localStorage.setItem('mirror_token', auth.token); localStorage.setItem('mirror_user', JSON.stringify(auth.user)) }, auth)
    try {
      await page.goto(`${base}/gallery`)
      await until(() => page.locator('.filter-count b').textContent().catch(() => ''), value => value.trim() === '96', 'Catalog did not load')
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await page.locator('.medal-dialog.reveal').waitFor()
      assert.match(await page.locator('.medal-dossier-header').innerText(), /镜闪镀层解锁/)
      await page.screenshot({ path: `${output}/plating-notification-${width}.png` })
      const ack = page.waitForResponse(response => response.url().endsWith('/achievements/acknowledge') && response.request().method() === 'POST')
      await page.getByRole('button', { name: '收下镀层', exact: true }).click()
      assert.equal((await ack).status(), 200)
      assert.ok(!(await api('/achievements/pending', auth)).some(item => item.code === 'R-04' && item.kind === 'plated'))
      for (const capacity of [8, 10]) {
        await page.getByRole('button', { name: /布置展架/ }).click()
        await page.getByRole('button', { name: `${capacity} 位`, exact: true }).click()
        const clear = page.getByRole('button', { name: '清空选择', exact: true })
        if (await clear.isEnabled()) await clear.click()
        for (let index = 0; index < capacity; index++) await page.locator('.showcase-picker button').nth(index).click()
        await page.screenshot({ path: `${output}/showcase-editor-${capacity}-${width}.png` })
        await page.getByRole('button', { name: '保存布置 ↗', exact: true }).click()
        await page.locator('.showcase-editor').waitFor({ state: 'detached' })
        const saved = await api('/achievements/showcase', auth)
        assert.equal(saved.capacity, capacity); assert.equal(saved.codes.length, capacity)
        await page.reload()
        await until(() => page.locator('.showcase-heading small').textContent().catch(() => ''), value => value.trim() === `${capacity} / ${capacity}`, 'Saved showcase did not restore')
        await page.screenshot({ path: `${output}/showcase-restored-${capacity}-${width}.png` })
      }
      // New showcase awards must not interrupt the reading flow.
      await api('/achievements/acknowledge', auth, 'POST', { notifications: (await api('/achievements/pending', auth)).map(({code,kind}) => ({code,kind})) })
      await page.goto(`${base}/records`)
      await page.getByRole('combobox', { name: '按情绪筛选', exact: true }).selectOption('happy')
      await until(() => page.locator('.record-card').evaluateAll(elements => elements.map(element => element.dataset.objectId)), values => values.includes(String(ids.matchRecord)) && !values.includes(String(ids.excludedRecord)) && values.length === 1, 'Mood filter did not exclude unrelated records')
      await page.getByRole('combobox', { name: '按内容类型筛选', exact: true }).selectOption('work')
      await until(() => page.locator('.record-card').evaluateAll(elements => elements.map(element => element.dataset.objectId)), values => values.length === 1 && values[0] === String(ids.matchRecord), 'Content type filter did not restrict records')
      await page.getByRole('combobox', { name: '按情绪筛选', exact: true }).selectOption('')
      await page.getByRole('combobox', { name: '按内容类型筛选', exact: true }).selectOption('')
      await page.locator('.records-page').getByRole('button', { name: '每日总结', exact: true }).click()
      await page.getByRole('button', { name: new RegExp(`阅读 ${ids.summaryDate}`) }).click()
      await page.locator('.summary-text[data-reading-end], .summary-text [data-reading-end]').first().waitFor({ state: 'attached' })
      assert.equal(count('summary.opened'), 0, 'Expanding a long summary does not prove reading')
      await page.screenshot({ path: `${output}/summary-before-end-${width}.png` })
      await page.locator('.summary-text [data-reading-end]').scrollIntoViewIfNeeded()
      await until(() => count('summary.opened'), value => value === 1, 'Summary read observation missing')
      await page.locator('.summary-sources button').first().waitFor()
      assert.ok((await page.locator('.summary-sources button').first().innerText()).includes('Browser record 1'), 'CamelCase source IDs must produce the actual summary source link')
      await page.screenshot({ path: `${output}/summary-read-${width}.png` })
      await page.locator('.sheet-close').click()
      await page.goto(`${base}/mirror`)
      await page.getByRole('button', { name: '阅读完整画像 ↗', exact: true }).click()
      await page.locator('.snapshot-reader-scroll [data-reading-end]').waitFor({ state: 'attached' })
      assert.equal(count('snapshot.opened', ids.snapshot), 0, 'Expanding a long portrait does not prove reading')
      await page.locator('.snapshot-reader-scroll').scrollIntoViewIfNeeded()
      await page.locator('.snapshot-reader-scroll').evaluate(element => { element.scrollTop = element.scrollHeight })
      await until(() => count('snapshot.opened', ids.snapshot), value => value === 1, 'Portrait read observation missing')
      await page.screenshot({ path: `${output}/portrait-read-${width}.png` })
      await page.goto(`${base}/vault`)
      const asset = page.locator(`[data-asset-id="${ids.vault}"]`)
      await asset.getByRole('button', { name: '补确认', exact: true }).click()
      await asset.getByRole('button', { name: '检查提取出的内容 ↗', exact: true }).click()
      await asset.locator('.vault-chunk-scroll [data-reading-end]').waitFor({ state: 'attached' })
      assert.equal(count('vault.reviewed', ids.vault), 0, 'Opening extracted chunks does not prove reading')
      await asset.locator('.vault-chunk-scroll').scrollIntoViewIfNeeded()
      await asset.locator('.vault-chunk-scroll').evaluate(element => { element.scrollTop = element.scrollHeight })
      await until(() => count('vault.reviewed', ids.vault), value => value === 1, 'Extracted chunks read observation missing')
      await asset.getByText('已读完提取内容', { exact: true }).waitFor()
      await page.screenshot({ path: `${output}/asset-chunks-read-${width}.png` })
      assert.deepEqual(errors, [], 'No browser errors are allowed')
      proofs.push({ width, username, user, ids, catalog: 96, plating: 24, showcase: [8,10], summaryRead: true, portraitRead: true, vaultRead: true, browserErrors: errors })
      console.log(`PASS ${width}px: real 96/24 catalog, independent plating ack, 8/10 persisted showcase, three scroll-end observations`)
    } catch (error) {
      await page.screenshot({ path: `${output}/failure-${width}.png` }).catch(() => {})
      await writeFile(`${output}/failure-${width}.txt`, `${error.stack}\nBrowser errors:\n${errors.join('\n')}\n\n${await page.locator('body').innerText()}`, 'utf8')
      throw error
    } finally { await context.close() }
  }
  await writeFile(`${output}/proof.json`, JSON.stringify(proofs, null, 2), 'utf8')
} finally { await browser.close() }
