import test from 'node:test'
import assert from 'node:assert/strict'
import { createChatScrollController } from '../src/motion/useChatScroll.js'

function fixture() {
  const frames = new Map()
  let frameId = 0
  let writes = 0
  let top = 500
  const el = {
    scrollHeight: 1000, clientHeight: 500,
    get scrollTop() { return top },
    set scrollTop(value) { writes++; top = value },
  }
  const controller = createChatScrollController({
    getElement: () => el,
    requestFrame: callback => { frames.set(++frameId, callback); return frameId },
    cancelFrame: id => frames.delete(id),
  })
  function flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()) }
  return { controller, el, frames, flush, move: value => { top = value; controller.onScroll() }, get writes() { return writes } }
}

test('many stream updates write scrollTop only once in a frame', () => {
  const f = fixture()
  for (let i = 0; i < 12; i++) { f.el.scrollHeight += 10; f.controller.requestBottom() }
  assert.equal(f.frames.size, 1)
  f.flush()
  assert.equal(f.writes, 1)
  assert.equal(f.el.scrollTop, 620)
})

test('upward user intent cancels even an already queued forced follow', () => {
  const f = fixture()
  f.controller.requestBottom({ force: true })
  f.controller.onWheel({ deltaY: -8 })
  f.el.scrollHeight += 80
  f.flush()
  assert.equal(f.writes, 0)
  assert.equal(f.controller.following, false)
})

test('reading above stays anchored through stream completion and composer resize', () => {
  const f = fixture()
  f.controller.requestBottom(); f.flush()
  f.move(230)
  f.el.scrollHeight = 1500
  f.el.clientHeight = 450
  f.controller.requestBottom(); f.flush()
  assert.equal(f.el.scrollTop, 230)
  assert.equal(f.writes, 1)
})

test('scrolling back to the bottom resumes future stream following', () => {
  const f = fixture()
  f.controller.requestBottom(); f.flush()
  f.move(240)
  f.el.scrollHeight = 1200
  f.move(700)
  assert.equal(f.controller.following, true)
  f.el.scrollHeight = 1300
  f.controller.requestBottom(); f.flush()
  assert.equal(f.el.scrollTop, 800)
})

test('touch and keyboard reading pauses following; explicit jump restores it', () => {
  const f = fixture()
  f.controller.onTouchStart({ touches: [{ clientY: 100 }] })
  f.controller.onTouchMove({ touches: [{ clientY: 130 }] })
  assert.equal(f.controller.following, false)
  f.controller.requestBottom({ force: true }); f.flush()
  assert.equal(f.controller.following, true)
  f.controller.onKeydown({ key: 'PageUp' })
  assert.equal(f.controller.following, false)
})

test('unmount cancels the pending frame and ignores later requests', () => {
  const f = fixture()
  f.controller.requestBottom()
  f.controller.dispose()
  f.controller.requestBottom({ force: true })
  f.flush()
  assert.equal(f.frames.size, 0)
  assert.equal(f.writes, 0)
})

test('browser scroll clamping after composer shrink preserves following', () => {
  const f = fixture()
  f.controller.requestBottom(); f.flush()
  f.el.clientHeight = 600
  f.move(400)
  assert.equal(f.controller.following, true)
  f.el.scrollHeight += 60
  f.controller.requestBottom(); f.flush()
  assert.equal(f.el.scrollTop, 460)
})
