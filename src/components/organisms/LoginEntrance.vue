<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { gsap, prefersReducedMotion } from '@/motion/core'
import { entranceGeometry, entranceLayers } from '@/motion/loginEntrance'

const props = defineProps({ scene: { type: Object, default: null } })
const emit = defineEmits(['active'])
const active = ref(false)
const stage = ref(null)
const skipButton = ref(null)
const phase = ref('cover')
const viewport = ref({ width: 1, height: 1 })
const maskId = `entry-mask-${useId().replace(/:/g, '')}`
let operation = null
let media

function skip() {
  if (!operation) return
  operation.skip = true
  // Completing each owned animation also releases its awaiting promise.
  operation.timelines.forEach(timeline => timeline.progress(1))
  operation.animations.forEach(animation => animation.finish())
}

function timeline(run, populate) {
  if (run.skip || run.disposed) return Promise.resolve()
  return new Promise(resolve => {
    const animation = gsap.timeline({ onComplete: () => { run.timelines.delete(animation); resolve() } })
    run.timelines.add(animation)
    populate(animation)
  })
}

function waitForPage(run) {
  if (props.scene?.querySelector('[data-entry-ready="true"] .page')) return Promise.resolve()
  return new Promise(resolve => {
    let timer
    const observer = new MutationObserver(() => {
      if (props.scene?.querySelector('[data-entry-ready="true"] .page')) finish()
    })
    const finish = () => { clearTimeout(timer); observer.disconnect(); run.releaseWait = null; resolve() }
    run.releaseWait = finish
    observer.observe(props.scene, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-entry-ready'] })
    // Missing/failed async views must never leave a blocking curtain behind.
    timer = setTimeout(finish, 5000)
  })
}

async function reveal(run) {
  if (run.skip || run.disposed || !props.scene) return
  const { width, height } = viewport.value
  const { x, y, radius } = entranceGeometry(width, height)
  // Let pages retain their own scrolling once the shot has finished.
  props.scene.querySelectorAll('.presentation-layout,.page-content').forEach(element => {
    const previous = element.style.overflow
    element.style.overflow = 'visible'
    run.restore.push(() => { element.style.overflow = previous })
  })
  const layers = entranceLayers(props.scene, width, height)
  phase.value = 'reveal'
  const flights = layers.map((element, index) => {
    const rect = element.getBoundingClientRect()
    const original = getComputedStyle(element).transform
    const base = original === 'none' ? '' : original
    const dx = width * .54 - (rect.left + rect.width / 2) + (index % 3 - 1) * 38
    const dy = height * .5 - (rect.top + rect.height / 2) + (index % 4 - 1.5) * 25
    const angle = -19 + index * 4
    const stack = `translate(${dx}px,${dy}px) perspective(1100px) rotateY(-17deg) rotateX(13deg) rotate(${angle}deg) scale(.58) ${base}`
    const animation = element.animate([
      { opacity: 0, transform: `translate(${dx - width * .2}px,${dy + height * .28}px) perspective(1100px) rotateY(38deg) rotate(-32deg) scale(.28) ${base}`, offset: 0, easing: 'cubic-bezier(.16,1,.3,1)' },
      { opacity: .96, transform: stack, offset: .3 },
      { opacity: 1, transform: stack, offset: .46, easing: 'cubic-bezier(.16,1,.3,1)' },
      { opacity: 1, transform: original, offset: 1 },
    ], { duration: 2400, delay: 180 + index * 125, easing: 'linear', fill: 'both' })
    run.animations.add(animation)
    return animation.finished.catch(() => {}).finally(() => { animation.cancel(); run.animations.delete(animation) })
  })
  await Promise.all([
    ...flights,
    timeline(run, tl => tl
      .set(stage.value.querySelector('.entry-reveal-ring'), { attr: { cx: x, cy: y, r: 0 }, opacity: 1 })
      .to(stage.value.querySelector('.entry-aperture'), { attr: { r: radius }, duration: 1.8, ease: 'power2.inOut' }, 0)
      .to(stage.value.querySelector('.entry-reveal-ring'), { attr: { r: radius }, duration: 1.8, ease: 'power2.inOut' }, 0)
      .to(stage.value.querySelector('.entry-title'), { y: -70, rotation: 8, opacity: 0, duration: .75, ease: 'power2.in' }, .15)
      .to(stage.value.querySelector('.entry-reveal-ring'), { opacity: 0, duration: .6 }, 1.15)),
  ])
}

async function enter(navigate) {
  if (operation) return operation.promise
  if (prefersReducedMotion() || document.hidden) return navigate()
  const run = { skip: false, disposed: false, timelines: new Set(), animations: new Set(), restore: [], releaseWait: null }
  operation = run
  run.promise = (async () => {
    const previousFocus = document.activeElement
    let navigated = false
    try {
      viewport.value = { width: window.innerWidth, height: window.innerHeight }
      const { radius } = entranceGeometry(viewport.value.width, viewport.value.height)
      phase.value = 'cover'
      active.value = true
      emit('active', true)
      await nextTick()
      skipButton.value?.focus({ preventScroll: true })
      const root = stage.value
      await timeline(run, tl => tl
        .fromTo(root.querySelector('.entry-wave-halo'), { attr: { r: 0 } }, { attr: { r: radius * 1.06 }, duration: 1.7, ease: 'power3.inOut' }, 0)
        .fromTo(root.querySelector('.entry-wave-fill'), { attr: { r: 0 } }, { attr: { r: radius }, duration: 1.55, ease: 'power3.inOut' }, .12)
        .fromTo(root.querySelector('.entry-wave-line'), { attr: { r: 0 }, opacity: 1 }, { attr: { r: radius * .88 }, duration: 1.8, ease: 'power2.inOut' }, .12)
        .fromTo(root.querySelector('.entry-title'), { opacity: 0, x: -100, y: 90, rotation: -16, scale: .65 }, { opacity: 1, x: 0, y: 0, rotation: -8, scale: 1, duration: .95, ease: 'back.out(1.1)' }, .6))
      // Navigation happens only after the login is successful and fully covered.
      if (run.disposed) return
      const failure = await navigate()
      if (failure) throw new Error('暂时没能打开页面，请重试。')
      navigated = true
      await nextTick()
      if (!run.disposed) await waitForPage(run)
      // Existing page entrance finishes behind the blue curtain, never competing.
      await timeline(run, tl => tl.to({}, { duration: .65 }))
      await reveal(run)
    } finally {
      run.timelines.forEach(tl => tl.kill())
      run.animations.forEach(animation => animation.cancel())
      run.releaseWait?.()
      run.restore.reverse().forEach(restore => restore())
      active.value = false
      emit('active', false)
      operation = null
      await nextTick()
      const target = navigated ? props.scene?.querySelector('.page h1,.masthead h1,.main button,.sidebar a') : previousFocus
      if (target?.isConnected) {
        const tabindex = target.getAttribute('tabindex')
        target.setAttribute('tabindex', '-1')
        target.focus({ preventScroll: true })
        if (tabindex === null) target.removeAttribute('tabindex')
        else target.setAttribute('tabindex', tabindex)
      }
    }
  })()
  return run.promise
}

const onKey = event => { if (active.value && event.key === 'Escape') { event.preventDefault(); skip() } }
const onHidden = () => { if (document.hidden) skip() }
const onPreference = event => { if (event.matches) skip() }
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', onPreference)
  window.addEventListener('resize', skip)
  document.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onHidden)
})
onBeforeUnmount(() => {
  if (operation) { operation.disposed = true; skip(); operation.releaseWait?.() }
  media?.removeEventListener('change', onPreference)
  window.removeEventListener('resize', skip)
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onHidden)
})
defineExpose({ enter })
</script>

<template>
  <Teleport to="body">
    <div v-if="active" ref="stage" class="login-entrance" :data-phase="phase">
      <svg class="entry-waves" :viewBox="`0 0 ${viewport.width} ${viewport.height}`" preserveAspectRatio="none" aria-hidden="true">
        <defs><mask :id="maskId"><rect width="100%" height="100%" fill="white" /><circle class="entry-aperture" :cx="viewport.width * .08" :cy="viewport.height * .92" r="0" fill="black" /></mask></defs>
        <g :mask="`url(#${maskId})`">
          <circle class="entry-wave-halo" :cx="viewport.width * .08" :cy="viewport.height * .92" r="0" fill="#69e4ed" />
          <circle class="entry-wave-fill" :cx="viewport.width * .08" :cy="viewport.height * .92" r="0" fill="#1246d2" />
          <circle class="entry-wave-line" :cx="viewport.width * .08" :cy="viewport.height * .92" r="0" fill="none" stroke="#99f5f0" stroke-width="2" stroke-dasharray="180 16 4 16" />
        </g>
        <circle class="entry-reveal-ring" r="0" fill="none" stroke="#8ef4ee" stroke-width="18" opacity="0" />
      </svg>
      <div class="entry-title" aria-hidden="true"><span>BACK TO</span><strong>MY DAYS.</strong><small>日常的碎片，正在显影。</small><i>✦</i></div>
      <span class="entry-status" role="status">{{ phase === 'cover' ? '正在进入我的日常…' : '欢迎回来。' }}</span>
      <button ref="skipButton" type="button" class="entry-skip" @click="skip">跳过动画 <span aria-hidden="true">↗</span></button>
    </div>
  </Teleport>
</template>

<style scoped>
.login-entrance{position:fixed;inset:0;z-index:500;overflow:hidden;isolation:isolate;touch-action:none}
.entry-waves{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.entry-title{position:absolute;left:33%;top:27%;color:#f3faee;transform-origin:left bottom;pointer-events:none;will-change:transform,opacity}
.entry-title>span{display:block;font:italic 900 clamp(35px,6vw,100px)/.85 var(--font-display);letter-spacing:-.03em;color:#93eeeb}
.entry-title strong{display:block;white-space:nowrap;font:italic 900 clamp(65px,12vw,190px)/.9 var(--font-display);letter-spacing:-.045em;text-shadow:8px 10px 0 #072d92;margin-top:10px}
.entry-title small{display:block;margin:24px 0 0 12px;font:13px var(--font);letter-spacing:.2em;color:#c7eef0}
.entry-title i{position:absolute;right:-70px;top:-60px;font:normal 140px/1 serif;color:#f16b9b;transform:rotate(17deg)}
.entry-status{position:absolute;bottom:30px;left:32px;font-size:11px;letter-spacing:.08em;color:#effbff;padding:7px 12px;background:#082e6bcc}
.entry-skip{position:absolute;right:30px;bottom:25px;min-height:42px;padding:10px 16px;border:1px solid #aad8eb80;background:#082e6bcc;color:#effbff;font-size:12px;cursor:pointer}.entry-skip span{margin-left:16px;color:#8ce9ec}.entry-skip:hover{background:#12458d}.entry-skip:focus-visible{outline:3px solid #f7a9c5;outline-offset:4px}
@media(max-width:699px){.entry-title{left:14%;top:34%}.entry-title strong{font-size:20vw}.entry-title>span{font-size:10vw}.entry-title small{font-size:10px;margin-top:20px}.entry-title i{font-size:80px;right:-17px;top:-55px}.entry-status{left:15px;bottom:25px;font-size:10px}.entry-skip{right:15px;bottom:20px;font-size:11px}}
</style>
