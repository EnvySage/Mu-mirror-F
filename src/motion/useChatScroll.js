import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/** One scroll write per frame. User intent is checked at execution, not enqueue time. */
export function createChatScrollController({ getElement, requestFrame, cancelFrame, onFollowingChange = () => {} }) {
  let following = true
  let frame = null
  let lastTop = 0
  let lastHeight = 0
  let disposed = false
  function setFollowing(value) {
    if (following === value) return
    following = value
    onFollowingChange(value)
  }
  function requestBottom({ force = false } = {}) {
    if (disposed) return
    if (force) setFollowing(true)
    if (frame !== null) return
    frame = requestFrame(() => {
      frame = null
      const el = getElement()
      if (!el || !following || disposed) return
      el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
      lastTop = el.scrollTop
      lastHeight = el.clientHeight
    })
  }
  function onScroll() {
    const el = getElement()
    if (!el) return
    const top = el.scrollTop
    const atBottom = el.scrollHeight - el.clientHeight - top <= 2
    // When the composer shrinks, the browser clamps scrollTop downward while
    // preserving the bottom. That geometry change is not an upward read gesture.
    const clampedBottom = following && atBottom && el.clientHeight !== lastHeight
    if (top < lastTop - 1 && !clampedBottom) setFollowing(false)
    else if (atBottom && (following || top > lastTop)) setFollowing(true)
    lastTop = top
    lastHeight = el.clientHeight
  }
  function pause() { setFollowing(false) }
  function onWheel(event) { if (event.deltaY < 0) pause() }
  let touchY = null
  function onTouchStart(event) { touchY = event.touches?.[0]?.clientY ?? null }
  function onTouchMove(event) {
    const y = event.touches?.[0]?.clientY
    if (touchY !== null && y > touchY) pause()
    touchY = y ?? null
  }
  function onKeydown(event) {
    if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) pause()
  }
  function dispose() {
    disposed = true
    if (frame !== null) cancelFrame(frame)
    frame = null
  }
  return { requestBottom, onScroll, onWheel, onTouchStart, onTouchMove, onKeydown, dispose, get following() { return following } }
}

export function useChatScroll(messagesEl, source) {
  const following = ref(true)
  const controller = createChatScrollController({
    getElement: () => messagesEl.value,
    requestFrame: callback => window.requestAnimationFrame(callback),
    cancelFrame: id => window.cancelAnimationFrame(id),
    onFollowingChange: value => { following.value = value },
  })
  watch(source, () => controller.requestBottom(), { flush: 'post' })
  let observer
  onMounted(() => {
    controller.requestBottom()
    observer = new ResizeObserver(() => controller.requestBottom())
    if (messagesEl.value) observer.observe(messagesEl.value)
  })
  onBeforeUnmount(() => { observer?.disconnect(); controller.dispose() })
  return { ...controller, following }
}
