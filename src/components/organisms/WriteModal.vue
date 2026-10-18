<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useRecordsStore } from '@/stores/records'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { useActionsStore } from '@/stores/actions'
import ActionCard from '@/components/organisms/ActionCard.vue'
import { createPrepareKey } from '@/api/actions'
import { completeCreatedRecordAction, createActionStatusPoller } from '@/utils/writeActionPolling'

const props = defineProps({
  show: Boolean,
  correctionOfRecordId: { type: [String, Number], default: null },
})
const emit = defineEmits(['close', 'saved'])

const router = useRouter()
const recordsStore = useRecordsStore()
const settingsStore = useSettingsStore()
const toast = useToastStore()
const actionsStore = useActionsStore()
const actionPoller = createActionStatusPoller({
  refresh: id => actionsStore.refresh(id),
  onUpdate: card => onActionUpdated(card),
})

const content = ref('')
const saveMode = ref('ONLY_SAVE')
const privateInput = ref(false)
const preparedAction = ref(null)
const preparingAction = ref(false)
let prepareGeneration = 0
let pendingPrepareKey = null
let pendingPrepareFingerprint = ''
const loading = ref(false)
const error = ref('')
const textareaEl = ref(null)
const dialogEl = ref(null)
const focusOpen = ref(false)
const openedAt = ref(new Date())
const prompts = ['今天发生了什么？', '有什么小事，让你觉得今天值得？', '现在的你，是什么心情？', '有哪件事，比昨天更进一步？']
const activePrompt = ref(0)
const dateLabel = computed(() => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(openedAt.value))
const dateNumber = computed(() => String(openedAt.value.getDate()).padStart(2, '0'))
const monthLabel = computed(() => new Intl.DateTimeFormat('en', { month: 'short' }).format(openedAt.value).toUpperCase())
useDialogFocus(() => focusOpen.value, dialogEl, 'textarea', onClose)
function afterModalLeave() { if (!props.show) focusOpen.value = false }
function choosePrompt(index) { activePrompt.value = index; textareaEl.value?.focus() }

const MAX = 2000

const count = computed(() => content.value.length)
const enabled = computed(() => content.value.trim().length > 0 && !loading.value)

watch(() => props.show, async (val) => {
  actionPoller.stop()
  if (val) {
    focusOpen.value = true
    openedAt.value = new Date()
    activePrompt.value = 0
    content.value = ''
    saveMode.value = settingsStore.settings.default_record_mode || 'ONLY_SAVE'
    privateInput.value = false
    preparedAction.value = null
    prepareGeneration += 1
    error.value = ''
    await nextTick()
    textareaEl.value?.focus()
  }
})

async function handleSubmit() {
  if (!enabled.value) return

  const requestAiProcessing = saveMode.value === 'AI_ASSISTED' && !privateInput.value
  if (requestAiProcessing && !settingsStore.isModelConfigComplete) {
    const msg = settingsStore.getModelConfigMissingMessage()
    toast.warning(msg || '请先完成 AI 模型配置后再写日记')
    emit('close')
    setTimeout(() => router.push({ name: 'settings' }), 300)
    return
  }

  loading.value = true
  error.value = ''
  const generation = ++prepareGeneration
  preparingAction.value = requestAiProcessing
  try {
    if (requestAiProcessing) {
      const fingerprint = `record.create:${props.correctionOfRecordId || ''}:${content.value.trim()}`
      if (!pendingPrepareKey || pendingPrepareFingerprint !== fingerprint) {
        pendingPrepareFingerprint = fingerprint
        pendingPrepareKey = createPrepareKey()
      }
      const action = await actionsStore.prepare('record.create', {
        rawContent: content.value.trim(),
        mode: 'AI_ASSISTED',
        privateInput: false,
        ...(props.correctionOfRecordId ? { correctionOfRecordId: props.correctionOfRecordId } : {}),
      }, pendingPrepareKey)
      if (generation !== prepareGeneration || !props.show) {
        if (action?.id) await actionsStore.cancel(action.id).catch(() => {})
        return
      }
      preparedAction.value = action
      pendingPrepareKey = null
      pendingPrepareFingerprint = ''
      toast.info(props.correctionOfRecordId ? '补充 / 更正候选已准备，确认后会新建关联记录' : '整理候选已准备，确认后才会创建记录')
      return action
    }
    const record = await recordsStore.createRecord(content.value.trim(), false, props.correctionOfRecordId)
    pendingPrepareKey = null
    pendingPrepareFingerprint = ''
    if (generation !== prepareGeneration || !props.show) return
    emit('saved', record)
    emit('close')
    toast.success(privateInput.value ? '私密记录已保存，未交给 AI 处理' : props.correctionOfRecordId ? '补充 / 更正记录已保存并关联来源' : '已保存为仅记录')
    return record
  } catch (err) {
    error.value = err.message || '创建失败，请重试'
  } finally {
    loading.value = false
    preparingAction.value = false
  }
}

function onClose() {
  prepareGeneration += 1
  actionPoller.stop()
  if (loading.value && !preparingAction.value) return
  if (loading.value && preparingAction.value && !preparedAction.value) { emit('close'); return }
  if (preparedAction.value?.state === 'PENDING') {
    if (!window.confirm('关闭会取消这张待确认卡。继续吗？')) return
    actionsStore.cancel(preparedAction.value.id).catch(() => {})
  } else if (!preparedAction.value && content.value.trim() && !window.confirm('这段日记还没有保存。放弃并关闭吗？')) return
  emit('close')
}

async function onActionUpdated(card) {
  if (!card) return
  preparedAction.value = card
  const state = String(card.state || '').toUpperCase()
  if (state === 'PENDING' || state === 'EXECUTING') {
    actionPoller.start(card.id, state)
    return
  }
  actionPoller.stop()
  await completeCreatedRecordAction(card, {
    fetchRecords: () => recordsStore.fetchRecords(),
    records: recordsStore.records,
    emit,
  })
}

// ---- 桌面/移动形态切换（2a）：≥900px 居中 modal，<900px 底部抽屉 ----
/** 窗口 ≥900px（与全局断点一致）；用 matchMedia 而非 resize 轮询 */
const desktopMq = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(min-width: 900px)')
  : null
const isDesktop = ref(desktopMq ? desktopMq.matches : false)

function onMqChange(e) {
  isDesktop.value = e.matches
}

onMounted(() => {
  desktopMq?.addEventListener?.('change', onMqChange)
})

onBeforeUnmount(() => {
  actionPoller.stop()
  desktopMq?.removeEventListener?.('change', onMqChange)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade"><div v-if="show" class="modal-overlay" @click="onClose" /></Transition>
    <Transition :name="isDesktop ? 'modal' : 'sheet'" @after-leave="afterModalLeave">
      <section v-if="show" ref="dialogEl" :class="['write-modal', { desktop: isDesktop }]" role="dialog" aria-modal="true" aria-labelledby="write-title" tabindex="-1" @keydown.ctrl.enter.prevent="handleSubmit" @keydown.meta.enter.prevent="handleSubmit">
        <aside class="write-stage">
          <span class="write-stage-word" aria-hidden="true">DEAR<br>MYSELF.</span>
          <div class="write-date"><b>{{ dateNumber }}</b><span>{{ monthLabel }}<small>{{ openedAt.getFullYear() }}</small></span></div>
          <div class="write-stage-copy"><span class="write-kicker">留给未来的自己</span><h2 id="write-title">这一刻，<br>值得留下。</h2><p>不必写得完整，也不用想好答案。<br>从今天的一件小事开始。</p></div>
          <span class="write-stage-bottom">MIRROR / 生活正在显影</span>
        </aside>
        <div class="write-paper">
          <header class="write-header"><div><span>写日记</span><time :datetime="openedAt.toLocaleDateString('sv-SE')">{{ dateLabel }}</time></div><button class="write-cancel" :disabled="loading" @click="onClose" aria-label="关闭写日记">关闭 <span aria-hidden="true">×</span></button></header>
          <div class="write-body">
            <p class="write-address" aria-hidden="true">Dear myself,</p>
            <div v-if="error" class="write-error" role="alert">{{ error }}</div>
            <textarea ref="textareaEl" v-model="content" class="write-textarea" aria-label="日记内容" :placeholder="prompts[activePrompt]" :maxlength="MAX" :disabled="loading || !!preparedAction" aria-describedby="write-hint" />
            <div class="write-prompts" aria-label="书写灵感"><span>从这里开始</span><button v-for="(label, index) in ['一件小事', '此刻心情', '一点进展']" :key="label" :aria-pressed="activePrompt === index + 1" @click="choosePrompt(index + 1)">{{ label }} <i aria-hidden="true">↗</i></button></div>
          </div>
          <footer class="write-footer">
            <div class="write-permission" role="radiogroup" aria-label="保存方式">
              <label :class="['permission-option', { selected: saveMode === 'ONLY_SAVE' }]">
                <input v-model="saveMode" type="radio" value="ONLY_SAVE" :disabled="loading || privateInput || !!preparedAction">
                <span><b>仅保存</b><small>这次不调用 AI 整理；以后可单独请求整理</small></span>
              </label>
              <label :class="['permission-option', { selected: saveMode === 'AI_ASSISTED' && !privateInput }]">
                <input v-model="saveMode" type="radio" value="AI_ASSISTED" :disabled="loading || privateInput || !!preparedAction">
                <span><b>AI 帮我整理</b><small>先生成可编辑候选；每条记忆仍需你确认后才生效</small></span>
              </label>
            </div>
            <label class="private-input"><input v-model="privateInput" type="checkbox" :disabled="loading || !!preparedAction" @change="privateInput && (saveMode = 'ONLY_SAVE')"><span><b>这是私密内容</b><small>从这个原记录入口保存，不会发送给 AI。</small></span></label>
            <ActionCard v-if="preparedAction" :proposal="preparedAction" @updated="onActionUpdated" />
            <div class="write-footer-main"><div><p id="write-hint" class="write-hint">{{ correctionOfRecordId ? '这是关联来源的新补充 / 更正记录，原记录不会被改写；更正默认不重复增加成长贡献。' : privateInput ? '私密输入会直接保存，绕过 AI。' : saveMode === 'ONLY_SAVE' ? '仅保存不调用 AI 整理；聊天里选择仅保存时，聊天本身仍已发送给 AI。' : 'AI 会先准备候选；你确认后才创建记录，记忆仍需逐项选择。' }}</p><span class="write-shortcut">Ctrl / ⌘ + Enter 保存</span></div><span class="write-counter" :class="{ full: count === MAX }" aria-live="off"><b>{{ count }}</b> / {{ MAX }}</span><button v-if="!preparedAction" :class="['write-submit', { enabled }]" :disabled="!enabled" @click="handleSubmit">{{ loading ? '准备中…' : saveMode === 'ONLY_SAVE' || privateInput ? '仅保存' : '生成待确认候选' }} <span aria-hidden="true">↗</span></button><button v-else class="write-submit" :disabled="loading" @click="onClose">完成</button></div>
          </footer>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay { position:fixed; inset:0; z-index:40; background:#020b32ba; backdrop-filter:blur(7px); }
.write-modal { position:fixed; left:50%; bottom:0; transform:translate(-50%,0); z-index:41; width:100%; max-height:96dvh; display:grid; grid-template-columns:1fr; background:var(--card); overflow:hidden; border-top:4px solid var(--cyan); box-shadow:10px 12px 0 #02113b70,0 25px 90px #010a3480; }
.write-stage { position:relative; overflow:hidden; isolation:isolate; color:white; background:linear-gradient(180deg,#0737bb20,#06123fe8),url('/art/water-surface.webp') 58% center/cover; padding:28px; }
.write-stage::after { content:''; position:absolute; width:320px; height:420px; right:-210px; top:80px; border:32px solid #50edfa50; border-radius:50%; z-index:-1; transform:rotate(-24deg); }
.write-stage-word { position:absolute; bottom:100px; left:12px; z-index:-1; font:italic 800 100px/.78 var(--font-display); color:#9aeaff24; letter-spacing:-.04em; }
.write-date { display:flex; gap:10px; align-items:center; }.write-date b{font:italic 800 80px/.8 var(--font-display)}.write-date>span{font:italic 700 25px/1 var(--font-display);color:var(--cyan)}.write-date small{display:block;font:600 13px/1.4 var(--font-display);color:#c7e5ff}
.write-stage-copy { margin-top:74px; }.write-kicker{font-size:11px;color:var(--cyan);letter-spacing:.12em}.write-stage h2{font-size:38px;line-height:1.4;letter-spacing:-.05em;font-weight:900;margin-top:15px}.write-stage p{font-size:12px;line-height:2;color:#c5dcff;margin-top:22px}.write-stage-bottom{position:absolute;left:28px;bottom:25px;font:italic 600 12px var(--font-display);color:#a8c5ed;letter-spacing:.04em}
.write-paper { min-width:0; min-height:0; display:flex; flex-direction:column; background:var(--card); }
.write-header { padding:25px 34px 21px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; gap:10px; }.write-header>div{display:flex;align-items:center;gap:16px}.write-header>div>span{font-weight:800;font-size:14px;color:var(--text-hi)}.write-header time{font-size:11px;color:var(--text-low)}
.write-cancel{font-size:11px;color:var(--text-mid);display:flex;align-items:center;gap:12px;min-height:34px}.write-cancel span{font:300 26px/1 var(--font)}.write-cancel:disabled{opacity:.4}
.write-body { flex:1; min-height:0; display:flex; flex-direction:column; padding:28px 34px 20px; overflow:auto; }.write-address{font:italic 600 31px/1 var(--font-display);color:var(--accent);margin-bottom:24px}
.write-textarea { width:100%; flex:1; min-height:220px; resize:none; background:transparent; border:0; border-radius:0; padding:0; font:16px/2.1 var(--font);color:var(--text-hi);caret-color:var(--accent); }.write-textarea:focus{outline:none}.write-textarea::placeholder{color:#8091af}.write-error{padding:10px 12px;margin-bottom:14px;background:var(--danger-bg);color:var(--danger);font-size:12px;border-left:3px solid var(--pink)}
.write-prompts{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:22px}.write-prompts>span{font-size:10px;color:var(--text-low);margin-right:3px}.write-prompts button{font-size:11px;color:var(--text-mid);border:1px solid var(--line);padding:7px 10px;background:white}.write-prompts button[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}.write-prompts i{font-style:normal;margin-left:10px;color:var(--accent)}
.write-footer{display:flex;align-items:center;gap:12px;flex-shrink:0;padding:16px 34px 20px;border-top:1px solid var(--line);flex-wrap:wrap}.write-permission{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex-basis:100%}.permission-option{display:flex;align-items:flex-start;gap:9px;padding:10px 12px;border:1px solid var(--line);background:white;cursor:pointer}.permission-option.selected{border-color:var(--accent);background:var(--accent-soft)}.permission-option input{margin:3px 0 0;accent-color:var(--accent)}.permission-option span{display:flex;flex-direction:column;gap:3px}.permission-option b{font-size:11px;color:var(--text-hi)}.permission-option small{font-size:10px;color:var(--text-mid);line-height:1.4}.write-footer-main{display:flex;align-items:center;gap:18px;width:100%}.write-hint{font-size:10px;color:var(--text-mid);line-height:1.5}.write-shortcut{display:block;font:11px var(--font-display);color:var(--text-low);margin-top:5px}.write-counter{margin-left:auto;white-space:nowrap;font:16px var(--font-display);color:var(--text-low)}.write-counter b{font-weight:600;color:var(--text-hi)}.write-counter.full b{color:var(--danger)}
.write-submit{display:flex;align-items:center;justify-content:space-between;gap:26px;padding:13px 18px;min-height:46px;font-size:13px;font-weight:800;background:#dce5f3;color:#8091ad;white-space:nowrap;transition:background .15s,box-shadow .15s}.write-submit.enabled{background:var(--accent);color:white;box-shadow:4px 4px 0 var(--cyan)}.write-submit.enabled:hover{background:var(--accent-hover)}.write-submit:disabled{cursor:not-allowed}.write-submit span{font-size:19px}
.write-footer :deep(.action-card){width:100%;max-width:none;max-height:34dvh;overflow:auto;margin:0}
@media(min-width:900px){.write-modal.desktop{top:50%;bottom:auto;transform:translate(-50%,-50%);width:min(1100px,calc(100vw - 80px));height:min(740px,88dvh);grid-template-columns:310px minmax(0,1fr)} }
@media(max-width:899px){.write-modal{height:94dvh;grid-template-rows:auto minmax(0,1fr);padding-bottom:var(--safe-bottom)}.write-stage{padding:20px 24px;display:flex;align-items:center;gap:24px}.write-date b{font-size:60px}.write-date>span{font-size:21px}.write-stage-copy{margin:0}.write-stage h2{font-size:23px;line-height:1.3;margin-top:7px}.write-stage h2 br{display:none}.write-stage p,.write-stage-bottom,.write-stage-word{display:none}.write-kicker{font-size:9px}.write-header{padding:12px 22px}.write-header>div{gap:10px}.write-header time{font-size:10px}.write-body{padding:22px}.write-address{font-size:28px;margin-bottom:18px}.write-textarea{min-height:120px;font-size:16px}.write-footer{padding:12px 22px 16px;gap:9px}.write-permission{gap:6px}.permission-option{padding:8px}.permission-option small{font-size:9px}.write-footer-main{gap:10px}.write-shortcut{display:none}.write-counter{margin-left:0;margin-right:auto}.write-prompts{margin-top:12px;gap:6px}.write-prompts>span{flex-basis:100%;margin-bottom:2px}.write-prompts button{font-size:10px}.write-submit{min-width:148px}}
@media(max-height:650px) and (min-width:900px){.write-stage-copy{margin-top:40px}.write-stage h2{font-size:30px}.write-stage p{margin-top:12px}.write-body{padding-top:20px}.write-textarea{min-height:130px}.write-prompts{margin-top:14px}.write-footer{padding-top:14px;padding-bottom:16px}}
.sheet-enter-active,.sheet-leave-active{transition:transform .34s cubic-bezier(.16,1,.3,1)}.sheet-enter-from,.sheet-leave-to{transform:translate(-50%,110%)}
.modal-enter-active{transition:transform .42s cubic-bezier(.16,1,.3,1),opacity .3s,clip-path .42s}.modal-leave-active{transition:opacity .3s,transform .3s}.modal-enter-from{opacity:0;transform:translate(-46%,-48%);clip-path:polygon(0 0,0 0,-20% 100%,0 100%)}.modal-enter-to{clip-path:polygon(0 0,120% 0,100% 100%,0 100%)}.modal-leave-to{opacity:0;transform:translate(-50%,-48%)}
@media(prefers-reduced-motion:reduce){.modal-enter-from,.modal-leave-to{transform:translate(-50%,-50%);clip-path:none}}
</style>
