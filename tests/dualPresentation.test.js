import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePresentationMode } from '../src/utils/presentation.js'

test('automatic mode uses the documented 900px boundary', () => {
  assert.equal(resolvePresentationMode('auto', 899), 'mobile')
  assert.equal(resolvePresentationMode('auto', 900), 'desktop')
})

test('a saved manual presentation overrides viewport width', () => {
  assert.equal(resolvePresentationMode('desktop', 390), 'desktop')
  assert.equal(resolvePresentationMode('mobile', 1440), 'mobile')
})

test('unknown preferences safely fall back to automatic selection', () => {
  assert.equal(resolvePresentationMode('other', 390), 'mobile')
  assert.equal(resolvePresentationMode(null, 1440), 'desktop')
})
