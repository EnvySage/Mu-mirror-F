<script setup>
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()

const iconMap = {
  info: '💡',
  success: '✓',
  warning: '⚠',
  error: '✕',
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="t in toast.toasts"
          :key="t.id"
          :class="['toast', `toast-${t.type}`]"
          @click="toast.remove(t.id)"
        >
          <span class="toast-icon">{{ iconMap[t.type] }}</span>
          <span class="toast-message">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-radius: var(--radius-full);
  background: var(--surface);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
  pointer-events: auto;
  cursor: pointer;
  max-width: 360px;
  animation: toast-in 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.toast-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.toast-message {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
}

/* 类型样式 */
.toast-info .toast-icon {
  background: rgba(99, 102, 241, 0.1);
  color: var(--accent);
}

.toast-success .toast-icon {
  background: rgba(16, 185, 129, 0.1);
  color: #10B981;
}

.toast-warning .toast-icon {
  background: rgba(245, 158, 11, 0.1);
  color: #F59E0B;
}

.toast-error .toast-icon {
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
}

/* 动画 */
.toast-enter-active {
  animation: toast-in 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.toast-leave-active {
  animation: toast-out 0.2s ease-in forwards;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes toast-out {
  to {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
}

/* 移动端适配 */
@media (max-width: 480px) {
  .toast-container {
    top: 12px;
    left: 16px;
    right: 16px;
    transform: none;
  }

  .toast {
    max-width: 100%;
    width: 100%;
  }
}
</style>
