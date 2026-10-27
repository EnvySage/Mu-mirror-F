<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { gsap, prefersReducedMotion } from '@/motion/core'
const props = defineProps({ card: { type: Object, required: true }, variant: { type: String, default: 'collection' } })
const emit = defineEmits(['zoom', 'ready'])
const root = ref(null)
let context
function tilt(event) {
  if (event.pointerType !== 'mouse' || prefersReducedMotion()) return
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--tilt-x', `${-(event.clientY - rect.top - rect.height / 2) / rect.height * 9}deg`)
  event.currentTarget.style.setProperty('--tilt-y', `${(event.clientX - rect.left - rect.width / 2) / rect.width * 12}deg`)
}
function clearTilt(event) { event.currentTarget.style.setProperty('--tilt-x', '0deg'); event.currentTarget.style.setProperty('--tilt-y', '0deg') }
onMounted(() => {
  if (prefersReducedMotion()) { emit('ready'); return }
  context = gsap.context(() => {
    const timeline = gsap.timeline({ onComplete: () => emit('ready') })
    timeline.from('.spotlight-cut', { scaleX: 0, xPercent: -50, duration: .55, ease: 'power4.out' }, 0)
      .from('.spotlight-orbit', { scale: 2.3, rotation: -105, opacity: 0, duration: 1.15, ease: 'expo.out' }, .08)
      .from('.spotlight-card-flight', { scale: props.variant === 'collection' ? .6 : 2.1, xPercent: 25, yPercent: -12, rotation: -32, duration: 1.2, ease: 'expo.out' }, .12)
      .from('.spotlight-flip', { rotationY: -180, duration: 1.05, ease: 'power3.inOut' }, .12)
      .from('.spotlight-copy > *', { x: 100, opacity: 0, stagger: .09, duration: .6, ease: 'power3.out' }, .65)
      .from('.spotlight-word', { xPercent: -35, opacity: 0, duration: .85, ease: 'expo.out' }, .25)
      .fromTo('.spotlight-shard', { scale: 0, opacity: 0 }, { scale: 1, opacity: .8, duration: .8, stagger: .025, ease: 'expo.out' }, .5)
  }, root.value)
})
onBeforeUnmount(() => context?.revert())
</script>

<template>
  <div ref="root" class="tarot-spotlight" :class="`spotlight-${variant}`">
    <div class="spotlight-cut" aria-hidden="true" />
    <div class="spotlight-orbit" aria-hidden="true"><span>{{ card.number }}</span><i /></div>
    <span class="spotlight-word" aria-hidden="true">{{ card.en }}</span>
    <i v-for="n in 9" :key="n" class="spotlight-shard" :style="{ '--angle': `${n * 41}deg`, '--reach': `${130 + n % 3 * 60}px` }" aria-hidden="true" />
    <div class="spotlight-card-flight">
      <div class="spotlight-tilt" @pointermove="tilt" @pointerleave="clearTilt">
        <button class="spotlight-flip" :aria-label="`放大卡牌细节`" @click="emit('zoom')">
          <span class="spotlight-face spotlight-front"><img :src="card.image_url" :alt="card.name" width="1024" height="1536" /></span>
          <span class="spotlight-face spotlight-back" aria-hidden="true"><img src="/art/tarot/v1/back.png" alt="" width="1024" height="1536" /></span>
        </button>
      </div>
      <span class="spotlight-shadow" aria-hidden="true" />
    </div>
    <div class="spotlight-copy">
      <span class="spotlight-edition">{{ variant === 'new' ? '初次相遇 / 新收藏' : variant === 'reading' ? '这一刻的启发' : variant === 'daily' ? '今日相遇' : '牌面鉴赏' }}</span>
      <div class="spotlight-name"><span>{{ card.number }}</span><h2>{{ card.name }}</h2></div>
      <p class="spotlight-keyword">{{ card.keyword }}</p>
      <p class="spotlight-headline">{{ card.headline }}</p>
      <span v-if="variant === 'new'" class="spotlight-collected">✦ 已收入你的收藏册</span>
      <small v-else>{{ variant === 'reading' ? '问一问的牌，不计入收藏' : '点击卡牌，放大欣赏细节' }}</small>
    </div>
  </div>
</template>

<style scoped>
.tarot-spotlight{position:relative;isolation:isolate;width:100%;height:100%;min-height:0;overflow:hidden;perspective:1200px;color:#fff;background:radial-gradient(ellipse at 32% 35%,#0758c77a,transparent 65%)}
.spotlight-cut{position:absolute;inset:5% -20% 8% -10%;z-index:-1;background:linear-gradient(140deg,#0c75ffba,#173adfe0 60%,#10295745);clip-path:polygon(12% 0,88% 0,75% 100%,0 100%);transform:rotate(-11deg)}
.spotlight-orbit{position:absolute;left:7%;top:2%;width:min(72vw,750px);aspect-ratio:1;border:16px solid #001125a6;border-right-color:transparent;border-radius:50%;transform:rotate(-23deg);z-index:-1}.spotlight-orbit:before{content:'';position:absolute;inset:6%;border:2px solid #5cdaff88;border-left-color:transparent;border-radius:50%}.spotlight-orbit i{position:absolute;inset:-7%;border:25px dashed #020a29a6;border-radius:50%}.spotlight-orbit>span{position:absolute;left:54%;top:15%;font:italic 900 clamp(160px,25vw,400px)/1 var(--font-display);color:#020c2f55}
.spotlight-word{position:absolute;left:-3%;bottom:3%;z-index:-1;white-space:nowrap;font:italic 900 clamp(100px,20vw,330px)/.8 var(--font-display);text-transform:uppercase;letter-spacing:-.055em;color:#030a248c;transform:rotate(-11deg);pointer-events:none}
.spotlight-card-flight{position:absolute;left:20%;top:50%;width:clamp(210px,28vw,350px);aspect-ratio:2/3;transform:translateY(-50%) rotate(-9deg);perspective:1200px}
.spotlight-tilt{position:relative;width:100%;height:100%;transform:rotateX(var(--tilt-x,0deg)) rotateY(var(--tilt-y,0deg));transform-style:preserve-3d;transition:transform .2s ease-out}
.spotlight-flip{position:relative;display:block;width:100%;height:100%;padding:0;transform-style:preserve-3d;border:0;background:transparent;cursor:zoom-in;outline-offset:9px}
.spotlight-face{position:absolute;inset:0;display:block;backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:18px 25px 0 #010a3c65,0 0 50px #1589ff45}
.spotlight-front{transform:translateZ(1px)}.spotlight-back{transform:rotateY(180deg)}.spotlight-face img{display:block;width:100%;height:100%;object-fit:cover;border:1px solid #a5e9ff99}.spotlight-shadow{position:absolute;bottom:-16%;left:-10%;width:130%;height:9%;background:#02071f88;filter:blur(14px);border-radius:50%;z-index:-1;transform:rotate(7deg)}
.spotlight-copy{position:absolute;left:58%;top:30%;max-width:36%;transform:rotate(-6deg)}.spotlight-edition{display:inline-block;padding:9px 23px;background:#02091c;color:#b8daff;font-size:13px;font-weight:700;clip-path:polygon(6% 0,100% 0,94% 100%,0 100%)}.spotlight-new .spotlight-edition{background:#50edfa;color:#001637}.spotlight-name{display:flex;gap:17px;align-items:baseline;margin:20px 0 5px}.spotlight-name>span{font:italic 900 clamp(45px,8vw,110px)/1 var(--font-display);color:#010b35}.spotlight-name h2{margin:0;font-size:clamp(34px,5.8vw,76px);font-weight:950;letter-spacing:-.055em;line-height:1.1;color:#50edfa;text-shadow:4px 5px #002267}.spotlight-keyword{font-size:17px;letter-spacing:.25em;margin:14px 0 24px}.spotlight-headline{font-size:clamp(16px,2.1vw,26px);font-weight:800;line-height:1.6;margin:0 0 22px;max-width:17em}.spotlight-copy small{display:block;font-size:12px;line-height:1.8;color:#accbef}.spotlight-collected{display:inline-block;padding:9px 15px;border:1px solid #8beeff;font-size:13px;background:#031b5980;color:#8bf7ff}
.spotlight-shard{position:absolute;left:39%;top:44%;width:12px;height:64px;transform:rotate(var(--angle)) translateY(calc(-1 * var(--reach)));background:#66eeff80;clip-path:polygon(50% 0,100% 100%,0 60%);z-index:-1}.spotlight-shard:nth-of-type(even){background:#040a2c;width:25px}
@media(max-width:700px){.spotlight-card-flight{left:50%;top:5%;width:min(53vw,230px,30vh);transform:translateX(-50%) rotate(-9deg)}.spotlight-copy{left:10%;top:auto;bottom:3%;max-width:85%;transform:rotate(-5deg)}.spotlight-edition{font-size:11px;padding:6px 18px}.spotlight-name{margin:9px 0 0;gap:14px}.spotlight-name h2{font-size:36px}.spotlight-name>span{font-size:48px}.spotlight-keyword{position:absolute;right:0;top:38px;font-size:13px;letter-spacing:.15em}.spotlight-headline{font-size:17px;margin:8px 0 8px}.spotlight-copy small,.spotlight-collected{font-size:11px}.spotlight-orbit{width:110vw;left:-6%;top:4%;border-width:12px}.spotlight-orbit>span{font-size:200px}.spotlight-word{font-size:24vw;bottom:20%;left:-9%}.spotlight-shard{left:50%;top:30%}}
@media(max-height:650px) and (min-width:701px){.spotlight-card-flight{width:min(25vw,42vh)}.spotlight-copy{top:20%}.spotlight-headline{margin-bottom:12px}}
@media(max-height:700px) and (max-width:700px){.spotlight-card-flight{top:3%;width:min(43vw,27vh)}.spotlight-copy{bottom:1%}.spotlight-keyword{display:none}.spotlight-name h2{font-size:29px}.spotlight-name>span{font-size:36px}.spotlight-headline{font-size:14px}.spotlight-copy small{font-size:10px}}
@media(prefers-reduced-motion:reduce){.spotlight-tilt{transition:none}}
</style>
