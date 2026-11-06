<script setup>
import { computed, ref, watch } from 'vue'
import { tarotCategory } from '@/utils/tarotPresentation'
const props = defineProps({ card: Object, locked: Boolean, orientation: { type: String, default: 'upright' }, lazy: Boolean })
const category = computed(() => tarotCategory(props.card))
const failed = ref(false)
watch(() => props.card?.image_url, () => { failed.value = false })
</script>
<template>
  <span class="tarot-art" :class="[`family-${category.id}`, { undiscovered: locked, reversed: orientation === 'reversed' && card }]" :style="{ '--family-color': category.color }">
    <img v-if="!failed" :src="card?.image_url || '/art/tarot/v1/back.png'" :alt="card?.name || '塔罗牌背'" :loading="lazy ? 'lazy' : 'eager'" width="1024" height="1536" draggable="false" @error="failed = true" />
    <span v-else class="art-unavailable"><i>{{ category.symbol }}</i><span>{{ card?.name }}</span><small>插画暂未加载</small></span>
    <span v-if="card" class="family-mark" aria-hidden="true">{{ category.symbol }}</span>
  </span>
</template>
<style scoped>
.tarot-art{position:relative;display:block;width:100%;height:100%;aspect-ratio:2/3;overflow:hidden;background:#06123f;isolation:isolate}.tarot-art img{display:block;width:100%;height:100%;object-fit:cover}.tarot-art.reversed img{transform:rotate(180deg)}
.tarot-art:after{content:'';position:absolute;inset:0;border:1px solid var(--family-color);pointer-events:none;opacity:.75}.undiscovered{filter:grayscale(1)}.family-mark{position:absolute;right:5%;top:7%;display:grid;place-items:center;width:1.45em;height:1.45em;background:#031124d9;border:1px solid var(--family-color);color:var(--family-color);font-size:clamp(13px,1.4vw,20px);border-radius:50%;line-height:1}.family-wands .family-mark{border-radius:0;clip-path:polygon(50% 0,100% 25%,85% 100%,15% 100%,0 25%)}.family-swords .family-mark{border-radius:0;transform:rotate(45deg)}.family-pentacles .family-mark{border-width:2px}.family-cups .family-mark{border-radius:0 0 50% 50%}
.art-unavailable{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--family-color);background:repeating-linear-gradient(45deg,#06123f,#06123f 22px,#15315c 23px,#15315c 24px)}.art-unavailable i{font-size:60px;font-style:normal}.art-unavailable small{font-size:11px;margin-top:8px}
.tarot-art:before{content:'';position:absolute;inset:3.4%;z-index:1;border:1px solid var(--family-color);opacity:.6;pointer-events:none}.family-major:before{border-width:2px;clip-path:polygon(0 5%,5% 5%,5% 0,95% 0,95% 5%,100% 5%,100% 95%,95% 95%,95% 100%,5% 100%,5% 95%,0 95%)}.family-wands:before{inset:3% 4%;border-top:5px double var(--family-color);border-bottom:5px double var(--family-color);clip-path:polygon(10% 0,90% 0,100% 8%,100% 92%,90% 100%,10% 100%,0 92%,0 8%)}.family-cups:before{inset:3% 4%;border-radius:48% 48% 10% 10%;border-width:2px}.family-swords:before{inset:3%;clip-path:polygon(50% 0,100% 7%,100% 93%,50% 100%,0 93%,0 7%);border-left-width:3px;border-right-width:3px}.family-pentacles:before{inset:3.5%;border:3px double var(--family-color);border-radius:16% 16% 3% 3%}.family-mark{z-index:2}
</style>
