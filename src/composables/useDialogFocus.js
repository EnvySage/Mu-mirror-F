import { nextTick, onBeforeUnmount, watch } from 'vue'

const dialogStack = []
let returnTarget = null
let handoffPending = false
let handoffGeneration = 0
let previousOverflow = ''

export function prepareDialogFocusHandoff() {
  const generation = ++handoffGeneration
  handoffPending = true
  return () => { if (generation === handoffGeneration) handoffPending = false }
}

function canFocus(element) {
  if (!element?.isConnected || !element.getClientRects?.().length || element.getAttribute?.('aria-hidden') === 'true') return false
  const rect = element.getBoundingClientRect()
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
}

function canTabTo(element) {
  if (!element?.isConnected || !element.getClientRects?.().length || element.matches?.(':disabled,[aria-hidden="true"]') || element.closest?.('[inert],[aria-hidden="true"]')) return false
  const style = getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
}

function focusSafely(target, fallback) {
  const candidate = canFocus(target) ? target : canFocus(fallback) ? fallback
    : [...document.querySelectorAll('[data-page-focus], main h1, .page h1, main button, main a[href]')].find(canFocus)
  candidate?.focus?.({ preventScroll: true })
}

export function useDialogFocus(isOpen, dialog, preferredSelector = 'button', onEscape = null) {
  let trigger = null
  let generation = 0
  const entry = { dialog, trap: null, onEscape }
  const focusable = () => [...(dialog.value?.querySelectorAll('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') || [])].filter(canTabTo)
  entry.trap = (event) => {
    if (!isOpen() || dialogStack[dialogStack.length - 1] !== entry) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      entry.onEscape?.()
      return
    }
    if (event.key !== 'Tab') return
    const items = focusable()
    if (!items.length) { event.preventDefault(); dialog.value?.focus?.({ preventScroll: true }); return }
    const first = items[0], last = items[items.length - 1]
    if (event.shiftKey && (document.activeElement === first || !dialog.value?.contains(document.activeElement))) { event.preventDefault(); last.focus({ preventScroll: true }) }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.value?.contains(document.activeElement))) { event.preventDefault(); first.focus({ preventScroll: true }) }
  }

  function release() {
    document.removeEventListener('keydown', entry.trap)
    const index = dialogStack.indexOf(entry)
    if (index === -1) return
    if (index !== -1) dialogStack.splice(index, 1)
    if (!dialogStack.length) {
      document.body.style.overflow = previousOverflow
      if (handoffPending) { trigger = null; return }
      const target = returnTarget || trigger
      focusSafely(target, document.querySelector('[data-page-focus], main h1, .page h1'))
      trigger = null
      returnTarget = null
    } else {
      const parent = dialogStack[dialogStack.length - 1]
      if (trigger && parent.dialog.value?.contains(trigger)) focusSafely(trigger)
      trigger = null
    }
  }

  function focusInitial() {
    if (!isOpen() || dialogStack.at(-1) !== entry || !dialog.value?.isConnected) return
    if (dialog.value.contains(document.activeElement)) return
    focusSafely(dialog.value.querySelector(preferredSelector) || dialog.value)
  }

  watch(isOpen, async open => {
    const current = ++generation
    if (!open) { release(); return }
    if (!dialogStack.length) {
      previousOverflow = document.body.style.overflow
      if (!handoffPending) returnTarget = document.activeElement
    }
    trigger = handoffPending && returnTarget ? returnTarget : document.activeElement
    handoffPending = false
    const existing = dialogStack.indexOf(entry)
    if (existing !== -1) dialogStack.splice(existing, 1)
    dialogStack.push(entry)
    document.addEventListener('keydown', entry.trap)
    document.body.style.overflow = 'hidden'
    await nextTick()
    if (current === generation && isOpen() && dialogStack.at(-1) === entry) {
      focusInitial()
    }
  }, { immediate: !!isOpen(), flush: 'post' })

  onBeforeUnmount(() => { generation++; release() })
  return { focusInitial }
}
