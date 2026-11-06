// Preview-only presentation checks. Message fixtures never call an AI service.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = new URL(process.env.TAROT_PREVIEW_URL || 'http://127.0.0.1:5192').origin
const output = process.env.CHAT_SCREENSHOT_DIR
if (output) await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const [width, height, mode] of [[375,812,'auto'], [375,500,'auto'], [320,600,'auto'], [1440,900,'mobile'], [1440,900,'desktop'], [375,812,'desktop']]) {
    const page = await browser.newPage({ viewport:{width,height}, reducedMotion:'reduce' })
    const errors=[]
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(mode => localStorage.setItem('mirror.presentation-mode',mode),mode)
    await page.goto(`${base}/chat`)
    await page.locator('.chat-page').waitFor()
    const mobile=mode==='mobile' || (mode==='auto' && width<900)
    if (mobile) {
      await page.getByRole('button',{name:'返回记录',exact:true}).waitFor()
      assert.equal(await page.locator('.mobile-header:visible,.bottom-nav:visible,.chat-masthead-wrap:visible,.phone-header:visible,.phone-divider:visible').count(),0,'only the compact toolbar remains')
      const input=page.getByRole('textbox',{name:'对话内容'})
      await input.fill('第一行\n第二行\n第三行\n第四行\n第五行\n第六行')
      const box=await input.boundingBox()
      assert.ok(box.height<=112,'composer caps at four 24px lines plus16px padding')
      assert.ok(await input.evaluate(el=>el.scrollHeight>el.clientHeight && getComputedStyle(el).overflowY==='auto'),'long drafts scroll inside composer')
      assert.equal(await input.evaluate(el=>getComputedStyle(el).fontSize),'16px','input avoids mobile focus zoom')
      await page.getByRole('button',{name:'更多对话操作'}).click()
      const more=page.getByRole('dialog',{name:'对话设置'})
      await more.waitFor()
      await page.keyboard.press('Escape')
      await more.waitFor({state:'hidden'})
      assert.ok(await page.getByRole('button',{name:'更多对话操作'}).evaluate(el=>el===document.activeElement),'more dialog restores focus')
      await page.getByRole('button',{name:'历史会话',exact:true}).click()
      const history=page.getByRole('dialog',{name:'历史会话',exact:true})
      await history.waitFor()
      await page.keyboard.press('Escape')
      await history.waitFor({state:'hidden'})
      await page.getByRole('button',{name:'更多对话操作'}).click()
      await more.getByRole('button',{name:/^聊天记忆/}).click()
      await page.getByRole('dialog',{name:'聊天记忆管理'}).waitFor()
      await page.getByRole('dialog',{name:'聊天记忆管理'}).getByRole('button',{name:'关闭',exact:true}).click()
      // Seed user-visible fixture bubbles to verify reading space and scrolling.
      await page.evaluate(async()=>{
        const {useChatStore}=await import('/src/stores/chat.js')
        const chat=useChatStore()
        chat.messages=Array.from({length:12},(_,index)=>({id:`fixture-${index}`,role:index%2?'ai':'user',content:index%2?'这是用于检查移动端阅读空间的示例回复。\n\n可以把事情拆成一件小事，先给自己十分钟。':'今天有些忙，想梳理一下自己的状态。',status:'completed',actionSourceMessage:index%2?`fixture-${index-1}`:undefined}))
      })
      await page.locator('.chat-msg').nth(11).waitFor()
      await input.fill('保留输入草稿')
      assert.equal(await page.locator('.chat-msg-ai .chat-msg-bubble').first().evaluate(el=>getComputedStyle(el).fontSize),'15px')
      const messages=page.locator('.chat-messages')
      assert.ok(await messages.evaluate(el=>el.clientHeight>180 && el.scrollHeight>el.clientHeight),'messages retain useful scrolling height')
      const composer=await page.locator('.chat-input-bar').boundingBox()
      assert.ok(composer.y+composer.height<=height+1,'composer remains in visible viewport')
      if (output) await page.screenshot({path:`${output}/chat-${width}x${height}-${mode}.png`})
      // Resizing represents available viewport loss; device keyboard still needs a real phone check.
      if (width===375 && height===812) {
        await page.setViewportSize({width,height:420})
        await page.waitForTimeout(100)
        const resized=await page.locator('.chat-input-bar').boundingBox()
        assert.ok(resized.y+resized.height<=421,'composer follows viewport reduction')
        await page.setViewportSize({width,height})
      }
      await input.fill('')
      await page.getByRole('button',{name:'返回记录',exact:true}).click()
      await page.waitForURL(`${base}/records`)
      await page.getByRole('button',{name:'和另一个自己聊聊',exact:true}).click()
      await page.waitForURL(`${base}/chat`)
      await page.getByRole('button',{name:'更多对话操作'}).click()
      await page.getByRole('dialog',{name:'对话设置'}).getByRole('button',{name:/^模型设置/}).click()
      await page.waitForURL(`${base}/models`)
    } else {
      assert.equal(await page.locator('.mobile-chat-toolbar').count(),0,'desktop presentation retains existing messenger layout')
      assert.equal(await page.locator('.phone-header:visible').count(),1)
      assert.equal(await page.locator('.chat-masthead-wrap:visible').count(),1)
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no document horizontal overflow')
    assert.deepEqual(errors,[])
    console.log(`PASS chat ${width}x${height} ${mode}: ${mobile?'fullscreen, history/more focus, memory/model entries, composer, messages and return':'desktop messenger retained'}`)
    await page.close()
  }
} finally { await browser.close() }
