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
    timeline.from(root.value, { opacity: 0, duration: .3 }, 0)
      .from('.spotlight-haze', { scale: .6, opacity: 0, duration: 1.3, ease: 'power2.out' }, 0)
      .from('.spotlight-echoes', { scale: .85, rotation: -15, opacity: 0, duration: 1.3, ease: 'power2.out' }, .1)
      .from('.spotlight-orbit', { scale: 1.2, rotation: -55, opacity: 0, duration: 1.3, ease: 'power2.out' }, .08)
      .from('.spotlight-card-flight', { scale: props.variant === 'collection' ? .85 : 1.4, xPercent: 12, yPercent: -8, rotation: -22, duration: 1.2, ease: 'power3.out' }, .12)
      .fromTo('.spotlight-flip', { rotationY: -180 }, { rotationY: 0, duration: 1.05, ease: 'power3.inOut' }, .12)
      .from('.spotlight-copy > *', { x: 100, opacity: 0, stagger: .09, duration: .6, ease: 'power3.out' }, .65)
      .from('.spotlight-word', { xPercent: -35, opacity: 0, duration: .85, ease: 'expo.out' }, .25)
      .fromTo('.spotlight-shard', { scale: 0, opacity: 0 }, { scale: 1, opacity: .3, duration: 1.1, stagger: .04, ease: 'power2.out' }, .5)
  }, root.value)
})
onBeforeUnmount(() => context?.revert())
</script>

<template>
  <div ref="root" class="tarot-spotlight" :class="`spotlight-${variant}`">
    <div class="spotlight-haze" aria-hidden="true" />
    <div class="spotlight-echoes" aria-hidden="true"><img v-for="n in 2" :key="n" src="/art/tarot/v1/back.png" alt="" /></div>
    <div class="spotlight-orbit" aria-hidden="true"><span>{{ card.number }}</span><i /></div>
    <span class="spotlight-word" aria-hidden="true">{{ card.en }}</span>
    <i v-for="n in 5" :key="n" class="spotlight-shard" :style="{ '--angle': `${n * 71}deg`, '--reach': `${150 + n % 3 * 60}px` }" aria-hidden="true" />
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
.tarot-spotlight{position:relative;isolation:isolate;width:100%;height:100%;min-height:0;overflow:hidden;perspective:1200px;color:#fff}
.spotlight-haze{position:absolute;inset:0;z-index:-2;background:radial-gradient(ellipse at 30% 45%,#89cbd329,transparent 55%),radial-gradient(ellipse at 75% 60%,#48688714,transparent 60%);pointer-events:none}
.spotlight-echoes{position:absolute;left:17%;top:50%;width:clamp(210px,28vw,350px);aspect-ratio:2/3;transform:translateY(-50%);z-index:-1;pointer-events:none}
.spotlight-echoes img{position:absolute;width:100%;height:100%;object-fit:cover;opacity:.09;transform:translate(-22%,-3%) rotate(-19deg);animation:card-echo-drift 10s ease-in-out infinite alternate}
.spotlight-echoes img+img{opacity:.055;transform:translate(30%,2%) rotate(13deg);animation-delay:-5s;animation-direction:alternate-reverse}
@keyframes card-echo-drift{to{translate:0 -12px}}
.spotlight-orbit{position:absolute;left:7%;top:2%;width:min(72vw,750px);aspect-ratio:1;border:1px solid #9bdbe02b;border-right-color:transparent;border-radius:50%;transform:rotate(-23deg);z-index:-1}.spotlight-orbit:before{content:'';position:absolute;inset:6%;border:1px solid #aadbe519;border-left-color:transparent;border-radius:50%}.spotlight-orbit i{position:absolute;inset:-7%;border:1px dashed #adcbd526;border-radius:50%}.spotlight-orbit>span{position:absolute;left:54%;top:15%;font:italic 900 clamp(160px,25vw,400px)/1 var(--font-display);color:#c0d9e009}
.spotlight-word{position:absolute;left:-3%;bottom:3%;z-index:-1;white-space:nowrap;font:italic 900 clamp(100px,20vw,330px)/.8 var(--font-display);text-transform:uppercase;letter-spacing:-.055em;color:transparent;-webkit-text-stroke:1px #b8dbe326;transform:rotate(-11deg);pointer-events:none}
.spotlight-card-flight{position:absolute;left:20%;top:50%;width:clamp(210px,28vw,350px);aspect-ratio:2/3;transform:translateY(-50%) rotate(-9deg);perspective:1200px}
.spotlight-tilt{position:relative;width:100%;height:100%;transform:rotateX(var(--tilt-x,0deg)) rotateY(var(--tilt-y,0deg));transform-style:preserve-3d;transition:transform .2s ease-out}
/* GSAP owns this transform: the global button transition otherwise corrupts its starting matrix. */
.spotlight-flip{position:relative;display:block;width:100%;height:100%;padding:0;transform:rotateY(0deg);transform-style:preserve-3d;transition:none;border:0;background:transparent;cursor:zoom-in;outline-offset:9px}
.spotlight-flip:active{transform:rotateY(0deg)}
.spotlight-face{position:absolute;inset:0;display:block;backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:12px 22px 35px #0009,0 0 30px #84c7cf14}
.spotlight-front{transform:translateZ(1px)}.spotlight-back{transform:rotateY(180deg)}.spotlight-face img{display:block;width:100%;height:100%;object-fit:cover;border:1px solid #a5e9ff99}.spotlight-shadow{position:absolute;bottom:-16%;left:-10%;width:130%;height:9%;background:#02071f88;filter:blur(14px);border-radius:50%;z-index:-1;transform:rotate(7deg)}
.spotlight-copy{position:absolute;left:58%;top:30%;max-width:36%;transform:rotate(-6deg)}.spotlight-edition{display:inline-block;padding:9px 23px;background:#02091c;color:#b8daff;font-size:13px;font-weight:700;clip-path:polygon(6% 0,100% 0,94% 100%,0 100%)}.spotlight-new .spotlight-edition{background:#50edfa;color:#001637}.spotlight-name{display:flex;gap:17px;align-items:baseline;margin:20px 0 5px}.spotlight-name>span{font:italic 900 clamp(45px,8vw,110px)/1 var(--font-display);color:#010b35}.spotlight-name h2{margin:0;font-size:clamp(34px,5.8vw,76px);font-weight:950;letter-spacing:-.055em;line-height:1.1;color:#50edfa;text-shadow:4px 5px #002267}.spotlight-keyword{font-size:17px;letter-spacing:.25em;margin:14px 0 24px}.spotlight-headline{font-size:clamp(16px,2.1vw,26px);font-weight:800;line-height:1.6;margin:0 0 22px;max-width:17em}.spotlight-copy small{display:block;font-size:12px;line-height:1.8;color:#accbef}.spotlight-collected{display:inline-block;padding:9px 15px;border:1px solid #8beeff;font-size:13px;background:#031b5980;color:#8bf7ff}
.spotlight-shard{position:absolute;left:39%;top:44%;width:2px;height:30px;transform:rotate(var(--angle)) translateY(calc(-1 * var(--reach)));background:linear-gradient(transparent,#b1e9ed,transparent);z-index:-1}
.spotlight-name h2{color:#daf4f2;text-shadow:2px 3px #011520}.spotlight-name>span{color:#99c6d580}.spotlight-new .spotlight-edition{background:#b5dce0;color:#092434}.spotlight-collected{border-color:#8fbbc859;color:#bddfe3;background:#1735434d}
@media(max-width:700px){.spotlight-echoes{left:50%;top:5%;width:min(53vw,230px,30vh);transform:translateX(-50%)}}
@media(max-height:700px) and (max-width:700px){.spotlight-echoes{top:3%;width:min(43vw,27vh)}}
@media(prefers-reduced-motion:reduce){.spotlight-echoes img{animation:none}}
@media(max-width:700px){.spotlight-card-flight{left:50%;top:5%;width:min(53vw,230px,30vh);transform:translateX(-50%) rotate(-9deg)}.spotlight-copy{left:10%;top:auto;bottom:3%;max-width:85%;transform:rotate(-5deg)}.spotlight-edition{font-size:11px;padding:6px 18px}.spotlight-name{margin:9px 0 0;gap:14px}.spotlight-name h2{font-size:36px}.spotlight-name>span{font-size:48px}.spotlight-keyword{position:absolute;right:0;top:38px;font-size:13px;letter-spacing:.15em}.spotlight-headline{font-size:17px;margin:8px 0 8px}.spotlight-copy small,.spotlight-collected{font-size:11px}.spotlight-orbit{width:110vw;left:-6%;top:4%;border-width:1px}.spotlight-orbit>span{font-size:200px}.spotlight-word{font-size:24vw;bottom:20%;left:-9%}.spotlight-shard{left:50%;top:30%}}
@media(max-height:650px) and (min-width:701px){.spotlight-card-flight{width:min(25vw,42vh)}.spotlight-copy{top:20%}.spotlight-headline{margin-bottom:12px}}
@media(max-height:700px) and (max-width:700px){.spotlight-card-flight{top:3%;width:min(43vw,27vh)}.spotlight-copy{bottom:4%}.spotlight-keyword{display:none}.spotlight-name h2{font-size:29px}.spotlight-name>span{font-size:36px}.spotlight-headline{font-size:14px}.spotlight-copy small{font-size:10px}}
@media(max-height:550px) and (min-width:701px){.spotlight-copy{top:10%}.spotlight-edition{padding:6px 16px;font-size:10px}.spotlight-name{margin:8px 0 0;gap:10px}.spotlight-name h2{font-size:34px}.spotlight-name>span{font-size:45px}.spotlight-keyword{font-size:12px;margin:6px 0 10px}.spotlight-headline{font-size:16px;line-height:1.5;margin-bottom:10px}.spotlight-copy small{font-size:10px}.spotlight-collected{font-size:10px;padding:5px 10px}}
@media(prefers-reduced-motion:reduce){.spotlight-tilt{transition:none}}
</style>
