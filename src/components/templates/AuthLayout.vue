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
/* 浅色例外（mirror-auth.html 权威）：独立浅色，不套深色玻璃 */
.auth-layout {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #F5F5F7;
}

.auth-container {
  width: 100%;
  max-width: 420px;
  background: #FFFFFF;
  border-radius: 20px;
  box-shadow: 0 12px 40px rgba(0,0,0,.1);
  overflow: hidden;
  animation: fadeInUp 0.4s ease;
}

@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }

@media (min-width: 768px) {
  .auth-layout { padding: 40px; }
  .auth-container { max-width: 440px; }
}
</style>
