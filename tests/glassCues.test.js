import test from 'node:test'
import assert from 'node:assert/strict'
import { createGlassCueUrls } from '../src/motion/mirror/glassCues.js'

test('the two original cues are cached valid mono PCM WAV files', () => {
  const cues = createGlassCueUrls()
  assert.equal(cues, createGlassCueUrls())
  for (const [name, url] of Object.entries(cues)) {
    assert.ok(url.startsWith('data:audio/wav;base64,'))
    const bytes = Buffer.from(url.split(',')[1], 'base64')
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF')
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE')
    assert.equal(bytes.readUInt16LE(22), 1)
    assert.equal(bytes.readUInt32LE(24), 22050)
    assert.equal(bytes.readUInt16LE(34), 16)
    assert.equal(bytes.readUInt32LE(40), bytes.length - 44)
    const samples = Array.from({ length: (bytes.length - 44) / 2 }, (_, i) => bytes.readInt16LE(44 + i * 2))
    assert.ok(samples.some(n => Math.abs(n) > 100), `${name} must contain an audible cue`)
    assert.ok(samples.every(n => Math.abs(n) < 16000), `${name} must leave audio headroom`)
    assert.ok(Math.max(...samples.slice(-100).map(Math.abs)) < 40, `${name} must decay before the end`)
  }
})
