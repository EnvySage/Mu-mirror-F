<script setup>
import { ref } from 'vue'
import { useSceneActivity } from '@/motion/useSceneActivity'
const root = ref(null)
const active = useSceneActivity(root)
</script>

<template>
  <div ref="root" class="persona-backdrop" :class="{ 'motion-active': active }" aria-hidden="true">
    <div class="persona-orbits"><i /><i /><i /></div>
    <div class="persona-stream"><span v-for="n in 3" :key="n">MAKE IT YOURS. / MIRROR / </span></div>
    <div class="persona-outline">EVERY DAY<br>ANOTHER YOU.</div>
    <svg v-for="n in 6" :key="n" class="persona-shard" :style="{ '--n': n }" viewBox="0 0 180 280" fill="none"><path class="glass-face" d="M24 20 170 0 135 240 0 280Z"/><path class="glass-fold" d="M24 20 135 240 170 0Z"/><path class="glass-edge" d="M24 20 170 0 135 240 0 280Z M24 20 135 240"/><path class="glass-glint" d="M35 35 149 19 M12 248 124 218"/></svg>
    <div class="persona-crosses"><span v-for="n in 4" :key="n" :style="{ '--n': n }">✳</span></div>
  </div>
</template>

<style scoped>
.persona-backdrop{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:-1;contain:paint}
.persona-orbits{position:absolute;width:85vw;height:85vw;right:-40vw;top:2%;border:1px solid #68e7ff55;border-radius:50%;animation:orbit-turn 48s linear infinite}
.persona-orbits i{position:absolute;inset:8%;border:2px dashed #55ebff38;border-radius:50%}.persona-orbits i:nth-child(2){inset:20%;border:18px solid #1679ff1c}.persona-orbits i:nth-child(3){inset:-5%;border:2px dashed #6bf4ff38}
.persona-stream{display:flex;position:absolute;left:-35%;bottom:10%;width:max-content;color:#8edfff26;font:italic 900 clamp(85px,12vw,190px)/1 var(--font-display);white-space:nowrap;animation:stream-drift 36s linear infinite}
.persona-outline{position:absolute;left:15%;top:22%;font:italic 900 clamp(74px,12vw,180px)/.9 var(--font-display);letter-spacing:-.05em;color:transparent;-webkit-text-stroke:1px #8be4ff40;transform:rotate(-18deg);animation:outline-drift 23s ease-in-out infinite alternate;white-space:nowrap}
.persona-shard{position:absolute;left:calc(var(--n)*18% - 19%);top:calc(var(--n)*18% - 30%);width:clamp(70px,12vw,190px);height:clamp(130px,22vw,300px);transform:rotate(-25deg);animation:shard-drift 17s ease-in-out infinite alternate;animation-delay:calc(var(--n)*-3.1s)}
.glass-face{fill:#53eaff17}.glass-fold{fill:#8ecbff19}.glass-edge{stroke:#86f5ff5e;stroke-width:1.1}.glass-glint{stroke:#c7ffff70;stroke-width:2}
.persona-shard:nth-of-type(even){width:clamp(55px,8vw,130px);animation-duration:22s}.persona-shard:nth-of-type(even) .glass-fold{fill:#f389ff1c}.persona-shard:nth-of-type(3n) .glass-edge{stroke:#d6fc7b60}
.persona-crosses span{position:absolute;left:calc(var(--n)*29% - 14%);top:calc(var(--n)*26% - 10%);font:300 42px/1 var(--font);color:#befeff4a;animation:cross-drift 29s linear infinite;animation-delay:calc(var(--n)*-6s)}
.persona-backdrop *{animation-play-state:paused}.motion-active *{animation-play-state:running}
@keyframes orbit-turn{to{transform:rotate(360deg)}}
@keyframes stream-drift{from{transform:rotate(-24deg) translateX(0)}to{transform:rotate(-24deg) translateX(-33.333%)}}
@keyframes shard-drift{to{transform:translate(55px,-110px) rotate(17deg)}}
@keyframes outline-drift{to{transform:translate(-50px,45px) rotate(-14deg)}}
@keyframes cross-drift{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.persona-backdrop *{animation:none}}
</style>
