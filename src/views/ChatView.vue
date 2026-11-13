<script setup>
import { useChatView } from '@/composables/useChatView'
const { LedgerActionForm, receiptEnabled, receiptBusy, receiptOffers, visibleReceiptOffers, toggleReceipt, recognizeChatImage, prepareReceipt, parseCitations, citeTitle, ChatImageDraft, PageMasthead, ref, ChatSessionsPanel, FilePreviewModal, VaultRefCard, VaultUploadCard, VaultDigestReceipt, ActionCard, ChatDaySummaryCard, ChatMemoryPanel, CreatedRecordReceipt, ToolTrail, FileTypeIcon, ChatMessageContent, router, isMobile, chat, actions, vault, toast, orderedMessages, input, messagesEl, inputEl, sceneEl, sceneActive, mailDate, showSessions, sessionsDialog, sessionsMotion, showMemoryPanel, showMore, moreDialog, openMemory, openModels, openHistory, imageDraft, imageCount, onPasteImages, canSend, retryingSummaryId, visibleEndedSummaries, summaryActions, retrySummary, actionCardsFor, receiptItems, previewItem, downloadRef, activeSessionTitle, emptyTitle, emptyDesc, chatScroll, followingBottom, scrollToBottom, vMessageEnter, autoGrow, send, onKeydown, openSource, openCreatedRecord, refreshRun, openVaultRef, onVaultPreviewLoaded, fileInput, dragOver, pendingUpload, pickFile, onPickChange, onDragOver, onDragLeave, onDrop, confirmUpload, cancelUpload, busyReceiptId, onReceiptConfirm, onReceiptSave, onReceiptSkip, onReceiptRemove, onOpenSession, onNewSession, onRemoveSession } = useChatView()
</script>

<template>
  <div ref="sceneEl" class="page chat-page" :class="{ 'motion-active': sceneActive, 'mobile-chat': isMobile }">
    <header v-if="isMobile" class="mobile-chat-toolbar" aria-label="对话操作">
      <button type="button" class="mobile-chat-back" aria-label="返回记录" @click="router.push({ name: 'records' })"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>
      <div class="mobile-chat-title"><strong>另一个我</strong><span role="status">{{ chat.sending ? '正在回复…' : '与我对话' }}</span></div>
      <button type="button" aria-label="历史会话" @click="openHistory"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 7M3 5v6h6M12 7v5l3 2" /></svg><span>历史</span></button>
      <button type="button" aria-label="返回今日对话" :disabled="chat.sending" @click="onNewSession"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg><span>今日</span></button>
      <button type="button" aria-label="更多对话操作" aria-haspopup="dialog" :aria-expanded="showMore" aria-controls="chat-more-dialog" @click="showMore = true"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg><span>更多</span></button>
    </header>
    <Teleport to="body"><dialog v-if="isMobile" id="chat-more-dialog" ref="moreDialog" class="chat-more-dialog" aria-labelledby="chat-more-heading" @cancel.prevent="showMore = false" @close="showMore = false" @click="e => { if (e.target === moreDialog) { const r = moreDialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) showMore = false } }">
      <div class="chat-more-heading"><h2 id="chat-more-heading">对话设置</h2><button type="button" aria-label="关闭更多操作" @click="showMore = false">×</button></div>
      <button type="button" class="chat-more-item" @click="openMemory"><span>聊天记忆<small>查看和管理对话中记住的内容</small></span><b aria-hidden="true">↗</b></button>
      <button type="button" class="chat-more-item" @click="openModels"><span>模型设置<small>选择模型与服务配置</small></span><b aria-hidden="true">↗</b></button>
      <button type="button" class="chat-more-item" role="switch" :aria-checked="receiptEnabled" @click="toggleReceipt"><span>识别支付截图<small>发现账单时询问是否生成记账卡</small></span><b>{{ receiptEnabled ? '已开启' : '已关闭' }}</b></button>
    </dialog></Teleport>
    <div v-if="!isMobile" class="chat-masthead-wrap"><PageMasthead title="与我对话" english="DIALOGUE" description="循着记录，听见自己的回响"><button class="p3-button secondary new-chat-btn" @click="onNewSession">今日对话</button><button class="p3-button secondary history-btn" @click="showSessions = !showSessions">历史会话</button><button class="p3-button secondary" @click="showMemoryPanel = true">聊天记忆</button><button class="p3-button secondary" role="switch" :aria-checked="receiptEnabled" @click="toggleReceipt">{{ receiptEnabled ? '已开启账单识别' : '识别支付截图' }}</button></PageMasthead></div>
    <ChatMemoryPanel v-if="showMemoryPanel" @close="showMemoryPanel = false" />

    <!-- 会话列表抽屉（<1440px 主入口；≥1440px 隐藏按钮但仍可通过 MobileHeader 打开） -->
    <Transition :css="false" v-bind="sessionsMotion.backdropHooks">
      <div v-if="showSessions" class="sessions-overlay" @click="showSessions = false" />
    </Transition>
    <Transition :css="false" v-bind="sessionsMotion.panelHooks">
      <div v-if="showSessions" ref="sessionsDialog" class="sessions-drawer" role="dialog" aria-modal="true" aria-label="历史会话" tabindex="-1">
        <ChatSessionsPanel
          variant="drawer"
          @close="showSessions = false"
          @new-session="onNewSession"
          @open-session="onOpenSession"
          @remove-session="onRemoveSession"
        />
      </div>
    </Transition>

    <div class="page-content">
      <div class="chat-layout">
        <div class="chat-wrap">
          <div class="phone-watermark" aria-hidden="true">TALK<br>TO ME.</div>
          <header class="phone-header">
            <div class="phone-brand" aria-hidden="true"><span>MAIL</span><small>MIRROR MESSENGER</small></div>
            <div class="phone-contact"><span class="phone-avatar" aria-hidden="true">M<span>✦</span></span><div><b>另一个我</b><small>{{ chat.sending ? '正在回复…' : '你的日常，有了回响。' }}</small></div></div>
            <span class="phone-date">{{ mailDate }}<small>TODAY'S</small></span>
          </header>
          <div class="phone-divider" aria-hidden="true"><span>YOU / ME / EVERY LITTLE THING</span><i /><b>↙</b></div>
          <!-- 空态（含加载中 / 失败兜底 + vault 演示入口） -->
          <div v-if="chat.messages.length === 0 && !visibleReceiptOffers.length" class="chat-empty">

            <span class="chat-empty-en" aria-hidden="true">HELLO, MYSELF.</span>
            <h2>{{ chat.historyLoading ? emptyTitle : chat.historyError ? '暂时没能找回这段对话' : '和另一个自己，聊聊。' }}</h2>
            <p>{{ emptyDesc }}</p>
            <ChatDaySummaryCard
              v-for="summary in visibleEndedSummaries"
              :key="summary.sourceSessionId || summary.source_session_id || summary.sourceDate || summary.source_date"
              :summary="summary"
              :actions="summaryActions(summary)"
              :loading="retryingSummaryId === (summary.sourceSessionId || summary.source_session_id)"
              @retry="retrySummary"
              @open-session="onOpenSession"
            />
            <div v-if="!chat.historyLoading && !chat.historyError" class="chat-prompts"><button v-for="prompt in ['最近我做了哪些事情？','这段时间，我的状态怎么样？','有什么事情还在等我完成？']" :key="prompt" @click="input = prompt; send()">{{ prompt }}<span aria-hidden="true">↗</span></button></div>
          </div>

          <!-- 消息列表 -->
          <ChatDaySummaryCard
            v-if="chat.daySummary && chat.messages.length"
            :summary="chat.daySummary"
            :actions="summaryActions(chat.daySummary)"
            :loading="retryingSummaryId === (chat.daySummary.sourceSessionId || chat.daySummary.source_session_id)"
            @retry="retrySummary"
            @open-session="onOpenSession"
          />
          <div v-show="chat.messages.length || visibleReceiptOffers.length" ref="messagesEl" class="chat-messages" aria-live="polite" aria-relevant="additions" tabindex="0" aria-label="对话消息" @scroll.passive="chatScroll.onScroll" @wheel.passive="chatScroll.onWheel" @touchstart.passive="chatScroll.onTouchStart" @touchmove.passive="chatScroll.onTouchMove" @keydown="chatScroll.onKeydown">
            <div
              v-for="msg in orderedMessages"
              :key="msg.id"
              v-message-enter="{ id: msg.id, animate: chat.sending && !chat.historyLoading }"
              :class="['chat-msg', msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai']"
            >
              <span class="message-avatar" aria-hidden="true">{{ msg.role === 'user' ? 'YOU' : 'M' }}<i>✦</i></span>
              <div class="chat-msg-bubble">
                <span class="message-sender">{{ msg.role === 'user' ? '我 / YOU' : 'MIRROR / 另一个我' }}</span>
                <ToolTrail v-if="msg.role === 'ai'" :tools="msg.toolsUsed" />
                <span v-if="msg.typing" class="typing-dots"><i /><i /><i /></span>
                <template v-else-if="!msg.typing">
                  <ChatMessageContent
                    v-if="msg.role === 'ai'"
                    :content="msg.content"
                    :streaming="chat.sending"
                    :sources="msg.sources"
                    :vault-refs="msg.vaultRefs"
                    @open-source="source => openSource(source, msg)"
                    @open-vault="ref => openVaultRef(ref, msg)"
                  />
                  <template v-else>
                    <template v-for="(seg, si) in parseCitations(msg.content, msg.sources, msg.vaultRefs)" :key="si">
                      <button
                        v-if="seg.type === 'cite' && seg.source"
                        class="cite-chip"
                        :title="citeTitle(seg.source)"
                        @click="openSource(seg.source, msg)"
                      >{{ seg.n }}</button>
                      <span v-else-if="seg.type === 'cite'">[{{ seg.n }}]</span>
                      <!-- 文件引用 [Fn]：行内文件芯片（点击预览），不再以裸文本/加粗文件名出现 -->
                      <button
                        v-else-if="seg.type === 'vault' && seg.ref"
                        class="cite-file-chip"
                        :title="`文件 · ${seg.ref.displayName}`"
                        @click="openVaultRef(seg.ref, msg)"
                      >
                        <FileTypeIcon :kind="seg.ref.category || 'file'" />
                        <span class="cite-file-name">{{ seg.ref.displayName }}</span>
                      </button>
                      <span v-else-if="seg.type === 'vault'" class="cite-file-plain">[F{{ seg.n }}]</span>
                      <template v-else>{{ seg.value }}</template>
                    </template>
                  </template>
                </template>

                <!-- sources 引用芯片 -->
                <div v-if="msg.sources && msg.sources.length" class="chat-msg-sources">
                  <button
                    v-for="(s, i) in msg.sources"
                    :key="i"
                    class="chat-source-link"
                    @click="openSource(s, msg)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    {{ s.date }} · {{ s.quote.slice(0, 10) }}…
                  </button>
                </div>

                <!-- 对话文件卡（vault_refs 三档：强引用完整卡 / 弱引用芯片 / 模糊提及芯片） -->
                <div v-if="msg.vaultRefs && msg.vaultRefs.length" class="chat-msg-vaultrefs">
                  <VaultRefCard
                    v-for="vr in msg.vaultRefs"
                    :key="vr.id"
                    :ref-item="vr"
                    @preview="ref => openVaultRef(ref, msg)"
                    @download="downloadRef"
                  />
                </div>

                <ActionCard v-for="proposal in actionCardsFor(msg)" :key="proposal.id" :proposal="proposal" />
                <CreatedRecordReceipt
                  v-for="record in msg.createdRecords || []"
                  :key="`created-record-${record.recordId}`"
                  :record="record"
                  @open="openCreatedRecord"
                />

                <div v-if="msg.outcome === 'action_unknown' || ['running', 'cancel_requested'].includes(msg.status)" class="chat-msg-state chat-msg-state-pending">
                  <span>保存结果待确认</span>
                  <button type="button" :disabled="msg.checkingRun || !msg.runId" @click="refreshRun(msg)">
                    {{ msg.checkingRun ? '正在查询…' : '查询本轮状态' }}
                  </button>
                </div>
                <div v-else-if="['failed', 'cancelled', 'abandoned'].includes(msg.status)" class="chat-msg-state chat-msg-state-error">
                  <span>{{ msg.errorMessage || (msg.status === 'cancelled' ? '本轮请求已取消' : '本轮未能完成') }}</span>
                </div>
                <div v-else-if="msg.status === 'transport_error'" class="chat-msg-state chat-msg-state-error">
                  <span>{{ msg.errorMessage || '连接中断，本轮可能仍在服务端处理' }}</span>
                  <button v-if="msg.retryable" type="button" @click="chat.retryLastMessage(msg.id)">重试本轮</button>
                  <button v-if="msg.runId" type="button" :disabled="msg.checkingRun" @click="refreshRun(msg)">
                    {{ msg.checkingRun ? '正在查询…' : '查询本轮状态' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- 消化回执卡（上传消化完成后出现在消息流末尾，三键纠错） -->
            <div v-for="item in receiptItems" :key="`receipt-${item.id}`" class="chat-msg chat-msg-ai">
              <div class="chat-msg-bubble chat-msg-bubble-receipt">
                <VaultDigestReceipt
                  :item="item"
                  :busy="busyReceiptId === item.id"
                  @confirm="() => onReceiptConfirm(item)"
                  @save="(d) => onReceiptSave(item, d)"
                  @skip="() => onReceiptSkip(item)"
                  @remove="() => onReceiptRemove(item)"
                />
              </div>
            </div>

            <div v-for="offer in visibleReceiptOffers" :key="'ledger-offer-' + offer.id" class="chat-msg chat-msg-ai">
              <div class="chat-msg-bubble chat-msg-bubble-receipt">
                <ActionCard v-if="offer.actionId && actions.byId[offer.actionId]" :proposal="actions.byId[offer.actionId]" />
                <section v-else class="chat-ledger-offer" aria-label="支付截图识别结果">
                  <strong>这像一张支付截图，要生成记账卡吗？</strong>
                  <LedgerActionForm v-if="offer.editing" :proposal="offer" :busy="offer.busy" @save="prepareReceipt(offer, $event)" @cancel="offer.editing = false" />
                  <div v-else><button type="button" @click="offer.editing = true">生成记账卡</button><button type="button" @click="receiptOffers = receiptOffers.filter(item => item !== offer)">暂不记账</button></div>
                  <p v-if="offer.error" role="alert">{{ offer.error }}</p>
                </section>
              </div>
            </div>
            <div v-if="chat.recovering" class="chat-recovering" role="status">
              <span class="typing-dots"><i /><i /><i /></span>
              <span>上一轮回答仍在生成，完成后会自动出现</span>
            </div>
          </div>

          <div class="chat-follow-control">
            <button v-if="!followingBottom && chat.messages.length" type="button" class="chat-jump-bottom" @click="scrollToBottom">回到最新消息 <span aria-hidden="true">↓</span></button>
          </div>

          <ChatImageDraft ref="imageDraft" :receipt-enabled="receiptEnabled" :receipt-busy="receiptBusy" @count="imageCount = $event" @error="toast.warning($event)" @receipt="recognizeChatImage" />
          <!-- 输入条（附件按钮 + 拖拽上传区） -->
          <div
            :class="['chat-input-bar', { 'chat-input-drag': dragOver }]"
            @dragover.prevent="onDragOver"
            @dragleave="onDragLeave"
            @drop.prevent="onDrop"
          >
            <button class="chat-attach" title="添加文件" aria-label="添加文件" :disabled="chat.sending" @click="pickFile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <input ref="fileInput" type="file" hidden @change="onPickChange">
            <textarea
              ref="inputEl"
              v-model="input"
              class="chat-input"
              aria-label="对话内容"
              rows="1"
              placeholder="问我任何关于你的事…"
              :disabled="chat.sending"
              @input="autoGrow"
              @keydown="onKeydown"
              @paste="onPasteImages"
            />
            <button aria-label="发送消息" :class="['chat-send', { enabled: canSend }]" :disabled="!canSend" @click="send">
              <span class="send-word" aria-hidden="true">SEND</span>
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>

          <!-- 拖拽提示 -->
          <div v-if="dragOver" class="chat-drop-hint">松手添加 · 图片预览 / 文件收藏</div>

          <!-- 上传卡（选文件后弹出，确认才上传） -->
          <VaultUploadCard
            v-if="pendingUpload"
            :pending="pendingUpload"
            :uploading="vault.uploading"
            @confirm="confirmUpload"
            @cancel="cancelUpload"
          />
        </div>

        <!-- ≥1440px 会话常驻栏（280px 固定右侧） -->
        <aside class="chat-rail">
          <ChatSessionsPanel
            variant="rail"
            :active-title="activeSessionTitle"
            @new-session="onNewSession"
            @open-session="onOpenSession"
            @remove-session="onRemoveSession"
          />
        </aside>
      </div>
    </div>

    <!-- 文件预览模态（Teleport to body；对话内文件卡预览入口） -->
    <FilePreviewModal
      v-if="previewItem"
      :item="previewItem"
      @loaded="onVaultPreviewLoaded"
      @close="previewItem = null"
    />
  </div>
</template>

<style scoped src="@/assets/styles/chat-view.css"></style>
<style scoped src="@/assets/styles/persona-chat.css"></style>
