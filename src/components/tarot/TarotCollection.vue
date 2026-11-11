<script setup>
import { computed, ref, watch } from 'vue'
import { tarotApi } from '@/api/tarot'
import { useAuthStore } from '@/stores/auth'
import { tarotCategories, tarotCategory } from '@/utils/tarotPresentation'
import { tarotDate } from '@/utils/tarotProtocol'
import TarotCard from './TarotCard.vue'
import TarotGalleryDialog from './TarotGalleryDialog.vue'

const auth = useAuthStore()
const cards = ref([])
const entries = ref([])
const category = ref('all')
const selected = ref(null)
const loading = ref(false)
const error = ref('')
const reload = ref(0)
const entryById = computed(() => new Map(entries.value.map(entry => [entry.card_id, entry])))
const collectedCount = computed(() => cards.value.filter(card => entryById.value.has(card.id)).length)
const filtered = computed(() => cards.value.filter(card => category.value === 'all' || card.category === category.value))
const families = computed(() => tarotCategories.map(family => {
  const members = cards.value.filter(card => card.category === family.id)
  return { ...family, count: members.length, collected: members.filter(card => entryById.value.has(card.id)).length }
}))

watch([() => auth.user?.id, reload], async ([owner], _, onCleanup) => {
  let current = true
  onCleanup(() => { current = false })
  cards.value = []
  entries.value = []
  selected.value = null
  error.value = ''
  loading.value = !!owner
  if (!owner) return
  try {
    const [catalog, collection] = await Promise.all([tarotApi.cards(), tarotApi.collection()])
    if (!current) return
    cards.value = catalog.cards ?? []
    entries.value = collection.entries ?? []
  } catch (cause) {
    if (current) error.value = cause.message || '暂时无法读取收藏。'
  } finally {
    if (current) loading.value = false
  }
}, { immediate: true, flush: 'sync' })
</script>

<template>
  <section class="tarot-exhibit" aria-labelledby="tarot-exhibit-title">
    <header class="tarot-exhibit-header">
      <div class="tarot-exhibit-copy">
        <span>02 / ARCANA COLLECTION</span>
        <h2 id="tarot-exhibit-title">偶然的收藏</h2>
        <p>每日抽到的牌会收入收藏。<br />每一张牌都可以打开欣赏。</p>
        <RouterLink :to="{ name: 'tarot' }">前往牌桌 <i aria-hidden="true">↗</i></RouterLink>
      </div>
      <div class="tarot-spread" aria-hidden="true">
        <span class="spread-ring" /><span class="spread-star">✧</span>
        <img src="/art/tarot/v1/back.png" alt="" width="1024" height="1536" decoding="async" />
        <img src="/art/tarot/v2/18-moon.png" alt="" width="1024" height="1536" decoding="async" />
        <img src="/art/tarot/v1/back.png" alt="" width="1024" height="1536" decoding="async" />
      </div>
    </header>
    <p v-if="loading" class="tarot-exhibit-state" role="status">正在读取塔罗收藏…</p>
    <div v-else-if="error" class="tarot-exhibit-state" role="alert">
      <p>暂时无法打开塔罗收藏。{{ error }}</p><button type="button" @click="reload++">重新加载 ↻</button>
    </div>
    <template v-else-if="cards.length">
      <div class="tarot-exhibit-progress">
        <span>已收藏 {{ collectedCount }} / {{ cards.length }}</span>
        <progress :value="collectedCount" :max="cards.length" aria-label="塔罗总收藏进度" />
      </div>
      <nav class="tarot-exhibit-filters" aria-label="牌组分类">
        <button type="button" :aria-pressed="category === 'all'" @click="category = 'all'">全部 <small>{{ cards.length }}</small></button>
        <button v-for="family in families" :key="family.id" type="button" :aria-pressed="category === family.id" :style="{ '--family-color': family.color }" @click="category = family.id">
          <span>{{ family.symbol }} {{ family.name }}</span><small>{{ family.collected }} / {{ family.count }}</small>
        </button>
      </nav>
      <div class="tarot-exhibit-grid">
        <figure v-for="card in filtered" :key="card.id" :style="{ '--plate-ink': tarotCategory(card).color }">
          <TarotCard :card="card" compact :locked="!entryById.has(card.id)" @open="selected = $event" />
          <figcaption v-if="entryById.has(card.id)">{{ tarotDate(entryById.get(card.id).first_obtained_at) }} 首次获得<br />每日抽中 {{ entryById.get(card.id).daily_draw_count }} 次</figcaption>
          <figcaption v-else>尚未收藏 · 点击了解牌义</figcaption>
        </figure>
      </div>
    </template>
    <p v-else class="tarot-exhibit-state">暂无可展示的卡牌。</p>
    <TarotGalleryDialog
      :card="selected" :cards="filtered" :locked="!!selected && !entryById.has(selected.id)" :entry="entryById.get(selected?.id)"
      @close="selected = null" @select="selected = $event"
    />
  </section>
</template>

<style scoped>
.tarot-exhibit-header { position: relative; isolation: isolate; display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); align-items: center; min-height: clamp(220px,23cqw,276px); padding: 18px clamp(15px,4cqw,52px); margin-bottom: 20px; }
.tarot-exhibit-header::before, .tarot-exhibit-header::after { content: ''; position: absolute; z-index: -1; pointer-events: none; }
.tarot-exhibit-header::before { inset: 0 4% 2% 0; background: linear-gradient(115deg,#281f54 35%,#45417a 88%); clip-path: polygon(2% 0,100% 9%,94% 95%,0 88%); }
.tarot-exhibit-header::after { inset: 0 0 0 45%; background: repeating-linear-gradient(125deg,#fff0a420 0 1px,transparent 1px 7px),#0f574f; clip-path: polygon(13% 10%,100% 0,96% 87%,0 100%); }
.tarot-exhibit-copy { z-index: 2; min-width: 0; }
.tarot-exhibit-copy > span { display: inline-block; color: #ffdf91; font: italic 800 12px var(--font-display); letter-spacing: .13em; border-bottom: 1px solid #ffdf9180; }
.tarot-exhibit-header h2 { margin: 8px 0; font-size: clamp(29px,5cqw,56px); line-height: 1.13; letter-spacing: -.07em; transform: skewX(-5deg); transform-origin: left; }
.tarot-exhibit-header p { color: #d7d3f2; font-size: 13px; line-height: 1.55; }
.tarot-exhibit-header a, .tarot-exhibit-state button { position: relative; isolation: isolate; display: inline-flex; align-items: center; gap: 11px; min-height: 44px; padding: 7px 13px; color: #151d36; font-size: 13px; font-weight: 800; }
.tarot-exhibit-header a { margin-top: 10px; }
.tarot-exhibit-header a::before, .tarot-exhibit-state button::before { content: ''; position: absolute; z-index: -1; inset: 2px 0; background: #f5d58c; clip-path: polygon(7px 0,100% 4%,calc(100% - 7px) 100%,0 95%); }
.tarot-exhibit-header a i { font-style: normal; font-size: 16px; }
.tarot-spread { position: relative; isolation: isolate; align-self: stretch; min-width: 0; display: grid; place-items: center; }
.tarot-spread img { grid-area: 1/1; width: clamp(65px,12cqw,122px); height: auto; aspect-ratio: 2/3; object-fit: cover; border: 1px solid #fee5ae; box-shadow: 5px 8px 0 #090b275c; transform: translate(var(--shift,0),var(--drop,0)) rotate(var(--turn)); animation: fan-open .55s var(--motion-enter) both; }
.tarot-spread img:nth-of-type(1) { --shift: -48%; --drop: 8%; --turn: -21deg; }
.tarot-spread img:nth-of-type(2) { --shift: 0; --drop: -4%; --turn: -6deg; z-index: 1; }
.tarot-spread img:nth-of-type(3) { --shift: 51%; --drop: 7%; --turn: 16deg; }
.spread-ring { position: absolute; z-index: -1; inset: 20% 0; border: 1px solid #ffdea394; border-radius: 50%; transform: rotate(-17deg); }
.spread-ring::after { content: ''; position: absolute; inset: 14% 8%; border: 1px dashed #ffdea373; border-radius: 50%; }
.spread-star { position: absolute; z-index: 2; top: 7%; right: 9%; color: #ffe1a0; font-size: clamp(23px,4cqw,45px); transform: rotate(10deg); }
.tarot-exhibit-state { padding: 23px; margin: 18px 0; border-left: 3px solid #f4d990; background: #071638; color: #dde9ff; }
.tarot-exhibit-state button { margin-top: 12px; }
.tarot-exhibit-progress { display: flex; align-items: center; gap: 14px; font-size: 13px; color: #f6e3b5; }
.tarot-exhibit-progress span { white-space: nowrap; font-weight: 800; }
.tarot-exhibit-progress progress { height: 6px; width: 100%; accent-color: #f4d990; transform: skewX(-20deg); }
.tarot-exhibit-filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 15px 0 21px; }
.tarot-exhibit-filters button { position: relative; isolation: isolate; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 5px 11px; color: #e4edff; font-size: 13px; }
.tarot-exhibit-filters button::before { content: ''; position: absolute; z-index: -1; inset: 2px 0; background: #213b63; clip-path: polygon(7px 0,100% 5%,calc(100% - 6px) 100%,0 95%); }
.tarot-exhibit-filters small { color: var(--family-color,#b8d4f5); }
.tarot-exhibit-filters button[aria-pressed=true] { color: #11203b; }
.tarot-exhibit-filters button[aria-pressed=true]::before { background: var(--family-color,#f4d990); transform: rotate(-2deg); }
.tarot-exhibit-filters button[aria-pressed=true] small { color: #38404f; }
.tarot-exhibit-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(min(100%,160px),1fr)); gap: 27px 19px; padding: 7px 6px 5px; }
.tarot-exhibit-grid figure { --lean: -2deg; margin: 0; min-width: 0; }
.tarot-exhibit-grid figure:nth-child(even) { --lean: 3deg; padding-top: 7px; }
.tarot-exhibit-grid figure :deep(.tarot-card) { transform: rotate(var(--lean)); box-shadow: 5px 6px 0 #060f2b94; }
.tarot-exhibit-grid figcaption { margin: 9px 5% 0; padding: 3px 4px; border-bottom: 1px solid color-mix(in srgb,var(--plate-ink) 65%,transparent); color: #d2e0f6; text-align: center; font-size: 11px; }
.tarot-exhibit a:focus-visible, .tarot-exhibit button:focus-visible { outline: 2px solid white; outline-offset: 3px; }
@keyframes fan-open { from { opacity: .7; transform: translateY(10px) rotate(0); } to { opacity: 1; transform: translate(var(--shift,0),var(--drop,0)) rotate(var(--turn)); } }
@container (max-width: 480px) {
  .tarot-exhibit-header { min-height: 183px; grid-template-columns: minmax(0,1.12fr) minmax(0,1fr); margin-bottom: 14px; }
  .tarot-exhibit-copy > span { font-size: 10px; }
  .tarot-exhibit-header h2 { font-size: clamp(23px,7cqw,32px); }
  .tarot-exhibit-header p { font-size: 11px; }
  .tarot-exhibit-filters { gap: 3px 5px; }
  .tarot-exhibit-filters button { gap: 5px; padding-inline: 7px; font-size: 12px; }
  .tarot-exhibit-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 20px 15px; }
  .tarot-exhibit-grid :deep(.card-caption b) { display: none; }
  .tarot-exhibit-grid :deep(.card-caption span) { font-size: 14px; }
}
@media (prefers-reduced-motion: reduce) { .tarot-spread img { animation: none; } }
</style>
