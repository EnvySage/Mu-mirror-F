import { nextTick, onBeforeUnmount, watch } from 'vue'

// Keep keyboard navigation inside an open dialog and return to its trigger on close.
export function useDialogFocus(isOpen, dialog, preferredSelector = 'button') {
  let trigger = null
  let generation = 0
  const focusable = () => [...(dialog.value?.querySelectorAll('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') || [])].filter(el => el.getClientRects().length)
  function trap(event) {
    if (event.key !== 'Tab' || !isOpen()) return
    const items = focusable()
    if (!items.length) { event.preventDefault(); dialog.value?.focus(); return }
    const first = items[0], last = items[items.length - 1]
    if (event.shiftKey && (document.activeElement === first || !dialog.value?.contains(document.activeElement))) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.value?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
  }
  function release() {
    document.removeEventListener('keydown', trap)
    if (trigger?.isConnected) trigger.focus()
    trigger = null
  }
  watch(isOpen, async open => {
    const current = ++generation
    if (!open) { release(); return }
    trigger = document.activeElement
    document.addEventListener('keydown', trap)
    await nextTick()
    if (current === generation && isOpen()) (dialog.value?.querySelector(preferredSelector) || dialog.value)?.focus()
  })
  onBeforeUnmount(() => { generation++; release() })
}
