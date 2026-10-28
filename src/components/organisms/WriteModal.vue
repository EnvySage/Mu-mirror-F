<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useOverlayMotion } from '@/motion/useOverlayMotion'
import { useRouter } from 'vue-router'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useRecordsStore } from '@/stores/records'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { useActionsStore } from '@/stores/actions'
import { createPrepareKey } from '@/api/actions'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close', 'saved'])

const router = useRouter()
const recordsStore = useRecordsStore()
const settingsStore = useSettingsStore()
const toast = useToastStore()
const actionsStore = useActionsStore()

const content = ref('')
const saveMode = ref('ONLY_SAVE')
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
const pageTurn = ref(0)
const dateLabel = computed(() => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(openedAt.value))
const dateNumber = computed(() => String(openedAt.value.getDate()).padStart(2, '0'))
const monthLabel = computed(() => new Intl.DateTimeFormat('en', { month: 'short' }).format(openedAt.value).toUpperCase())
const dialogFocus = useDialogFocus(() => focusOpen.value, dialogEl, 'textarea', onClose)
let pendingNavigation = null
function afterModalLeave() {
  if (props.show) return
  focusOpen.value = false
  const destination = pendingNavigation
  pendingNavigation = null
  if (destination) router.push(destination)
}
function choosePrompt(index) { activePrompt.value = index; pageTurn.value += 1; textareaEl.value?.focus({ preventScroll: true }) }

const MAX = 2000

const count = computed(() => content.value.length)
const enabled = computed(() => content.value.trim().length > 0 && !loading.value && !preparedAction.value)

watch(() => props.show, (val) => {
  if (val) {
    pendingNavigation = null
    focusOpen.value = true
    openedAt.value = new Date()
    activePrompt.value = 0
    content.value = ''
    saveMode.value = settingsStore.settings.default_record_mode || 'ONLY_SAVE'
    preparedAction.value = null
    prepareGeneration += 1
    error.value = ''
  }
})

async function handleSubmit() {
  if (!enabled.value) return

  const requestAiProcessing = saveMode.value === 'AI_ASSISTED'
  if (requestAiProcessing && !settingsStore.isModelConfigComplete) {
    const msg = settingsStore.getModelConfigMissingMessage()
    toast.warning(msg || '请先完成 AI 模型配置后再写日记')
    pendingNavigation = { name: 'settings' }
    emit('close')
    return
  }

  loading.value = true
  error.value = ''
  const generation = ++prepareGeneration
  preparingAction.value = requestAiProcessing
  try {
    if (requestAiProcessing) {
      const fingerprint = `record.create:${content.value.trim()}`
      if (!pendingPrepareKey || pendingPrepareFingerprint !== fingerprint) {
        pendingPrepareFingerprint = fingerprint
        pendingPrepareKey = createPrepareKey()
      }
      const action = await actionsStore.prepare('record.create', {
        rawContent: content.value.trim(),
        mode: 'AI_ASSISTED',
      }, pendingPrepareKey)
      if (generation !== prepareGeneration || !props.show) {
        if (action?.id) await actionsStore.cancel(action.id).catch(() => {})
        return
      }
      preparedAction.value = action
      pendingPrepareKey = null
      pendingPrepareFingerprint = ''
      pendingNavigation = { name: 'records' }
      emit('close')
      toast.info('已交给 AI 整理，进度会显示在记录列表')
      return action
    }
    const record = await recordsStore.createRecord(content.value.trim(), false)
    pendingPrepareKey = null
    pendingPrepareFingerprint = ''
    if (generation !== prepareGeneration || !props.show) return
    emit('saved', record)
    emit('close')
    toast.success('已保存为仅记录')
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
  if (loading.value && !preparingAction.value) return
  if (loading.value && preparingAction.value && !preparedAction.value) { emit('close'); return }
  if (!preparedAction.value && content.value.trim() && !window.confirm('这段日记还没有保存。放弃并关闭吗？')) return
  emit('close')
}

// ---- 桌面/移动形态切换（2a）：≥900px 居中 modal，<900px 底部抽屉 ----
/** 窗口 ≥900px（与全局断点一致）；用 matchMedia 而非 resize 轮询 */
const desktopMq = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(min-width: 900px)')
  : null
const isDesktop = ref(desktopMq ? desktopMq.matches : false)
const overlay = useOverlayMotion(() => ({ xPercent: -50, yPercent: isDesktop.value ? -50 : 0, distance: 100, rotation: isDesktop.value ? -7 : -3, scale: .86, enterDuration: 720, leaveDuration: 340, ease: 'back.out(1.15)' }))

function onMqChange(e) {
  isDesktop.value = e.matches
}

onMounted(() => {
  desktopMq?.addEventListener?.('change', onMqChange)
})

onBeforeUnmount(() => {
  desktopMq?.removeEventListener?.('change', onMqChange)
})
</script>

<template>
  <Teleport to="body">
    <Transition :css="false" v-bind="overlay.backdropHooks"><div v-if="show" class="modal-overlay" @click="onClose" /></Transition>
    <Transition :css="false" v-bind="overlay.panelHooks" @after-enter="dialogFocus.focusInitial" @after-leave="afterModalLeave">
      <section v-if="show" ref="dialogEl" :class="['write-modal', { desktop: isDesktop }]" role="dialog" aria-modal="true" aria-labelledby="write-title" tabindex="-1" @keydown.ctrl.enter.prevent="handleSubmit" @keydown.meta.enter.prevent="handleSubmit">
        <aside class="write-stage">
          <span class="write-stage-word" aria-hidden="true">DEAR<br>MYSELF.</span>
          <span class="notebook-edition" aria-hidden="true">VOL. {{ openedAt.getFullYear() }} / MY DAYS</span>
          <div class="write-date"><b>{{ dateNumber }}</b><span>{{ monthLabel }}<small>{{ openedAt.getFullYear() }}</small></span></div>
          <div class="write-stage-copy"><span class="write-kicker">留给未来的自己</span><h2 id="write-title">这一刻，<br>值得留下。</h2><p>不必写得完整，也不用想好答案。<br>从今天的一件小事开始。</p></div>
          <div class="notebook-photo" aria-hidden="true"><div /><span>somewhere in my blue hour.</span><i>✦</i></div>
          <span class="notebook-sticker" aria-hidden="true">KEEP<br>THIS DAY ↗</span>
          <svg class="notebook-doodle" viewBox="0 0 240 80" aria-hidden="true"><path d="M8 45 Q45 0 80 38 T145 35 Q170 15 194 32 M181 17l17 17-24 6 M210 5l5 16 17 3-14 10 1 18-12-13-17 5 9-15-9-13 17 2Z" /></svg>
          <span class="write-stage-bottom">MIRROR / 一天一页，慢慢成为自己。</span>
        </aside>
        <div class="notebook-binding" aria-hidden="true"><i v-for="n in 8" :key="n" /></div>
        <div class="write-paper" :class="{ 'has-action': !!preparedAction }">
          <span class="notebook-bookmark" aria-hidden="true">TODAY</span>
          <header class="write-header"><div><span>写日记</span><time :datetime="openedAt.toLocaleDateString('sv-SE')">{{ dateLabel }}</time></div><button class="write-cancel" :disabled="loading" @click="onClose" aria-label="关闭写日记">关闭 <span aria-hidden="true">×</span></button></header>
          <div class="write-body">
            <span v-if="pageTurn" :key="pageTurn" class="notebook-page-flip" aria-hidden="true" />
            <p class="write-address" aria-hidden="true">Dear myself,<span>把今天写成自己的故事。</span></p>
            <div v-if="error" class="write-error" role="alert">{{ error }}</div>
            <textarea ref="textareaEl" v-model="content" class="write-textarea" aria-label="日记内容" :placeholder="prompts[activePrompt]" :maxlength="MAX" :disabled="loading || !!preparedAction" aria-describedby="write-hint" />
            <div class="write-prompts" aria-label="书写灵感"><span>从这里开始</span><button v-for="(label, index) in ['一件小事', '此刻心情', '一点进展']" :key="label" :aria-pressed="activePrompt === index + 1" @click="choosePrompt(index + 1)">{{ label }} <i aria-hidden="true">↗</i></button></div>
          </div>
          <footer class="write-footer">
            <div class="write-permission" role="radiogroup" aria-label="保存方式">
              <label :class="['permission-option', { selected: saveMode === 'ONLY_SAVE' }]">
                <input v-model="saveMode" type="radio" value="ONLY_SAVE" :disabled="loading || !!preparedAction">
                <span><b>仅保存</b><small>这次不调用 AI 整理；以后可单独请求整理</small></span>
              </label>
              <label :class="['permission-option', { selected: saveMode === 'AI_ASSISTED' }]">
                <input v-model="saveMode" type="radio" value="AI_ASSISTED" :disabled="loading || !!preparedAction">
                <span><b>AI 帮我整理</b><small>先回列表，AI 在后台整理；你确认后再保存</small></span>
              </label>
            </div>
            <div class="write-footer-main"><div><p id="write-hint" class="write-hint">{{ saveMode === 'ONLY_SAVE' ? '仅保存不调用 AI 整理；聊天里选择仅保存时，聊天本身仍已发送给 AI。' : '进度会留在列表里。整理完成后，打开修改并确认保存。' }}</p><span class="write-shortcut">Ctrl / ⌘ + Enter 保存</span></div><span class="write-counter" :class="{ full: count === MAX }" aria-live="off"><b>{{ count }}</b> / {{ MAX }}</span><button v-if="!preparedAction" :class="['write-submit', { enabled }]" :disabled="!enabled" @click="handleSubmit">{{ loading ? '准备中…' : saveMode === 'ONLY_SAVE' ? '仅保存' : '交给 AI，返回列表' }} <span aria-hidden="true">↗</span></button><button v-else class="write-submit" :disabled="loading" @click="onClose">{{ preparedAction.state === 'PENDING' ? '关闭' : '完成' }}</button></div>
          </footer>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped src="@/assets/styles/notebook.css"></style>
