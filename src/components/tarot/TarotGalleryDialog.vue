<script setup>
import { computed, ref, watch } from 'vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
const props = defineProps({ card: Object, cards: { type: Array, default: () => [] } })
const emit = defineEmits(['close', 'select'])
const dialog = ref(null), zoom = ref(false)
const index = computed(() => props.cards.findIndex(c => c.id === props.card?.id))
watch(() => props.card?.id, () => { zoom.value = false })
useDialogFocus(() => !!props.card, dialog, '.gallery-close', () => emit('close'))
function step(delta) {
  if (props.cards.length < 2) return
  emit('select', props.cards[(index.value + delta + props.cards.length) % props.cards.length])
}
</script>
<template>
  <Teleport to="body">
    <div v-if="card" class="tarot-gallery" @click.self="$emit('close')">
      <section ref="dialog" class="gallery-dialog" role="dialog" aria-modal="true" :aria-label="`欣赏${card.name}`" tabindex="-1"
        @keydown.left.prevent="step(-1)" @keydown.right.prevent="step(1)">
        <header><span>{{ card.number }} / {{ card.name }}</span><button class="gallery-close" @click="$emit('close')">关闭 ×</button></header>
        <div class="gallery-image" :class="{ zoom }"><button :aria-label="zoom ? '缩小卡牌' : '放大卡牌细节'" @click="zoom = !zoom"><img :src="card.image_url" :alt="card.name" width="1024" height="1536" /></button></div>
        <footer><button v-if="cards.length > 1" aria-label="上一张" @click="step(-1)">←</button><p>{{ card.headline }}<small>点击画面{{ zoom ? '缩小' : '放大' }}<template v-if="cards.length > 1"> · {{ index + 1 }} / {{ cards.length }}</template></small></p><button v-if="cards.length > 1" aria-label="下一张" @click="step(1)">→</button></footer>
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.tarot-gallery{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;background:#020921ed;padding:18px;backdrop-filter:blur(12px);color:#fff}.gallery-dialog{width:min(100%,760px);height:95dvh;display:flex;flex-direction:column;outline:none}.gallery-dialog header,.gallery-dialog footer{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:10px 0}.gallery-dialog header{font-size:18px}.gallery-dialog button{color:inherit;min-width:44px;min-height:44px}.gallery-close{border-bottom:2px solid #50edfa}.gallery-image{flex:1;min-height:0;overflow:auto;text-align:center}.gallery-image>button{height:100%;padding:0;display:inline-block;cursor:zoom-in}.gallery-image img{height:100%;width:auto;max-width:100%;object-fit:contain}.gallery-image.zoom>button{height:auto;width:100%;cursor:zoom-out}.gallery-image.zoom img{height:auto;width:100%;max-width:none}.gallery-dialog footer p{flex:1;text-align:center;margin:0;font-size:15px}.gallery-dialog small{display:block;font-size:12px;color:#9dbce8;margin-top:5px}.gallery-dialog footer button{font-size:28px;background:#124393}
@media(max-width:600px){.tarot-gallery{padding:10px}.gallery-dialog{height:96dvh}.gallery-dialog header{font-size:15px}}
</style>
