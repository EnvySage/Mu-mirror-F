<script setup>
import { useVaultView } from '@/composables/useVaultView'
const { PageMasthead, reportAchievementActivity, ref, AssetCard, FilePreviewModal, FileTypeIcon, VAULT_WHITELIST, categoryLabel, stableVariant, vault, vaultRoot, listMotion, folderEl, acceptanceEl, previewItem, previewOrigin, openPreview, FILTERS, busyIds, onAssetDraftChange, fileInput, dragOver, pendingUpload, isImagePending, canConfirmUpload, descPlaceholder, pickFile, onPickChange, onDragEnter, onDragOver, onDragLeave, onDrop, confirmUpload, cancelUpload, enterTask, leaveTask, cancelTask, onSave, onConfirm, setFilter, onRemove, onDownload, focusItem, digestSummary } = useVaultView()
</script>

<template>
  <div class="page vault-page">
    <div ref="vaultRoot" class="page-content">
      <PageMasthead title="记忆资产" english="MEMORY ARCHIVE" description="把文件与灵感，留在自己的记忆里" />
      <!-- 配额条 -->
      <div class="card quota-card">
        <div class="quota-row">
          <span class="quota-label">{{ vault.quotaLabel }}</span>
          <span v-if="digestSummary" class="quota-sub">{{ digestSummary }}</span>
        </div>
        <div class="quota-bar">
          <div class="quota-fill" :style="{ transform: `scaleX(${vault.quotaPercent / 100})` }" />
        </div>
      </div>

      <!-- 上传投放区（点击/拖拽，dragover 高亮） -->
      <div
        :class="['dropzone', { over: dragOver }]"
        role="button"
        aria-label="上传文件"
        tabindex="0"
        @click="pickFile"
        @keydown.enter="pickFile"
        @keydown.space.prevent="pickFile"
        @dragover.prevent="onDragOver"
        @dragenter.prevent="onDragEnter"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <span ref="acceptanceEl" class="dropzone-acceptance" aria-hidden="true" /><div ref="folderEl" class="vault-folder" aria-hidden="true"><svg viewBox="0 0 120 100" fill="none"><path d="M8 18h36l12 13h54v60H8z" fill="#0b2370" stroke="#50edfa" stroke-width="3"/><path d="M18 43h97L96 91H8z" fill="#50edfa"/><path d="M28 14h47v45H28z" fill="white" transform="rotate(-9 28 14)"/><path d="M18 43h97L96 91H8z" fill="#50edfa" fill-opacity=".85"/></svg></div>
        <div class="dropzone-text"><span class="dropzone-title">让灵感，有处可寻。</span>
          {{ dragOver ? '松开文件，交给 Mirror 整理' : '拖文件进来，或点击选择' }}
          <span class="dropzone-hint">单文件 20MB 内 · {{ VAULT_WHITELIST.join(' / ') }}</span>
        </div>
        <span class="dropzone-plus" aria-hidden="true">＋</span>
        <input ref="fileInput" type="file" hidden @change="onPickChange">
      </div>

      <!-- 上传卡（选文件后弹出，确认才上传；图片必填描述） -->
      <div class="upload-task-slot" :class="{ occupied: pendingUpload }">
      <Transition :css="false" @enter="enterTask" @leave="leaveTask" @enter-cancelled="cancelTask" @leave-cancelled="cancelTask">
      <div v-if="pendingUpload" key="upload-task" class="upload-wrap" :aria-busy="vault.uploading">
        <div class="up-mini">
          <span class="up-mini-icon"><FileTypeIcon :kind="pendingUpload.category || 'file'" /></span>
          <div class="up-mini-body">
            <div class="up-mini-name">{{ pendingUpload.displayName }}</div>
            <div class="up-mini-meta">识别为：{{ categoryLabel(pendingUpload.category) }}</div>
          </div>
        </div>
        <input
          v-model="pendingUpload.description"
          :disabled="vault.uploading"
          :class="['up-mini-input', { 'up-mini-input-required': isImagePending }]"
          :placeholder="descPlaceholder"
          maxlength="100"
        >
        <div v-if="isImagePending" class="up-mini-note">图片内容镜子读不到，一句描述是它被找到的唯一途径</div>
        <div class="upload-task-status" role="status" aria-live="polite"><Transition :css="false" mode="out-in" @enter="enterTask" @leave="leaveTask" @enter-cancelled="cancelTask" @leave-cancelled="cancelTask"><span :key="vault.uploading ? 'uploading' : 'ready'"><span v-if="vault.uploading" class="spinner" />{{ vault.uploading ? '正在存入文件，请稍候…' : '确认信息后存入，提取完成后可补确认' }}</span></Transition></div>
        <div class="up-mini-actions">
          <button class="as-btn as-btn-ghost" :disabled="vault.uploading" @click="cancelUpload">取消</button>
          <button class="as-btn as-btn-primary" :disabled="vault.uploading || !canConfirmUpload" @click="confirmUpload">
            {{ vault.uploading ? '存入中…' : '就这样存' }}
          </button>
        </div>
      </div>

      </Transition>
      </div>

      <!-- 低信息/待确认置顶区（§3.3b 补确认入口） -->
      <div v-if="vault.lowInfoItems.length" class="lowinfo-zone">
        <div class="lowinfo-head">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          未能识别，请描述一下（{{ vault.lowInfoItems.length }}）
        </div>
        <button
          v-for="item in vault.lowInfoItems"
          :key="`low-${item.id}`"
          class="lowinfo-row"
          @click="focusItem(item)"
        >
          <FileTypeIcon :kind="item.category || 'file'" />
          <span class="lowinfo-name">{{ item.display_name }}</span>
          <span class="lowinfo-hint">请描述一下，它才能被找到</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      <!-- 补确认提示（有描述但还没确认的 extracted 文件——确认门禁漏斗第二级） -->
      <div v-if="vault.unconfirmedItems.filter(i => (i.description || '').trim()).length" class="confirm-zone">
        <div class="confirm-head">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          这些文件还没确认 · 确认后才能被检索到（{{ vault.unconfirmedItems.filter(i => (i.description || '').trim()).length }}）
        </div>
        <button
          v-for="item in vault.unconfirmedItems.filter(i => (i.description || '').trim())"
          :key="`uc-${item.id}`"
          class="lowinfo-row"
          @click="focusItem(item)"
        >
          <FileTypeIcon :kind="item.category || 'file'" />
          <span class="lowinfo-name">{{ item.display_name }}</span>
          <span class="lowinfo-hint lowinfo-hint-accent">补确认 · 让它可检索</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      <!-- 类型筛选 chips -->
      <div class="archive-heading"><div><span>THE PERSONAL COLLECTION</span><h2>收集，也是生活。</h2></div><strong>{{ String(vault.items.length).padStart(2, '0') }}<small>份记忆资产</small></strong></div>
      <div class="filter-row">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          :class="['chip', { selected: vault.filter === f.key }]"
          :aria-pressed="vault.filter === f.key"
          @click="setFilter(f.key)"
        >{{ f.label }}</button>
      </div>

      <!-- 首次加载才替换卡架；消化轮询保留卡片和未保存编辑。 -->
      <div v-if="vault.loading && !vault.items.length" class="vault-empty"><span class="spinner" /> 加载中…</div>

      <!-- 文件卡列表（时间倒序） -->
      <div v-else-if="vault.filteredItems.length" class="assets-grid">
        <AssetCard
          v-for="item in vault.filteredItems"
          :key="item.id"
          :data-asset-id="item.id"
          :item="item"
          :shelf-variant="['lead', 'cut-a', 'cut-b', 'cut-c'][stableVariant(item.id, 4)]"
          :busy="busyIds.has(String(item.id))"
          @draft-change="onAssetDraftChange"
          @layout-change="listMotion.capture"
          @preview="openPreview"
          @save="(d, done) => onSave(item, d, done)"
          @confirm="(d, done) => onConfirm(item, d, done)"
          @remove="() => onRemove(item)"
          @download="onDownload"
        />
      </div>

      <!-- 空态 / 筛选空 -->
      <div v-else-if="vault.items.length" class="vault-empty">这个分类下还没有文件</div>
      <div v-else class="vault-empty">还没有文件 · 传一个试试，镜子会替你记住它</div>

      <!-- 加载失败兜底 -->
      <div v-if="vault.error" class="vault-error">{{ vault.error }}</div>

      <!-- 文件预览模态（Teleport to body；资产卡预览入口） -->
      <FilePreviewModal
        v-if="previewItem"
        :key="previewItem.id"
        :item="previewItem"
        :origin="previewOrigin"
        @loaded="item => reportAchievementActivity('vault.previewed', item.id)"
        @close="previewItem = null"
      />
    </div>
  </div>
</template>

<style scoped src="@/assets/styles/vault-view.css"></style>
<style scoped src="@/assets/styles/persona-vault.css"></style>
