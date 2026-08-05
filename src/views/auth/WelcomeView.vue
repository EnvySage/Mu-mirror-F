<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

// 当前模式：login 或 register
const mode = ref('login')

// 表单数据
const username = ref('')
const password = ref('')
const confirmPassword = ref('')

// 错误信息
const errorMsg = ref('')
const fieldErrors = ref({ username: '', password: '', confirmPassword: '' })

// 清除错误
function clearErrors() {
  errorMsg.value = ''
  fieldErrors.value = { username: '', password: '', confirmPassword: '' }
}

// 验证用户名
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
  } else {
    if (!username.value) {
      fieldErrors.value.username = '请输入用户名'
      return false
    }
  }
  fieldErrors.value.username = ''
  return true
}

// 验证密码
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
  } else {
    if (!password.value) {
      fieldErrors.value.password = '请输入密码'
      return false
    }
  }
  fieldErrors.value.password = ''
  return true
}

// 验证确认密码
function validateConfirmPassword() {
  if (mode.value !== 'register') return true
  if (password.value !== confirmPassword.value) {
    fieldErrors.value.confirmPassword = '两次输入的密码不一致'
    return false
  }
  fieldErrors.value.confirmPassword = ''
  return true
}

// 表单是否有效
const isValid = computed(() => {
  const baseValid = username.value && password.value && !fieldErrors.value.username && !fieldErrors.value.password
  if (mode.value === 'register') {
    return baseValid && confirmPassword.value && !fieldErrors.value.confirmPassword
  }
  return baseValid
})

// 提交表单
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

// 切换模式
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
      <!-- Tab 切换 -->
      <div class="auth-tabs">
        <button :class="['auth-tab', { active: mode === 'login' }]" @click="switchMode('login')">登录</button>
        <button :class="['auth-tab', { active: mode === 'register' }]" @click="switchMode('register')">注册</button>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMsg" class="auth-error">{{ errorMsg }}</div>

      <!-- 表单 -->
      <form @submit.prevent="handleSubmit" class="auth-form">
        <div class="form-group">
          <label class="form-label">用户名</label>
          <input
            type="text"
            class="form-input"
            :class="{ error: fieldErrors.username }"
            v-model="username"
            :placeholder="mode === 'register' ? '请输入用户名（3-50个字符）' : '请输入用户名'"
            @input="validateUsername"
          />
          <div v-if="fieldErrors.username" class="form-error show">{{ fieldErrors.username }}</div>
        </div>

        <div class="form-group">
          <label class="form-label">密码</label>
          <input
            type="password"
            class="form-input"
            :class="{ error: fieldErrors.password }"
            v-model="password"
            :placeholder="mode === 'register' ? '请输入密码（6-20个字符）' : '请输入密码'"
            @input="validatePassword"
          />
          <div v-if="fieldErrors.password" class="form-error show">{{ fieldErrors.password }}</div>
        </div>

        <div v-if="mode === 'register'" class="form-group">
          <label class="form-label">确认密码</label>
          <input
            type="password"
            class="form-input"
            :class="{ error: fieldErrors.confirmPassword }"
            v-model="confirmPassword"
            placeholder="请再次输入密码"
            @input="validateConfirmPassword"
          />
          <div v-if="fieldErrors.confirmPassword" class="form-error show">{{ fieldErrors.confirmPassword }}</div>
        </div>

        <button type="submit" class="btn btn-primary" :disabled="!isValid || auth.loading">
          <span v-if="auth.loading" class="btn-loading"></span>
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
.auth-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.auth-header {
  padding: 60px 32px 0;
  text-align: center;
}

.auth-logo {
  width: 64px; height: 64px; border-radius: 16px;
  background: linear-gradient(135deg, #4F46E5, #7C3AED);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 8px 24px rgba(79,70,229,0.3);
}
.auth-logo svg { width: 32px; height: 32px; }

.auth-title { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
.auth-subtitle { font-size: 14px; color: var(--text-secondary); }

.auth-body {
  flex: 1;
  padding: 32px;
  max-width: 400px;
  margin: 0 auto;
  width: 100%;
}

/* Tab 切换 */
.auth-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  padding: 4px;
}
.auth-tab {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}
.auth-tab.active {
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* 错误提示 */
.auth-error {
  padding: 12px 16px;
  margin-bottom: 20px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md);
  color: var(--error);
  font-size: 13px;
  text-align: center;
}

/* 表单 */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group { position: relative; }
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 14px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 16px;
  font-family: var(--font);
  color: var(--text-primary);
  background: var(--bg-primary);
  outline: none;
  transition: all 0.2s ease;
}
.form-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}
.form-input.error { border-color: var(--error); }
.form-input::placeholder { color: var(--text-tertiary); }

.form-error {
  font-size: 12px;
  color: var(--error);
  margin-top: 6px;
  display: none;
}
.form-error.show { display: block; }

/* 按钮 */
.btn {
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary {
  background: linear-gradient(135deg, #4F46E5, #7C3AED);
  color: white;
  box-shadow: 0 4px 12px rgba(79,70,229,0.3);
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(79,70,229,0.4);
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-loading {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 底部 */
.auth-footer {
  padding: 20px 32px;
  text-align: center;
  border-top: 0.5px solid var(--border);
}
.auth-footer-text {
  font-size: 13px;
  color: var(--text-secondary);
}
.auth-link {
  background: none;
  border: none;
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}
.auth-link:hover {
  text-decoration: underline;
}

@media (min-width: 768px) {
  .auth-header { padding: 80px 40px 0; }
  .auth-body { padding: 40px; }
}
</style>
