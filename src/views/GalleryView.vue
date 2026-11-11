<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AchievementCollection from '@/components/organisms/AchievementCollection.vue'
import TarotCollection from '@/components/tarot/TarotCollection.vue'
import { useAchievementsStore } from '@/stores/achievements'

const route = useRoute()
const achievementStore = useAchievementsStore()
const showingTarot = ref(route.query.hall === 'tarot')
const content = ref(null)
watch(() => route.query.hall, hall => {
  if (route.name !== 'gallery') return
  showingTarot.value = hall === 'tarot'
  if (content.value) content.value.scrollTop = 0
})
</script>

<template>
  <div class="page gallery-page">
    <div ref="content" class="page-content gallery-content">
      <div class="gallery-inner">
        <header class="gallery-header">
          <div class="gallery-heading">
            <span class="gallery-edition">MIRROR / COLLECTIONS</span>
            <h1><span class="gallery-title">展览馆</span><span class="gallery-wordmark" aria-hidden="true">GALLERY</span></h1>
          </div>
          <nav class="gallery-halls" aria-label="展区">
            <RouterLink :to="{ name: 'gallery' }" :aria-current="!showingTarot ? 'page' : undefined">
              <span class="hall-index" aria-hidden="true">01</span><strong>成就章 <small>ETCHED MEDALS</small></strong><b>{{ achievementStore.catalog.length || '—' }}</b>
            </RouterLink>
            <RouterLink :to="{ name: 'gallery', query: { hall: 'tarot' } }" :aria-current="showingTarot ? 'page' : undefined">
              <span class="hall-index" aria-hidden="true">02</span><strong>塔罗收藏 <small>ARCANA</small></strong><b aria-hidden="true">✦</b>
            </RouterLink>
          </nav>
        </header>
        <div :key="showingTarot ? 'tarot' : 'achievements'" class="gallery-exhibit">
          <TarotCollection v-if="showingTarot" />
          <AchievementCollection v-else />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gallery-page { display: flex; flex: 1; min-height: 0; flex-direction: column; color: #f2f7ff; }
.gallery-content { flex: 1; min-height: 0; overflow: auto; padding-bottom: 42px; overscroll-behavior-y: contain; container-type: inline-size; }
.gallery-inner { max-width: 1250px; margin-inline: auto; }
.gallery-header { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: 24px 0 20px; }
.gallery-heading { min-width: 0; }
.gallery-edition { display: inline-block; padding: 2px 9px; background: #e1f691; color: #10213d; transform: rotate(-4deg); font: italic 800 12px var(--font-display); letter-spacing: .1em; }
.gallery-heading h1 { display: flex; align-items: baseline; gap: 12px; font-size: clamp(25px, 3.5cqw, 45px); line-height: 1.05; letter-spacing: -.07em; margin-top: 7px; }
.gallery-wordmark { color: #bce7ff; font: italic 800 clamp(24px, 3.6cqw, 48px)/.95 var(--font-display); letter-spacing: -.035em; }
:global(.presentation-mode-mobile .gallery-title) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
:global(.presentation-mode-mobile .gallery-heading) { display: flex; align-items: center; gap: 12px; }
:global(.presentation-mode-mobile .gallery-heading h1) { margin-top: 0; }
.gallery-halls { display: flex; justify-content: end; gap: 6px; padding: 3px 7px 3px 3px; }
.gallery-halls a { --ticket: #70effb; position: relative; isolation: isolate; display: flex; align-items: center; gap: 8px; padding: 8px 16px 8px 13px; min-width: 0; min-height: 51px; color: #d8ebff; text-decoration: none; transition: transform .22s var(--motion-shift); }
.gallery-halls a::before, .gallery-halls a::after { content: ''; position: absolute; z-index: -1; inset: 0; clip-path: polygon(10px 0,100% 6%,calc(100% - 8px) 100%,0 94%); }
.gallery-halls a::before { background: #060f30; transform: translate(3px,4px); }
.gallery-halls a::after { background: #173969; }
.gallery-halls a:nth-child(2) { --ticket: #f6da8e; }
.gallery-halls a[aria-current] { color: #071638; transform: rotate(-2deg); }
.gallery-halls a:nth-child(2)[aria-current] { transform: rotate(2deg); }
.gallery-halls a[aria-current]::before { background: #315fff; }
.gallery-halls a[aria-current]::after { background: var(--ticket); }
.gallery-halls a:focus-visible { outline: 2px solid white; outline-offset: 4px; }
.gallery-halls .hall-index { align-self: start; opacity: .8; font: italic 800 20px/.95 var(--font-display); }
.gallery-halls strong { font-size: 14px; white-space: nowrap; }
.gallery-halls small { display: block; font: italic 800 10px var(--font-display); letter-spacing: .08em; }
.gallery-halls b { font: italic 800 18px var(--font-display); margin-left: 4px; }
.gallery-exhibit { animation: gallery-arrive .42s var(--motion-enter) both; }
@keyframes gallery-arrive { from { opacity: .55; transform: translateX(12px) translateY(4px); } to { opacity: 1; transform: none; } }
@media (hover: hover) {
  .gallery-halls a:hover { transform: translateY(-3px) rotate(-2deg); }
}
@container (max-width: 560px) {
  .gallery-header { align-items: stretch; flex-direction: column; gap: 14px; padding: 12px 0 15px; }
  .gallery-halls { justify-content: stretch; padding-inline: 2px 6px; }
  .gallery-halls a { flex: 1; }
  .gallery-halls b { margin-left: auto; }
}
@container (max-width: 340px) {
  .gallery-halls a { gap: 5px; padding-inline: 9px 12px; }
  .gallery-halls strong { font-size: 12px; }
  .gallery-halls .hall-index, .gallery-halls b { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .gallery-halls a { transition: none; }
  .gallery-exhibit { animation: none; }
}
</style>
