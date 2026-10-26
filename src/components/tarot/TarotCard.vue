<script setup>
defineProps({ card: Object, locked: Boolean, compact: Boolean, disabled: Boolean })
defineEmits(['open'])
</script>

<template>
  <button class="tarot-card" :class="{ compact, locked }" :disabled="disabled || locked"
    :aria-label="locked ? '尚未获得' : card ? `放大欣赏${card.name}` : '等待抽牌'" @click="$emit('open', card)">
    <img :src="!locked && card ? card.image_url : '/art/tarot/v1/back.png'" :alt="!locked && card ? card.name : '塔罗牌背'"
      :loading="compact ? 'lazy' : 'eager'" width="1024" height="1536" />
    <span v-if="card && !locked" class="card-caption"><b>{{ card.number }}</b><span>{{ card.name }}<small>{{ card.en }}</small></span><i aria-hidden="true">↗</i></span>
  </button>
</template>

<style scoped>
.tarot-card{display:block;position:relative;width:100%;max-width:310px;padding:0;aspect-ratio:2/3;background:#051539;border:1px solid #72cfff70;box-shadow:12px 16px 0 #03133865;transform:rotate(-5deg);transition:transform .22s;overflow:hidden;text-align:left;color:white}
.tarot-card img{width:100%;height:100%;object-fit:cover;display:block}.tarot-card:not(:disabled):hover{transform:rotate(0) translateY(-5px)}
.card-caption{position:absolute;bottom:0;left:0;right:0;display:flex;align-items:center;gap:12px;padding:24px 15px 12px;background:linear-gradient(transparent,#020a2ff5);text-shadow:0 2px 3px #000}
.card-caption b{font:italic 700 40px/1 var(--font-display)}.card-caption span{font-size:21px;font-weight:800}.card-caption small{display:block;font:italic 16px/1.4 var(--font-display)}.card-caption i{margin-left:auto;font-size:22px;color:#50edfa}
.compact{transform:none;max-width:none;box-shadow:5px 7px 0 #03133865}.compact .card-caption{padding:22px 10px 10px;gap:8px}.compact .card-caption b{font-size:26px}.compact .card-caption span{font-size:16px}.compact .card-caption small{font-size:12px}.compact .card-caption i{font-size:16px}.locked{filter:saturate(.65);opacity:.55}
@media(prefers-reduced-motion:reduce){.tarot-card{transition:none}.tarot-card:not(:disabled):hover{transform:none}}
</style>
