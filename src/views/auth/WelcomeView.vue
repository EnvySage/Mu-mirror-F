<script setup>
import { ref, computed, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { loginEntranceKey } from '@/motion/loginEntrance'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const enterMirror = inject(loginEntranceKey, navigate => navigate())
const entering = ref(false)

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
  if (auth.loading || entering.value) return
  clearErrors()
  const uValid = validateUsername()
  const pValid = validatePassword()
  const cValid = validateConfirmPassword()
  if (!uValid || !pValid || !cValid) return

  entering.value = true
  try {
    if (mode.value === 'login') {
      await auth.login(username.value, password.value)
    } else {
      await auth.register(username.value, password.value)
    }
    const candidate = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    const redirect = candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : null
    const destination = redirect || (localStorage.getItem('mirror.home-page') === 'chat'
      ? '/chat'
      : localStorage.getItem('mirror.home-page') === 'records'
        ? '/records'
        : (localStorage.getItem('mirror.presentation-mode') === 'mobile' || (localStorage.getItem('mirror.presentation-mode') !== 'desktop' && window.innerWidth < 900) ? '/chat' : '/records'))
    await enterMirror(() => router.push(destination))
  } catch (err) {
    errorMsg.value = err.message || '操作失败，请重试'
  } finally {
    entering.value = false
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
        <button type="button" :disabled="auth.loading || entering" :aria-pressed="mode === 'login'" :class="['auth-tab', { active: mode === 'login' }]" @click="switchMode('login')">登录</button>
        <button type="button" :disabled="auth.loading || entering" :aria-pressed="mode === 'register'" :class="['auth-tab', { active: mode === 'register' }]" @click="switchMode('register')">注册</button>
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

        <button type="submit" class="btn" :disabled="!isValid || auth.loading || entering">
          <span v-if="auth.loading" class="btn-loading" />
          {{ auth.loading || entering ? '正在进入…' : mode === 'login' ? '回到我的日常' : '开始我的故事' }}
        </button>
      </form>
    </div>

    <div class="auth-footer">
      <p class="auth-footer-text">
        {{ mode === 'login' ? '还没有账号？' : '已有账号？' }}
        <button class="auth-link" :disabled="auth.loading || entering" @click="switchMode(mode === 'login' ? 'register' : 'login')">
          {{ mode === 'login' ? '立即注册' : '去登录' }}
        </button>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page{width:100%;max-width:370px;color:#f2f8f4}
.auth-header{padding-bottom:27px}
.auth-eyebrow{display:block;font:italic 900 34px/.95 var(--font-display);color:#8de2e8;transform:rotate(-3deg);margin:0 0 23px}
.auth-title{font-size:29px;font-weight:900;letter-spacing:-.04em;line-height:1.4;margin-bottom:10px}
.auth-subtitle{font-size:12px;color:#abc2d0;line-height:1.8}
.auth-tabs{display:flex;gap:6px;margin-bottom:28px;border-bottom:1px solid #64839555;padding-bottom:9px}
.auth-tab{min-height:43px;padding:10px 28px;background:transparent;color:#b4c7d6;font-size:14px;font-weight:800;border:0;cursor:pointer;transition:transform .22s,background .22s}
.auth-tab.active{background:#e8f1eb;color:#102c46;transform:skew(-9deg) rotate(-2deg);box-shadow:4px 4px 0 #1555d9}
.auth-tab:not(.active):hover{color:#8feaf0;transform:translateX(3px)}
.auth-form{display:grid;gap:22px}.form-label{display:block;color:#bdcfd9;font-size:12px;margin-bottom:9px}
.form-input{width:100%;padding:14px 13px;background:#0d2944;border:1px solid #476581;border-left:3px solid #719aa8;border-radius:0;color:#f1f9ff;font:14px var(--font);outline:none;transition:background .2s,border-color .2s}
.form-input::placeholder{font-size:12px;color:#92adbd}.form-input:focus{border-color:#93edf0;background:#103756;box-shadow:3px 3px 0 #1b53b7}
.form-input.error{border-color:#f488ad}.form-error{font-size:12px;color:#ffaec9;margin-top:7px}
.btn{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:53px;padding:14px 24px;margin-top:8px;border:0;border-radius:0;background:#8ee8ea;color:#0c2942;font-size:15px;font-weight:900;box-shadow:6px 6px 0 #1b51c1;transform:skew(-6deg);cursor:pointer;transition:transform .25s cubic-bezier(.34,1.56,.64,1),background .2s,box-shadow .2s}
.btn:after{content:'↗';font-size:25px;line-height:1}.btn:hover:not(:disabled){background:#e7f6ec;transform:skew(-6deg) translate(-3px,-3px);box-shadow:10px 10px 0 #1b51c1}.btn:active:not(:disabled){transform:skew(-6deg) translate(3px,3px);box-shadow:2px 2px 0 #1b51c1}.btn:disabled{opacity:.45;cursor:not-allowed}
.auth-footer{margin-top:35px;padding-top:20px;border-top:1px solid #64839555}.auth-footer-text{font-size:12px;color:#a6bccb}.auth-link{border:0;padding:7px;background:transparent;color:#99ebec;font-size:12px;cursor:pointer;text-decoration:underline;text-underline-offset:4px}
.auth-error{margin-bottom:20px;padding:12px;background:#592b4555;border-left:3px solid #ed77a4;color:#ffbdd3;font-size:12px;line-height:1.7}
.btn-loading{width:16px;height:16px;border:2px solid #0c294244;border-top-color:#0c2942;border-radius:50%;animation:auth-spin .7s linear infinite}
button:focus-visible,a:focus-visible{outline:3px solid #f688b2;outline-offset:5px}
@keyframes auth-spin{to{rotate:360deg}}
@media(max-width:699px){.auth-page{max-width:430px}.auth-eyebrow{font-size:28px;margin-bottom:17px}.auth-title{font-size:25px}.auth-header{padding-bottom:20px}.auth-form{gap:18px}.auth-footer{margin-top:28px}.form-input{font-size:16px}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
