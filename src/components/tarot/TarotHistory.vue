<script setup>
import { computed } from 'vue'
import { useTarotStore } from '@/stores/tarot'
import { tarotDate } from '@/utils/tarotProtocol'
import { tarotPerspective, orientationLabel } from '@/utils/tarotPresentation'
import TarotCard from './TarotCard.vue'
const tarot = useTarotStore()
defineEmits(['inspect', 'source'])
const selectedCard = computed(() => tarot.cards.find(card => card.id === tarot.historySelection?.card_id))
const perspective = computed(() => tarotPerspective(selectedCard.value, tarot.historySelection?.orientation))
const cardFor = event => tarot.cards.find(card => card.id === event.card_id)
const statusText = status => ({ pending: '等待解读', running: '正在解读', completed: '已完成', failed: '解读未完成', stale: '资料变更，内容已隐藏' }[status] || status)
</script>
<template>
  <section class="tarot-history" aria-labelledby="history-title">
    <header><h2 id="history-title">每次相遇，<br />都有迹可循。</h2><p>每日牌与问一问，都保留在这里。<br />同一张问题牌，可以回看每次保存的解读。</p></header>
    <p v-if="!tarot.history && tarot.historyBusy" role="status">正在寻找过去的相遇…</p>
    <p v-else-if="!tarot.history?.items.length" class="history-empty">还没有相遇记录。抽取一张牌，故事就开始了。</p>
    <div v-else class="history-layout">
      <div class="history-list"><p class="history-total">共 {{ tarot.history.total }} 次相遇</p>
        <button v-for="event in tarot.history.items" :key="`${event.kind}-${event.id}`" class="history-event" :class="{ selected: tarot.historySelection?.id === event.id && tarot.historySelection?.kind === event.kind }" :aria-pressed="tarot.historySelection?.id === event.id && tarot.historySelection?.kind === event.kind" @click="tarot.inspectHistory(event)">
          <img v-if="cardFor(event)" :src="cardFor(event).image_url" alt="" width="64" height="96" loading="lazy" :class="{ reversed: event.orientation === 'reversed' }" />
          <span><small>{{ event.draw_date || tarotDate(event.created_at) }} · {{ event.kind === 'daily' ? '每日牌' : '问一问' }}</small><b>{{ cardFor(event)?.name || '历史牌面' }}</b><span>{{ orientationLabel(event.orientation) }}<template v-if="event.kind === 'question'"> · {{ event.latest_analysis_id ? '有保存的解读' : '尚未解读' }}</template></span></span><i aria-hidden="true">↗</i>
        </button>
        <button v-if="tarot.history.has_more" class="history-more" :disabled="tarot.historyBusy" @click="tarot.loadHistory(true)">{{ tarot.historyBusy ? '正在加载…' : '更早的相遇 ↓' }}</button>
      </div>
      <section v-if="tarot.historySelection && selectedCard" class="history-detail" aria-label="相遇详情">
        <div class="history-card"><TarotCard :card="selectedCard" compact :orientation="tarot.historySelection.orientation" @open="$emit('inspect', selectedCard, tarot.historySelection.orientation)" /><div><span>{{ tarot.historySelection.kind === 'daily' ? '每日牌' : '问一问' }} / {{ orientationLabel(tarot.historySelection.orientation) }}</span><h3>{{ selectedCard.name }}</h3><b>{{ perspective.keyword }}</b><p>{{ perspective.meaning }}</p><p class="history-action">小尝试 / {{ perspective.action }}</p></div></div>
        <template v-if="tarot.historySelection.kind === 'question'">
          <h4>保存的解读 <small>{{ tarot.historyVersions.length }} 个版本</small></h4>
          <nav v-if="tarot.historyVersions.length" class="analysis-versions" aria-label="解读版本"><button v-for="(version, index) in tarot.historyVersions" :key="version.analysis_id" :aria-pressed="tarot.historyAnalysis?.analysis_id === version.analysis_id" :disabled="tarot.historyDetailBusy" @click="tarot.selectHistoryVersion(version.analysis_id)"><b>版本 {{ tarot.historyVersions.length - index }}</b><span>{{ tarotDate(version.created_at) }} · {{ statusText(version.status) }}</span></button></nav>
          <p v-if="tarot.historyDetailBusy" role="status">正在读取这次保存的解读…</p>
          <div v-else-if="tarot.historyAnalysis" class="history-analysis" aria-live="polite"><p class="history-question">{{ tarot.historyAnalysis.question }}</p><p v-if="tarot.historyAnalysis.status === 'stale'" class="history-status">参考资料已变更或撤回，旧解读已隐藏。</p><p v-else-if="tarot.historyAnalysis.status === 'failed'" class="history-status">这次解读没有完成，抽到的牌仍然保留。</p><p v-else-if="['pending','running'].includes(tarot.historyAnalysis.status)" role="status">解读还在整理中。<button class="history-more" @click="tarot.selectHistoryVersion(tarot.historyAnalysis.analysis_id)">刷新结果</button></p><p v-else class="history-text">{{ tarot.historyAnalysis.text }}</p>
            <div v-if="tarot.historyAnalysis.status === 'completed' && tarot.historyAnalysis.sources?.length" class="history-sources"><span>参考的生活片段</span><button v-for="item in tarot.historyAnalysis.sources" :key="item.ref" @click="$emit('source', item)">[{{ item.ref }}] {{ item.title }} ↗</button></div>
            <p v-for="(notice, i) in tarot.historyAnalysis.notices" :key="i" class="history-notice">{{ notice }}</p>
          </div><p v-else>这次相遇还没有保存的解读。</p>
        </template>
      </section>
      <p v-else class="history-placeholder">选择一次相遇，展开它的故事。</p>
    </div>
  </section>
</template>
<style scoped>
.tarot-history{padding-top:32px}.tarot-history>header{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:30px}.tarot-history h2{font-size:32px;line-height:1.4;margin:0}.tarot-history>header p{font-size:13px;color:#b1caee;line-height:1.9;margin:0}.history-layout{display:grid;grid-template-columns:minmax(220px,.65fr) minmax(0,1.35fr);gap:28px;align-items:start}.history-total{font-size:12px;color:#a8c2d8;margin:0 0 12px}.history-event{display:flex;align-items:center;gap:14px;width:100%;padding:12px 10px;text-align:left;border-bottom:1px solid #7cacc53d;color:#d8edf4;background:#06214955;min-height:105px}.history-event.selected{border-left:3px solid #9edecf;background:#17445c}.history-event>img{width:48px;height:72px;object-fit:cover;flex:none}.history-event img.reversed{transform:rotate(180deg)}.history-event>span{display:flex;flex-direction:column;gap:7px;min-width:0}.history-event small{font-size:11px;color:#aac9df}.history-event b{font-size:16px}.history-event span span{font-size:12px;color:#b2d6db}.history-event i{margin-left:auto;font-style:normal;color:#a6e2d3}.history-more{display:block;padding:14px 18px;margin:16px 0;color:#a4e2db;border:1px solid #8fc6cc5e;font-size:13px;min-height:44px}.history-more:disabled{opacity:.5}.history-placeholder,.history-empty{padding:50px 20px;color:#b1ccda;text-align:center;font-size:14px}.history-detail{background:#092c54;padding:24px;border-top:3px solid #a5ddd3;min-width:0}.history-card{display:grid;grid-template-columns:120px minmax(0,1fr);align-items:start;gap:22px}.history-card>div>span{font-size:11px;color:#c1e1e1}.history-card h3{font-size:25px;margin:8px 0}.history-card b{font-size:13px;color:#c8e3dc}.history-card p{font-size:13px;line-height:1.9;color:#c9dce9}.history-action{border-left:2px solid #a4d8c9;padding-left:10px}.history-detail h4{font-size:17px;margin:28px 0 14px}.history-detail h4 small{font-size:11px;color:#a8c2d8;font-weight:400;margin-left:10px}.analysis-versions{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px}.analysis-versions button{flex:none;display:flex;flex-direction:column;gap:6px;text-align:left;border:1px solid #749ba366;padding:10px 13px;color:#c4dce8;min-height:60px}.analysis-versions button[aria-pressed=true]{background:#bddfd9;color:#0b3144}.analysis-versions b{font-size:13px}.analysis-versions span{font-size:10px}.history-question{border-bottom:1px solid #7697a84d;padding-bottom:12px;font-size:13px;color:#bedae7;overflow-wrap:anywhere}.history-text{font-size:15px;line-height:2;white-space:pre-wrap;overflow-wrap:anywhere}.history-status{color:#f5cbd9;font-size:14px;line-height:1.9}.history-notice{font-size:11px;line-height:1.9;color:#acc2d6}.history-sources{display:flex;flex-direction:column;gap:8px;font-size:12px;color:#b1d7de}.history-sources button{text-align:left;padding:10px;background:#071c3c;color:#cce4ee}.history-detail>p{font-size:13px;line-height:1.9;color:#b8ccdd}
@media(max-width:900px){.history-layout{grid-template-columns:1fr}.history-detail{padding:18px}.history-list{max-height:380px;overflow-y:auto}.history-placeholder{padding:20px}.tarot-history>header{align-items:start;flex-direction:column;gap:12px}.tarot-history h2{font-size:28px}}
@media(max-width:450px){.history-card{grid-template-columns:90px minmax(0,1fr);gap:14px}.history-card h3{font-size:21px}.history-card :deep(.card-caption b){display:none}.history-card :deep(.card-caption span){font-size:12px}.history-card :deep(.card-caption small){font-size:9px}.history-card p{font-size:12px}.history-card>div>span{font-size:10px}.history-detail{padding:14px}}
.history-card :deep(.card-caption b),.history-card :deep(.card-caption i){display:none}.history-card :deep(.card-caption){gap:4px}.history-card :deep(.card-caption span){min-width:0;font-size:13px}.history-card :deep(.card-caption small){font-size:9px}
</style>
