import { onBeforeUnmount, onMounted, ref } from 'vue'

/** Decorative loops only run while their scene is visible and motion is allowed. */
export function useSceneActivity(root) {
  const active = ref(false)
  let observer, preference, visible = false
  const update = () => { active.value = visible && !document.hidden && !preference?.matches }
  onMounted(() => {
    preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    preference.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update() })
    if (root.value) observer.observe(root.value)
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    preference?.removeEventListener('change', update)
    document.removeEventListener('visibilitychange', update)
  })
  return active
}
