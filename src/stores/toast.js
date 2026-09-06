import { ref } from 'vue'
import { defineStore } from 'pinia'

let toastId = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([])

  /**
   * 显示 toast 提示
   * @param {string} message - 提示内容
   * @param {'info' | 'success' | 'warning' | 'error' | 'undo'} type - 类型
   * @param {number} duration - 显示时长（毫秒），默认 3000
   * @param {() => void} [onUndo] - undo 类型：点撤销回调（Q2 删除撤销窗）
   */
  function show(message, type = 'info', duration = 3000, onUndo = null) {
    const id = ++toastId
    toasts.value.push({
      id, message, type,
      undoable: type === 'undo' && typeof onUndo === 'function',
      onUndo,
      // 撤销窗倒计时条动画时长（CSS width 100%→0）
      duration: type === 'undo' ? duration : 0,
    })

    setTimeout(() => {
      remove(id)
    }, duration)
  }

  function remove(id) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  /** 撤销：执行回调并立即收起 toast */
  function undo(id) {
    const t = toasts.value.find(x => x.id === id)
    if (t && typeof t.onUndo === 'function') t.onUndo()
    remove(id)
  }

  function info(message, duration) {
    show(message, 'info', duration)
  }

  function success(message, duration) {
    show(message, 'success', duration)
  }

  function warning(message, duration) {
    show(message, 'warning', duration)
  }

  function error(message, duration) {
    show(message, 'error', duration)
  }

  /**
   * 删除撤销 toast（Q2 三层防误删第 3 层）：消息 + 撤销按钮 + 5 秒倒计时条，
   * 5 秒内点撤销执行 onUndo；到时自动消失（调用方此时才发真删请求）
   * @param {string} message
   * @param {number} duration 撤销窗毫秒（默认 5000）
   * @param {() => void} onUndo
   */
  function undoable(message, duration = 5000, onUndo) {
    show(message, 'undo', duration, onUndo)
  }

  return {
    toasts,
    show,
    remove,
    undo,
    info,
    success,
    warning,
    error,
    undoable,
  }
})
