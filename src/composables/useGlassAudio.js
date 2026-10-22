import { createGlassCueUrls } from '@/motion/mirror/glassCues'

// Original synthesized cues, decoded by the asynchronous media path. Opening a
// realtime AudioContext inside pointerdown can block Windows input for 80-100ms.
let players = null
let preparation = null
let unlocked = false
let operation = 0
const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
const reduced = () => preference.matches

export function prepareGlassAudio() {
  preparation ||= Promise.resolve().then(() => {
    const urls = createGlassCueUrls()
    players = Object.fromEntries(Object.entries(urls).map(([name, src]) => {
      const audio = new Audio(src)
      audio.preload = 'auto'
      audio.load()
      return [name, audio]
    }))
    return players
  }).catch(() => null)
  return preparation
}

export function unlockGlassAudio(event) {
  if (!event?.isTrusted || reduced()) return
  unlocked = true
}

export function stopGlassAudio() {
  operation += 1
  for (const audio of Object.values(players || {})) {
    audio.pause()
    try { audio.currentTime = 0 } catch { /* Metadata may not be loaded yet. */ }
  }
}

function ignorePlaybackFailure() { /* Autoplay/audio policy never blocks UI. */ }
function playCue(name) {
  if (!unlocked || reduced()) return
  const current = ++operation
  const play = () => {
    if (current !== operation || !unlocked || reduced()) return
    const audio = players?.[name]
    if (!audio) return
    audio.pause()
    try { audio.currentTime = 0; audio.play()?.catch(ignorePlaybackFailure) }
    catch { /* Unavailable media playback leaves the visual effect usable. */ }
  }
  if (players) play()
  else prepareGlassAudio().then(play)
}

export function playGlassCrack() { playCue('crack') }
export function playGlassBurst() { playCue('burst') }

preference.addEventListener?.('change', event => {
  if (event.matches) { unlocked = false; stopGlassAudio() }
})
document.addEventListener('visibilitychange', () => { if (document.hidden) stopGlassAudio() })
if ('requestIdleCallback' in window) window.requestIdleCallback(() => prepareGlassAudio(), { timeout: 800 })
else window.setTimeout(() => prepareGlassAudio(), 0)
