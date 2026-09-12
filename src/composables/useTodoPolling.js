import { onBeforeUnmount, onMounted } from 'vue'
import { useTodoStore } from '@/stores/todo'

/**
 * 待办建议轮询（默认 15s，全局常驻）
 *
 * 为什么轮询而不是"猜时机"：
 * 待办登记与状态建议都要等用户点「确认入库」才真正落库（审核态不做任何真实改动），
 * 落库时机对前端既不可观测也没有推送通道。用"记录状态变化"当代理信号只能覆盖
 * 部分路径（切走再切回就漏），所以改为按固定间隔拉
 * GET /todos/pending-suggestions —— 幂等、返回极小（通常 0~几条），单人场景成本可忽略。
 *
 * 行为：
 *  - 页面不可见（切标签页/最小化）时跳过本轮，回到前台自动继续
 *  - 正在裁决（resolvingId 非空）或有请求在飞（loading）时跳过本轮，不覆盖用户操作
 *  - 建议条数变化时回调 onChange：说明后端有新增，调用方可顺带刷新 stats 等聚合
 *
 * @param {{ interval?: number, onChange?: (next: number, prev: number) => void }} options
 */
export function useTodoPolling({ interval = 15000, onChange } = {}) {
  const todoStore = useTodoStore()
  let timer = null
  /** 上一轮条数（-1 = 首次，不触发 onChange） */
  let lastCount = -1

  async function tick() {
    if (document.visibilityState === 'visible' && !todoStore.loading && !todoStore.resolvingId) {
      await todoStore.fetch()
      const n = todoStore.pendingSuggestions.length
      if (lastCount >= 0 && n !== lastCount && onChange) onChange(n, lastCount)
      lastCount = n
    }
    timer = setTimeout(tick, interval)
  }

  onMounted(() => {
    timer = setTimeout(tick, interval)
  })

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
    timer = null
  })
}
