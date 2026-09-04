<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const mode = ref('login')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')

const errorMsg = ref('')
const fieldErrors = ref({ username: '', password: '', confirmPassword: '' })

function clearErrors() {
  errorMsg.value = ''
  fieldErrors.value = { username: '', password: '', confirmPassword: '' }
}

function validateUsername() {
  if (mode.value === 'register') {
    if (username.value.length < 3) {
      fieldErrors.value.username = '用户名至少3个字符'
      return false
    }
    if (username.value.length > 50) {
      fieldErrors.value.username = '用户名最多50个字符'
      return false
    }
  } else if (!username.value) {
    fieldErrors.value.username = '请输入用户名'
    return false
  }
  fieldErrors.value.username = ''
  return true
}

function validatePassword() {
  if (mode.value === 'register') {
    if (password.value.length < 6) {
      fieldErrors.value.password = '密码至少6个字符'
      return false
    }
    if (password.value.length > 20) {
      fieldErrors.value.password = '密码最多20个字符'
      return false
    }
  } else if (!password.value) {
    fieldErrors.value.password = '请输入密码'
    return false
  }
  fieldErrors.value.password = ''
  return true
}

function validateConfirmPassword() {
  if (mode.value !== 'register') return true
  if (password.value !== confirmPassword.value) {
    fieldErrors.value.confirmPassword = '两次输入的密码不一致'
    return false
  }
  fieldErrors.value.confirmPassword = ''
  return true
}

const isValid = computed(() => {
  const baseValid = username.value && password.value && !fieldErrors.value.username && !fieldErrors.value.password
  if (mode.value === 'register') {
    return baseValid && confirmPassword.value && !fieldErrors.value.confirmPassword
  }
  return baseValid
})

async function handleSubmit() {
  clearErrors()
  const uValid = validateUsername()
  const pValid = validatePassword()
  const cValid = validateConfirmPassword()
  if (!uValid || !pValid || !cValid) return

  try {
    if (mode.value === 'login') {
      await auth.login(username.value, password.value)
    } else {
      await auth.register(username.value, password.value)
    }
    router.push('/records')
  } catch (err) {
    errorMsg.value = err.message || '操作失败，请重试'
  }
}

function switchMode(newMode) {
  mode.value = newMode
  clearErrors()
  password.value = ''
  confirmPassword.value = ''
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-header">
      <div class="auth-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="#fff"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>
      </div>
      <h1 class="auth-title">Mirror</h1>
      <p class="auth-subtitle">你的 AI 日记伙伴</p>
    </div>

    <div class="auth-body">
      <div class="auth-tabs">
        <button :class="['auth-tab', { active: mode === 'login' }]" @click="switchMode('login')">登录</button>
        <button :class="['auth-tab', { active: mode === 'register' }]" @click="switchMode('register')">注册</button>
      </div>

      <div v-if="errorMsg" class="auth-error">{{ errorMsg }}</div>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label class="form-label">用户名</label>
          <input
            v-model="username"
            type="text"
            class="form-input"
            :class="{ error: fieldErrors.username }"
            :placeholder="mode === 'register' ? '请输入用户名（3-50个字符）' : '请输入用户名'"
            @input="validateUsername"
          >
          <div v-if="fieldErrors.username" class="form-error show">{{ fieldErrors.username }}</div>
        </div>

        <div class="form-group">
          <label class="form-label">密码</label>
          <input
            v-model="password"
            type="password"
            class="form-input"
            :class="{ error: fieldErrors.password }"
            :placeholder="mode === 'register' ? '请输入密码（6-20个字符）' : '请输入密码'"
            @input="validatePassword"
          >
          <div v-if="fieldErrors.password" class="form-error show">{{ fieldErrors.password }}</div>
        </div>

        <div v-if="mode === 'register'" class="form-group">
          <label class="form-label">确认密码</label>
          <input
            v-model="confirmPassword"
            type="password"
            class="form-input"
            :class="{ error: fieldErrors.confirmPassword }"
            placeholder="请再次输入密码"
            @input="validateConfirmPassword"
          >
          <div v-if="fieldErrors.confirmPassword" class="form-error show">{{ fieldErrors.confirmPassword }}</div>
        </div>

        <button type="submit" class="btn" :disabled="!isValid || auth.loading">
          <span v-if="auth.loading" class="btn-loading" />
          {{ mode === 'login' ? '登录' : '注册' }}
        </button>
      </form>
    </div>

    <div class="auth-footer">
      <p class="auth-footer-text">
        {{ mode === 'login' ? '还没有账号？' : '已有账号？' }}
        <button class="auth-link" @click="switchMode(mode === 'login' ? 'register' : 'login')">
          {{ mode === 'login' ? '立即注册' : '去登录' }}
        </button>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* 浅色例外（mirror-auth.html 权威）：不走深色玻璃 token */
.auth-page {
  min-height: 100dvh;
  display: flex; flex-direction: column;
  background: #F5F5F7;
  color: #1D1D1F;
}

.auth-header { padding: 60px 32px 0; text-align: center; }

.auth-logo {
  width: 64px; height: 64px; border-radius: 16px;
  background: linear-gradient(135deg, #4F46E5, #7C3AED);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 8px 24px rgba(79,70,229,.3);
}
.auth-logo svg { width: 32px; height: 32px; }

.auth-title { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
.auth-subtitle { font-size: 14px; color: #6E6E73; }

.auth-body {
  flex: 1; padding: 32px;
  max-width: 400px; margin: 0 auto; width: 100%;
}

.auth-tabs {
  display: flex; margin-bottom: 24px;
  border-radius: 14px; background: #EAEAEE; padding: 4px;
}
.auth-tab {
  flex: 1; padding: 10px 16px;
  border: none; background: transparent;
  font-size: 14px; font-weight: 600; color: #6E6E73;
  cursor: pointer; border-radius: 10px; transition: all .2s ease;
}
.auth-tab.active {
  background: #FFFFFF; color: #1D1D1F;
  box-shadow: 0 1px 3px rgba(0,0,0,.1);
}

.auth-error {
  padding: 12px 16px; margin-bottom: 20px;
  background: #FFE5E3; border-radius: 14px;
  color: #FF3B30; font-size: 13px; text-align: center;
}

.auth-form { display: flex; flex-direction: column; gap: 20px; }

.form-group { position: relative; }
.form-label {
  display: block; font-size: 13px; font-weight: 600;
  color: #6E6E73; margin-bottom: 8px;
}

.form-input {
  width: 100%; padding: 14px 16px;
  border: 1.5px solid #E8E8ED; border-radius: 14px;
  font-size: 16px; color: #1D1D1F; background: #fff;
  outline: none; transition: all .2s ease;
}
.form-input:focus {
  border-color: #4F46E5;
  box-shadow: 0 0 0 3px #EEF0FF;
}
.form-input.error { border-color: #FF3B30; }
.form-input::placeholder { color: #AEAEB2; }

.form-error { font-size: 12px; color: #FF3B30; margin-top: 6px; display: none; }
.form-error.show { display: block; }

.btn {
  width: 100%; padding: 14px 24px;
  border: none; border-radius: 14px;
  font-size: 16px; font-weight: 600; cursor: pointer;
  transition: all .2s ease;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: linear-gradient(135deg, #4F46E5, #7C3AED);
  color: #fff;
  box-shadow: 0 4px 12px rgba(79,70,229,.3);
}
.btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(79,70,229,.4); }
.btn:disabled { opacity: .6; cursor: not-allowed; transform: none; }

.btn-loading {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,.3); border-top-color: white;
  border-radius: 50%; animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.auth-footer {
  padding: 20px 32px; text-align: center;
  border-top: 0.5px solid #E8E8ED;
}
.auth-footer-text { font-size: 13px; color: #6E6E73; }
.auth-link {
  background: none; border: none;
  color: #4F46E5; font-weight: 600; cursor: pointer; font-size: 13px; padding: 0;
}
.auth-link:hover { text-decoration: underline; }

@media (min-width: 768px) {
  .auth-header { padding: 80px 40px 0; }
  .auth-body { padding: 40px; }
}
</style>
