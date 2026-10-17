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
      <span class="auth-eyebrow">{{ mode === 'login' ? 'CONTINUE YOUR STORY' : 'YOUR STORY STARTS HERE' }}</span>
      <h1 class="auth-title">{{ mode === 'login' ? '欢迎回来。' : '从这一刻，开始记录。' }}</h1>
      <p class="auth-subtitle">{{ mode === 'login' ? '那些属于你的生活，正在这里等你。' : '给未来的自己，留下一面镜子。' }}</p>
    </div>

    <div class="auth-body">
      <div class="auth-tabs">
        <button :class="['auth-tab', { active: mode === 'login' }]" @click="switchMode('login')">登录</button>
        <button :class="['auth-tab', { active: mode === 'register' }]" @click="switchMode('register')">注册</button>
      </div>

      <div v-if="errorMsg" class="auth-error" role="alert">{{ errorMsg }}</div>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label class="form-label" for="auth-username">用户名</label>
          <input
            id="auth-username" autocomplete="username"
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
          <label class="form-label" for="auth-password">密码</label>
          <input
            id="auth-password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
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
          <label class="form-label" for="auth-confirm">确认密码</label>
          <input
            id="auth-confirm" autocomplete="new-password"
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
/* 晨纸浅色（与全站统一 token）：暖白纸底 + 墨蓝 accent */
.auth-page {
  min-height: 100dvh;
  display: flex; flex-direction: column;
  background: var(--ink);
  color: var(--text-hi);
}

.auth-header { padding: 60px 32px 0; text-align: center; }

.auth-logo {
  width: 64px; height: 64px; border-radius: 16px;
  background: var(--accent);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 4px 14px rgba(44,95,232,.28);
}
.auth-logo svg { width: 32px; height: 32px; }

.auth-title { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
.auth-subtitle { font-size: 14px; color: var(--text-mid); }

.auth-body {
  flex: 1; padding: 32px;
  max-width: 400px; margin: 0 auto; width: 100%;
}

.auth-tabs {
  display: flex; margin-bottom: 24px;
  border-radius: 12px; background: var(--ink-2); padding: 4px;
}
.auth-tab {
  flex: 1; padding: 10px 16px;
  border: none; background: transparent;
  font-size: 14px; font-weight: 600; color: var(--text-mid);
  cursor: pointer; border-radius: 9px; transition: all .2s ease;
}
.auth-tab.active {
  background: var(--card); color: var(--text-hi);
  box-shadow: 0 1px 3px rgba(20,20,15,.08);
}

.auth-error {
  padding: 12px 16px; margin-bottom: 20px;
  background: var(--danger-bg); border-radius: 12px;
  color: var(--danger); font-size: 13px; text-align: center;
}

.auth-form { display: flex; flex-direction: column; gap: 20px; }

.form-group { position: relative; }
.form-label {
  display: block; font-size: 13px; font-weight: 600;
  color: var(--text-mid); margin-bottom: 8px;
}

.form-input {
  width: 100%; padding: 14px 16px;
  border: 1.5px solid var(--line); border-radius: 12px;
  font-size: 16px; color: var(--text-hi); background: var(--card);
  outline: none; transition: all .2s ease;
}
.form-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.form-input.error { border-color: var(--danger); }
.form-input::placeholder { color: var(--text-low); }

.form-error { font-size: 12px; color: var(--danger); margin-top: 6px; display: none; }
.form-error.show { display: block; }

.btn {
  width: 100%; padding: 14px 24px;
  border: none; border-radius: 12px;
  font-size: 16px; font-weight: 600; cursor: pointer;
  transition: all .2s ease;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--accent);
  color: #fff;
  box-shadow: 0 3px 10px rgba(44,95,232,.25);
}
.btn:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); box-shadow: 0 5px 14px rgba(44,95,232,.3); }
.btn:active:not(:disabled) { transform: scale(.98); }
.btn:disabled { opacity: .6; cursor: not-allowed; transform: none; }

.btn-loading {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,.3); border-top-color: white;
  border-radius: 50%; animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.auth-footer {
  padding: 20px 32px; text-align: center;
  border-top: 0.5px solid var(--line);
}
.auth-footer-text { font-size: 13px; color: var(--text-mid); }
.auth-link {
  background: none; border: none;
  color: var(--accent); font-weight: 600; cursor: pointer; font-size: 13px; padding: 0;
}
.auth-link:hover { text-decoration: underline; }

@media (min-width: 768px) {
  .auth-header { padding: 80px 40px 0; }
  .auth-body { padding: 40px; }
}

.auth-page { min-height:0; background:transparent; color:white; width:100%; max-width:380px; }
.auth-header { text-align:left; padding:0 0 26px; }
.auth-eyebrow { display:block; color:var(--cyan); font:italic 800 25px/1 var(--font-display); margin-bottom:18px; }
.auth-title { font-family:var(--font); font-size:29px; font-weight:900; margin:0 0 10px; letter-spacing:-.04em; }
.auth-subtitle { font-size:12px; color:#a9c3eb; }
.auth-body { padding:0; max-width:none; }
.auth-tabs { padding:0; background:transparent; border-radius:0; border-bottom:1px solid #5278bc70; gap:12px; margin:4px 0 26px; }
.auth-tab { border-radius:0; padding:12px; color:#9bb8e6; border-bottom:3px solid transparent; }
.auth-tab.active { color:var(--cyan); background:transparent; border-bottom-color:var(--cyan); box-shadow:none; }
.form-label { color:#c1d6f6; font-size:12px; }.form-input { border:1px solid #526da0; border-radius:2px; background:#0a1d50; color:white; padding:13px 14px; font-size:14px; }.form-input::placeholder{color:#89a2ce;font-size:12px}.form-input:focus{border-color:var(--cyan);box-shadow:0 0 0 1px var(--cyan)}
.auth-form { gap:20px; }.btn { border-radius:2px; background:var(--cyan); color:var(--night); font-size:14px; font-weight:900; box-shadow:4px 4px 0 var(--electric); margin-top:8px; }.btn:hover:not(:disabled){background:white;box-shadow:4px 4px 0 var(--electric)}.btn:disabled{opacity:.4}
.auth-footer { padding:26px 0 0; margin-top:28px; border-top:1px solid #47639750; }.auth-footer-text{color:#aac4ed;font-size:11px}.auth-link{color:var(--cyan);font-size:11px}.auth-error{border-radius:2px;text-align:left;background:#f5236b20;border:1px solid #f879a0;color:#ffb9cf;font-size:12px}
@media(max-width:899px){.auth-header{padding-bottom:20px}.auth-eyebrow{font-size:21px;margin-bottom:12px}.auth-title{font-size:25px}.auth-form{gap:16px}.auth-footer{margin-top:25px;padding-top:20px}}
</style>
