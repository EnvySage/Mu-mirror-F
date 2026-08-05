<script setup>
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/organisms/PageHeader.vue'
import SettingsItem from '@/components/molecules/SettingsItem.vue'

const router = useRouter()
const settings = useSettingsStore()
const auth = useAuthStore()

function handleLogout() {
  if (confirm('确定要退出登录吗？')) {
    auth.logout()
    router.push('/auth/login')
  }
}
</script>

<template>
  <div class="page settings-page">
    <PageHeader title="设置" />
    <div class="page-content">
      <div class="settings-grid">
        <!-- AI 模型 -->
        <div class="settings-group">
          <div class="settings-group-title">AI 模型</div>
          <div class="settings-card">
            <SettingsItem
              icon="chat"
              icon-bg="var(--accent)"
              label="API 地址"
              :description="settings.settings.apiUrl"
            />
            <SettingsItem
              icon="lock"
              icon-bg="#7C3AED"
              label="API Key"
              :description="settings.settings.apiKey"
            />
            <SettingsItem
              icon="zap"
              icon-bg="#10B981"
              label="模型"
              :description="settings.settings.model"
            />
          </div>
        </div>

        <!-- 数据库 -->
        <div class="settings-group">
          <div class="settings-group-title">数据库</div>
          <div class="settings-card">
            <SettingsItem
              icon="database"
              icon-bg="#F59E0B"
              label="数据库地址"
              :description="settings.settings.dbUrl"
            />
          </div>
        </div>

        <!-- 审核模式 -->
        <div class="settings-group">
          <div class="settings-group-title">审核模式</div>
          <div class="settings-card">
            <SettingsItem
              icon="eye"
              icon-bg="#EC4899"
              label="自动审核"
              description="跳过审核，AI直接保存"
              action="toggle"
              :toggle-value="settings.autoReview"
              @toggle="settings.toggleAutoReview()"
            />
          </div>
        </div>

        <!-- 关于 -->
        <div class="settings-group">
          <div class="settings-group-title">关于</div>
          <div class="settings-card">
            <SettingsItem
              icon="info"
              icon-bg="#6B7280"
              label="版本"
              description="v0.1.0"
              action="none"
            />
          </div>
        </div>

        <!-- 账号 -->
        <div class="settings-group">
          <div class="settings-group-title">账号</div>
          <div class="settings-card">
            <SettingsItem
              v-if="auth.user"
              icon="user"
              icon-bg="#3B82F6"
              label="当前用户"
              :description="auth.user.username"
              action="none"
            />
            <div class="logout-btn" @click="handleLogout">
              <span class="logout-text">退出登录</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: var(--bg); overflow-y: auto; overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.page-content { padding: 12px 16px 32px; }

.settings-grid { display: flex; flex-direction: column; gap: 16px; }
.settings-group { margin-bottom: 0; }
.settings-group-title {
  font-size: 12px; font-weight: 600; color: var(--text-tertiary);
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-left: 4px;
}
.settings-card {
  background: var(--surface); border-radius: var(--radius-md);
  border: 0.5px solid var(--border); overflow: hidden;
}

@media (min-width: 900px) {
  .page-content { padding: 20px 36px 36px; }
  .settings-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
  .settings-group-title { margin-bottom: 10px; }
}

.logout-btn {
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.2s ease;
  border-top: 0.5px solid var(--border);
}
.logout-btn:hover {
  background: var(--bg-secondary);
}
.logout-text {
  color: var(--error);
  font-size: 14px;
  font-weight: 500;
}
</style>
