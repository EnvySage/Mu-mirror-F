<script setup>
import { computed, ref, watch } from 'vue'
import AchievementMedal from '@/components/molecules/AchievementMedal.vue'
import AchievementRating from '@/components/molecules/AchievementRating.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'

const props = defineProps({ medal: Object, reveal: Boolean, previewMode: { type: Boolean, default: true } })
const emit = defineEmits(['close', 'preview'])
const dialog = ref(null)
const replay = ref(0)
const finish = ref(null)
watch(() => props.medal?.code, () => { finish.value = null; replay.value = 0 })
const finishPreview = computed(() => finish.value !== null)
const platingReveal = computed(() => props.reveal && props.medal?.notificationKind === 'plated')
const concealed = computed(() => props.medal?.hidden && !props.medal?.earned)
const statusText = computed(() => props.medal?.plated ? '已获得 · 镜闪镀层' : props.medal?.earned ? '已获得' : concealed.value ? '待揭晓' : '未解锁')
const { focusInitial } = useDialogFocus(() => !!props.medal, dialog, '.medal-close', () => emit('close'))
watch(() => props.reveal, focusInitial, { flush: 'post' })
function formatProgress(progress) {
  if (!progress) return ''
  if (Number.isFinite(progress.current) && Number.isFinite(progress.target)) return `${progress.current} / ${progress.target}`
  const children = progress.all || progress.any || []
  return children.map(formatProgress).join(progress.all ? ' · ' : ' 或 ')
}
const progressText = computed(() => formatProgress(props.medal?.progress))
</script>

<template>
  <Teleport to="body">
    <Transition name="medal-overlay">
      <div v-if="medal" class="medal-overlay" @click.self="emit('close')">
        <section ref="dialog" class="medal-dialog" :class="{ reveal }" :style="{ '--medal-ink': medal.group.ink, '--medal-accent': medal.group.accent }" role="dialog" aria-modal="true" aria-labelledby="medal-heading" aria-describedby="medal-condition" tabindex="-1">
          <header class="medal-dossier-header">
            <span class="dossier-mark" aria-hidden="true"><i /><i /></span>
            <span>{{ reveal ? previewMode ? '解锁演示' : platingReveal ? '镜闪镀层解锁' : '成就解锁' : '藏品档案' }}</span>
            <span class="dossier-reference">{{ medal.code }}</span>
            <button type="button" class="medal-close" aria-label="关闭成就详情" @click="emit('close')">×</button>
          </header>
          <div class="medal-dossier-body">
          <div :key="`${medal.code}-${reveal}-${replay}`" class="medal-scene">
            <div class="medal-visual">
              <div class="medal-stage">
                <div class="medal-target" aria-hidden="true" />
                <span class="medal-plane plane-left" aria-hidden="true" />
                <span class="medal-plane plane-right" aria-hidden="true" />
                <span class="medal-coordinate coordinate-top" aria-hidden="true" />
                <span class="medal-coordinate coordinate-bottom" aria-hidden="true" />
                <span v-if="reveal" class="medal-scan" aria-hidden="true" />
                <div class="medal-object" :class="{ 'finish-preview': finish === 'plated' }"><AchievementMedal :medal="medal" :finish="finish" :preview="reveal || finishPreview" :concealed="concealed" eager /></div>
              </div>
              <span class="medal-visual-caption">{{ medal.setName || medal.group.label }}</span>
            </div>
            <div class="medal-copy">
              <span class="medal-kicker">{{ reveal ? previewMode ? 'UNLOCK PREVIEW' : platingReveal ? 'MIRROR FINISH UNLOCKED' : 'ACHIEVEMENT UNLOCKED' : medal.group.label + ' / ' + medal.code }}</span>
              <h2 id="medal-heading">{{ concealed ? '隐藏成就' : medal.name }}</h2>
              <p v-if="!concealed" class="medal-english">{{ medal.english }}</p>
              <AchievementRating class="medal-detail-rating" :level="medal.difficulty" label />
              <dl class="medal-condition"><dt>获得条件</dt><dd id="medal-condition">{{ concealed ? '获得后揭晓章面和解锁条件。' : medal.condition }}</dd></dl>
              <div v-if="medal.plating" class="plating-detail">
                <div class="plating-heading"><strong>{{ medal.plated ? '✧ 镜闪镀层' : '✧ 可镀层' }}</strong><span>条件隐藏</span></div>
                <div v-if="!concealed" class="finish-controls" role="group" aria-label="章面外观预览">
                  <button type="button" :aria-pressed="finish === 'base'" @click="finish = 'base'">原章</button>
                  <button type="button" :aria-pressed="finish === 'plated'" @click="finish = 'plated'">预览镜闪镀层 ✧</button>
                </div>
                <small v-if="finishPreview">仅比较外观，不改变获得状态。</small>
              </div>
              <p v-if="progressText && !medal.earned" class="medal-progress">当前进度 <b>{{ progressText }}</b></p>
              <p class="medal-status" :class="{ earned: medal.earned }"><i aria-hidden="true" />{{ reveal && previewMode ? '演示首次对话完成后的效果' : statusText }}</p>
            </div>
          </div>
          </div>
          <div class="medal-actions">
            <span class="dossier-footnote" aria-hidden="true">{{ reveal ? '◆' : '◇' }} {{ medal.group.label }}</span>
            <button v-if="reveal && previewMode" type="button" @click="replay++">再播一次 ↻</button>
            <button v-else-if="!reveal && medal.code === 'D-01'" type="button" @click="emit('preview')">预览解锁 ↗</button>
            <button type="button" class="medal-primary" @click="emit('close')">{{ previewMode ? '返回展览馆' : platingReveal ? '收下镀层' : '收下成就' }}</button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.medal-overlay { position: fixed; inset: 0; z-index: 1130; display: grid; place-items: center; padding: 16px; background: #020817c9; backdrop-filter: blur(8px); }
.medal-dialog { position: relative; isolation: isolate; display: flex; flex-direction: column; width: min(100%, 620px); max-height: calc(100dvh - 32px); color: #edf6ff; outline: none; background: #0d2347; border: 1px solid #729bba70; box-shadow: 7px 8px 0 #05122b91,0 20px 65px #0008; overflow: hidden; clip-path: polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px); }
.medal-dialog::before { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 3; border-top: 2px solid var(--medal-ink); border-bottom: 1px solid #73a5d469; animation: dossier-frame .24s ease-out both; transform-origin: left; }
.medal-dialog::after { content: ''; position: absolute; pointer-events: none; inset: 0; z-index: -1; background: linear-gradient(124deg,#2b57932b 0 32%,transparent 32% 76%,#2f5f9340 76%),repeating-linear-gradient(132deg,transparent 0 21px,#c4eaff04 21px 22px); }
.medal-dossier-header { flex: none; display: flex; align-items: center; gap: 9px; min-height: 49px; padding: 6px 11px 6px 19px; border-bottom: 1px solid #6f97ba38; color: #c9deef; font-size: 12px; letter-spacing: .1em; }
.dossier-mark { display: grid; grid-template-columns: 6px 6px; gap: 3px; transform: skewY(-20deg); }.dossier-mark i { display: block; height: 13px; background: var(--medal-ink); }.dossier-mark i + i { background: #719cc76b; }
.dossier-reference { margin-left: auto; font: 700 11px var(--font-display); letter-spacing: .12em; color: #9dbed8; }
.medal-close { display: grid; place-items: center; flex: none; width: 36px; height: 36px; margin-left: 5px; color: #c5e4f2; font-size: 24px; background: #06152e70; clip-path: polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px); }
.medal-close:hover { background: #284a70; color: white; }
.medal-dossier-body { min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 19px 22px 18px; }
.medal-scene { display: grid; grid-template-columns: 192px minmax(0,1fr); align-items: start; column-gap: 23px; }
.medal-visual { align-self: center; min-width: 0; }
.medal-stage { position: relative; isolation: isolate; display: grid; place-items: center; width: 184px; aspect-ratio: 1; margin: 0 auto; }
.medal-target { position: absolute; z-index: -1; inset: 3%; border: 1px solid color-mix(in srgb,var(--medal-ink) 48%,transparent); clip-path: polygon(15% 0,85% 0,100% 15%,100% 85%,85% 100%,15% 100%,0 85%,0 15%); background: linear-gradient(32deg,#29537948,transparent 65%); animation: frame-reveal .32s .04s ease-out both; }
.medal-target::after { content: ''; position: absolute; inset: 16%; border: 1px solid #a3d8f235; transform: rotate(45deg); }
.medal-plane { position: absolute; z-index: -1; pointer-events: none; width: 55%; height: 67%; top: 16%; opacity: .75; }
.plane-left { left: -2%; background: #4585a52b; clip-path: polygon(0 0,100% 20%,100% 75%,0 100%); animation: plane-left-in .28s .04s ease-out both; }
.plane-right { right: -2%; border-right: 2px solid var(--medal-ink); background: #79c3d20c; clip-path: polygon(0 20%,100% 0,100% 100%,0 75%); animation: plane-right-in .28s .08s ease-out both; }
.medal-coordinate { position: absolute; width: 24px; height: 7px; background: repeating-linear-gradient(90deg,var(--medal-ink) 0 1px,transparent 1px 6px); opacity: .7; animation: coordinate-in .25s .11s ease-out both; }
.coordinate-top { top: 0; left: 22%; }.coordinate-bottom { bottom: 0; right: 22%; }
.medal-object { position: relative; z-index: 1; width: 86%; transform: rotate(-3deg); filter: drop-shadow(3px 5px 0 #03102680); animation: object-reveal .32s .13s cubic-bezier(.2,.7,.25,1) both; }
.medal-visual-caption { display: block; text-align: center; margin-top: 10px; padding-top: 8px; color: #86aac9; border-top: 1px solid #8eb6d333; font-size: 11px; letter-spacing: .1em; animation: copy-reveal .25s .23s ease-out both; }
.medal-copy { min-width: 0; }
.medal-kicker { display: inline-block; color: var(--medal-ink); font-size: 10px; letter-spacing: .13em; line-height: 1.5; animation: copy-reveal .25s .14s ease-out both; }
.medal-copy h2 { margin: 5px 0 4px; font-size: clamp(23px,4vw,29px); line-height: 1.16; letter-spacing: -.045em; font-weight: 850; animation: copy-reveal .27s .18s ease-out both; }
.medal-english { color: #89acd1; font: italic 700 11px/1.4 var(--font-display); letter-spacing: .05em; overflow-wrap: anywhere; animation: copy-reveal .25s .21s ease-out both; }
.medal-detail-rating { margin-top: 9px; animation: copy-reveal .25s .23s ease-out both; }
.medal-condition { margin: 15px 0 0; padding-top: 11px; border-top: 1px solid #799fc23d; animation: copy-reveal .28s .25s ease-out both; }
.medal-condition dt { margin-bottom: 4px; font-size: 10px; color: #88afce; }.medal-condition dd { margin: 0; line-height: 1.65; color: #d6e6f5; font-size: 13px; }
.plating-detail { margin-top: 12px; padding: 10px 11px; border-left: 2px solid #b9a9e7; background: linear-gradient(115deg,#8a79cb24,#53c5d40a); clip-path: polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%); animation: copy-reveal .28s .28s ease-out both; }
.plating-heading { display: flex; align-items: center; justify-content: space-between; gap: 7px; }.plating-heading strong { color: #dfd6fa; font-size: 12px; }.plating-heading > span { font-size: 10px; color: #a3a9c8; }
.plating-detail small { display: block; color: #9fbbd0; font-size: 10px; margin-top: 6px; line-height: 1.5; }
.finish-controls { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }.finish-controls button { min-height: 36px; padding: 5px 9px; border: 1px solid #8295b366; color: #c7ddf2; font-size: 11px; background: #122a4c; }.finish-controls button[aria-pressed=true] { background: #c5d7ea; color: #132743; border-color: #e0f1ff; }
.finish-preview { filter: drop-shadow(0 0 10px #91cef643); }
.medal-progress { display: flex; justify-content: space-between; gap: 10px; margin-top: 10px; font-size: 11px; color: #8db2d0; }.medal-progress b { color: #d6e8f4; font-weight: 600; }
.medal-status { display: flex; align-items: center; gap: 6px; margin-top: 11px; color: #8fb1cc; font-size: 10px; line-height: 1.5; animation: copy-reveal .25s .31s ease-out both; }.medal-status i { width: 5px; height: 5px; transform: rotate(45deg); background: #718ba5; }.medal-status.earned { color: #d0e6a3; }.medal-status.earned i { background: #c8e99d; }
.medal-actions { flex: none; display: flex; align-items: center; justify-content: end; flex-wrap: wrap; gap: 8px; padding: 9px 18px 11px; border-top: 1px solid #6f97ba38; background: #07192c75; }
.dossier-footnote { margin-right: auto; color: #7b9db7; font-size: 10px; letter-spacing: .06em; }
.medal-actions button { position: relative; isolation: isolate; min-height: 38px; padding: 7px 12px; color: #b9d9ee; font-size: 11px; font-weight: 700; }
.medal-actions button::before { content: ''; position: absolute; z-index: -1; inset: 0; clip-path: polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px); background: #223f60; }
.medal-actions .medal-primary { color: #132236; }.medal-actions .medal-primary::before { background: #dceda9; }
.medal-dialog button:focus-visible { outline: 2px solid white; outline-offset: 2px; }
.medal-scan { position: absolute; z-index: 2; inset: 4%; pointer-events: none; background: linear-gradient(110deg,transparent 40%,#b7f9ff9e 50%,transparent 60%) no-repeat; background-size: 240% 100%; clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%); opacity: 0; }
.reveal .medal-object { animation-name: unlock-object; animation-duration: .42s; animation-delay: .32s; }
.reveal .medal-target { animation-delay: .06s; }.reveal .medal-scan { animation: scan .6s .35s ease-out both; }
.reveal .medal-kicker, .reveal .medal-copy h2 { animation-delay: .34s; }.reveal .medal-english, .reveal .medal-detail-rating { animation-delay: .4s; }.reveal .medal-condition, .reveal .medal-status { animation-delay: .45s; }
.medal-overlay-enter-active { transition: opacity .18s ease; }.medal-overlay-leave-active { transition: opacity .14s ease; }.medal-overlay-enter-from, .medal-overlay-leave-to { opacity: 0; }
@keyframes dossier-frame { from { opacity: 0; transform: scaleX(.6); } to { opacity: 1; transform: scaleX(1); } }
@keyframes frame-reveal { from { opacity: 0; clip-path: polygon(0 0,0 0,0 0,0 100%,0 100%,0 100%,0 100%,0 0); } to { opacity: 1; clip-path: polygon(15% 0,85% 0,100% 15%,100% 85%,85% 100%,15% 100%,0 85%,0 15%); } }
@keyframes plane-left-in { from { opacity: 0; transform: translateX(-10px); } to { opacity: .75; transform: none; } }
@keyframes plane-right-in { from { opacity: 0; transform: translateX(10px); } to { opacity: .75; transform: none; } }
@keyframes coordinate-in { from { opacity: 0; transform: scaleX(0); } to { opacity: .7; transform: scaleX(1); } }
@keyframes object-reveal { from { opacity: 0; transform: translateX(-7px) rotate(-6deg); clip-path: inset(0 100% 0 0); } to { opacity: 1; transform: rotate(-3deg); clip-path: inset(0); } }
@keyframes unlock-object { from { opacity: 0; transform: translateY(7px) rotate(-6deg); clip-path: inset(100% 0 0 0); } to { opacity: 1; transform: rotate(-3deg); clip-path: inset(0); } }
@keyframes scan { 0% { opacity: 0; background-position: 100% 0; } 30%,60% { opacity: .75; } 100% { opacity: 0; background-position: 0 0; } }
@keyframes copy-reveal { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
@media (max-width: 575px) {
  .medal-overlay { padding: 12px; }.medal-dialog { max-height: calc(100dvh - 24px); }
  .medal-dossier-header { min-height: 46px; padding-left: 15px; }.medal-dossier-body { padding: 15px 16px; }
  .medal-scene { grid-template-columns: 126px minmax(0,1fr); grid-template-areas: 'art kicker' 'art title' 'art english' 'art rating' 'condition condition' 'plating plating' 'progress progress' 'status status'; gap: 5px 13px; align-items: center; }
  .medal-copy { display: contents; }.medal-visual { grid-area: art; }.medal-stage { width: 126px; }.medal-visual-caption { display: none; }
  .medal-kicker { grid-area: kicker; align-self: end; font-size: 9px; }.medal-copy h2 { grid-area: title; align-self: center; margin: 0; font-size: 25px; }.medal-english { grid-area: english; font-size: 10px; }.medal-detail-rating { grid-area: rating; align-self: start; margin-top: 2px; }
  .medal-condition { grid-area: condition; margin-top: 7px; padding-top: 10px; }.plating-detail { grid-area: plating; margin-top: 6px; }
  .medal-progress { grid-area: progress; margin-top: 5px; }.medal-status { grid-area: status; margin-top: 5px; }
  .medal-actions { padding: 9px 13px 11px; }.medal-actions button { min-height: 40px; }.medal-close { width: 38px; height: 38px; }
}
@media (max-width: 350px) {
  .medal-scene { grid-template-columns: 112px minmax(0,1fr); gap: 5px 10px; }.medal-stage { width: 112px; }.medal-copy h2 { font-size: 22px; }.medal-dossier-body { padding-inline: 13px; }.dossier-footnote { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .medal-dialog::before, .medal-target, .medal-plane, .medal-coordinate, .medal-object, .medal-visual-caption, .medal-kicker, .medal-copy h2, .medal-english, .medal-detail-rating, .medal-condition, .plating-detail, .medal-status, .reveal .medal-object, .reveal .medal-scan { animation: none; }
  .medal-overlay-enter-active, .medal-overlay-leave-active { transition: none; }
}
</style>
