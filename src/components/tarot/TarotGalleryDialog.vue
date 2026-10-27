<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import TarotSpotlight from './TarotSpotlight.vue'
const props = defineProps({ card: Object, cards: { type: Array, default: () => [] } })
const emit = defineEmits(['close', 'select'])
const dialog = ref(null), zoom = ref(false), zoomControl = ref(null)
const index = computed(() => props.cards.findIndex(c => c.id === props.card?.id))
watch(() => props.card?.id, () => { zoom.value = false })
useDialogFocus(() => !!props.card, dialog, '.gallery-close', () => emit('close'))
function step(delta) {
  if (props.cards.length < 2 || zoom.value) return
  emit('select', props.cards[(index.value + delta + props.cards.length) % props.cards.length])
}
async function toggleZoom() { zoom.value = !zoom.value; await nextTick(); zoomControl.value?.focus({ preventScroll: true }) }
</script>
<template>
  <Teleport to="body">
    <div v-if="card" class="tarot-gallery">
      <section ref="dialog" class="gallery-dialog" role="dialog" aria-modal="true" :aria-label="`欣赏${card.name}`" tabindex="-1"
        @keydown.left="!zoom && (step(-1), $event.preventDefault())" @keydown.right="!zoom && (step(1), $event.preventDefault())">
        <header><span>收藏的另一面 <small>{{ card.number }} / {{ card.en }}</small></span><button class="gallery-close" @click="$emit('close')">关闭 ×</button></header>
        <div v-show="!zoom" class="gallery-stage">
          <TarotSpotlight :key="card.id" :card="card" @zoom="toggleZoom" />
          <nav v-if="cards.length > 1" class="gallery-fan" aria-label="已收藏卡牌">
            <button v-for="(item, i) in cards" :key="item.id" :aria-label="`欣赏${item.name}`" :aria-current="item.id === card.id ? 'true' : undefined" :style="{ '--card-tilt': `${(i % 3 - 1) * 7}deg` }" @click="$emit('select', item)"><img :src="item.image_url" :alt="item.name" loading="lazy" width="80" height="120" /><span>{{ item.name }}</span></button>
          </nav>
        </div>
        <div v-if="zoom" class="gallery-zoom" tabindex="0" aria-label="卡面细节，可滚动查看"><img :src="card.image_url" :alt="`${card.name}放大细节`" width="1024" height="1536" /></div>
        <footer>
          <button v-if="cards.length > 1 && !zoom" class="gallery-step" aria-label="上一张" @click="step(-1)">←</button>
          <p>{{ card.name }}<small>{{ zoom ? '滚动或拖动查看细节' : cards.length > 1 ? `${index + 1} / ${cards.length} · 左右方向键切换` : '属于你的这一次相遇' }}</small></p>
          <button ref="zoomControl" class="gallery-zoom-control" @click="toggleZoom">{{ zoom ? '缩小卡牌' : '放大细节' }}</button>
          <button v-if="cards.length > 1 && !zoom" class="gallery-step" aria-label="下一张" @click="step(1)">→</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.tarot-gallery{position:fixed;inset:0;z-index:1120;background:#020b24f5;color:white;backdrop-filter:blur(16px);overflow:hidden}
.gallery-dialog{height:100dvh;width:100%;display:flex;flex-direction:column;outline:none;background:linear-gradient(135deg,#061922de,#030a18f5),url('/art/water-surface.webp') center/cover}
.gallery-dialog header{display:flex;justify-content:space-between;align-items:center;padding:18px 32px;gap:20px;flex:none;z-index:2}.gallery-dialog header>span{font-size:15px;font-weight:800}.gallery-dialog header small{display:block;font:italic 16px var(--font-display);color:#85b3ec;margin-top:4px}.gallery-dialog button{color:inherit;min-width:44px;min-height:44px}.gallery-close{border:1px solid #9fceff55;padding:7px 15px;font-size:13px;background:#03153b99}
.gallery-stage{position:relative;flex:1;min-height:0;overflow:hidden}.gallery-fan{position:absolute;right:1%;top:4%;bottom:4%;width:12%;display:flex;flex-direction:column;align-items:center;overflow:auto;overscroll-behavior:contain;padding:18px 12px;gap:14px;scrollbar-width:thin;transform:rotate(7deg);background:#01071955}.gallery-fan button{padding:0;flex:none;width:70px;transform:rotate(var(--card-tilt));opacity:.5;transition:opacity .2s,transform .2s}.gallery-fan button[aria-current=true]{opacity:1;transform:translateX(-8px) rotate(-8deg)}.gallery-fan button:hover{opacity:1}.gallery-fan img{display:block;width:100%;height:auto;border:1px solid #a5dcff66}.gallery-fan span{font-size:10px;line-height:2;display:block}
.gallery-stage:has(.gallery-fan) :deep(.spotlight-copy){left:54%;max-width:29%}.gallery-stage:has(.gallery-fan) :deep(.spotlight-card-flight){left:16%}
.gallery-zoom{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-x pan-y pinch-zoom;padding:20px;text-align:center;background:#010719e8}.gallery-zoom img{display:block;width:min(1000px,180vw);height:auto;max-width:none;margin:auto;border:1px solid #8fcaff}
.gallery-dialog footer{display:flex;align-items:center;gap:24px;padding:18px 7% max(22px,env(safe-area-inset-bottom));flex:none;background:#02091e88;z-index:2}.gallery-dialog footer p{flex:1;margin:0;font-size:18px;font-weight:800}.gallery-dialog footer small{display:block;font-size:11px;font-weight:400;color:#9dbce8;margin-top:6px}.gallery-step{font-size:28px;background:#153e89;padding:0 18px;transform:skew(-8deg)}.gallery-zoom-control{font-size:13px;border-bottom:2px solid #50edfa;padding:5px 12px;white-space:nowrap}
@media(max-width:700px){.gallery-dialog header{padding:12px 18px}.gallery-dialog header>span{font-size:13px}.gallery-dialog header small{font-size:12px}.gallery-dialog footer{gap:10px;padding:14px 18px max(18px,env(safe-area-inset-bottom))}.gallery-dialog footer p{font-size:15px}.gallery-dialog footer small{font-size:10px}.gallery-step{padding:0 8px}.gallery-fan{right:2%;top:5%;bottom:auto;max-height:55%;width:18%;padding:10px 7px;gap:10px;transform:rotate(5deg)}.gallery-fan button{width:46px}.gallery-fan span{font-size:9px}.gallery-stage:has(.gallery-fan) :deep(.spotlight-card-flight){left:42%}.gallery-stage:has(.gallery-fan) :deep(.spotlight-copy){left:8%;max-width:84%}}
@media(max-height:650px){.gallery-dialog header{padding-block:8px}.gallery-dialog footer{padding-block:10px}}
@media(prefers-reduced-motion:reduce){.gallery-fan button{transition:none}}
</style>
