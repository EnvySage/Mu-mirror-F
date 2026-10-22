import { bindCardMotion } from '@/motion/useCardMotion'

const cleanups = new WeakMap()
export const vCardLift = {
  mounted(element) { cleanups.set(element, bindCardMotion(element)) },
  updated(element) { if (element.dataset.cardMotionDisabled === 'true') cleanups.get(element)?.reset() },
  unmounted(element) { cleanups.get(element)?.(); cleanups.delete(element) },
}
