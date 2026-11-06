<script setup>
import TarotArtwork from './TarotArtwork.vue'
import { tarotCategory, orientationLabel } from '@/utils/tarotPresentation'
defineProps({ card: Object, locked: Boolean, compact: Boolean, disabled: Boolean, drawLabel: String, orientation: String })
defineEmits(['open'])
</script>
<template>
  <button class="tarot-card" :class="{ compact, locked }" :disabled="disabled" :aria-label="card ? `${locked ? '尚未收藏，查看' : '放大欣赏'}${card.name}` : drawLabel || '等待抽牌'" @click="$emit('open', card)">
    <TarotArtwork :card="card" :locked="locked" :orientation="orientation" :lazy="compact" />
    <span v-if="card" class="card-caption"><b>{{ card.number }}</b><span>{{ card.name }}<small>{{ tarotCategory(card).name }}<template v-if="orientation"> · {{ orientationLabel(orientation) }}</template></small></span><i aria-hidden="true">↗</i></span>
    <span v-if="locked" class="collection-state">尚未收藏</span>
  </button>
</template>
<style scoped>
.tarot-card{display:block;position:relative;width:100%;max-width:310px;padding:0;aspect-ratio:2/3;background:#051539;border:1px solid #72cfff70;box-shadow:12px 16px 0 #03133865;transform:rotate(-5deg);transition:transform .22s;overflow:hidden;text-align:left;color:white}.tarot-card:not(:disabled):hover{transform:rotate(0) translateY(-5px)}
.card-caption{position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;gap:12px;padding:24px 15px 12px;background:linear-gradient(transparent,#020a2ff5);text-shadow:0 2px 3px #000}.card-caption b{font:italic 700 40px/1 var(--font-display)}.card-caption span{font-size:21px;font-weight:800}.card-caption small{display:block;font:11px/1.8 var(--font);color:#d0dded}.card-caption i{margin-left:auto;font-size:22px;color:#b6e4e8}.collection-state{position:absolute;left:5%;top:7%;font-size:10px;padding:4px 7px;background:#172133d9;color:#fff;border:1px solid #ffffff66}
.compact{transform:none;max-width:none;box-shadow:5px 7px 0 #03133865}.compact .card-caption{padding:22px 10px 10px;gap:8px}.compact .card-caption b{font-size:26px}.compact .card-caption span{font-size:16px}.compact .card-caption small{font-size:10px}.compact .card-caption i{font-size:16px}
@media(prefers-reduced-motion:reduce){.tarot-card{transition:none}.tarot-card:not(:disabled):hover{transform:none}}
</style>
