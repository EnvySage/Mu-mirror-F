function scrollContainer(element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) return parent
  }
  return null
}

function bind(element, binding) {
  const { key, onRead } = binding.value || {}
  if (!key || typeof onRead !== 'function' || element.__readingKey === key) return
  element.__stopReading?.()
  element.__readingKey = key
  const end = document.createElement('span')
  end.setAttribute('aria-hidden', 'true')
  end.setAttribute('data-reading-end', '')
  end.style.cssText = 'display:block;height:1px;width:100%;pointer-events:none'
  element.append(end)
  const root = scrollContainer(element)
  let finished = false
  const complete = () => {
    if (finished || !element.isConnected || document.visibilityState === 'hidden') return
    const bounds = end.getBoundingClientRect()
    const area = root?.getBoundingClientRect() || { top: 0, bottom: window.innerHeight }
    const visibleTop = Math.max(0, area.top)
    const visibleBottom = Math.min(window.innerHeight, area.bottom)
    if (bounds.height && bounds.top >= visibleTop && bounds.bottom <= visibleBottom + 1) {
      finished = true
      observer.disconnect()
      document.removeEventListener('visibilitychange', complete)
      document.removeEventListener('scroll', complete, true)
      onRead()
    }
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .99)) complete()
  }, { root, threshold: 1 })
  observer.observe(end)
  document.addEventListener('visibilitychange', complete)
  document.addEventListener('scroll', complete, true)
  element.__stopReading = () => {
    observer.disconnect()
    document.removeEventListener('visibilitychange', complete)
    document.removeEventListener('scroll', complete, true)
    end.remove()
    element.__readingKey = null
  }
}

// Bind only to successfully loaded content, with a key that identifies that content.
export const vReadEnd = {
  mounted: bind,
  updated: bind,
  beforeUnmount(element) { element.__stopReading?.() },
}
