<script setup>
import { useSettingsView } from '@/composables/useSettingsView'
const { reportAchievementActivity, vReadEnd, PageMasthead, ref, SettingsItem, TermCard, SelectMenu, router, settingsStore, auth, glossary, presentation, homePage, scrollArea, activeSection, sections, trackSection, jumpSection, setHomePage, dismissedOpen, confirmedOpen, addOpen, addDraft, busyTermId, onTermConfirm, onTermSave, onTermDismiss, onTermRestore, onTermOpenSource, submitAdd, handleExtract, halfLifeDraft, halfLifeEditing, halfLifeValue, effectiveHalfLife, lookbackSelectOptions, lookbackSaving, lookbackValue, onLookbackChange, setDefaultRecordMode, saveHalfLife, halfLifePreview, exportingKind, handleExport, handleLogout } = useSettingsView()
</script>

<template>
  <div class="page settings-page">
    <div ref="scrollArea" class="page-content" @scroll.passive="trackSection">
      <PageMasthead title="设置" english="SYSTEM" description="让镜子按你的方式，理解你的生活" />
      <div class="settings-identity"><span class="settings-config" aria-hidden="true">CONFIG!</span><span class="settings-emblem" aria-hidden="true">M/</span><div><span class="settings-kicker">MAKE YOUR OWN RULES</span><h2>你的镜子，<br>由你设定。</h2><p>{{ auth.user?.username || 'Mirror' }} 的个人空间</p></div></div>
      <div v-if="settingsStore.error" class="settings-load-error" role="alert">{{ settingsStore.error }}<button class="p3-link" @click="settingsStore.fetchSettings()">重试</button></div>
      <div class="settings-console">
      <nav class="settings-index" aria-label="设置分区">
        <span class="settings-index-caption" aria-hidden="true">TUNE YOUR MIRROR ↘</span>
        <a v-for="([id, english, label], index) in sections" :key="id" :href="'#settings-' + id" :aria-current="activeSection === 'settings-' + id ? 'location' : undefined" @click.prevent="jumpSection('settings-' + id)"><small>0{{ index + 1 }}</small><span><b>{{ english }}</b><em>{{ label }}</em></span><i aria-hidden="true">↗</i></a>
      </nav>
      <div class="settings-wrap">
      <div v-read-end="{ key: 'presentation', onRead: () => reportAchievementActivity('settings.section_viewed', 'presentation') }" class="settings-group" id="settings-presentation">
        <div class="settings-group-title">页面呈现</div>
        <div class="settings-card card presentation-settings">
          <div class="presentation-setting"><div><strong>当前布局</strong><small>切换不会中断正在进行的对话</small></div><div class="presentation-buttons"><button :aria-pressed="presentation.override.value === 'auto'" @click="presentation.requestMode('auto')">自动</button><button :aria-pressed="presentation.mode.value === 'mobile' && presentation.override.value !== 'auto'" @click="presentation.requestMode('mobile')">手机</button><button :aria-pressed="presentation.mode.value === 'desktop' && presentation.override.value !== 'auto'" @click="presentation.requestMode('desktop')">桌面</button></div></div>
          <label class="presentation-setting"><span><strong>默认首页</strong><small>自动进入记录；也可以固定进入对话</small></span><select aria-label="默认首页" :value="homePage" @change="setHomePage($event.target.value)"><option value="auto">自动</option><option value="chat">对话</option><option value="records">记录</option></select></label>
        </div>
      </div>
      <div class="settings-group" id="settings-model">
        <div class="settings-group-title">模型中心</div>
        <div class="settings-card card">
          <SettingsItem icon="chat" icon-bg="var(--accent)" label="管理 AI 模型" :description="settingsStore.settings.ai_model || '添加模型配置，选择你的对话搭档'" action="none"><template #append><button class="test-btn" @click="router.push('/models')">进入模型中心</button></template></SettingsItem>
          <SettingsItem icon="sparkle" icon-bg="var(--processing)" label="记忆检索模型" :description="settingsStore.settings.embedding_source === 'api' ? '远程 API 服务' : '本地 BGE-m3（1024 维）'" action="none"><template #append><button class="test-btn" @click="router.push({ path: '/models', query: { tab: 'embedding' } })">管理检索</button></template></SettingsItem>
        </div>
      </div>

      <div v-read-end="{ key: 'authorization', onRead: () => reportAchievementActivity('settings.section_viewed', 'authorization') }" class="settings-group" id="settings-authorization">
        <div class="settings-group-title">AI 使用与授权</div>
        <div class="settings-card card">
          <div class="record-mode-setting">
            <div><b>新记录默认方式</b><p>只影响之后新建的记录，每条记录仍可单独选择。</p></div>
            <div class="protocol-chips" role="group" aria-label="新记录默认方式">
              <button :class="['chip', { selected: settingsStore.settings.default_record_mode === 'ONLY_SAVE' }]" :disabled="settingsStore.loading" @click="setDefaultRecordMode('ONLY_SAVE')">仅保存</button>
              <button :class="['chip', { selected: settingsStore.settings.default_record_mode === 'AI_ASSISTED' }]" :disabled="settingsStore.loading" @click="setDefaultRecordMode('AI_ASSISTED')">AI 帮我整理</button>
            </div>
          </div>
          <SettingsItem
            icon="eye"
            icon-bg="var(--processing)"
            label="逐片段确认后进入长期记忆"
            description="仅保存的记录不会调用 AI 整理；AI 整理候选须由你审核确认。旧的“自动审核”设置也会保留人工确认，不会自动进入记忆。"
            action="none"
          />
        </div>
      </div>

      <!-- 个人词典（lexicon-design.md 5b：全量管理入口） -->
      <div class="settings-group" id="settings-glossary">
        <div class="settings-group-title">个人词典</div>
        <div class="settings-card card glossary-card">
          <!-- 顶部操作行：教镜子一个词 + 手动抽取 -->
          <div class="glossary-toolbar">
            <span class="glossary-hint">从你的日记里学"论文=毕设 RAG"这类个人指代</span>
            <div class="glossary-toolbar-btns">
              <button class="test-btn" :disabled="glossary.extracting" @click="handleExtract">
                {{ glossary.extracting ? '抽取中…' : '重新抽取' }}
              </button>
              <button class="glossary-add-btn" @click="addOpen = !addOpen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                教镜子一个词
              </button>
            </div>
          </div>

          <!-- 新增表单（空表单展开，直接 confirmed） -->
          <div v-if="addOpen" class="glossary-add-form">
            <label class="glossary-field">
              <span class="glossary-field-label">词条</span>
              <input v-model="addDraft.term" class="glossary-input" placeholder="比如：那个设计" @keyup.enter="submitAdd">
            </label>
            <label class="glossary-field">
              <span class="glossary-field-label">别名</span>
              <input v-model="addDraft.aliasesText" class="glossary-input" placeholder="可选 · 多个用顿号分隔，如：毕设、那个设计" @keyup.enter="submitAdd">
            </label>
            <label class="glossary-field">
              <span class="glossary-field-label">它指的是什么</span>
              <textarea v-model="addDraft.description" class="glossary-input glossary-textarea" rows="2" placeholder="镜子会按这句话理解你的记录" />
            </label>
            <div class="glossary-add-actions">
              <button class="term-btn-ghost glossary-cancel" @click="addOpen = false">取消</button>
              <button class="glossary-submit" @click="submitAdd">加入词典</button>
            </div>
          </div>

          <!-- 加载中 -->
          <div v-if="glossary.loading" class="glossary-empty"><span class="spinner" /> 加载中…</div>

          <template v-else>
            <!-- 1. 待确认（badge 计数） -->
            <div class="glossary-group-head">
              <span>待确认</span>
              <span v-if="glossary.pendingCount" class="glossary-badge">{{ glossary.pendingCount }}</span>
            </div>
            <template v-if="glossary.pending.length">
              <TermCard
                v-for="t in glossary.pending"
                :key="t.id"
                :term="t"
                group="pending"
                :busy="busyTermId === t.id"
                @confirm="onTermConfirm(t)"
                @save="data => onTermSave(t, data)"
                @dismiss="onTermDismiss(t)"
                @open-source="onTermOpenSource"
              />
            </template>
            <div v-else class="glossary-empty">没有待确认的候选 · 凌晨任务会从近 14 天日记里学新词</div>

            <!-- 2. 已生效（有词时默认收起，与已忽略组同一套折叠交互） -->
            <template v-if="glossary.confirmed.length">
              <button class="glossary-group-head glossary-group-toggle" @click="confirmedOpen = !confirmedOpen">
                <span>已生效</span>
                <span class="glossary-badge glossary-badge-mid">{{ glossary.confirmed.length }}</span>
                <span class="glossary-toggle-hint">{{ confirmedOpen ? '收起' : '展开' }}</span>
                <svg :class="['glossary-caret', { open: confirmedOpen }]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <template v-if="confirmedOpen">
                <TermCard
                  v-for="t in glossary.confirmed"
                  :key="t.id"
                  :term="t"
                  group="confirmed"
                  :busy="busyTermId === t.id"
                  @confirm="onTermConfirm(t)"
                  @save="data => onTermSave(t, data)"
                  @dismiss="onTermDismiss(t)"
                  @open-source="onTermOpenSource"
                />
              </template>
            </template>
            <template v-else>
              <div class="glossary-group-head"><span>已生效</span></div>
              <div class="glossary-empty">还没有已生效的词 · 确认候选或点上方「教镜子一个词」</div>
            </template>

            <!-- 3. 已忽略（折叠） -->
            <template v-if="glossary.dismissed.length">
              <button class="glossary-group-head glossary-group-toggle" @click="dismissedOpen = !dismissedOpen">
                <span>已忽略</span>
                <span class="glossary-badge glossary-badge-low">{{ glossary.dismissed.length }}</span>
                <span class="glossary-toggle-hint">{{ dismissedOpen ? '收起' : '展开' }}</span>
                <svg :class="['glossary-caret', { open: dismissedOpen }]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <template v-if="dismissedOpen">
                <TermCard
                  v-for="t in glossary.dismissed"
                  :key="t.id"
                  :term="t"
                  group="dismissed"
                  :busy="busyTermId === t.id"
                  @confirm="onTermRestore(t)"
                  @dismiss="onTermDismiss(t)"
                />
              </template>
            </template>
          </template>
        </div>
        <div class="settings-note">
          确认后对话会按词条理解检索你的记录；理解过时会导致偏差，可在这里随时修改。被忽略的词 30 天后可能重新浮现。
        </div>
      </div>

      <!-- 镜子引擎（rolling-mirror-design.md §2：回看深度 + 时间衰减同组） -->
      <div v-read-end="{ key: 'memory', onRead: () => reportAchievementActivity('settings.section_viewed', 'memory') }" class="settings-group" id="settings-memory">
        <div class="settings-group-title">镜子的记忆</div>
        <div class="settings-card card">
          <div class="lookback-row">
            <div class="lookback-head">
              <span class="lookback-label">原文回看深度</span>
              <span class="lookback-value">{{ lookbackValue }}</span>
            </div>
            <SelectMenu
              :model-value="lookbackValue"
              :options="lookbackSelectOptions"
              :disabled="lookbackSaving"
              aria-label="生成镜子时带多少原文回看"
              @update:model-value="onLookbackChange"
            />
            <div v-if="lookbackValue === 3" class="lookback-warn">记录多时生成会变慢且消耗更多 token</div>
          </div>
          <div class="half-life-row">
            <div class="half-life-header">
              <span class="half-life-label">半衰期</span>
              <span class="half-life-value">{{ effectiveHalfLife }} 天</span>
            </div>
            <input
              v-model.number="halfLifeDraft"
              type="range"
              min="7"
              max="365"
              value="30"
              @input="halfLifeEditing = true"
              @change="saveHalfLife"
            >
            <div class="settings-note" style="padding:8px 0 0">{{ halfLifePreview }}</div>
          </div>
        </div>
        <div class="settings-note">
          生成镜子时带多少原文回看：0=只继承上月镜子（最省） / 1=上月原文（推荐，默认） / 2=近三月原文 / 3=全部原文（慢，消耗大）。
        </div>
      </div>

      <!-- 数据 -->
      <div v-read-end="{ key: 'data', onRead: () => reportAchievementActivity('settings.section_viewed', 'data') }" class="settings-group" id="settings-data">
        <div class="settings-group-title">数据与账号</div>
        <div class="settings-card card">
          <SettingsItem
            icon="download"
            icon-bg="#8A8F9C"
            label="导出 JSON"
            description="结构化备份 · 不含向量"
            action="none"
          >
            <template #append><button class="test-btn" :disabled="exportingKind === 'JSON'" @click="handleExport('JSON')">{{ exportingKind === 'JSON' ? '导出中…' : '导出' }}</button></template>
          </SettingsItem>
          <SettingsItem
            icon="file"
            icon-bg="#8A8F9C"
            label="导出 Markdown"
            description="人可读 · 不含向量"
            action="none"
          >
            <template #append><button class="test-btn" :disabled="exportingKind === 'Markdown'" @click="handleExport('Markdown')">{{ exportingKind === 'Markdown' ? '导出中…' : '导出' }}</button></template>
          </SettingsItem>
          <SettingsItem
            icon="logout"
            icon-bg="var(--danger)"
            :label="auth.user ? `退出登录（${auth.user.username}）` : '退出登录'"
            action="none"
          >
            <template #append>
              <button class="test-btn danger-btn" @click="handleLogout">退出</button>
            </template>
          </SettingsItem>
        </div>
      </div>
      </div>

      <!-- 编辑弹窗 -->
      </div>

    </div>
  </div>
</template>

<style scoped src="@/assets/styles/settings-view.css"></style>
<style scoped src="@/assets/styles/persona-settings.css"></style>
