<script setup>
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()

/** 类型 → SVG path（无 emoji，纯线性图标） */
const icons = {
  info: { d: 'M12 16v-4M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', stroke: 'var(--accent)' },
  success: { d: 'M20 6L9 17l-5-5', stroke: 'var(--success)' },
  warning: { d: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', stroke: 'var(--warn)' },
  error: { d: 'M18 6L6 18M6 6l12 12', stroke: 'var(--danger)' },
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
          <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" :style="{ stroke: icons[t.type]?.stroke || 'var(--accent)' }">
            <path :d="icons[t.type]?.d || icons.info.d" />
          </svg>
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
  padding: 12px 18px 12px 15px;
  border-radius: var(--radius);
  background: #FFFFFF;
  border: 1px solid var(--line);
  border-left: 3px solid var(--line-strong);
  box-shadow: var(--shadow-float);
  pointer-events: auto;
  cursor: pointer;
  max-width: 360px;
}

.toast-success { border-left-color: var(--success); }
.toast-error { border-left-color: var(--danger); }
.toast-warning { border-left-color: var(--warn); }
.toast-info { border-left-color: var(--accent); }

.toast-icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke-width: 2.2;
  flex-shrink: 0;
}

.toast-message {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-hi);
  line-height: 1.4;
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
