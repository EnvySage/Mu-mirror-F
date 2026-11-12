import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { vReadEnd } from '../src/composables/useReadingEnd.js'

let saved, observer, visibilityListeners, sentinel
beforeEach(() => {
  saved = Object.fromEntries(['document', 'window', 'getComputedStyle', 'IntersectionObserver'].map(name => [name, globalThis[name]]))
  visibilityListeners = new Set()
  globalThis.document = {
    visibilityState: 'visible',
    createElement: () => (sentinel = { style: {}, setAttribute() {}, remove() {}, getBoundingClientRect: () => ({ top: 210, bottom: 211, height: 1 }) }),
    addEventListener: (kind, callback) => visibilityListeners.add(callback),
    removeEventListener: (kind, callback) => visibilityListeners.delete(callback),
  }
  globalThis.window = { innerHeight: 600 }
  globalThis.getComputedStyle = () => ({ overflowY: 'auto' })
  globalThis.IntersectionObserver = class {
    constructor(callback) { observer = this; this.callback = callback }
    observe() {}
    disconnect() { this.disconnected = true }
    visible() { this.callback([{ isIntersecting: true, intersectionRatio: 1 }]) }
  }
})
afterEach(() => { for (const [name, value] of Object.entries(saved)) value === undefined ? delete globalThis[name] : globalThis[name] = value })
function content() {
  return { isConnected: true, parentElement: { parentElement: null, getBoundingClientRect: () => ({ top: 0, bottom: 200 }) }, append() {} }
}

test('loaded content counts as read only when its end is visible, and only once', () => {
  let reads = 0
  const element = content()
  vReadEnd.mounted(element, { value: { key: 'summary-1', onRead: () => reads++ } })
  observer.visible()
  assert.equal(reads, 0)
  sentinel.getBoundingClientRect = () => ({ top: 199, bottom: 200, height: 1 })
  observer.visible()
  observer.visible()
  assert.equal(reads, 1)
  assert.equal(observer.disconnected, true)
})

test('a hidden page does not claim reading; returning to visible content can complete it', () => {
  let reads = 0
  const element = content()
  document.visibilityState = 'hidden'
  vReadEnd.mounted(element, { value: { key: 'snapshot-2', onRead: () => reads++ } })
  sentinel.getBoundingClientRect = () => ({ top: 99, bottom: 100, height: 1 })
  observer.visible()
  assert.equal(reads, 0)
  document.visibilityState = 'visible'
  for (const callback of visibilityListeners) callback()
  assert.equal(reads, 1)
})

test('unmount releases the observer and detached content cannot report reading', () => {
  let reads = 0
  const element = content()
  vReadEnd.mounted(element, { value: { key: 'vault-3', onRead: () => reads++ } })
  vReadEnd.beforeUnmount(element)
  element.isConnected = false
  sentinel.getBoundingClientRect = () => ({ top: 99, bottom: 100, height: 1 })
  observer.visible()
  assert.equal(reads, 0)
  assert.equal(observer.disconnected, true)
  assert.equal(visibilityListeners.size, 0)
})

test('a short passage below the viewport is unread until the parent scroll brings it into view', () => {
  let reads = 0
  const element = content()
  element.parentElement.getBoundingClientRect = () => ({ top: 650, bottom: 850 })
  vReadEnd.mounted(element, { value: { key: 'offscreen-reading', onRead: () => reads++ } })
  sentinel.getBoundingClientRect = () => ({ top: 749, bottom: 750, height: 1 })
  observer.visible()
  assert.equal(reads, 0)
  element.parentElement.getBoundingClientRect = () => ({ top: 100, bottom: 300 })
  sentinel.getBoundingClientRect = () => ({ top: 199, bottom: 200, height: 1 })
  for (const callback of visibilityListeners) callback()
  assert.equal(reads, 1)
})
