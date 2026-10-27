<script setup>
import { useId } from 'vue'
const id = useId()
const pieces = [
  '0,72 338,0 168,274 0,328',
  '24,352 210,282 144,556',
  '66,602 306,312 454,754 210,848',
  '274,46 538,0 420,205',
  '424,714 570,430 668,872',
  '826,0 1440,0 1164,152 944,96',
  '1072,208 1400,120 1264,376',
  '1260,438 1440,300 1440,732 1128,854',
  '832,756 1100,604 1006,900 696,900',
]
</script>
<template>
  <svg class="tarot-fractures" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient :id="`${id}-glass`" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b8f9ff" stop-opacity=".32" /><stop offset=".48" stop-color="#56c9ed" stop-opacity=".1" /><stop offset="1" stop-color="#1258b7" stop-opacity=".22" /></linearGradient>
      <linearGradient :id="`${id}-edge`"><stop stop-color="#e4ffff" stop-opacity=".65" /><stop offset="1" stop-color="#66b6df" stop-opacity=".06" /></linearGradient>
    </defs>
    <polygon v-for="(points, i) in pieces" :key="points" :points="points" :fill="`url(#${id}-glass)`" :stroke="`url(#${id}-edge)`" :class="{ 'fracture-offset': i % 3 === 1 }" stroke-width="1.4" />
    <path d="m0 712 372-130 112 208M1056 0l-98 186 204 126M1328 580l-162 96 70 224" fill="none" :stroke="`url(#${id}-edge)`" stroke-width="1" />
  </svg>
</template>
<style scoped>
.tarot-fractures{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.tarot-fractures polygon{transform-box:fill-box;transform-origin:center}
.fracture-offset{translate:10px -9px}
@media(max-width:700px){.tarot-fractures{width:145%;left:-22%}}
</style>
