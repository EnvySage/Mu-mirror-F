import { ref } from 'vue'
import { defineStore } from 'pinia'

let toastId = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([])

  /**
   * 显示 toast 提示
   * @param {string} message - 提示内容
   * @param {'info' | 'success' | 'warning' | 'error'} type - 类型
   * @param {number} duration - 显示时长（毫秒），默认 3000
   */
  function show(message, type = 'info', duration = 3000) {
    const id = ++toastId
    toasts.value.push({ id, message, type })

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

  return {
    toasts,
    show,
    remove,
    info,
    success,
    warning,
    error,
  }
})
