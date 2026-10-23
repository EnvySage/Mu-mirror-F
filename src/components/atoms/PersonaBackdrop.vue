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
    <i v-for="n in 6" :key="n" class="persona-shard" :style="{ '--n': n }" />
  </div>
</template>

<style scoped>
.persona-backdrop{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:-1;contain:paint}
.persona-orbits{position:absolute;width:75vw;height:75vw;right:-38vw;top:10%;border:1px solid #68e7ff20;border-radius:50%;animation:orbit-turn 48s linear infinite}
.persona-orbits i{position:absolute;inset:8%;border:2px dashed #55ebff16;border-radius:50%}.persona-orbits i:nth-child(2){inset:20%;border:14px solid #1762ff15}.persona-orbits i:nth-child(3){inset:-5%;border:2px dashed #6bf4ff26}
.persona-stream{display:flex;position:absolute;left:-35%;bottom:20%;width:max-content;transform:rotate(-24deg);color:#8ec9ff0e;font:italic 900 clamp(65px,10vw,170px)/1 var(--font-display);white-space:nowrap;animation:stream-drift 26s linear infinite}
.persona-shard{position:absolute;left:calc(var(--n)*17% - 6%);top:calc(var(--n)*13%);width:clamp(35px,7vw,110px);height:190px;background:#42d8ff0d;clip-path:polygon(100% 0,60% 100%,0 76%);transform:rotate(-28deg);animation:shard-drift 8s ease-in-out infinite alternate;animation-delay:calc(var(--n)*-1.3s)}
.persona-shard:nth-of-type(2n){height:90px;background:#ff4e980c}
.persona-backdrop *{animation-play-state:paused}.motion-active *{animation-play-state:running}
@keyframes orbit-turn{to{transform:rotate(360deg)}}
@keyframes stream-drift{from{transform:rotate(-24deg) translateX(0)}to{transform:rotate(-24deg) translateX(-33.333%)}}
@keyframes shard-drift{to{transform:translate(25px,-55px) rotate(12deg)}}
@media(prefers-reduced-motion:reduce){.persona-backdrop *{animation:none}}
</style>
