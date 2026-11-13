<script setup>
import { computed, onMounted, ref } from 'vue'
import { getLedgerBrief } from '@/api/ledger'
import { currency, shanghaiToday } from '@/utils/ledger'
const brief = ref(null), failed = ref(false)
const today = shanghaiToday(), month = today.slice(0, 7) + '-01'
const max = computed(() => Math.max(1, ...(brief.value?.categories || []).map(row => Math.abs(Number(row.net_expense || 0)))))
async function load() {
  failed.value = false
  try { brief.value = await getLedgerBrief(month, today) }
  catch { failed.value = true }
}
onMounted(load)
</script>

<template>
  <section v-if="brief || failed" class="mirror-ledger" aria-label="本月消费回顾">
    <header><div><h2>本月消费回顾</h2><p>{{ month }} 至 {{ today }} · 已确认账目</p></div><RouterLink :to="{ name: 'ledger' }">打开账本</RouterLink></header>
    <p v-if="failed" role="alert">暂时无法读取本月账目。 <button type="button" @click="load">重试</button></p>
    <template v-else>
      <div class="mirror-ledger-total"><span>净消费</span><strong>{{ currency(brief.net_expense) }}</strong></div>
      <p v-if="!brief.categories?.length">本月还没有可回顾的消费。</p>
      <ul v-else>
        <li v-for="row in brief.categories" :key="row.category_id"><span>{{ row.name }}</span><div class="ledger-bar"><i :style="{ width: 100 * Math.abs(Number(row.net_expense || 0)) / max + '%' }" /></div><strong>{{ currency(row.net_expense) }}</strong></li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.mirror-ledger{background:#0c265e;border-left:5px solid var(--pink);color:white;padding:clamp(14px,3vw,25px);margin:16px 0}
header{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}
h2,p{margin:0}h2{font-size:21px;font-weight:900}p{font-size:12px;color:#bcd5ff;margin-top:5px}
a,button{color:var(--cyan);font-size:13px;padding:5px 0;border-bottom:1px solid #50edfa89}
.mirror-ledger-total{display:flex;align-items:baseline;gap:12px;margin-top:9px;font-size:12px}.mirror-ledger-total strong{font:italic 800 42px var(--font-display);color:var(--cyan)}
ul{list-style:none;margin:7px 0 0;padding:0}li{display:grid;grid-template-columns:minmax(40px,.5fr) minmax(40px,2fr) minmax(55px,auto);align-items:center;gap:8px;min-height:29px;font-size:12px}li strong{text-align:right}
.ledger-bar{height:5px;background:#5176ad55}.ledger-bar i{height:100%;background:var(--cyan);display:block;transform:skew(-12deg)}
</style>
