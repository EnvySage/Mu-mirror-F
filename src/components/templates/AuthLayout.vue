<script setup>
</script>

<template>
  <div class="auth-layout">
    <div class="auth-container">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
/* 晨纸浅色（与全站统一）：暖白纸底 + 白卡细边 */
.auth-layout {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--ink);
}

.auth-container {
  width: 100%;
  max-width: 420px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
  overflow: hidden;
  animation: fadeInUp 0.4s ease;
}

@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }

@media (min-width: 768px) {
  .auth-layout { padding: 40px; }
  .auth-container { max-width: 440px; }
}
</style>
