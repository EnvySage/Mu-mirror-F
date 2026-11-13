import { ref, onBeforeUnmount } from 'vue'
import { getRecord } from '@/api/records'
import { shouldPollRecord } from '@/utils/recordIndexing'

/**
 * 记录状态轮询（8.2 契约）
 *
 * POST /records 返回 status=processing 后无推送通道，前端每 2-3s 轮询
 * GET /records/{id}，处理完成且没有待处理的索引任务时停止。
 * version1 的 READY 不代表索引结束；明确跳过及 failed 不继续轮询。
 *
 * 用法：
 *   const { startPolling, stopPolling, pollingId } = useRecordPolling({
 *     onUpdate(record) { ... },
 *   })
 *   startPolling(recordId)   // 幂等：重复调用先停旧轮询
 *   stopPolling()            // 组件卸载时自动调用
 *
 * @param {{ onUpdate: (record: Object) => void, interval?: number }} options
 * @returns {{ startPolling: Function, stopPolling: Function, pollingId: import('vue').Ref<string|number|null> }}
 */
export function useRecordPolling({ onUpdate, interval = 2500, loadRecord = async id => (await getRecord(id)).data } = {}) {
  const pollingId = ref(null)
  const pollingRecordId = ref(null)

  /**
   * 开始轮询某条记录
   * @param {string|number} recordId
   */
  function startPolling(recordId) {
    stopPolling()
    pollingRecordId.value = recordId
    schedule(recordId)
  }

  function schedule(recordId) {
    pollingId.value = setTimeout(async () => {
      if (pollingRecordId.value !== recordId) return
      let record = null
      try {
        record = await loadRecord(recordId, () => pollingRecordId.value === recordId)
      } catch (err) {
        // 网络/服务错误：继续下一轮，不中断轮询
        console.warn('poll error:', err.message)
        if (pollingRecordId.value === recordId) schedule(recordId)
        return
      }
      if (pollingRecordId.value !== recordId) return
      if (!record) {
        schedule(recordId)
        return
      }
      if (onUpdate) onUpdate(record)
      if (shouldPollRecord(record)) {
        schedule(recordId)
      } else {
        stopPolling()
      }
    }, interval)
  }

  /** 停止轮询 */
  function stopPolling() {
    pollingRecordId.value = null
    if (pollingId.value) {
      clearTimeout(pollingId.value)
      pollingId.value = null
    }
  }

  onBeforeUnmount(stopPolling)

  return { startPolling, stopPolling, pollingId, pollingRecordId }
}
