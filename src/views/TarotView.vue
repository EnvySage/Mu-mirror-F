<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useTarotStore } from '@/stores/tarot'
import { useAuthStore } from '@/stores/auth'
import { tarotDate } from '@/utils/tarotProtocol'
import TarotCard from '@/components/tarot/TarotCard.vue'
import TarotGalleryDialog from '@/components/tarot/TarotGalleryDialog.vue'
import TarotReferenceSettings from '@/components/tarot/TarotReferenceSettings.vue'
import TarotSourceDialog from '@/components/tarot/TarotSourceDialog.vue'

const tarot = useTarotStore(), auth = useAuthStore()
const tab = ref('daily'), gallery = ref(null), galleryCards = ref([]), source = ref(null)
const tabs = [{ id: 'daily', name: '每日运势' }, { id: 'question', name: '问一问' }, { id: 'collection', name: '收藏册' }]
const todayDrawn = computed(() => tarot.daily?.draw?.draw_date === tarot.daily?.server_date)
const ownedCards = computed(() => tarot.cards.filter(c => tarot.unlocked.has(c.id)))
const recoveredCard = computed(() => tarot.cards.find(c => c.id === tarot.recoveredDaily?.card_id))
const terminalMessage = computed(() => tarot.analysis?.status === 'stale' ? '参考资料已变更或撤回，旧解读已隐藏。可以用当前资料重新解读。' : tarot.analysis?.status === 'failed' ? '这次解读没有完成。牌已保留，可以重新解读。' : '')
function showCard(card, collection = false) { if (!card) return; gallery.value = card; galleryCards.value = collection ? ownedCards.value : [card] }
function switchTab(id) { tab.value = id; tarot.error = ''; tarot.notice = '' }
let timer, dailyTick = 0, mounted = true
async function refresh() {
  if (document.hidden) return
  try { await tarot.refreshDaily(); if (tarot.analysis) await tarot.poll() } catch (e) { tarot.error = `暂时无法刷新：${e.message}` }
}
watch(() => auth.user?.id, () => { gallery.value = source.value = null; tarot.load() })
onMounted(async () => {
  await tarot.load()
  if (!mounted) return
  timer = setInterval(() => {
    if (document.hidden) return
    if (tarot.analyzing) tarot.poll()
    if (++dailyTick >= 15) { dailyTick = 0; refresh() }
  }, 2000)
  document.addEventListener('visibilitychange', refresh)
  window.addEventListener('focus', refresh)
})
onBeforeUnmount(() => { mounted = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh) })
</script>

<template>
  <div class="page tarot-page"><div class="page-content tarot-content">
    <header class="tarot-masthead"><div><h1>偶然，<br class="mobile-break" />也有回声。</h1><p>给生活一点新的视角。答案，依然在你手里。</p></div><span class="masthead-mark" aria-hidden="true">✦</span></header>
    <nav class="tarot-tabs" aria-label="塔罗功能"><button v-for="item in tabs" :key="item.id" :class="{ active: tab === item.id }" :aria-current="tab === item.id ? 'page' : undefined" @click="switchTab(item.id)">{{ item.name }}<small v-if="item.id === 'collection' && tarot.collection">{{ tarot.collection.unlocked_count }} / {{ tarot.collection.active_count }}</small></button></nav>
    <div v-if="tarot.error" class="tarot-alert" role="alert"><p>{{ tarot.error }}</p><button v-if="!tarot.cards.length" @click="tarot.load">重新加载</button><RouterLink v-if="/配置|模型/.test(tarot.error)" to="/settings">前往模型设置</RouterLink></div>
    <p v-if="tarot.notice" class="tarot-notice" role="status">{{ tarot.notice }}</p>
    <section v-if="tab === 'daily' && recoveredCard" class="recovered-draw" aria-label="找回的抽牌">
      <button :aria-label="`放大找回的${recoveredCard.name}`" @click="showCard(recoveredCard)"><img :src="recoveredCard.image_url" :alt="recoveredCard.name" width="80" height="120" /></button>
      <div><small>{{ tarot.recoveredDaily.draw_date }} 的抽牌已找回</small><h2>{{ recoveredCard.name }} / {{ recoveredCard.keyword }}</h2><p>{{ recoveredCard.headline }}</p><small>这张牌已保留在收藏册。今天的新牌仍由你主动抽取。</small></div>
    </section>
    <div v-if="tarot.loading && !tarot.cards.length" class="tarot-loading" role="status">正在展开牌桌…</div>
    <template v-else-if="tarot.cards.length">
      <section v-if="tab === 'daily'" class="tarot-stage" aria-labelledby="daily-title">
        <div class="card-stage"><div class="card-orbit" aria-hidden="true" /><Transition name="card-reveal" mode="out-in"><TarotCard :key="tarot.dailyCard?.id || 'back'" :card="todayDrawn ? tarot.dailyCard : null" :disabled="!todayDrawn" @open="showCard" /></Transition><span class="stage-note">{{ todayDrawn ? '点击卡牌，放大欣赏' : '一天一张，留住今天的偶然' }}</span></div>
        <div class="tarot-copy"><span class="date-ticket">{{ tarot.daily?.server_date?.replaceAll('-', '.') }} <small>今日牌签</small></span>
          <template v-if="todayDrawn && tarot.dailyCard"><h2 id="daily-title">{{ tarot.dailyCard.headline }}</h2><p class="card-meaning">{{ tarot.dailyCard.meaning }}</p><p class="small-action"><span>今天的小尝试</span>{{ tarot.dailyCard.action }}</p><div class="drawn-label">{{ tarot.dailyCard.name }} / {{ tarot.dailyCard.keyword }}<span>今天已抽取</span></div><p class="tarot-fine">每天 00:00（北京时间）迎来新牌。抽到的牌会收入收藏。</p><button class="tarot-text-button" @click="switchTab('collection')">去收藏册看看 ↗</button></template>
          <template v-else><h2 id="daily-title">今天的故事，<br />从哪一面开始？</h2><p class="card-meaning">停一小会儿，翻开属于今天的一张牌。<br />把它当作一句鼓励，或闲聊的新话题。</p><button class="tarot-cta" :disabled="tarot.busy" @click="tarot.drawDaily">{{ tarot.busy ? '正在翻开…' : '抽取今日牌' }}<span aria-hidden="true">✦</span></button><p class="tarot-fine">每天随机一张，抽取后不可更换。只有每日牌解锁收藏。</p></template>
        </div>
      </section>
      <section v-else-if="tab === 'question'" class="tarot-stage question-stage" aria-labelledby="question-title">
        <div class="card-stage"><div class="card-orbit" aria-hidden="true" /><Transition name="card-reveal" mode="out-in"><TarotCard :key="tarot.reading?.reading_id || 'back'" :card="tarot.questionCard" :disabled="!tarot.questionCard" @open="showCard" /></Transition><span class="stage-note">{{ tarot.questionCard ? `${tarot.questionCard.name} / ${tarot.questionCard.keyword}` : '把问题留在心里，也可以' }}</span><button v-if="tarot.reading" class="tarot-text-button" :disabled="tarot.busy || tarot.analyzing" @click="tarot.drawQuestion">为另一个问题抽牌 ↗</button></div>
        <div class="tarot-copy"><h2 id="question-title">问一问，<br />另一种可能。</h2>
          <template v-if="!tarot.reading"><p class="card-meaning">心里想一个问题，再翻一张牌。<br />不必说出来，也能看看它带来的启发。</p><button class="tarot-cta" :disabled="tarot.busy" @click="tarot.drawQuestion">{{ tarot.busy ? '正在翻开…' : '心里有个问题，抽一张' }}<span aria-hidden="true">✦</span></button><p class="tarot-fine">单张牌，轻巧直接。这里的抽牌不会解锁收藏。</p></template>
          <template v-else><p class="question-meaning">{{ tarot.questionCard?.meaning }}</p><label class="question-label" for="tarot-question">愿意说说你的问题吗？<small>可选</small></label><textarea id="tarot-question" v-model="tarot.question" maxlength="500" rows="3" :disabled="tarot.busy || tarot.analyzing" placeholder="比如：想学画画，又有点担心坚持不下去…" /><span class="question-count">{{ [...tarot.question].length }} / 500</span>
            <TarotReferenceSettings :preferences="tarot.preferences" :saving="tarot.saving" :disabled="tarot.busy || tarot.analyzing" @save="tarot.savePreferences" />
            <button class="tarot-cta" :disabled="!tarot.question.trim() || tarot.busy || tarot.analyzing || tarot.saving" @click="tarot.analyze">{{ tarot.analyzing ? '正在整理这份启发…' : tarot.busy ? '正在提交…' : tarot.analysis ? '重新解读这张牌' : '看看这张牌的启发' }}<span aria-hidden="true">↗</span></button>
            <p v-if="tarot.analyzing" class="tarot-fine" role="status">可以离开再回来，解读完成后会保留在这里。</p>
          </template>
        </div>
        <section v-if="tarot.analysis" class="tarot-reading" aria-label="问题解读" aria-live="polite">
          <h3>这张牌，想起了什么</h3><p class="reading-question">{{ tarot.analysis.question }}</p><p v-if="terminalMessage" class="reading-status">{{ terminalMessage }}</p><p v-else-if="tarot.analyzing">正在结合你的问题整理启发…</p><p v-else class="reading-text">{{ tarot.analysis.text }}</p>
          <div v-if="tarot.analysis.status === 'completed' && tarot.analysis.sources?.length" class="tarot-sources"><span>参考了这些生活片段</span><button v-for="item in tarot.analysis.sources" :key="item.ref" @click="source = item"><b>[{{ item.ref }}]</b> {{ item.title }}<small>{{ tarotDate(item.date) }} ↗</small></button></div>
          <p v-for="(item, i) in tarot.analysis.notices" :key="i" class="tarot-fine">{{ item }}</p>
        </section>
      </section>
      <section v-else class="tarot-collection" aria-labelledby="collection-title"><header><h2 id="collection-title">慢慢遇见，<br />一张张收藏。</h2><p>只有每日抽到的牌会在这里亮起。<br />重复相遇，也算今天的一段缘分。</p></header><div class="collection-grid"><figure v-for="(card, i) in tarot.cards" :key="card.id" :style="{ '--tilt': `${i % 2 ? 2 : -2}deg` }"><TarotCard :card="card" compact :locked="!tarot.unlocked.has(card.id)" @open="showCard($event, true)" /><figcaption v-if="tarot.unlocked.has(card.id)">{{ tarotDate(tarot.collection.entries.find(e => e.card_id === card.id)?.first_obtained_at) }} 初次相遇</figcaption><figcaption v-else>尚未相遇</figcaption></figure></div></section>
      <footer class="tarot-footer">牌提供一个视角，生活由你决定。</footer>
    </template>
    <TarotGalleryDialog :card="gallery" :cards="galleryCards" @close="gallery = null" @select="gallery = $event" />
    <TarotSourceDialog :source="source" :analysis-id="tarot.analysis?.analysis_id" @close="source = null" @refresh="tarot.poll" />
  </div></div>
</template>

<style scoped>
.tarot-page{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.tarot-content{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;padding-bottom:40px}
.tarot-page{color:#f0f6ff}.tarot-content{position:relative;container-type:inline-size}.tarot-masthead{display:flex;justify-content:space-between;align-items:center;padding:28px 0 24px;gap:16px}.tarot-masthead h1{margin:0;font-size:clamp(30px,4.4vw,60px);font-weight:950;letter-spacing:-.06em;transform:skew(-5deg)}.tarot-masthead p{margin:14px 0 0;color:#acc7ef;font-size:13px;line-height:1.8}.mobile-break{display:none}.masthead-mark{color:#50edfa;font-size:100px;line-height:1;transform:rotate(-12deg);margin-right:4%}.tarot-tabs{display:flex;gap:8px;border-bottom:1px solid #91bdf94d;padding:0 0 16px}.tarot-tabs button{font-size:17px;font-weight:800;color:#9ebce6;padding:12px 25px;transform:skew(-8deg);white-space:nowrap}.tarot-tabs button.active{background:#50edfa;color:#06123f;box-shadow:4px 4px 0 #1762ff}.tarot-tabs small{font:700 14px var(--font-display);margin-left:8px}.tarot-alert{margin:20px 0;padding:12px 18px;border-left:4px solid #ffb4c6;background:#53263a;color:#fff;line-height:1.7}.tarot-alert p{margin:0}.tarot-alert button,.tarot-alert a{display:inline-block;color:#fff;text-decoration:underline;margin-top:8px}.tarot-notice{font-size:13px;color:#50edfa}.tarot-loading{padding:90px 0;text-align:center;color:#bed5fa}.tarot-stage{display:grid;grid-template-columns:minmax(230px,.95fr) minmax(260px,1fr);gap:30px 6%;align-items:center;padding:46px 10px 30px;max-width:1100px;margin:auto}.card-stage{position:relative;min-width:0;display:flex;align-items:center;flex-direction:column;padding:28px 28px 12px;isolation:isolate}.card-orbit{position:absolute;width:110%;height:68%;top:12%;z-index:-1;border:1px solid #50edfa65;border-radius:50%;transform:rotate(-30deg);background:repeating-linear-gradient(125deg,transparent 0 18px,#50edfa07 18px 19px)}.card-orbit:after{content:'✦';position:absolute;top:0;right:12%;font-size:36px;line-height:1;color:#50edfa}.stage-note{display:block;text-align:center;font-size:11px;letter-spacing:.08em;color:#adc8ee;margin-top:28px}.tarot-copy{padding:10px 0}.date-ticket{display:inline-flex;align-items:center;gap:14px;font:italic 700 24px var(--font-display);color:#50edfa}.date-ticket small{font:12px var(--font);border-left:1px solid #50edfa;padding-left:14px}.tarot-copy h2{font-size:clamp(30px,3.5vw,47px);font-weight:900;line-height:1.3;letter-spacing:-.04em;margin:24px 0 20px}.card-meaning{font-size:16px;line-height:1.95;color:#c6d9f5;max-width:34em}.small-action{border-left:3px solid #50edfa;padding:4px 0 4px 16px;margin:28px 0;font-size:16px;line-height:1.8}.small-action>span{display:block;font-size:12px;color:#50edfa;margin-bottom:5px}.drawn-label{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;font-size:14px;font-weight:700}.drawn-label>span{font-size:12px;color:#50edfa}.tarot-cta{display:flex;justify-content:space-between;align-items:center;gap:20px;min-height:53px;min-width:230px;max-width:100%;padding:15px 22px;margin-top:25px;background:#50edfa;color:#06123f;font-size:16px;font-weight:900;box-shadow:5px 5px 0 #1762ff;clip-path:polygon(4% 0,100% 0,96% 100%,0 100%)}.tarot-cta>span{font-size:24px;line-height:1}.tarot-cta:disabled{opacity:.5;cursor:default}.tarot-fine{font-size:12px;line-height:1.8;color:#a0bde6;margin-top:16px}.tarot-text-button{font-size:13px;color:#50edfa;padding:12px 0;border-bottom:1px solid #50edfa70}.tarot-text-button:disabled{opacity:.5}.tarot-footer{text-align:center;color:#86a6d4;font-size:12px;letter-spacing:.12em;padding:35px 0 18px}.question-stage{align-items:start}.question-stage .tarot-copy h2{margin-top:5px}.question-stage .card-stage{position:sticky;top:20px}.question-meaning{font-size:14px;color:#c6d9f5;line-height:1.9;margin-bottom:24px}.question-label{font-size:14px;display:flex;justify-content:space-between;margin-bottom:10px}.question-label small{font-size:11px;color:#9ab7e2}.tarot-copy textarea{display:block;width:100%;min-height:100px;resize:vertical;border:1px solid #5481be;background:#04163e80;color:#f0f6ff;padding:13px;font:14px/1.7 var(--font);border-radius:0}.tarot-copy textarea::placeholder{color:#829fce}.question-count{display:block;text-align:right;font-size:11px;color:#9bb6df;margin-top:6px}.tarot-reading{grid-column:1/-1;max-width:780px;width:100%;margin:16px auto 0;background:#092e6b;padding:28px 32px;border-top:4px solid #50edfa;box-shadow:10px 10px 0 #04143570}.tarot-reading h3{font-size:22px;line-height:1.6;margin:0 0 10px}.reading-question{font-size:13px;color:#9fc7ef;padding-bottom:16px;border-bottom:1px solid #5295cb55;overflow-wrap:anywhere}.reading-text{font-size:16px;line-height:2;white-space:pre-wrap;overflow-wrap:anywhere}.reading-status{line-height:1.9;color:#ffd1df}.tarot-sources{display:flex;flex-direction:column;gap:8px;margin-top:24px}.tarot-sources>span{font-size:12px;color:#9fc7ef}.tarot-sources button{padding:12px;background:#041d4b;text-align:left;color:#d0e9ff;font-size:13px;line-height:1.8;overflow-wrap:anywhere}.tarot-sources b{color:#50edfa}.tarot-sources small{display:block;font-size:11px;color:#9fc7ef}.tarot-collection header{display:flex;justify-content:space-between;align-items:end;gap:25px;margin:35px 0}.tarot-collection h2{font-size:32px;line-height:1.4;margin:0;letter-spacing:-.04em}.tarot-collection header p{font-size:13px;line-height:1.9;color:#b1caee;margin:0}.collection-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:35px 24px;padding:15px 6px}.collection-grid figure{margin:0;transform:rotate(var(--tilt));min-width:0}.collection-grid figcaption{font-size:10px;text-align:center;color:#9bb9e4;margin-top:12px}.card-reveal-enter-active{animation:tarot-reveal .55s cubic-bezier(.2,.7,.2,1)}.card-reveal-leave-active{transition:opacity .15s}.card-reveal-leave-to{opacity:0}@keyframes tarot-reveal{from{opacity:0;transform:perspective(900px) rotateY(80deg) rotate(-5deg)}to{opacity:1;transform:perspective(900px) rotateY(0) rotate(-5deg)}}
@container(max-width:650px){.tarot-masthead{padding-top:15px}.tarot-masthead h1{font-size:35px}.masthead-mark{font-size:75px;margin-right:0}.tarot-tabs button{font-size:15px;padding:11px 14px;flex:1}.tarot-tabs small{font-size:12px;margin-left:4px}.tarot-stage{grid-template-columns:1fr;padding:15px 0 20px;gap:12px}.card-stage{padding:24px 45px 10px;max-width:340px;margin:auto;width:100%}.card-stage :deep(.tarot-card){max-width:220px}.tarot-copy{padding:14px 5px}.tarot-copy h2{font-size:32px;margin:18px 0}.card-orbit{width:95%}.card-meaning{font-size:15px}.tarot-cta{width:100%;margin-top:22px}.question-stage .card-stage{position:relative;top:0}.question-stage .card-stage :deep(.tarot-card){max-width:170px}.question-stage .tarot-copy h2{font-size:28px}.question-stage .tarot-copy h2 br{display:none}.tarot-reading{padding:22px 18px}.tarot-collection header{align-items:start;flex-direction:column;gap:12px}.tarot-collection h2{font-size:28px}.collection-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:25px 14px}.collection-grid :deep(.card-caption b){display:none}.collection-grid :deep(.card-caption span){font-size:13px}.collection-grid :deep(.card-caption small){font-size:10px}}
@container(max-width:400px){.tarot-masthead h1{font-size:32px}.mobile-break{display:block}.tarot-masthead p{font-size:12px}.collection-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:25px 20px}.tarot-tabs button{padding:10px 8px;font-size:14px}}
@media(prefers-reduced-motion:reduce){.card-reveal-enter-active{animation:none}.card-reveal-leave-active{transition:none}}
.tarot-page button:focus-visible,.tarot-page textarea:focus-visible{outline:3px solid #fff;outline-offset:4px}
.recovered-draw{display:flex;align-items:center;gap:18px;margin-top:20px;padding:16px;background:#092e6b;border-left:3px solid #50edfa}.recovered-draw button{flex:none;width:80px;padding:0}.recovered-draw img{display:block;width:100%;height:auto}.recovered-draw h2{font-size:19px;margin:8px 0}.recovered-draw p{font-size:14px;margin:8px 0}.recovered-draw small{font-size:12px;line-height:1.8;color:#b4cff0}
</style>
