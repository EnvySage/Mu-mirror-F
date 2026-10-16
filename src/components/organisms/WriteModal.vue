<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useRecordsStore } from '@/stores/records'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close'])

const router = useRouter()
const recordsStore = useRecordsStore()
const settingsStore = useSettingsStore()
const toast = useToastStore()

const content = ref('')
const loading = ref(false)
const error = ref('')
const textareaEl = ref(null)
const dialogEl = ref(null)
const openedAt = ref(new Date())
const prompts = ['今天发生了什么？', '有什么小事，让你觉得今天值得？', '现在的你，是什么心情？', '有哪件事，比昨天更进一步？']
const activePrompt = ref(0)
const dateLabel = computed(() => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(openedAt.value))
const dateNumber = computed(() => String(openedAt.value.getDate()).padStart(2, '0'))
const monthLabel = computed(() => new Intl.DateTimeFormat('en', { month: 'short' }).format(openedAt.value).toUpperCase())
useDialogFocus(() => props.show, dialogEl, 'textarea')
function choosePrompt(index) { activePrompt.value = index; textareaEl.value?.focus() }

const MAX = 500

const count = computed(() => content.value.length)
const enabled = computed(() => content.value.trim().length > 0 && !loading.value)

watch(() => props.show, async (val) => {
  if (val) {
    openedAt.value = new Date()
    activePrompt.value = 0
    content.value = ''
    error.value = ''
    await nextTick()
    textareaEl.value?.focus()
  }
})

async function handleSubmit() {
  if (!enabled.value) return

  if (!settingsStore.isModelConfigComplete) {
    const msg = settingsStore.getModelConfigMissingMessage()
    toast.warning(msg || '请先完成 AI 模型配置后再写日记')
    emit('close')
    setTimeout(() => router.push({ name: 'settings' }), 300)
    return
  }

  loading.value = true
  error.value = ''
  try {
    const record = await recordsStore.createRecord(content.value.trim())
    emit('close')
    toast.info('已提交，AI 拆分中…')
    // processing 态记录留在列表轮询（RecordsView 列表级轮询接管）
    return record
  } catch (err) {
    error.value = err.message || '创建失败，请重试'
  } finally {
    loading.value = false
  }
}

function onClose() {
  if (loading.value) return
  emit('close')
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
  desktopMq?.removeEventListener?.('change', onMqChange)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade"><div v-if="show" class="modal-overlay" @click="onClose" /></Transition>
    <Transition :name="isDesktop ? 'modal' : 'sheet'">
      <section v-if="show" ref="dialogEl" :class="['write-modal', { desktop: isDesktop }]" role="dialog" aria-modal="true" aria-labelledby="write-title" tabindex="-1" @keydown.esc="onClose" @keydown.ctrl.enter.prevent="handleSubmit" @keydown.meta.enter.prevent="handleSubmit">
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
            <textarea ref="textareaEl" v-model="content" class="write-textarea" aria-label="日记内容" :placeholder="prompts[activePrompt]" :maxlength="MAX" :disabled="loading" aria-describedby="write-hint" />
            <div class="write-prompts" aria-label="书写灵感"><span>从这里开始</span><button v-for="(label, index) in ['一件小事', '此刻心情', '一点进展']" :key="label" :aria-pressed="activePrompt === index + 1" @click="choosePrompt(index + 1)">{{ label }} <i aria-hidden="true">↗</i></button></div>
          </div>
          <footer class="write-footer"><div><p id="write-hint" class="write-hint">可以写多件事，Mirror 会帮你整理。</p><span class="write-shortcut">Ctrl / ⌘ + Enter 保存</span></div><span class="write-counter" :class="{ full: count === MAX }" aria-live="off"><b>{{ count }}</b> / {{ MAX }}</span><button :class="['write-submit', { enabled }]" :disabled="!enabled" @click="handleSubmit">{{ loading ? '保存中…' : '保存此刻' }} <span aria-hidden="true">↗</span></button></footer>
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
.write-footer{display:flex;align-items:center;gap:18px;flex-shrink:0;padding:20px 34px 24px;border-top:1px solid var(--line)}.write-hint{font-size:10px;color:var(--text-mid);line-height:1.5}.write-shortcut{display:block;font:11px var(--font-display);color:var(--text-low);margin-top:5px}.write-counter{margin-left:auto;white-space:nowrap;font:16px var(--font-display);color:var(--text-low)}.write-counter b{font-weight:600;color:var(--text-hi)}.write-counter.full b{color:var(--danger)}
.write-submit{display:flex;align-items:center;justify-content:space-between;gap:26px;padding:13px 18px;min-height:46px;font-size:13px;font-weight:800;background:#dce5f3;color:#8091ad;white-space:nowrap;transition:background .15s,box-shadow .15s}.write-submit.enabled{background:var(--accent);color:white;box-shadow:4px 4px 0 var(--cyan)}.write-submit.enabled:hover{background:var(--accent-hover)}.write-submit:disabled{cursor:not-allowed}.write-submit span{font-size:19px}
@media(min-width:900px){.write-modal.desktop{top:50%;bottom:auto;transform:translate(-50%,-50%);width:min(1100px,calc(100vw - 80px));height:min(740px,88dvh);grid-template-columns:310px minmax(0,1fr)} }
@media(max-width:899px){.write-modal{height:94dvh;grid-template-rows:auto minmax(0,1fr);padding-bottom:var(--safe-bottom)}.write-stage{padding:20px 24px;display:flex;align-items:center;gap:24px}.write-date b{font-size:60px}.write-date>span{font-size:21px}.write-stage-copy{margin:0}.write-stage h2{font-size:23px;line-height:1.3;margin-top:7px}.write-stage h2 br{display:none}.write-stage p,.write-stage-bottom,.write-stage-word{display:none}.write-kicker{font-size:9px}.write-header{padding:12px 22px}.write-header>div{gap:10px}.write-header time{font-size:10px}.write-body{padding:22px}.write-address{font-size:28px;margin-bottom:18px}.write-textarea{min-height:150px;font-size:16px}.write-footer{padding:15px 22px 20px;gap:12px;flex-wrap:wrap}.write-footer>div{flex-basis:100%}.write-shortcut{display:none}.write-counter{margin-left:0;margin-right:auto}.write-prompts{margin-top:12px;gap:6px}.write-prompts>span{flex-basis:100%;margin-bottom:2px}.write-prompts button{font-size:10px}.write-submit{min-width:148px}}
@media(max-height:650px) and (min-width:900px){.write-stage-copy{margin-top:40px}.write-stage h2{font-size:30px}.write-stage p{margin-top:12px}.write-body{padding-top:20px}.write-textarea{min-height:130px}.write-prompts{margin-top:14px}.write-footer{padding-top:14px;padding-bottom:16px}}
.sheet-enter-active,.sheet-leave-active{transition:transform .34s cubic-bezier(.16,1,.3,1)}.sheet-enter-from,.sheet-leave-to{transform:translate(-50%,110%)}
.modal-enter-active{transition:transform .38s cubic-bezier(.16,1,.3,1),opacity .25s,clip-path .38s}.modal-leave-active{transition:opacity .18s,transform .18s}.modal-enter-from{opacity:0;transform:translate(-46%,-48%);clip-path:polygon(0 0,0 0,-20% 100%,0 100%)}.modal-enter-to{clip-path:polygon(0 0,120% 0,100% 100%,0 100%)}.modal-leave-to{opacity:0;transform:translate(-50%,-48%)}
@media(prefers-reduced-motion:reduce){.modal-enter-from,.modal-leave-to{transform:translate(-50%,-50%);clip-path:none}}
</style>
