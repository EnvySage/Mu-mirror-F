<script setup>
import { useDetailPanel } from '@/composables/useDetailPanel'
const { ref, ReviewPanel, ActionCard, formatFullDate, ui, panelEl, readerEl, reviewPanelRef, loadingRecord, detailError, closing, confirming, actionError, rawEditing, rawDraft, preparedRecordAction, memoryLifecycleAction, deleteRecordAction, record, journalDate, memoryState, memoryFailureReason, canEditMemorySource, processingStep, openRecord, headerTitle, showConfirm, close, retryLoad, growthReviewValid, onAuthorizationChange, onConfirm, saveRaw, organizeSavedRecord, onRecordActionUpdated, saveRecordActionDraft, prepareDisableMemory, onMemoryLifecycleUpdated, onDeleteRecordActionUpdated, submitting, retryProcessing, deleteRecord } = useDetailPanel()
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.selectedRecordId" ref="panelEl" :class="['detail-page',{closing}]" role="dialog" aria-modal="true" aria-label="记录详情">
        <div class="detail-header">
          <button class="detail-back" @click="close">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
            返回
          </button>
          <span class="detail-title">{{ headerTitle }}</span>
          <span v-if="record?.created_at" class="detail-date">{{ formatFullDate(new Date(record.created_at)) }}</span>
          <button
            v-if="showConfirm"
            class="detail-confirm"
            :disabled="confirming || !growthReviewValid"
            @click="onConfirm"
          >{{ confirming ? '保存授权…' : record.status === 'reviewing' ? '确认所选片段' : '更新记忆授权' }}</button>
          <button v-if="record?.status === 'done'" class="detail-confirm" type="button" :disabled="confirming" @click="ui.openWriteModal()">继续写</button>
          <button v-if="memoryState === 'READY'" class="detail-confirm detail-danger" type="button" :disabled="confirming" @click="prepareDisableMemory">{{ confirming ? '准备确认卡…' : '永久移除记忆' }}</button>
          <button v-if="canEditMemorySource && ['record_only', 'done'].includes(record?.status)" class="detail-confirm" :disabled="confirming" @click="organizeSavedRecord">{{ confirming ? '准备候选…' : record.status === 'record_only' ? '让 Mirror 整理' : '重新提交 AI 整理' }}</button>
          <span class="detail-title" />
        </div>

        <div ref="readerEl" class="detail-content detail-reader">
          <div v-if="loadingRecord && !record" class="detail-load-state" role="status"><span class="spinner" /> 正在载入这段记录…</div>
          <div v-else-if="detailError && !record" class="detail-load-state" role="alert"><p>{{ detailError }}</p><button class="detail-confirm" @click="retryLoad">重试</button><button class="detail-back" @click="close">返回列表</button></div>
          <template v-else-if="record">
          <header class="detail-folio" data-chart-reveal>
            <div class="folio-type"><span>KEEP A LITTLE OF TODAY.</span><h2>这一天，<br><em>值得留下。</em></h2><b>MY JOURNAL / 私人存档</b></div>
            <div v-if="journalDate" class="folio-date"><span>{{ journalDate.year }} / {{ journalDate.month }}</span><strong>{{ journalDate.day }}</strong><em>{{ journalDate.weekday }}</em></div>
            <span class="folio-spark" aria-hidden="true">✳</span>
          </header>
          <div v-if="actionError" class="detail-error">{{ actionError }}</div>
          <ActionCard v-if="preparedRecordAction" :proposal="preparedRecordAction" hide-edit @updated="onRecordActionUpdated" />
          <ActionCard v-if="memoryLifecycleAction" :proposal="memoryLifecycleAction" hide-edit @updated="onMemoryLifecycleUpdated" />
          <ActionCard v-if="deleteRecordAction" :proposal="deleteRecordAction" hide-edit @updated="onDeleteRecordActionUpdated" />

          <!-- 处理中：三步动画 -->
          <div v-if="ui.detailMode === 'processing'" class="processing-view">
            <div class="processing-ring" />
            <div class="processing-title">正在分析你的记录</div>
            <div class="processing-desc">正在整理原文、识别主题并生成片段。</div>
            <div class="processing-steps">
              <div :class="['processing-step', { active: processingStep === 0, done: processingStep > 0 }]">
                <div class="processing-step-dot" />整理原文
              </div>
              <div :class="['processing-step', { active: processingStep === 1, done: processingStep > 1 }]">
                <div class="processing-step-dot" />识别主题
              </div>
              <div :class="['processing-step', { active: processingStep === 2 }]">
                <div class="processing-step-dot" />生成片段卡片
              </div>
            </div>
          </div>

          <!-- failed：原因 + 重试/删除 -->
          <div v-else-if="ui.detailMode === 'failed'" class="failed-view">
            <div class="review-original">
              <div class="review-label">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                原始内容 · 不可修改
              </div>
              <div class="review-original-text">{{ record.content }}</div>
            </div>
            <div class="status-failed-row" style="font-size:13px;justify-content:center;padding:10px 0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              {{ record.fail_reason || '处理失败（可能是模型配置问题或内容被判定无意义）' }}
            </div>
            <div class="failed-actions">
              <button class="chip chip-accent" :disabled="confirming || submitting" @click="retryProcessing">
                {{ confirming ? '准备候选…' : '重新生成整理候选' }}
              </button>
              <button class="chip chip-danger" :disabled="submitting" @click="deleteRecord">删除</button>
            </div>
          </div>

          <div v-else-if="record.status === 'record_only'" class="record-only-view">
            <p class="record-only-note">记忆状态：{{ memoryState }} · 这条内容当前仅保存在记录中，尚未加入 Mirror 记忆。</p>
            <p v-if="memoryFailureReason" class="record-only-note" role="status">记忆建立未完成，已降级为仅保存。原因：{{ memoryFailureReason }}</p>
            <ReviewPanel v-if="preparedRecordAction" :record="record" :proposal="preparedRecordAction" @proposal-save="saveRecordActionDraft" />
            <textarea v-if="rawEditing" v-model="rawDraft" class="record-only-editor" aria-label="编辑仅记录原文" />
            <div v-else class="review-original-text">{{ record.content }}</div>
            <div class="failed-actions">
              <button v-if="!rawEditing" class="chip chip-accent" @click="rawEditing = true">编辑原文</button>
              <button v-else class="chip chip-accent" @click="saveRaw">保存修改</button>
              <button v-if="rawEditing" class="chip" @click="rawEditing = false; rawDraft = record.content">取消</button>
              <button class="chip chip-danger" @click="deleteRecord">删除记录</button>
            </div>
          </div>

          <template v-else>
            <!-- 审核 / 只读（审核态内含待办建议卡，证据行可切记录） -->
            <ReviewPanel ref="reviewPanelRef" :record="record" :authorization-busy="confirming" @open-record="openRecord" @authorization-change="onAuthorizationChange" />
          </template>
          </template>
        </div>
    </div>
  </Teleport>
</template>

<style scoped src="@/assets/styles/detail-panel.css"></style>
<style scoped src="@/assets/styles/persona-detail.css"></style>
