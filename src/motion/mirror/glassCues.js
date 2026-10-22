const SAMPLE_RATE = 22050
let cachedUrls

function tone(samples, start, frequency, end, length, volume, triangle = false) {
  const from = Math.round(start * SAMPLE_RATE), count = Math.round(length * SAMPLE_RATE)
  const sweep = Math.log(end / frequency)
  for (let i = 0; i < count && from + i < samples.length; i++) {
    const time = i / SAMPLE_RATE
    const cycles = frequency * length / sweep * (Math.exp(sweep * time / length) - 1)
    const wave = triangle ? 1 - 4 * Math.abs((cycles + .25) % 1 - .5) : Math.sin(cycles * Math.PI * 2)
    const gain = time < .004 ? .0001 * (volume / .0001) ** (time / .004)
      : volume * (.0001 / volume) ** ((time - .004) / (length - .004))
    samples[from + i] += wave * gain
  }
}

function noise(samples, length, volume, frequency) {
  let seed = 7341, previous = 0, high = 0
  const alpha = 1 / (1 + 2 * Math.PI * frequency / SAMPLE_RATE)
  for (let i = 0; i < Math.min(samples.length, Math.round(length * SAMPLE_RATE)); i++) {
    seed = seed * 16807 % 2147483647
    const next = seed / 1073741824 - 1
    high = alpha * (high + next - previous)
    previous = next
    samples[i] += high * volume * (.0001 / volume) ** (i / SAMPLE_RATE / length)
  }
}

function wavUrl(samples) {
  const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer)
  const text = (offset, value) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i) }
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE')
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:audio/wav;base64,${btoa(binary)}`
}

/** Stable original PCM cues. Playback reuses the two data URLs and media players. */
export function createGlassCueUrls() {
  if (cachedUrls) return cachedUrls
  const crack = new Float32Array(Math.ceil(SAMPLE_RATE * .2))
  tone(crack, 0, 2480, 2320, .16, .045)
  tone(crack, 0, 3970, 3720, .11, .018, true)
  noise(crack, .065, .055, 3200)
  const burst = new Float32Array(Math.ceil(SAMPLE_RATE * .33))
  tone(burst, 0, 150, 52, .2, .13)
  noise(burst, .27, .12, 1400)
  ;[1860, 2750, 4320].forEach((frequency, index) => tone(burst, index * .027, frequency, frequency * .83, .16, .022))
  cachedUrls = Object.freeze({ crack: wavUrl(crack), burst: wavUrl(burst) })
  return cachedUrls
}
