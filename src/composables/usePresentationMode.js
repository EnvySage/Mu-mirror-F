import { computed, ref } from 'vue'
import { useUIStore } from '@/stores/ui'
import { resolvePresentationMode } from '@/utils/presentation'

const STORAGE_KEY = 'mirror.presentation-mode'
function readPreference() {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY) }
  catch { return null }
}
function writePreference(value) {
  try { window.localStorage.setItem(STORAGE_KEY, value) }
  catch { /* Keep the current mode in memory when browser storage is restricted. */ }
}
const stored = readPreference()
const override = ref(['auto', 'desktop', 'mobile'].includes(stored) ? stored : 'auto')
const mode = ref(resolvePresentationMode(override.value, typeof window !== 'undefined' ? window.innerWidth : 900))

export function usePresentationMode() {
  const ui = useUIStore()
  function requestMode(nextMode) {
    if (!['auto', 'desktop', 'mobile'].includes(nextMode)) return
    override.value = nextMode
    mode.value = resolvePresentationMode(nextMode, window.innerWidth)
    writePreference(nextMode)
    ui.isMobile = mode.value === 'mobile'
  }
  // Deliberately no resize listener: the active conversation stays mounted.
  ui.isMobile = mode.value === 'mobile'
  return { mode: computed(() => mode.value), override: computed(() => override.value), requestMode }
}
