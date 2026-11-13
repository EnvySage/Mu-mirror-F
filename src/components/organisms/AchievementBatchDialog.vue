<script setup>
import { computed, ref } from 'vue'
import AchievementMedal from '@/components/molecules/AchievementMedal.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'

const props = defineProps({ awards: { type: Array, default: () => [] } })
const emit = defineEmits(['close'])
const dialog = ref(null)
const columns = computed(() => Math.min(3, props.awards.length))
const hasPlating = computed(() => props.awards.some(item => item.notification.kind === 'plated'))
useDialogFocus(() => props.awards.length > 0, dialog, '.batch-accept', () => emit('close'))
</script>

<template>
  <Teleport to="body">
    <Transition name="batch-reveal">
      <div v-if="awards.length" class="batch-overlay" @click.self="emit('close')">
        <section ref="dialog" class="batch-dialog" :style="{ '--award-columns': columns, '--award-width': `${columns * 192 + 64}px` }" role="dialog" aria-modal="true" aria-labelledby="batch-heading" aria-describedby="batch-description" tabindex="-1">
          <header class="batch-header">
            <div><span class="batch-kicker">ACHIEVEMENTS UNLOCKED</span><h2 id="batch-heading">{{ hasPlating ? '收获了' : '解锁了' }} {{ awards.length }} 项{{ hasPlating ? '成就与镀层' : '成就' }}</h2></div>
            <button type="button" class="batch-close" aria-label="关闭本批成就通知" @click="emit('close')">×</button>
          </header>
          <p id="batch-description" class="batch-description">这些日常里的进展，值得一起记住。</p>
          <ul class="batch-grid" aria-label="本次获得的成就">
            <li v-for="item in awards" :key="item.key" class="batch-card" :data-notification-key="item.key" :style="{ '--award-ink': item.medal.group.ink }">
              <div class="batch-card-top"><span>{{ item.medal.code }}</span><span :class="{ plated: item.notification.kind === 'plated' }">{{ item.notification.kind === 'plated' ? '镜闪镀层' : '新成就' }}</span></div>
              <div class="batch-art"><AchievementMedal :medal="item.medal" preview eager /></div>
              <span class="batch-group">{{ item.medal.group.label }}</span>
              <h3>{{ item.medal.name }}</h3>
              <p>{{ item.notification.kind === 'plated' ? '镜闪镀层已点亮，为这枚成就留下新的光泽。' : item.medal.condition }}</p>
            </li>
          </ul>
          <footer class="batch-footer"><span>已存入成就图鉴</span><button type="button" class="batch-accept" @click="emit('close')">全部收下 · {{ awards.length }} 项 ↗</button></footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.batch-overlay{position:fixed;inset:0;z-index:1130;display:grid;place-items:center;padding:16px;background:#020817c9;backdrop-filter:blur(8px)}
.batch-dialog{display:flex;flex-direction:column;min-width:0;width:min(100%,var(--award-width));max-height:calc(100dvh - 32px);overflow:hidden;background:linear-gradient(135deg,#143762,#0b1c39);color:#eef7ff;border:1px solid #79b9d877;border-top:3px solid #70eced;box-shadow:7px 8px #04112b99;outline:none}
.batch-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px 8px;flex:none}.batch-kicker{font:700 10px var(--font-display);letter-spacing:.15em;color:#82d7e6}.batch-header h2{font-size:21px;line-height:1.4;margin-top:3px}.batch-close{flex:none;width:44px;height:44px;color:#d0e6f5;font-size:26px;background:#06152e70}
.batch-description{flex:none;margin:0;padding:0 20px 16px;font-size:12px;line-height:1.6;color:#abc6da}
.batch-grid{display:grid;grid-template-columns:repeat(var(--award-columns),minmax(0,1fr));gap:12px;min-height:0;overflow-y:auto;overscroll-behavior:contain;list-style:none;padding:0 20px 20px;margin:0}
.batch-card{min-width:0;padding:10px 11px 13px;background:#0619328c;border:1px solid #729bb53b;border-top:2px solid var(--award-ink)}.batch-card-top{display:flex;justify-content:space-between;align-items:center;gap:5px;font:600 10px var(--font-display);color:#9abbd2}.batch-card-top span:last-child{color:#93efed}.batch-card-top .plated{color:#eaff8a!important}
.batch-art{width:104px;max-width:100%;aspect-ratio:1;margin:12px auto 8px}.batch-group{font-size:10px;color:#a9c7dc}.batch-card h3{margin:4px 0 7px;font-size:14px;line-height:1.5;overflow-wrap:anywhere}.batch-card p{margin:0;font-size:12px;line-height:1.6;color:#b7cede;overflow-wrap:anywhere}
.batch-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none;padding:12px 20px;border-top:1px solid #7195b33b;background:#06162a55}.batch-footer>span{font-size:11px;color:#9bb8ce}.batch-accept{min-height:44px;padding:9px 16px;background:#b8f4ed;color:#12314b;font-size:13px;font-weight:700}.batch-close:focus-visible,.batch-accept:focus-visible{outline:3px solid #f34b96;outline-offset:3px}
.batch-reveal-enter-active,.batch-reveal-leave-active{transition:opacity .18s}.batch-reveal-enter-active .batch-dialog{animation:batch-in .24s ease-out}.batch-reveal-enter-from,.batch-reveal-leave-to{opacity:0}
@keyframes batch-in{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
@media(max-width:520px){.batch-overlay{padding:10px}.batch-dialog{max-height:calc(100dvh - 20px)}.batch-header{padding:12px 12px 6px}.batch-header h2{font-size:18px}.batch-description{padding:0 12px 12px}.batch-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:0 12px 12px}.batch-card{padding:9px}.batch-art{width:88px}.batch-footer{padding:10px 12px}.batch-footer>span{font-size:10px}.batch-accept{padding:9px 12px}}
@media(prefers-reduced-motion:reduce){.batch-reveal-enter-active,.batch-reveal-leave-active{transition:none}.batch-reveal-enter-active .batch-dialog{animation:none}}
</style>
