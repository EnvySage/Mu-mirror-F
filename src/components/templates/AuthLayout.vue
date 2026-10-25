<script setup>
import { ref } from 'vue'
const stage = ref(null)
function move(event) {
  if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const rect = stage.value.getBoundingClientRect()
  stage.value.style.setProperty('--look-x', ((event.clientX - rect.left - rect.width / 2) / rect.width * 22) + 'px')
  stage.value.style.setProperty('--look-y', ((event.clientY - rect.top - rect.height / 2) / rect.height * 15) + 'px')
}
function reset() {
  stage.value.style.setProperty('--look-x', '0px')
  stage.value.style.setProperty('--look-y', '0px')
}
</script>
<template>
  <main ref="stage" class="auth-layout" @pointermove="move" @pointerleave="reset">
    <div class="auth-ocean" aria-hidden="true" /><div class="auth-grain" aria-hidden="true" />
    <a href="/" class="auth-brand">MIRROR<span>记录，让自己显影。</span></a>
    <span class="auth-edition" aria-hidden="true">A PLACE FOR ALL YOUR SELVES.</span>
    <section class="auth-illustration" aria-label="在日常的碎片里，看见自己">
      <div class="auth-orbit" aria-hidden="true"><i /><i /><i /></div>
      <div class="auth-art-type" aria-hidden="true"><span>INTO</span><span>THE BLUE.</span></div>
      <div class="auth-shards" aria-hidden="true">
        <div class="auth-shard shard-one" /><div class="auth-shard shard-two" /><div class="auth-shard shard-three" />
        <span class="auth-spark">✦</span><span class="auth-streak" />
      </div>
      <div class="auth-ticket" aria-hidden="true"><span>DEAR MYSELF,</span><b>每一面，<br>都是我。</b><small>somewhere in my blue hour.</small></div>
      <div class="auth-art-copy"><span class="auth-copy-mark" aria-hidden="true">↙</span><div><h2>在日常的碎片里，<br>看见自己。</h2><p>写下一点生活，留给未来的你。</p></div></div>
    </section>
    <div class="auth-container"><div class="auth-form-slice" aria-hidden="true" /><router-view /></div>
    <footer class="auth-bottom"><span>YOUR DAYS. YOUR REFLECTION.</span><span>不必完整，也值得被记住。</span><span aria-hidden="true">M / ↗</span></footer>
  </main>
</template>
<style scoped>
.auth-layout{--look-x:0px;--look-y:0px;position:relative;isolation:isolate;min-height:100dvh;height:100dvh;overflow:auto;display:grid;align-content:start;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);background:#061638;color:#effbff}
.auth-ocean{position:absolute;inset:0;z-index:-4;background:linear-gradient(120deg,#051a4d66,#0c3f9955 45%,#041530e8 74%),url('/art/water-surface.webp') center/cover;filter:saturate(.65)}
.auth-grain{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:.11;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%23fff' filter='url(%23n)' opacity='.6' d='M0 0h180v180H0z'/%3E%3C/svg%3E")}
.auth-brand{position:absolute;z-index:6;left:4.5%;top:35px;font:italic 900 43px/.85 var(--font-display);color:#f3f9f2;letter-spacing:-.03em}.auth-brand span{font:11px/1.5 var(--font);letter-spacing:.12em;display:block;margin-top:12px;color:#c2e2e9}
.auth-edition{position:absolute;right:4%;top:40px;font:600 12px var(--font-display);letter-spacing:.16em;color:#9ebfce;z-index:4}
.auth-illustration{position:relative;min-height:max(688px,calc(100dvh - 72px));overflow:hidden;perspective:1200px}
.auth-art-type{position:absolute;top:22%;left:7%;z-index:1;font:italic 900 clamp(95px,11.6vw,200px)/.78 var(--font-display);letter-spacing:-.045em;color:#eff9ee;transform:rotate(-11deg);pointer-events:none;animation:type-cut .95s cubic-bezier(.16,1,.3,1) both}
.auth-art-type span{display:block;white-space:nowrap}.auth-art-type span:last-child{font-size:.69em;margin-top:16px;color:#80e8ee;text-shadow:5px 5px #0a36ac}
.auth-orbit{position:absolute;left:-11%;top:8%;width:110%;aspect-ratio:1;border:1px solid #b0f7ff55;border-radius:50%;transform:rotateX(27deg) rotateZ(-25deg);animation:orbit-in 1.4s cubic-bezier(.16,1,.3,1) both}.auth-orbit:before,.auth-orbit:after{content:'';position:absolute;border-radius:50%;inset:7%;border:1px dashed #92c9e756}.auth-orbit:after{inset:20%;border:36px solid #123fc04a}.auth-orbit i{position:absolute;inset:15%;border:1px solid #72daff55;transform:rotate(30deg)}.auth-orbit i:nth-child(2){transform:rotate(60deg)}.auth-orbit i:nth-child(3){transform:rotate(90deg)}
.auth-shards{position:absolute;inset:0;transform:translate3d(var(--look-x),var(--look-y),0);transition:transform .5s ease-out;pointer-events:none}
.auth-shard{position:absolute;background:url('/art/water-surface.webp') center/cover;box-shadow:inset 0 0 70px #95f9ffaa;animation:shard-cut 1.25s cubic-bezier(.16,1,.3,1) both}
.shard-one{width:57%;height:52%;top:33%;left:25%;clip-path:polygon(12% 0,100% 11%,68% 100%,0 71%);transform:rotate(-13deg);filter:saturate(.55) brightness(1.2)}
.shard-two{width:28%;height:39%;top:38%;left:3%;clip-path:polygon(0 0,100% 16%,80% 100%,30% 80%);transform:rotate(8deg);filter:brightness(.55);animation-delay:.12s}
.shard-three{width:20%;height:26%;top:52%;right:3%;clip-path:polygon(0 18%,100% 0,43% 100%);transform:rotate(16deg);background:#8fe3ea;mix-blend-mode:screen;animation-delay:.2s}
.auth-spark{position:absolute;right:9%;top:35%;font:130px/1 serif;color:#ef4d8a;transform:rotate(-15deg);animation:spark-in 1s .25s both}
.auth-streak{position:absolute;left:0;top:62%;width:103%;height:9%;background:#1758ee;clip-path:polygon(0 62%,100% 0,88% 34%,0 100%);transform:rotate(-16deg);animation:streak-in .85s .2s both}
.auth-ticket{position:absolute;z-index:2;left:37%;top:47%;width:210px;padding:23px 26px 19px;background:#e8eee4;color:#17344a;transform:rotate(-12deg);box-shadow:9px 10px 0 #051b5080;animation:ticket-in 1.15s .18s both}.auth-ticket:before{content:'';position:absolute;left:25%;top:-11px;width:90px;height:23px;background:#7fdae5a6;transform:rotate(5deg)}.auth-ticket>span{font:italic 800 18px var(--font-display)}.auth-ticket b{display:block;font-size:29px;line-height:1.4;margin:12px 0}.auth-ticket small{font:italic 13px Georgia,serif}
.auth-art-copy{position:absolute;left:8%;bottom:9%;display:flex;gap:18px;align-items:flex-start;z-index:3}.auth-copy-mark{font:90px/.8 var(--font-display);color:#8ce8e6}.auth-art-copy h2{font-size:24px;line-height:1.55;font-weight:800;letter-spacing:.03em}.auth-art-copy p{font-size:11px;color:#b3cfdf;margin-top:12px}
.auth-container{position:relative;isolation:isolate;display:flex;align-items:center;justify-content:center;padding:130px clamp(35px,5vw,90px) 110px 40px;min-width:0;animation:form-cut .85s .18s both}.auth-container:before{content:'';position:absolute;inset:13% 0 7% -9%;z-index:-2;background:#06152eea;clip-path:polygon(14% 0,100% 5%,100% 100%,0 93%)}.auth-container:after{content:'';position:absolute;inset:14% 0 6% -10%;z-index:-3;background:#71d8e0;clip-path:polygon(14% 0,18% 0,4% 93%,100% 99%,100% 100%,0 94%)}.auth-form-slice{position:absolute;right:0;top:16%;width:75px;height:75px;background:#1755e9;clip-path:polygon(100% 0,100% 100%,0 78%)}
.auth-bottom{position:relative;grid-column:1/-1;margin:0 4% 0 4.5%;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #90bbd34a;padding:16px 0 25px;font:12px var(--font-display);letter-spacing:.1em;color:#a9c6d4}.auth-bottom span:nth-child(2){font:10px var(--font);letter-spacing:.08em}.auth-bottom span:last-child{font-size:23px;color:#7de8ed}
@keyframes type-cut{from{opacity:0;translate:-130px 60px;filter:blur(8px)}to{opacity:1;translate:0 0;filter:blur(0)}}
@keyframes shard-cut{from{opacity:0;translate:160px -160px;scale:.4;rotate:32deg}to{opacity:1;translate:0 0;scale:1;rotate:0deg}}
@keyframes orbit-in{from{opacity:0;rotate:-65deg;scale:1.6}to{opacity:1;rotate:0deg;scale:1}}
@keyframes spark-in{from{opacity:0;scale:0;rotate:-150deg}70%{opacity:1;scale:1.2}to{scale:1;rotate:0deg}}
@keyframes streak-in{from{scale:0 1;translate:-100px 0}to{scale:1;translate:0 0}}
@keyframes ticket-in{from{opacity:0;translate:90px 100px;rotate:30deg}70%{opacity:1;translate:-5px -8px;rotate:-5deg}to{translate:0 0;rotate:0deg}}
@keyframes form-cut{from{opacity:0;translate:100px 20px;rotate:4deg}to{opacity:1;translate:0 0;rotate:0deg}}
@media(min-width:1600px){.auth-illustration{min-height:max(850px,calc(100dvh - 72px))}.auth-ticket{width:250px;top:44%}.auth-ticket b{font-size:36px}}
@media(max-width:1000px){.auth-layout{grid-template-columns:1fr 1fr}.auth-art-type{font-size:12vw}.auth-ticket{left:30%;width:175px;padding:18px}.auth-ticket b{font-size:24px}.auth-container{padding-inline:30px}.auth-art-copy{left:6%}.auth-art-copy h2{font-size:20px}.auth-copy-mark{font-size:60px}}
@media(max-width:699px){.auth-layout{display:block;height:100dvh}.auth-brand{top:24px;left:24px;font-size:32px}.auth-brand span{font-size:9px;margin-top:8px}.auth-edition{font-size:9px;top:30px;right:22px;max-width:95px;text-align:right}.auth-illustration{min-height:315px;height:315px}.auth-art-type{top:35%;left:7%;font-size:84px}.auth-ticket{width:133px;left:auto;right:9%;top:45%;padding:13px;transform:rotate(10deg)}.auth-ticket b{font-size:20px;margin:6px 0}.auth-ticket>span{font-size:13px}.auth-ticket small{font-size:9px}.auth-ticket:before{width:64px}.auth-art-copy{display:none}.auth-orbit{width:92%;top:-30%;left:10%}.auth-spark{font-size:70px;top:25%;right:20%}.auth-container{padding:32px 34px 45px}.auth-container:before{inset:-12px 13px 0;clip-path:polygon(3% 0,100% 3%,97% 100%,0 97%)}.auth-container:after{inset:-15px 10px -3px;clip-path:polygon(3% 0,5% 0,2% 97%,98% 99%,97% 100%,0 97%)}.auth-form-slice{width:40px;height:40px;top:0;right:14px}.auth-bottom{position:relative;top:auto;left:auto;right:auto;bottom:auto;margin:25px 23px 0;padding:15px 0 25px}.auth-bottom span:nth-child(2){display:none}}
@media(prefers-reduced-motion:reduce){.auth-layout *{animation:none!important;transition:none!important}.auth-shards{transform:none}}
</style>
