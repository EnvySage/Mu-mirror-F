<script setup>
const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
</script>

<template>
  <div class="question-clock" aria-hidden="true">
    <div class="clock-wake" />
    <svg class="clock-face" viewBox="0 0 1000 1000">
      <circle cx="500" cy="500" r="447" class="outer-ring" />
      <circle cx="500" cy="500" r="350" class="inner-ring" />
      <g v-for="tick in 60" :key="tick" :transform="`rotate(${tick * 6} 500 500)`">
        <path :d="tick % 5 === 0 ? 'M500 28V152' : 'M500 50V78'" :class="tick % 5 === 0 ? 'hour-tick' : 'minute-tick'" />
      </g>
      <g v-for="(number, index) in numerals" :key="number" :transform="`rotate(${index * 30} 500 500)`">
        <text x="500" y="220" text-anchor="middle">{{ number }}</text>
      </g>
      <g class="clock-hands">
        <path d="M500 505L472 461L500 160L528 461Z" />
        <path d="M497 501L534 475L813 622L518 531Z" />
        <path d="M500 500L322 783L510 504L663 244Z" />
        <circle cx="500" cy="500" r="17" />
      </g>
    </svg>
    <i v-for="n in 6" :key="n" class="clock-ray" :style="{ '--ray': `${n * 59 - 23}deg` }" />
  </div>
</template>

<style scoped>
.question-clock{position:absolute;left:50%;top:50%;width:min(125vmax,1700px);aspect-ratio:1;transform:translate(-50%,-50%) rotate(-16deg);pointer-events:none;perspective:900px}
.clock-face{position:absolute;inset:0;width:100%;height:100%;overflow:visible;transform:rotateX(21deg);filter:drop-shadow(18px 22px 0 #00154245);color:#02050d}
.outer-ring,.inner-ring{fill:none;stroke:currentColor;stroke-width:12}.inner-ring{stroke-width:4}.hour-tick,.minute-tick{stroke:currentColor;stroke-width:12;stroke-linecap:square}.minute-tick{stroke-width:3;opacity:.65}.clock-face text{fill:currentColor;font:72px Georgia,'Times New Roman',serif;letter-spacing:-6px}.clock-hands{fill:currentColor;transform-origin:500px 500px;animation:clock-drift 16s ease-in-out infinite alternate}
.clock-wake{position:absolute;inset:9%;border-radius:50%;background:radial-gradient(ellipse at 44% 45%,#214affd9 0,#1344c989 28%,#07275b60 57%,transparent 72%);box-shadow:0 0 120px #1657ff35;transform:rotate(-25deg)}
.clock-ray{position:absolute;inset:49% 0 49% 50%;transform-origin:0 50%;transform:rotate(var(--ray));background:#052174;clip-path:polygon(0 50%,100% 0,83% 100%);height:9%;opacity:.85}.clock-ray:nth-of-type(even){background:#2855fa;opacity:.5}
@keyframes clock-drift{from{transform:rotate(-7deg)}to{transform:rotate(13deg)}}
@media(prefers-reduced-motion:reduce){.clock-hands{animation:none}}
</style>
