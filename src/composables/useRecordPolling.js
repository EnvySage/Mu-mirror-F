import { ref, onBeforeUnmount } from 'vue'
import { getRecord } from '@/api/records'

/**
 * 记录状态轮询（8.2 契约）
 *
 * POST /records 返回 status=processing 后无推送通道，前端每 2-3s 轮询
 * GET /records/{id}，status 变为 reviewing / done / failed 时停止。
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
export function useRecordPolling({ onUpdate, interval = 2500 } = {}) {
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
        const res = await getRecord(recordId)
        record = res.data
      } catch (err) {
        // 网络/服务错误：继续下一轮，不中断轮询
        console.warn('poll error:', err.message)
        schedule(recordId)
        return
      }
      if (!record) {
        schedule(recordId)
        return
      }
      if (onUpdate) onUpdate(record)
      const status = record.status
      if (status === 'processing') {
        schedule(recordId)
      } else {
        // reviewing / done / failed：终态，停止
        pollingRecordId.value = null
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
